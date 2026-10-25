const COOKIE='kana_session';
export function cookieKey(request){return request.headers.get('Cookie')?.split(';').map(p=>p.trim()).find(p=>p.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';}
export function accessHeaders(){return {'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','X-Robots-Tag':'noindex, nofollow'};}
export function loginPage(message='',status=200){
 const body=`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Кана — вход</title><style>body{margin:0;background:#f6f5ef;color:#2e352b;font:16px/1.5 system-ui,sans-serif;display:grid;min-height:100svh;place-items:center}main{width:min(380px,calc(100% - 48px));padding:30px 0}h1{font-size:28px;margin:0 0 8px}p{color:#69735e}label{display:block;margin:28px 0 8px}input,button{box-sizing:border-box;width:100%;font:inherit;border-radius:12px;padding:15px}input{background:#fffefa;border:1px solid #cdd5c3}button{margin-top:16px;border:0;background:#e77650;color:white;font-weight:600;cursor:pointer}.error{color:#9a402b}small{display:block;margin-top:20px;color:#69735e}a{color:inherit}</style><main><h1>Кана</h1><p>Хирагана и Genki 1</p><form action="/auth/login" method="post"><label for="key">Ключ доступа</label><input id="key" name="key" type="password" autocomplete="current-password" required minlength="32" maxlength="128" spellcheck="false" autocapitalize="none"><small>Тот же ключ, что для синхронизации.</small>${message?`<p class="error" role="alert">${message}</p>`:''}<button type="submit">Войти</button></form><small>Прогресс сохраняется в облако автоматически.</small></main></html>`;
 return new Response(body,{status,headers:{...accessHeaders(),'Content-Type':'text/html; charset=utf-8','X-Kana-Locked':'1','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});
}
async function loginKey(request){
 if(Number(request.headers.get('Content-Length')||0)>2048)throw new Error('large');
 const reader=request.body?.getReader();if(!reader)return '';let body='',size=0;const decoder=new TextDecoder();
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();throw new Error('large');}body+=decoder.decode(value,{stream:true});}body+=decoder.decode();
 return (request.headers.get('Content-Type')||'').startsWith('application/json')?JSON.parse(body).key:new URLSearchParams(body).get('key');
}
export async function handleAccess(request,env,verify){
 const url=new URL(request.url),path=url.pathname;
 if(path==='/auth/login'&&request.method==='POST'){
  let key;try{key=String(await loginKey(request)||'').trim();}catch{return loginPage('Не удалось прочитать ключ.',400);}
  if(!await verify(key,env.SYNC_KEY_HASH))return loginPage('Ключ не подходит. Проверь его и попробуй ещё раз.',401);
  return new Response(null,{status:303,headers:{...accessHeaders(),Location:'/', 'Set-Cookie':`${COOKIE}=${key}; Path=/; HttpOnly; SameSite=Lax; Max-Age=15552000${url.protocol==='https:'?'; Secure':''}`}});
 }
 if(path==='/auth/logout'&&request.method==='POST'){
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return new Response('Forbidden',{status:403,headers:accessHeaders()});
  return new Response(null,{status:303,headers:{...accessHeaders(),Location:'/', 'Set-Cookie':`${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${url.protocol==='https:'?'; Secure':''}`,'Clear-Site-Data':'"cache"'}});
 }
 return null;
}

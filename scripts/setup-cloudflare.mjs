import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const local=process.argv.includes('--local');
const wrangler=path.join(root,'node_modules/wrangler/bin/wrangler.js');
const baseConfig=path.join(root,'worker/wrangler.jsonc');
const privateDir=path.join(root,'.local'),keyPath=path.join(privateDir,'sync-key.txt');
await mkdir(privateDir,{recursive:true,mode:0o700});await chmod(privateDir,0o700);
let key;try{key=(await readFile(keyPath,'utf8')).trim();}catch{key=randomBytes(32).toString('base64url');await writeFile(keyPath,key+'\n',{mode:0o600});}
if(!/^[A-Za-z0-9_-]{43}$/.test(key))throw new Error('Invalid local sync key. Restore .local/sync-key.txt; do not overwrite an existing key.');
await chmod(keyPath,0o600);
const hash=createHash('sha256').update(key).digest('hex');
await writeFile(path.join(root,'worker/.dev.vars'),`SYNC_KEY_HASH="${hash}"\n`,{mode:0o600});

function run(args,{input='',extraEnv={}}={}){
 return new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,[wrangler,...args],{cwd:root,env:{...process.env,CI:'1',WRANGLER_SEND_METRICS:'false',...extraEnv},stdio:['pipe','pipe','pipe']});
   let stdout='',stderr='';child.stdout.on('data',b=>{stdout+=b;});child.stderr.on('data',b=>{stderr+=b;});child.on('error',reject);
   child.on('close',code=>{if(code===0)resolve(stdout);else reject(new Error((stderr||stdout||`Wrangler exited ${code}`).split(key).join('[redacted]').split(hash).join('[redacted]').slice(-5000)));});child.stdin.end(input);
 });
}
if(local){
 console.log('Applying local D1 migration.');
 await run(['d1','migrations','apply','DB','--local','--config',baseConfig]);
 await writeFile(path.join(privateDir,'connection.local.json'),JSON.stringify({endpoint:'http://localhost:8787',key},null,2)+'\n',{mode:0o600});
 console.log('Local D1 ready. Key: .local/sync-key.txt. Start npm run worker:dev.');
 process.exit(0);
}

console.log('Checking Cloudflare account.');
let identity;try{identity=JSON.parse(await run(['whoami','--json']));}catch{throw new Error('Cloudflare login required. Run npx wrangler login, then npm run cloudflare:setup.');}
if(!identity.loggedIn)throw new Error('Cloudflare login required. Run npx wrangler login, then npm run cloudflare:setup.');
const accounts=identity.accounts||[];
const accountId=process.env.CLOUDFLARE_ACCOUNT_ID||(accounts.length===1?accounts[0].id:null);
if(!accountId)throw new Error('Choose CLOUDFLARE_ACCOUNT_ID from wrangler whoami before deployment.');
const env={CLOUDFLARE_ACCOUNT_ID:accountId};
let databases=JSON.parse(await run(['d1','list','--json'],{extraEnv:env}));
let database=databases.find(d=>d.name==='jap-learn-progress');
if(!database){console.log('Creating D1 database jap-learn-progress.');await run(['d1','create','jap-learn-progress','--config',baseConfig],{extraEnv:env});databases=JSON.parse(await run(['d1','list','--json'],{extraEnv:env}));database=databases.find(d=>d.name==='jap-learn-progress');}
const databaseId=database?.uuid||database?.id;if(!databaseId)throw new Error('Cloudflare did not return the D1 database ID.');
const config=JSON.parse(await readFile(baseConfig,'utf8'));config.account_id=accountId;config.d1_databases[0].database_id=databaseId;
const generatedConfig=path.join(root,'worker/wrangler.generated.json');
await writeFile(generatedConfig,JSON.stringify(config,null,2)+'\n');
console.log('Applying remote D1 migration.');await run(['d1','migrations','apply','DB','--remote','--config',generatedConfig],{extraEnv:env});
console.log('Deploying Worker.');
const output=await run(['deploy','--config',generatedConfig],{extraEnv:env});
const endpoint=output.match(/https:\/\/jap-learn-sync\.[a-z0-9-]+\.workers\.dev\b/)?.[0];
if(!endpoint)throw new Error('Worker URL not found in deployment output. Check wrangler deployments and account workers.dev subdomain.');
await writeFile(path.join(privateDir,'worker-endpoint.txt'),endpoint+'\n');
console.log(JSON.stringify({stage:'deployed',endpoint}));
async function readHealth(requireReady=false){
 let failure;for(const delay of [0,2000,5000,10000]){if(delay)await new Promise(r=>setTimeout(r,delay));try{const response=await fetch(endpoint+'/health');if(!response.ok)throw new Error(`Health HTTP ${response.status}`);const health=await response.json();if(requireReady&&!health.ok)throw new Error('Worker deployment is still propagating.');return health;}catch(e){failure=e;}}
 throw new Error(`Cannot reach ${endpoint}/health: ${failure.cause?.code||failure.message}`);
}
let health=await readHealth();
if(health.service!=='kana-sync')throw new Error('Unexpected Worker at deployment URL.');
if(health.ok){
 const response=await fetch(endpoint+'/v1/heads',{headers:{Authorization:`Bearer ${key}`}});
 if(response.status===401)throw new Error('This Worker uses another key. Restore its existing key in .local/sync-key.txt; the server key was not changed.');
 if(!response.ok)throw new Error('Existing Worker failed the authenticated health check.');
}else{
 console.log('Configuring synchronization key hash.');await run(['secret','put','SYNC_KEY_HASH','--config',generatedConfig],{input:hash+'\n',extraEnv:env});
}
health=await readHealth(true);
const response=await fetch(endpoint+'/v1/heads',{headers:{Authorization:`Bearer ${key}`}});if(!response.ok)throw new Error('Authenticated D1 read failed.');
const unauthorized=await fetch(endpoint+'/v1/heads');if(unauthorized.status!==401)throw new Error('Worker authentication check failed.');
await writeFile(path.join(privateDir,'cloudflare-connection.json'),JSON.stringify({endpoint,key},null,2)+'\n',{mode:0o600});
await writeFile(path.join(root,'dist/config.mjs'),`// Public Worker URL. The synchronization key is never published.\nexport const CLOUDFLARE_SYNC_URL = ${JSON.stringify(endpoint)};\n`);
console.log(JSON.stringify({ready:true,endpoint,key_file:'.local/sync-key.txt',connection_file:'.local/cloudflare-connection.json'}));

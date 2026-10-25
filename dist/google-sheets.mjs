import {SYNC_HEADERS,findHeads,parseHeader,parseRecord,recordRow} from './sync-core.mjs';

const DRIVE='https://www.googleapis.com/drive/v3';
const SHEETS='https://sheets.googleapis.com/v4/spreadsheets';
const TAB='Сохранения';
const range=address=>encodeURIComponent(`'${TAB}'!${address}`);
export class GoogleAPIError extends Error{constructor(message,status){super(message);this.status=status;}}
export class SheetsStore{
 constructor(token,{fetcher=fetch}={}){this.token=token;this.fetcher=fetcher;this.id=null;this.url=null;}
 async request(url,{method='GET',body}={}){
   let response;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
   try{response=await this.fetcher(url,{method,headers:{Authorization:`Bearer ${this.token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});}
   catch(error){throw new GoogleAPIError(error.name==='AbortError'?'Google не ответил вовремя. Прогресс сохранён локально.':'Нет соединения с Google. Прогресс сохранён локально.',0);}
   finally{clearTimeout(timer);}
   const result=await response.json().catch(()=>({}));
   if(!response.ok){
     const messages={401:'Сеанс Google истёк. Подключись повторно.',403:'Google отклонил доступ. Проверь включение Sheets API, Drive API и разрешение drive.file.',404:'Таблица недоступна. Проверь, что вошёл в нужный аккаунт.',429:'Лимит запросов Google. Повтори синхронизацию позже.'};
     throw new GoogleAPIError(messages[response.status]||'Не удалось сохранить данные в Google Sheets.',response.status);
   }
   return result;
 }
 async open(){
   const q="trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet' and appProperties has { key='kanaProgress' and value='v1' }";
   const found=await this.request(`${DRIVE}/files?${new URLSearchParams({q,fields:'files(id,name,createdTime,appProperties)',orderBy:'createdTime',pageSize:'100'})}`);
   let created=false;
   if(found.files?.length){this.id=found.files[0].id;created=found.files[0].appProperties?.kanaSchema!=='ready';}
   else{
     const file=await this.request(`${DRIVE}/files?fields=id`,{method:'POST',body:{name:'Кана — прогресс',mimeType:'application/vnd.google-apps.spreadsheet',appProperties:{kanaProgress:'v1',kanaSchema:'initializing'}}});
     if(!file.id)throw new Error('Google не вернул идентификатор таблицы.');this.id=file.id;created=true;
   }
   let metadata=await this.metadata();
   let sheet=metadata.sheets?.find(s=>s.properties.title===TAB);
   if(created){
     const first=sheet||metadata.sheets?.[0];
     await this.request(`${SHEETS}/${this.id}:batchUpdate`,{method:'POST',body:{requests:first?[{updateSheetProperties:{properties:{sheetId:first.properties.sheetId,title:TAB,gridProperties:{frozenRowCount:1}},fields:'title,gridProperties.frozenRowCount'}}]:[{addSheet:{properties:{title:TAB,gridProperties:{rowCount:1000,columnCount:5,frozenRowCount:1}}}}]}});
     const existing=await this.request(`${SHEETS}/${this.id}/values/${range('A1:E1')}`);
     if(existing.values?.[0]?.length&&JSON.stringify(existing.values[0])!==JSON.stringify(SYNC_HEADERS))throw new Error('В таблице уже есть данные другого формата.');
     if(!existing.values?.length)await this.request(`${SHEETS}/${this.id}/values/${range('A1:E1')}?valueInputOption=RAW`,{method:'PUT',body:{values:[SYNC_HEADERS]}});
     metadata=await this.metadata();sheet=metadata.sheets.find(s=>s.properties.title===TAB);
     if(sheet)await this.request(`${SHEETS}/${this.id}:batchUpdate`,{method:'POST',body:{requests:[{repeatCell:{range:{sheetId:sheet.properties.sheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:5},cell:{userEnteredFormat:{backgroundColor:{red:.91,green:.94,blue:.86},textFormat:{bold:true}}},fields:'userEnteredFormat'}},{updateDimensionProperties:{range:{sheetId:sheet.properties.sheetId,dimension:'COLUMNS',startIndex:0,endIndex:4},properties:{pixelSize:190},fields:'pixelSize'}},{updateDimensionProperties:{range:{sheetId:sheet.properties.sheetId,dimension:'COLUMNS',startIndex:4,endIndex:5},properties:{pixelSize:400},fields:'pixelSize'}}]}});
   }
   if(!sheet)throw new Error('В таблице отсутствует лист «Сохранения».');
   const header=await this.request(`${SHEETS}/${this.id}/values/${range('A1:E1')}`);
   if(JSON.stringify(header.values?.[0])!==JSON.stringify(SYNC_HEADERS))throw new Error('Заголовки таблицы изменены. Восстанови id, parents, device, saved_at, state_json.');
   if(created)await this.request(`${DRIVE}/files/${this.id}?fields=id`,{method:'PATCH',body:{appProperties:{kanaProgress:'v1',kanaSchema:'ready'}}});
   this.url=metadata.spreadsheetUrl;
   return {id:this.id,url:this.url};
 }
 async metadata(){return this.request(`${SHEETS}/${this.id}?fields=spreadsheetId,spreadsheetUrl,sheets(properties(sheetId,title,gridProperties(rowCount)))`);}
 async readHeads(){
   const metadata=await this.metadata(),sheet=metadata.sheets?.find(s=>s.properties.title===TAB);
   if(!sheet)throw new Error('Лист «Сохранения» удалён или переименован.');
   const rows=sheet.properties.gridProperties?.rowCount||1000;
   const result=await this.request(`${SHEETS}/${this.id}/values/${range(`A2:C${Math.max(2,rows)}`)}`);
   const headers=(result.values||[]).flatMap((row,i)=>row[0]?[parseHeader(row,i+2)]:[]),heads=findHeads(headers);
   if(heads.length>10)throw new Error('В таблице слишком много конфликтующих версий. Сначала выгрузи локальный прогресс в файл.');
   return Promise.all(heads.map(async h=>{
     const data=await this.request(`${SHEETS}/${this.id}/values/${range(`A${h.row}:E${h.row}`)}`);
     const record=parseRecord(data.values?.[0]||[]);if(record.id!==h.id)throw new Error('Таблица изменилась во время чтения. Повтори синхронизацию.');return record;
   }));
 }
 async append(record){
   const row=recordRow(record);
   const result=await this.request(`${SHEETS}/${this.id}/values/${range('A:E')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&includeValuesInResponse=true`,{method:'POST',body:{majorDimension:'ROWS',values:[row]}});
   const saved=result.updates?.updatedData?.values?.[0];
   if(!saved||saved[0]!==record.id||saved[4]!==row[4])throw new Error('Google не подтвердил запись. Повтори синхронизацию.');
   return record;
 }
}

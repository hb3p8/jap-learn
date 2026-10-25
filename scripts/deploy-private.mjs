import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync,spawn} from 'node:child_process';
execFileSync(process.execPath,['scripts/build-private.mjs'],{stdio:'inherit'});
const config=JSON.parse(await readFile('worker/wrangler.jsonc','utf8'));
let existing;try{existing=JSON.parse(await readFile('worker/wrangler.generated.json','utf8'));}catch{throw new Error('Run the Cloudflare setup first; existing database identity is required.');}
if(!existing.account_id||!existing.d1_databases?.[0]?.database_id)throw new Error('Existing Cloudflare account and database are required.');
config.account_id=existing.account_id;config.d1_databases[0].database_id=existing.d1_databases[0].database_id;
await writeFile('worker/wrangler.generated.json',JSON.stringify(config,null,2)+'\n');
const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--config','worker/wrangler.generated.json'],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});child.on('exit',code=>process.exit(code||0));

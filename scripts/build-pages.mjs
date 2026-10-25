import {mkdir,rm,copyFile} from 'node:fs/promises';
const output='.pages-build';await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
for(const file of ['index.html','migrate.mjs','sw.js'])await copyFile('pages/'+file,output+'/'+file);
for(const file of ['engine.mjs','content.mjs','genki-engine.mjs','genki-content.mjs','sync-core.mjs','cloudflare-store.mjs','cloud-sync.mjs','config.mjs'])await copyFile('dist/'+file,output+'/'+file);
console.log('GitHub Pages migration page prepared; app assets and recordings are excluded.');

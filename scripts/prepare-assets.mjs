import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

// Give every module in a deployment the same revision so a normal page reload
// cannot combine a new entry point with cached dependencies from an old release.
const revision=process.env.GITHUB_SHA?.trim();
if(!/^[a-f0-9]{7,64}$/.test(revision||''))throw new Error('GITHUB_SHA is required to version published assets.');
const directory=process.argv[2]?resolve(process.argv[2]):fileURLToPath(new URL('../dist/',import.meta.url));
for(const name of await readdir(directory)){
 if(!/\.(?:mjs|html)$/.test(name))continue;
 const path=join(directory,name),source=await readFile(path,'utf8');
 const updated=name.endsWith('.mjs')
  ?source.replace(/(\bfrom\s*['"])(\.\/[^'"]+\.mjs)(?:\?[^'"]*)?(['"])/g,`$1$2?v=${revision}$3`)
  :source.replace(/((?:src|href)=['"])((?:[a-zA-Z0-9-]+\.mjs|styles\.css))(?:\?[^'"]*)?(['"])/g,`$1$2?v=${revision}$3`);
 if(updated!==source)await writeFile(path,updated);
}
console.log(`Published assets versioned: ${revision.slice(0,7)}.`);

import {writeFile} from 'node:fs/promises';
import {CLOUDFLARE_SYNC_URL} from '../dist/config.mjs';
import {normalizeEndpoint} from '../dist/cloudflare-store.mjs';
const value=(process.env.CLOUDFLARE_SYNC_URL||CLOUDFLARE_SYNC_URL||'').trim();
const endpoint=value?normalizeEndpoint(value):'';
if(endpoint&&!endpoint.startsWith('https://'))throw new Error('Only HTTPS synchronization endpoints may be published.');
await writeFile(new URL('../dist/config.mjs',import.meta.url),`// Public Worker URL. The synchronization key is never published.\nexport const CLOUDFLARE_SYNC_URL = ${JSON.stringify(endpoint)};\nexport const PRIVATE_APP = false;\n`);
console.log(endpoint?'Cloudflare synchronization endpoint configured.':'Cloudflare endpoint not configured; local progress remains available.');

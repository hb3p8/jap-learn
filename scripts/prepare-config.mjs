import {writeFile} from 'node:fs/promises';
const value=(process.env.GOOGLE_CLIENT_ID||'').trim();
if(value&&!/^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(value))throw new Error('GOOGLE_CLIENT_ID must be an OAuth web client ID. Do not provide a client secret.');
await writeFile(new URL('../dist/config.mjs',import.meta.url),`// Public Google OAuth client ID, generated for this deployment.\nexport const GOOGLE_CLIENT_ID = ${JSON.stringify(value)};\n`);
console.log(value?'Google OAuth client ID configured.':'Google OAuth not configured; local progress remains available.');

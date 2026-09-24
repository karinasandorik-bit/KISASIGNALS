import fs from 'node:fs';
export function appendLedger(path,row){fs.appendFileSync(path,JSON.stringify(row)+'\n')}
export function readLedger(path){if(!fs.existsSync(path))return[];return fs.readFileSync(path,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)}

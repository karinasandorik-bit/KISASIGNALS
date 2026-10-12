import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {runDelivery} from '../src/pg-delivery-recovery.mjs';
const [reportId,ledgerPath,workerId,crash]=process.argv.slice(2);
const lookup=async()=>existsSync(ledgerPath)?[JSON.parse(readFileSync(ledgerPath,'utf8'))]:[];
const send=async(id)=>{
 const receipt={id:'provider-'+id,reportId:id};
 writeFileSync(ledgerPath,JSON.stringify(receipt),{flag:'wx'});
 return receipt;
};
runDelivery({reportId,workerId,send,lookup,crashAfterSend:crash==='kill'})
 .then(x=>{console.log(JSON.stringify(x))}).catch(e=>{console.error(e);process.exitCode=2});

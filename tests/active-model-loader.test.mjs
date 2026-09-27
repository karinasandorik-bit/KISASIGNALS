import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {loadPriceNet} from '../src/pricenet.mjs';
import {physicallyRollback} from '../src/physical-rollback.mjs';

const hash=b=>crypto.createHash('sha256').update(b).digest('hex');

test('PriceNet loader reads the exact KISA_ACTIVE_MODEL_PATH artifact',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kisa-active-model-'));
 const p=path.join(dir,'active.json'),bytes=Buffer.from(JSON.stringify({model:{version:'rollback-model'}})),sha=hash(bytes);
 fs.writeFileSync(p,bytes);
 const prevPath=process.env.KISA_ACTIVE_MODEL_PATH,prevSha=process.env.KISA_ACTIVE_MODEL_SHA256;
 process.env.KISA_ACTIVE_MODEL_PATH=p;process.env.KISA_ACTIVE_MODEL_SHA256=sha;
 try{const loaded=loadPriceNet();assert.equal(loaded.sha256,sha);assert.equal(loaded.artifact.model.version,'rollback-model');assert.match(loaded.source,/active\.json$/)}
 finally{prevPath===undefined?delete process.env.KISA_ACTIVE_MODEL_PATH:process.env.KISA_ACTIVE_MODEL_PATH=prevPath;prevSha===undefined?delete process.env.KISA_ACTIVE_MODEL_SHA256:process.env.KISA_ACTIVE_MODEL_SHA256=prevSha}
});

test('next loader read observes physically rolled back bytes',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kisa-runtime-'));
 const active=path.join(dir,'active.json'),old=Buffer.from(JSON.stringify({model:{version:'bad'}})),proven=Buffer.from(JSON.stringify({model:{version:'proven-v1'}})),sha=hash(proven);
 fs.writeFileSync(active,old);
 await physicallyRollback({transition:{transition:'ROLLBACK',rollbackTo:'proven-v1',revocationId:'r1'},resolveArtifact:async()=>({bytes:proven,sha256:sha}),activePath:active,persist:async()=>{}});
 const loaded=loadPriceNet(new URL('file://'+active),sha);
 assert.equal(loaded.sha256,sha);
 assert.equal(loaded.artifact.model.version,'proven-v1');
});

test('active path with wrong expected hash fails closed',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kisa-active-model-')),p=path.join(dir,'active.json');
 fs.writeFileSync(p,'{}');
 assert.throws(()=>loadPriceNet(new URL('file://'+p),'0'.repeat(64)),/MODEL_HASH_MISMATCH/);
});

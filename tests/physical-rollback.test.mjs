import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {physicallyRollback} from '../src/physical-rollback.mjs';

const hash=b=>crypto.createHash('sha256').update(b).digest('hex');

test('ROLLBACK atomically activates exact proven bytes and attests runtime hash',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kisa-rollback-'));
 const active=path.join(dir,'active-model.json');
 fs.writeFileSync(active,'bad-model');
 const proven=Buffer.from('proven-model-v1'),sha=hash(proven),events=[];
 const out=await physicallyRollback({
  transition:{transition:'ROLLBACK',rollbackTo:'proven-v1',revocationId:'r1'},
  resolveArtifact:async()=>({bytes:proven,sha256:sha}),activePath:active,
  persist:async(type,id,payload)=>events.push({type,id,payload})
 });
 assert.equal(fs.readFileSync(active,'utf8'),'proven-model-v1');
 assert.equal(out.targetSha256,sha);
 assert.equal(out.runtimeSha256,sha);
 assert.equal(out.verified,true);
 assert.equal(events[0].type,'rollback_attestation');
});

test('hash mismatch cannot touch active artifact',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kisa-rollback-'));
 const active=path.join(dir,'active-model.json');
 fs.writeFileSync(active,'current-safe');
 await assert.rejects(()=>physicallyRollback({
  transition:{transition:'ROLLBACK',rollbackTo:'fake',revocationId:'r2'},
  resolveArtifact:async()=>({bytes:Buffer.from('tampered'),sha256:'0'.repeat(64)}),activePath:active,persist:async()=>{}
 }),/ROLLBACK_ARTIFACT_HASH_MISMATCH/);
 assert.equal(fs.readFileSync(active,'utf8'),'current-safe');
});

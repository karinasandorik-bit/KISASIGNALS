import test from 'node:test';
import assert from 'node:assert/strict';
import {attestBoot,resetBootAttestationForTest} from '../src/boot-attestation.mjs';
import {EXPECTED_MODEL_SHA256,loadCalibration} from '../src/pricenet.mjs';

test('boot attestation binds deployment runtime model calibration and git identity',async()=>{
 resetBootAttestationForTest();
 const rows=[];
 const a=await attestBoot({mode:'SHADOW',deploymentId:'deploy-test',force:true,persist:async(type,id,payload)=>{rows.push({type,id,payload});return true}});
 assert.equal(a.schema,'KISA_BOOT_ATTESTATION_V1');
 assert.equal(a.deploymentId,'deploy-test');
 assert.equal(a.modelSha256,EXPECTED_MODEL_SHA256);
 assert.equal(a.calibrationSha256,loadCalibration().sha256);
 assert.ok(a.bootAttestationId);
 assert.equal(rows[0].type,'boot_attestation');
 assert.equal(rows[0].id,a.bootAttestationId);
});

test('postgres rejection prevents boot attestation',async()=>{
 resetBootAttestationForTest();
 await assert.rejects(()=>attestBoot({force:true,persist:async()=>false}),/POSTGRES_BOOT_ATTESTATION_REQUIRED/);
});

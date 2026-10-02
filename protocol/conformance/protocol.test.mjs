import test from 'node:test';
import assert from 'node:assert/strict';
import {checkProspectiveOrdering,checkDecisionFrozenInputs,checkGrantBinding,taintPlan} from '../invariants.mjs';

const decision={id:'d1',frozenAt:'2026-09-29T08:00:00.000Z',inputEntityIds:['e1'],inputRootDigest:'a'.repeat(64)};
test('prospective outcome must follow freeze',()=>{assert.equal(checkProspectiveOrdering({decision,outcome:{observedAt:'2026-09-29T12:00:00.000Z'}}).ok,true);assert.equal(checkProspectiveOrdering({decision,outcome:{observedAt:decision.frozenAt}}).ok,false)});
test('decision requires frozen inputs',()=>assert.equal(checkDecisionFrozenInputs(decision).ok,true));
test('grant binds exact decision',()=>{const g={decisionId:'d1',action:'OPEN_POSITION',scope:{mode:'SHADOW'},issuedAt:'2026-09-29T08:00:01.000Z',expiresAt:'2026-09-30T08:00:01.000Z'};assert.equal(checkGrantBinding({grant:g,decision}).ok,true)});
test('invalid ancestor taints causal descendants',()=>{const r=[{type:'GENERATED',from:'e1',to:'d1'},{type:'AUTHORIZED_BY',from:'d1',to:'g1'},{type:'EVALUATED_BY',from:'d1',to:'o1'}];assert.deepEqual(new Set(taintPlan({relations:r,invalidRoot:'e1'}).descendants),new Set(['e1','d1','g1','o1']))});

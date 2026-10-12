import test from 'node:test';import assert from 'node:assert/strict';
import {executionCosts} from '../src/execution-costs.mjs';
import {compareShadow} from '../src/shadow-evaluator.mjs';
test('unknown executions stay unverified',()=>assert.equal(executionCosts([]).verified,false));
test('reconciled execution receipts produce measured quantiles',()=>{const fills=Array.from({length:30},(_,i)=>({independentlyReconciled:true,providerTradeId:'p'+i,decisionId:'d'+i,side:'LONG',referencePrice:100,entryPrice:100.01,exitPrice:101,entryFee:.05,exitFee:.05,fundingPaid:0,quantity:1}));const x=executionCosts(fills);assert.equal(x.verified,true);assert.ok(x.feesUpper>0);});
test('shadow evaluator rejects missing prospective settlement',()=>assert.equal(compareShadow(Array.from({length:100},()=>({}))).status,'UNVERIFIED_OUTCOMES'));
test('paired shadow comparator does not claim significance',()=>{const rows=Array.from({length:100},()=>({prospective:true,settled:true,independentOutcome:true,kisaNetReturn:.001,baselineNetReturn:0,opportunityNetReturn:.001,kisaAction:'LONG'}));const r=compareShadow(rows);assert.equal(r.status,'DESCRIPTIVE_ONLY');assert.ok(r.pairedDeltaVsRule>0);});

import test from 'node:test';import assert from 'node:assert/strict';import {canonicalize} from '../integrity/jcs.mjs';import {digestJSON,digestRoot} from '../integrity/digest.mjs';
test('canonicalization ignores object insertion order',()=>{assert.equal(canonicalize({b:1,a:2}),canonicalize({a:2,b:1}));assert.equal(digestJSON({b:1,a:2}).value,digestJSON({a:2,b:1}).value)});
test('canonicalization rejects non-finite numbers',()=>assert.throws(()=>canonicalize({x:NaN}),/JCS_NON_FINITE/));
test('input root is order-independent set identity',()=>assert.equal(digestRoot(['b','a']),digestRoot(['a','b'])));

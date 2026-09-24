import test from 'node:test';
import assert from 'node:assert/strict';
import {safeCaptureFuturesState} from '../src/futures-recorder.mjs';
test('futures recorder fails closed when endpoint unavailable',async()=>{const old=process.env.BINANCE_FUTURES_BASE_URL;process.env.BINANCE_FUTURES_BASE_URL='http://127.0.0.1:1';const r=await safeCaptureFuturesState();assert.equal(r.ok,false);if(old)process.env.BINANCE_FUTURES_BASE_URL=old;else delete process.env.BINANCE_FUTURES_BASE_URL});

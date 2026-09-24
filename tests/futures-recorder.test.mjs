import test from 'node:test';
import assert from 'node:assert/strict';
import {safeCaptureFuturesState} from '../src/futures-recorder.mjs';
test('futures recorder fails closed when endpoint unavailable',async()=>{const old=process.env.BINANCE_FUTURES_BASE_URL,op=process.env.FUTURES_PROVIDERS;process.env.FUTURES_PROVIDERS='binance';process.env.BINANCE_FUTURES_BASE_URL='http://127.0.0.1:1';const r=await safeCaptureFuturesState();assert.equal(r.ok,false);if(old)process.env.BINANCE_FUTURES_BASE_URL=old;else delete process.env.BINANCE_FUTURES_BASE_URL;if(op)process.env.FUTURES_PROVIDERS=op;else delete process.env.FUTURES_PROVIDERS});

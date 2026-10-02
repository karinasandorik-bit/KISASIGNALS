import crypto from 'node:crypto';
import {canonicalize} from './jcs.mjs';
export function sha256Bytes(value){return crypto.createHash('sha256').update(value).digest('hex')}
export function digestJSON(value){return {algorithm:'sha256',canonicalization:'RFC8785-JCS',value:sha256Bytes(canonicalize(value))}}
export function digestRoot(ids=[]){return sha256Bytes(canonicalize([...ids].sort()))}

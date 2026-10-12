// RFC 8785-compatible canonicalization for JSON-compatible ECMAScript values.
// JSON.stringify supplies ECMAScript number/string serialization; object keys are sorted
// by UTF-16 code units as required by JCS. Inputs outside the I-JSON domain are rejected.
function assertScalar(x){
  if(typeof x==='number'&&!Number.isFinite(x)) throw Error('JCS_NON_FINITE_NUMBER');
  if(typeof x==='bigint'||typeof x==='undefined'||typeof x==='function'||typeof x==='symbol') throw Error('JCS_UNSUPPORTED_VALUE');
}
export function canonicalize(x){
  assertScalar(x);
  if(x===null||typeof x!=='object') return JSON.stringify(x);
  if(Array.isArray(x)) return '['+x.map(v=>{if(v===undefined)throw Error('JCS_UNSUPPORTED_VALUE');return canonicalize(v)}).join(',')+']';
  const proto=Object.getPrototypeOf(x);
  if(proto!==Object.prototype&&proto!==null) throw Error('JCS_PLAIN_OBJECT_REQUIRED');
  const keys=Object.keys(x).sort();
  return '{'+keys.map(k=>JSON.stringify(k)+':'+canonicalize(x[k])).join(',')+'}';
}

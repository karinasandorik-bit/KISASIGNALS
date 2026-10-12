/** Conservative EV gate. Quantities are fractions of notional. */
const finite = x => typeof x === 'number' && Number.isFinite(x);
const inRange = (x,a,b) => finite(x) && x >= a && x <= b;
const reject = (reason, details={}) => ({action:'NO_TRADE',verified:false,reason,...details});
export function verifyEV(q,policy={}) {
  const minN=policy.minN ?? 100, minNetEV=policy.minNetEV ?? 0;
  if (!q || typeof q !== 'object') return reject('MISSING_INPUT');
  if (!['LONG','SHORT'].includes(q.side)) return reject('INVALID_SIDE');
  if (q.independentHoldout !== true || q.prospective !== true) return reject('UNVERIFIED_MODEL');
  if (!Number.isSafeInteger(q.n) || q.n < minN) return reject('INSUFFICIENT_SAMPLE');
  if (q.evidenceFresh !== true || q.executionVerified !== true) return reject('UNVERIFIED_EXECUTION');
  if (![q.pWinLower,q.winLower,q.lossUpper].every(x=>inRange(x,0,1))) return reject('INVALID_FORECAST');
  const c=q.costs;
  if (!c || ['feesUpper','slippageUpper','fundingUpper','modelErrorUpper'].some(k=>!inRange(c[k],0,1))) return reject('UNKNOWN_COST');
  if (!finite(minNetEV) || minNetEV < 0 || !Number.isSafeInteger(minN) || minN < 1) return reject('INVALID_POLICY');
  const grossLower=q.pWinLower*q.winLower-(1-q.pWinLower)*q.lossUpper;
  const totalCostsUpper=c.feesUpper+c.slippageUpper+c.fundingUpper+c.modelErrorUpper;
  const netEVLower=grossLower-totalCostsUpper;
  const details={netEVLower,grossLower,totalCostsUpper,minNetEV,n:q.n};
  if (netEVLower <= minNetEV) return reject('NON_POSITIVE_CONSERVATIVE_EV',details);
  // SHADOW_ONLY: separate permission checks required for any real order.
  return {action:q.side,verified:true,scope:'SHADOW_ONLY',reason:'POSITIVE_CONSERVATIVE_EV',...details};
}

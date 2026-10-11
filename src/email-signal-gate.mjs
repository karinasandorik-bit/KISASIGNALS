// Fail-closed eligibility validation for SHADOW email delivery.
// This module does not send mail or authorize real orders.
const finitePositive = x => typeof x === 'number' && Number.isFinite(x) && x > 0;
const dateMs = x => typeof x === 'string' ? Date.parse(x) : NaN;
export function validateEmailSignal(signal, {now = Date.now(), maxAgeMs = 120_000} = {}) {
  const errors = [];
  const side = signal?.side;
  if (!['LONG', 'SHORT'].includes(side)) errors.push('SIDE');
  if (!signal?.decisionId || typeof signal.decisionId !== 'string') errors.push('DECISION_ID');
  if (!/^[A-Z0-9]{3,24}$/.test(signal?.symbol ?? '')) errors.push('SYMBOL');
  if (signal?.mode !== 'SHADOW_ONLY') errors.push('SHADOW_MODE');
  if (signal?.status !== 'SHADOW_SIGNAL_ARMED') errors.push('NOT_ARMED');
  if (signal?.independentValidation !== true) errors.push('INDEPENDENT_VALIDATION');
  if (signal?.futuresConsensus?.verified !== true || (signal?.futuresConsensus?.sourceCount ?? 0) < 2) errors.push('VENUE_CONSENSUS');
  const {entry, stopLoss, takeProfit, takeProfit2} = signal ?? {};
  if (![entry, stopLoss, takeProfit, takeProfit2].every(finitePositive)) errors.push('PRICE_FIELDS');
  else if (side === 'LONG' && !(stopLoss < entry && entry < takeProfit && takeProfit <= takeProfit2)) errors.push('LONG_LEVEL_ORDER');
  else if (side === 'SHORT' && !(stopLoss > entry && entry > takeProfit && takeProfit >= takeProfit2)) errors.push('SHORT_LEVEL_ORDER');
  const observed = dateMs(signal?.observedAt), expires = dateMs(signal?.expiresAt);
  if (!Number.isFinite(observed) || observed > now + 5_000 || now - observed > maxAgeMs) errors.push('STALE_OR_INVALID_EVIDENCE');
  if (!Number.isFinite(expires) || expires <= now || expires - now > 86_400_000) errors.push('EXPIRED_OR_INVALID_EXPIRY');
  if (!finitePositive(signal?.netRR) || signal.netRR < 2) errors.push('NET_RR');
  if (typeof signal?.riskFraction !== 'number' || !Number.isFinite(signal.riskFraction) || signal.riskFraction <= 0 || signal.riskFraction > 0.005) errors.push('RISK_LIMIT');
  if (!Array.isArray(signal?.sources) || new Set(signal.sources).size < 2) errors.push('INDEPENDENT_SOURCES');
  return {eligible: errors.length === 0, errors, decisionId: signal?.decisionId ?? null};
}

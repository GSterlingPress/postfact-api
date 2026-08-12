const SIDE_EFFECT_METHODS = new Set(['POST','PATCH','PUT','DELETE']);

export function resolveOutcome(input = {}) {
  const method = String(input.method || '').toUpperCase();
  const sideEffect = input.sideEffect ?? SIDE_EFFECT_METHODS.has(method);
  const evidence = input.evidence || {};
  const failure = String(input.failure || input.error || '').toLowerCase();

  // DONE requires affirmative durable evidence, never inference from a timeout.
  if (evidence.providerStatus === 'completed' || evidence.resourceExists === true || evidence.receiptVerified === true || evidence.transactionStatus === 'settled') {
    return result('DONE', false, 1, evidenceList(evidence), 'Do not retry the side effect. Continue from the confirmed completed state.');
  }

  // NOT_DONE requires affirmative evidence that execution did not occur.
  if (evidence.providerStatus === 'not_found' || evidence.resourceExists === false || evidence.transactionStatus === 'rejected' || evidence.preExecutionRejection === true) {
    return result('NOT_DONE', true, 0.99, evidenceList(evidence), 'The original side effect is confirmed absent. Retry only if the operation is still desired and otherwise permitted.');
  }

  // Non-side-effecting operations can generally be repeated, but their outcome is still UNKNOWN.
  if (!sideEffect) {
    return result('UNKNOWN', true, 0.6, [], 'Outcome is unverified, but the operation is classified as non-side-effecting.');
  }

  // Ambiguous network failures are deliberately UNKNOWN even with an idempotency key.
  const ambiguous = ['timeout','timed out','connection reset','econnreset','network','disconnect','502','503','504'].some(x => failure.includes(x));
  if (ambiguous || input.status >= 500 || input.status == null) {
    return result('UNKNOWN', false, 0, [], input.idempotencyKey ? 'Verify provider state using the idempotency key or durable resource/transaction reference before retrying.' : 'Verify external state before retrying. Add an idempotency key for future attempts when supported.');
  }

  return result('UNKNOWN', false, 0, [], 'Evidence is insufficient to establish whether the side effect occurred. Verify external state before retrying.');
}

function evidenceList(e) {
  return Object.entries(e).filter(([,v]) => v !== undefined && v !== null).map(([k,v]) => `${k}:${String(v)}`);
}
function result(state, retry_safe, confidence, evidence, next) {
  return { state, retry_safe, confidence, evidence, next };
}

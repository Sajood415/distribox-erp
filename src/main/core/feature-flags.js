/**
 * Phase 10 feature flags. Flip after migration + verification.
 * Company settings may override in future sub-phases.
 */
export const FLAGS = {
  ENABLE_SUBLEDGERS: process.env.ENABLE_SUBLEDGERS === "true",
  ENABLE_STOCK_LEDGER: process.env.ENABLE_STOCK_LEDGER === "true",
  ENABLE_DOCUMENT_REVERSAL: process.env.ENABLE_DOCUMENT_REVERSAL === "true",
  ENABLE_PERIOD_LOCKING: process.env.ENABLE_PERIOD_LOCKING === "true",
};

export function isEnabled(flag) {
  return Boolean(FLAGS[flag]);
}

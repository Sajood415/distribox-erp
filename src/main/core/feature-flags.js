/**
 * Phase 10 feature flags. Flip after migration + verification.
 * Company settings may override in future sub-phases.
 *
 * LOCKED MODULES (do not modify without verified bug):
 * - Sub-Ledgers: customer-ledger.js, vendor-ledger.js, customer-outstanding.js,
 *   vendor-outstanding.js, sub-ledger-service.js
 * - Stock Ledger: stock-movement-recorder.js, stock-ledger-service.js, stock-quantity.js
 * - All party balances must use getCustomerOutstanding / getVendorOutstanding /
 *   getInvoiceOutstanding / getPurchaseInvoiceOutstanding — no duplicate formulas.
 * - All stock history/valuation must use stock-ledger-service / stock-quantity — no duplicate qty formulas.
 */
export const FLAGS = {
  ENABLE_SUBLEDGERS: true,
  ENABLE_STOCK_LEDGER: true,
  ENABLE_DOCUMENT_REVERSAL: process.env.ENABLE_DOCUMENT_REVERSAL === "true",
  ENABLE_PERIOD_LOCKING: process.env.ENABLE_PERIOD_LOCKING === "true",
};

export function isEnabled(flag) {
  return Boolean(FLAGS[flag]);
}

/**
 * Phase 10 feature flags.
 *
 * LOCKED MODULES (do not modify without verified bug):
 *
 * Accounting Core — posting-engine.js, journal flows
 *
 * Sub-Ledgers — customer-ledger.js, vendor-ledger.js, customer-outstanding.js,
 *   vendor-outstanding.js, sub-ledger-service.js
 *   Party balances: getCustomerOutstanding / getVendorOutstanding /
 *   getInvoiceOutstanding / getPurchaseInvoiceOutstanding only
 *
 * Stock Ledger — stock-movement-recorder.js, stock-quantity.js, stock-ledger-shared.js,
 *   stock-ledger-service.js, StockMovement table
 *   Rules:
 *   1. Every stock-changing transaction MUST call recordStockMovement
 *   2. No direct running-stock calculations outside stock-ledger-service
 *   3. No direct inventory valuation outside stock-quantity.js
 *   4. Product qty from getStockQuantity; valuation from getStockValuation
 *   5. Ledgers/stock card via stock-ledger-service only
 *   6. Future modules (offers, load slips, production, expiry, transfers) use recorder only
 *
 * Distributor Operations (Phase 10.5) — verified by business-smoke-verification.test.js
 *   purchase-order.js, trade-offer-engine.js, trade-offer.js, load-slip.js,
 *   distributor-reports.js, salesman-target.js, expense.js (daily cash portion),
 *   claims.js (workflow: approve/reject/settle + audit), GlobalSearchBar + globalSearch
 *   Rules:
 *   1. PO receive is qty-tracking only; stock posts on purchase invoice conversion
 *   2. Trade offer discounts are percentage-based for invoice lines
 *   3. Load slips are logistics only — no stock impact
 *   4. Outstanding/valuation/stock via locked domain services only
 *
 * Document Lifecycle (Phase 10.6) — document-lifecycle-service.js,
 *   document-reversal-service.js, document-correction-service.js, document-post-service.js
 *   Rules: Draft/Posted/Cancelled/Reversed/Archived only; posted immutable; reversal + correction
 *
 * Accounting Period Locking (Phase 10.7) — fiscal-period-service.js, period-lock-service.js,
 *   period-closing-service.js, journal-repository createJournalEntry guard
 *   Rules: Posting blocked in closed periods; closing checklist enforced before close
 *
 * Fiscal Year Closing (Phase 10.8) — fiscal-year-close-service.js
 *   Rules: Year-end validation, snapshot, opening balance carry-forward, irreversible close
 */
export const FLAGS = {
  ENABLE_SUBLEDGERS: true,
  ENABLE_STOCK_LEDGER: true,
  ENABLE_DISTRIBUTOR_OPS: true,
  ENABLE_DOCUMENT_REVERSAL: process.env.ENABLE_DOCUMENT_REVERSAL !== "false",
  ENABLE_PERIOD_LOCKING: process.env.ENABLE_PERIOD_LOCKING !== "false",
  ENABLE_FISCAL_YEAR_CLOSE: process.env.ENABLE_FISCAL_YEAR_CLOSE !== "false",
};

export function isEnabled(flag) {
  return Boolean(FLAGS[flag]);
}

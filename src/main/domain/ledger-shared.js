import { roundMoney } from "../utils/money";

export const LEDGER_DOCUMENT_TYPES = {
  OPENING_BALANCE: "OPENING_BALANCE",
  SALES_INVOICE: "SALES_INVOICE",
  SALES_RETURN: "SALES_RETURN",
  RECOVERY: "RECOVERY",
  PURCHASE_INVOICE: "PURCHASE_INVOICE",
  PURCHASE_RETURN: "PURCHASE_RETURN",
  VENDOR_PAYMENT: "VENDOR_PAYMENT",
};

export const DOCUMENT_ROUTES = {
  [LEDGER_DOCUMENT_TYPES.SALES_INVOICE]: "/sales/invoices",
  [LEDGER_DOCUMENT_TYPES.SALES_RETURN]: "/claims/sales-returns",
  [LEDGER_DOCUMENT_TYPES.RECOVERY]: "/sales/recovery",
  [LEDGER_DOCUMENT_TYPES.PURCHASE_INVOICE]: "/purchase/invoices",
  [LEDGER_DOCUMENT_TYPES.PURCHASE_RETURN]: "/purchase/returns",
  [LEDGER_DOCUMENT_TYPES.VENDOR_PAYMENT]: "/purchase/payments",
};

export function getDocumentRoute(documentType, documentId) {
  const base = DOCUMENT_ROUTES[documentType];
  if (!base || !documentId) return null;
  return `${base}?docId=${documentId}`;
}

function parseDateRange(payload = {}) {
  const start = payload.startDate ? new Date(payload.startDate) : new Date("2000-01-01");
  const end = payload.endDate ? new Date(payload.endDate) : new Date("2099-12-31");
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function matchesFilters(row, { documentType, reference, start, end }) {
  if (documentType && row.documentType !== documentType) return false;
  if (reference && !String(row.reference || "").toLowerCase().includes(String(reference).toLowerCase())) {
    return false;
  }
  if (row.documentType === LEDGER_DOCUMENT_TYPES.OPENING_BALANCE) {
    return true;
  }
  const rowDate = new Date(row.date);
  return rowDate >= start && rowDate <= end;
}

export function applyRunningBalance(rows, { liability = false } = {}) {
  let running = 0;
  return rows.map((row) => {
    if (liability) {
      running = roundMoney(running + row.credit - row.debit);
    } else {
      running = roundMoney(running + row.debit - row.credit);
    }
    return { ...row, balance: running };
  });
}

export function sliceLedgerForPeriod(allRows, payload = {}, { liability = false } = {}) {
  const { start, end } = parseDateRange(payload);
  const withBalance = applyRunningBalance(allRows, { liability });

  let openingBalance = 0;
  const periodRows = [];

  for (const row of withBalance) {
    if (row.documentType === LEDGER_DOCUMENT_TYPES.OPENING_BALANCE) {
      openingBalance = row.balance;
      continue;
    }
    const rowDate = new Date(row.date);
    if (rowDate < start) {
      openingBalance = row.balance;
      continue;
    }
    if (rowDate > end) continue;
    if (!matchesFilters(row, { documentType: payload.documentType, reference: payload.reference, start, end })) {
      continue;
    }
    periodRows.push(row);
  }

  const closingBalance =
    periodRows.length > 0
      ? periodRows[periodRows.length - 1].balance
      : openingBalance;

  return {
    start,
    end,
    openingBalance,
    closingBalance,
    rows: periodRows,
  };
}

export { parseDateRange, matchesFilters };

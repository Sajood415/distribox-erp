export const DOCUMENT_TYPES = {
  PURCHASE_ORDER: "PURCHASE_ORDER",
  PURCHASE_INVOICE: "PURCHASE_INVOICE",
  PURCHASE_RETURN: "PURCHASE_RETURN",
  SALES_INVOICE: "SALES_INVOICE",
  SALES_RETURN: "SALES_RETURN",
  RECOVERY: "RECOVERY",
  CUSTOMER_CLAIM: "CUSTOMER_CLAIM",
  SUPPLIER_CLAIM: "SUPPLIER_CLAIM",
  CLAIM: "CLAIM",
  EXPENSE: "EXPENSE",
  STOCK_ADJUSTMENT: "STOCK_ADJUSTMENT",
  QUOTATION: "QUOTATION",
  LOAD_SLIP: "LOAD_SLIP",
};

export const LIFECYCLE_STATUS = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
  REVERSED: "Reversed",
  ARCHIVED: "Archived",
};

export const LIFECYCLE_ACTIONS = {
  CREATED: "Created",
  EDITED: "Edited",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
  REVERSED: "Reversed",
  CORRECTED: "Corrected",
  ARCHIVED: "Archived",
};

export const DOCUMENT_TABLES = {
  [DOCUMENT_TYPES.PURCHASE_ORDER]: "purchaseOrder",
  [DOCUMENT_TYPES.PURCHASE_INVOICE]: "purchaseInvoice",
  [DOCUMENT_TYPES.PURCHASE_RETURN]: "purchaseReturn",
  [DOCUMENT_TYPES.SALES_INVOICE]: "salesInvoice",
  [DOCUMENT_TYPES.SALES_RETURN]: "salesReturn",
  [DOCUMENT_TYPES.RECOVERY]: "recoveryVoucher",
  [DOCUMENT_TYPES.CUSTOMER_CLAIM]: "claim",
  [DOCUMENT_TYPES.SUPPLIER_CLAIM]: "claim",
  [DOCUMENT_TYPES.CLAIM]: "claim",
  [DOCUMENT_TYPES.EXPENSE]: "expenseVoucher",
  [DOCUMENT_TYPES.STOCK_ADJUSTMENT]: "stockAdjustment",
  [DOCUMENT_TYPES.QUOTATION]: "quotation",
  [DOCUMENT_TYPES.LOAD_SLIP]: "loadSlip",
};

export const DOCUMENT_ROUTES = {
  [DOCUMENT_TYPES.PURCHASE_ORDER]: "/purchase/orders",
  [DOCUMENT_TYPES.PURCHASE_INVOICE]: "/purchase/invoices",
  [DOCUMENT_TYPES.PURCHASE_RETURN]: "/purchase/returns",
  [DOCUMENT_TYPES.SALES_INVOICE]: "/sales/invoices",
  [DOCUMENT_TYPES.SALES_RETURN]: "/claims/sales-returns",
  [DOCUMENT_TYPES.RECOVERY]: "/sales/recovery",
  [DOCUMENT_TYPES.CUSTOMER_CLAIM]: "/claims",
  [DOCUMENT_TYPES.SUPPLIER_CLAIM]: "/claims",
  [DOCUMENT_TYPES.CLAIM]: "/claims",
  [DOCUMENT_TYPES.EXPENSE]: "/accounting/vouchers",
  [DOCUMENT_TYPES.STOCK_ADJUSTMENT]: "/inventory/adjustments",
  [DOCUMENT_TYPES.QUOTATION]: "/sales/quotations",
  [DOCUMENT_TYPES.LOAD_SLIP]: "/sales/load-slips",
};

export function resolveClaimDocumentType(partyType) {
  return partyType === "Supplier" ? DOCUMENT_TYPES.SUPPLIER_CLAIM : DOCUMENT_TYPES.CUSTOMER_CLAIM;
}

export function normalizeDocumentType(documentType) {
  if (documentType === DOCUMENT_TYPES.CUSTOMER_CLAIM || documentType === DOCUMENT_TYPES.SUPPLIER_CLAIM) {
    return DOCUMENT_TYPES.CLAIM;
  }
  return documentType;
}

/** Company setting keys and Pakistan distributor defaults. */
export const SETTING_KEYS = {
  COMPANY_NAME: "company_name",
  COMPANY_ADDRESS: "company_address",
  COMPANY_CITY: "company_city",
  COMPANY_PHONE: "company_phone",
  COMPANY_NTN: "company_ntn",
  COMPANY_STRN: "company_strn",

  FISCAL_YEAR_START_MONTH: "fiscal_year_start_month",
  DATE_FORMAT: "date_format",
  CURRENCY_SYMBOL: "currency_symbol",

  PRICING_MODE: "pricing_mode",
  TAX_MODE: "tax_mode",
  DEFAULT_VAT_PERCENT: "default_vat_percent",

  ALLOW_NEGATIVE_STOCK: "allow_negative_stock",
  HALT_ON_EXPIRY: "halt_on_expiry",
  DEFAULT_PAYMENT_TERMS: "default_payment_terms",

  AUTO_BACKUP_ENABLED: "auto_backup_enabled",
  AUTO_BACKUP_HOUR: "auto_backup_hour",
  BACKUP_RETENTION_DAYS: "backup_retention_days",

  PRINT_SHOW_LOGO: "print_show_logo",
  PRINT_FOOTER_TEXT: "print_footer_text",
  PRINT_PAGE_SIZE: "print_page_size",

  DOCUMENT_SHOW_BATCH: "document_show_batch",
  DOCUMENT_SHOW_EXPIRY: "document_show_expiry",
  INVOICE_TERMS_TEXT: "invoice_terms_text",
};

export const DEFAULT_SETTINGS = {
  [SETTING_KEYS.COMPANY_NAME]: "Distribox Demo",
  [SETTING_KEYS.COMPANY_ADDRESS]: "",
  [SETTING_KEYS.COMPANY_CITY]: "",
  [SETTING_KEYS.COMPANY_PHONE]: "",
  [SETTING_KEYS.COMPANY_NTN]: "",
  [SETTING_KEYS.COMPANY_STRN]: "",

  [SETTING_KEYS.FISCAL_YEAR_START_MONTH]: "7",
  [SETTING_KEYS.DATE_FORMAT]: "DD/MM/YYYY",
  [SETTING_KEYS.CURRENCY_SYMBOL]: "Rs",

  [SETTING_KEYS.PRICING_MODE]: "tier",
  [SETTING_KEYS.TAX_MODE]: "line_vat",
  [SETTING_KEYS.DEFAULT_VAT_PERCENT]: "0",

  [SETTING_KEYS.ALLOW_NEGATIVE_STOCK]: "false",
  [SETTING_KEYS.HALT_ON_EXPIRY]: "true",
  [SETTING_KEYS.DEFAULT_PAYMENT_TERMS]: "30",

  [SETTING_KEYS.AUTO_BACKUP_ENABLED]: "false",
  [SETTING_KEYS.AUTO_BACKUP_HOUR]: "2",
  [SETTING_KEYS.BACKUP_RETENTION_DAYS]: "30",

  [SETTING_KEYS.PRINT_SHOW_LOGO]: "true",
  [SETTING_KEYS.PRINT_FOOTER_TEXT]: "Thank you for your business",
  [SETTING_KEYS.PRINT_PAGE_SIZE]: "A4",

  [SETTING_KEYS.DOCUMENT_SHOW_BATCH]: "true",
  [SETTING_KEYS.DOCUMENT_SHOW_EXPIRY]: "true",
  [SETTING_KEYS.INVOICE_TERMS_TEXT]: "Goods once sold will not be taken back.",
};

export const DOCUMENT_TYPES = {
  SALES_INVOICE: "SALES_INVOICE",
  PURCHASE_INVOICE: "PURCHASE_INVOICE",
  SALES_RETURN: "SALES_RETURN",
  PURCHASE_RETURN: "PURCHASE_RETURN",
  RECOVERY: "RECOVERY",
  QUOTATION: "QUOTATION",
  CLAIM: "CLAIM",
  VOUCHER: "VOUCHER",
  STOCK_ADJUSTMENT: "STOCK_ADJUSTMENT",
  STOCK_TRANSFER: "STOCK_TRANSFER",
  LOAD_SLIP: "LOAD_SLIP",
};

export const DEFAULT_SEQUENCES = [
  { documentType: DOCUMENT_TYPES.SALES_INVOICE, prefix: "SI", padding: 6, resetPolicy: "FISCAL_YEAR" },
  { documentType: DOCUMENT_TYPES.PURCHASE_INVOICE, prefix: "PI", padding: 6, resetPolicy: "FISCAL_YEAR" },
  { documentType: DOCUMENT_TYPES.SALES_RETURN, prefix: "SR", padding: 6, resetPolicy: "FISCAL_YEAR" },
  { documentType: DOCUMENT_TYPES.PURCHASE_RETURN, prefix: "PR", padding: 6, resetPolicy: "FISCAL_YEAR" },
  { documentType: DOCUMENT_TYPES.RECOVERY, prefix: "RV", padding: 6, resetPolicy: "FISCAL_YEAR" },
  { documentType: DOCUMENT_TYPES.QUOTATION, prefix: "QT", padding: 6, resetPolicy: "FISCAL_YEAR" },
  { documentType: DOCUMENT_TYPES.CLAIM, prefix: "CL", padding: 6, resetPolicy: "FISCAL_YEAR" },
  { documentType: DOCUMENT_TYPES.VOUCHER, prefix: "JV", padding: 6, resetPolicy: "FISCAL_YEAR" },
  { documentType: DOCUMENT_TYPES.STOCK_ADJUSTMENT, prefix: "SA", padding: 6, resetPolicy: "FISCAL_YEAR" },
  { documentType: DOCUMENT_TYPES.STOCK_TRANSFER, prefix: "TR", padding: 6, resetPolicy: "FISCAL_YEAR" },
  { documentType: DOCUMENT_TYPES.LOAD_SLIP, prefix: "LS", padding: 6, resetPolicy: "FISCAL_YEAR" },
];

export const RESET_POLICIES = ["NEVER", "CALENDAR_YEAR", "FISCAL_YEAR"];

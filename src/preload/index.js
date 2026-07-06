import { contextBridge, ipcRenderer } from "electron";

let sessionToken = null;

function invoke(channel, payload) {
  if (payload === undefined) {
    return ipcRenderer.invoke(channel, { _token: sessionToken });
  }

  const enriched =
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? { ...payload, _token: sessionToken }
      : { _payload: payload, _token: sessionToken };

  return ipcRenderer.invoke(channel, enriched);
}

function masterApi(entity) {
  return {
    list: () => invoke(`masters:${entity}:list`),
    save: (data) => invoke(`masters:${entity}:save`, data),
    delete: (id) => invoke(`masters:${entity}:delete`, { id }),
  };
}

contextBridge.exposeInMainWorld("api", {
  session: {
    setToken: (token) => {
      sessionToken = token || null;
    },
  },
  auth: {
    login: (credentials) => ipcRenderer.invoke("auth:login", credentials),
    validate: (token) => {
      sessionToken = token || null;
      return ipcRenderer.invoke("auth:validate", { _token: token });
    },
    logout: (token) => {
      sessionToken = token || null;
      return ipcRenderer.invoke("auth:logout", { _token: token });
    },
  },
  company: {
    list: () => invoke("company:list"),
    create: (data) => invoke("company:create", data),
    select: (data) => invoke("company:select", data),
  },
  masters: {
    lookups: () => invoke("masters:lookups"),
    units: masterApi("units"),
    warehouses: masterApi("warehouses"),
    accounts: masterApi("accounts"),
    routes: masterApi("routes"),
    salesmen: masterApi("salesmen"),
    products: masterApi("products"),
    customers: masterApi("customers"),
    vendors: masterApi("vendors"),
  },
  purchase: {
    lookups: () => invoke("purchase:lookups"),
    listInvoices: () => invoke("purchase:invoices:list"),
    getInvoice: (id) => invoke("purchase:invoices:get", { id }),
    saveInvoice: (data) => invoke("purchase:invoices:save", data),
    previewTotals: (data) => invoke("purchase:invoices:preview", data),
    listReturns: () => invoke("purchase:returns:list"),
    saveReturn: (data) => invoke("purchase:returns:save", data),
    listPayments: () => invoke("purchase:payments:list"),
    savePayment: (data) => invoke("purchase:payments:save", data),
    getOutstandingInvoices: (vendorId) =>
      invoke("purchase:payments:outstanding", { vendorId }),
  },
  sales: {
    lookups: () => invoke("sales:lookups"),
    listQuotations: () => invoke("sales:quotations:list"),
    saveQuotation: (data) => invoke("sales:quotations:save", data),
    convertQuotation: (id) => invoke("sales:quotations:convert", { id }),
    listInvoices: () => invoke("sales:invoices:list"),
    saveInvoice: (data) => invoke("sales:invoices:save", data),
    getCustomerOutstanding: (customerId) =>
      invoke("sales:customer:outstanding", { customerId }),
    listPendingDeliveries: () => invoke("sales:invoices:pending"),
    listRecoveries: () => invoke("sales:recoveries:list"),
    saveRecovery: (data) => invoke("sales:recoveries:save", data),
    getOutstandingInvoices: (customerId) =>
      invoke("sales:recoveries:outstanding", { customerId }),
    listLoadSlips: () => invoke("sales:loadslips:list"),
    saveLoadSlip: (data) => invoke("sales:loadslips:save", data),
    deliverLoadSlip: (id) => invoke("sales:loadslips:deliver", { id }),
    listDeliveryMen: () => invoke("sales:deliverymen:list"),
    saveDeliveryMan: (data) => invoke("sales:deliverymen:save", data),
    listReturns: () => invoke("sales:returns:list"),
    saveReturn: (data) => invoke("sales:returns:save", data),
    getReturnInvoice: (id) => invoke("sales:returns:invoice", { id }),
  },
  claims: {
    lookups: () => invoke("claims:lookups"),
    list: (filters) => invoke("claims:list", filters || {}),
    save: (data) => invoke("claims:save", data),
    updateStatus: (data) => invoke("claims:status", data),
    settle: (data) => invoke("claims:settle", data),
    report: (filters) => invoke("claims:report", filters || {}),
  },
  stock: {
    list: () => invoke("stock:list"),
  },
  inventory: {
    lookups: () => invoke("inventory:lookups"),
    getStockTakeSheet: (warehouseId) => invoke("inventory:stocktake:sheet", { warehouseId }),
    finalizeStockTake: (data) => invoke("inventory:stocktake:finalize", data),
    saveOpeningStock: (data) => invoke("inventory:opening:save", data),
    saveAdjustment: (data) => invoke("inventory:adjustments:save", data),
    listAdjustments: () => invoke("inventory:adjustments:list"),
    saveTransfer: (data) => invoke("inventory:transfers:save", data),
    listTransfers: () => invoke("inventory:transfers:list"),
    lowStockReport: () => invoke("inventory:reports:lowstock"),
    expiryReport: () => invoke("inventory:reports:expiry"),
  },
  accounting: {
    lookups: () => invoke("accounting:lookups"),
    listVouchers: (filters) => invoke("accounting:vouchers:list", filters || {}),
    saveVoucher: (data) => invoke("accounting:vouchers:save", data),
    buildQuickLines: (data) => invoke("accounting:vouchers:quicklines", data),
    listJournal: (filters) => invoke("accounting:journal:list", filters || {}),
    trialBalance: (filters) => invoke("accounting:trialbalance", filters || {}),
    cashbook: (filters) => invoke("accounting:cashbook", filters || {}),
    bankbook: (filters) => invoke("accounting:bankbook", filters || {}),
    accountLedger: (filters) => invoke("accounting:ledger", filters || {}),
    dailyCash: (filters) => invoke("accounting:dailycash", filters || {}),
    profitLoss: (filters) => invoke("accounting:profitloss", filters || {}),
  },
  reports: {
    aging: (filters) => invoke("reports:aging", filters || {}),
    balanceSheet: (filters) => invoke("reports:balancesheet", filters || {}),
    incomeStatement: (filters) => invoke("reports:incomestatement", filters || {}),
    customerOutstanding: () => invoke("reports:customeroutstanding"),
    customerSales: (filters) => invoke("reports:customersales", filters || {}),
    recovery: (filters) => invoke("reports:recovery", filters || {}),
    salesmen: (filters) => invoke("reports:salesmen", filters || {}),
    productSales: (filters) => invoke("reports:productsales", filters || {}),
    purchases: (filters) => invoke("reports:purchases", filters || {}),
    stockValuation: () => invoke("reports:stockvaluation"),
    commission: (filters) => invoke("reports:commission", filters || {}),
    subLedgerLookups: () => invoke("reports:subledgerlookups"),
    customerLedger: (filters) => invoke("reports:customerledger", filters || {}),
    supplierLedger: (filters) => invoke("reports:supplierledger", filters || {}),
    customerStatement: (filters) => invoke("reports:customerstatement", filters || {}),
    supplierStatement: (filters) => invoke("reports:supplierstatement", filters || {}),
    outstandingStatement: (filters) => invoke("reports:outstandingstatement", filters || {}),
  },
  tools: {
    backup: () => invoke("tools:backup"),
    backupLocal: () => invoke("tools:backup:local"),
    listLocalBackups: () => invoke("tools:backup:list"),
    restore: () => invoke("tools:restore"),
    exportEntities: () => invoke("tools:export:entities"),
    exportCsv: (entity) => invoke("tools:export:csv", { entity }),
    importCsv: (entity) => invoke("tools:import:csv", { entity }),
    printHtml: (html) => invoke("tools:printHtml", { html }),
    integrity: () => invoke("tools:integrity"),
  },
  settings: {
    get: () => invoke("settings:get"),
    save: (data) => invoke("settings:save", data),
    listSequences: () => invoke("settings:sequences:list"),
    saveSequence: (data) => invoke("settings:sequences:save", data),
    listMappings: () => invoke("settings:mappings:list"),
    saveMapping: (data) => invoke("settings:mappings:save", data),
  },
});

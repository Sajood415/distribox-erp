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
    listOrders: () => invoke("purchase:orders:list"),
    getOrder: (id) => invoke("purchase:orders:get", { id }),
    saveOrder: (data) => invoke("purchase:orders:save", data),
    deleteOrder: (id) => invoke("purchase:orders:delete", { id }),
    approveOrder: (id) => invoke("purchase:orders:approve", { id }),
    cancelOrder: (id) => invoke("purchase:orders:cancel", { id }),
    receiveOrder: (data) => invoke("purchase:orders:receive", data),
    convertOrder: (data) => invoke("purchase:orders:convert", data),
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
    updateLoadSlipStatus: (data) => invoke("sales:loadslips:status", data),
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
  offers: {
    list: () => invoke("offers:list"),
    save: (data) => invoke("offers:save", data),
    preview: (data) => invoke("offers:preview", data),
  },
  distributor: {
    recoverySheet: (filters) => invoke("distributor:recoverysheet", filters || {}),
    recoveryBySalesman: (filters) => invoke("distributor:recoverysalesman", filters || {}),
    recoveryByCustomer: (filters) => invoke("distributor:recoverycustomer", filters || {}),
    pendingRecovery: () => invoke("distributor:recoverypending"),
    recoveryPerformance: (filters) => invoke("distributor:recoveryperformance", filters || {}),
    recoveryAging: (filters) => invoke("distributor:recoveryaging", filters || {}),
    routeReport: (filters) => invoke("distributor:routereport", filters || {}),
    routeSummary: (filters) => invoke("distributor:routesummary", filters || {}),
    dailyCash: (filters) => invoke("distributor:dailycash", filters || {}),
    finalSheet: (filters) => invoke("distributor:finalsheet", filters || {}),
    search: (query) => invoke("distributor:search", { query }),
  },
  documents: {
    timeline: (payload) => invoke("documents:timeline", payload),
    links: (payload) => invoke("documents:links", payload),
    assertEditable: (payload) => invoke("documents:editable", payload),
    archive: (payload) => invoke("documents:archive", payload),
    reverse: (payload) => invoke("documents:reverse", payload),
    reverseSales: (payload) => invoke("documents:reverse:sales", payload),
    reversePurchase: (payload) => invoke("documents:reverse:purchase", payload),
    reverseRecovery: (payload) => invoke("documents:reverse:recovery", payload),
    correct: (payload) => invoke("documents:correct", payload),
    correctClaim: (payload) => invoke("documents:correct:claim", payload),
    postDraft: (payload) => invoke("documents:post", payload),
  },
  salesmanOps: {
    listTargets: (filters) => invoke("salesman:targets:list", filters || {}),
    saveTarget: (data) => invoke("salesman:targets:save", data),
    performance: (filters) => invoke("salesman:performance", filters || {}),
  },
  expenses: {
    list: () => invoke("expenses:list"),
    save: (data) => invoke("expenses:save", data),
  },
  periods: {
    listFiscalYears: () => invoke("periods:fiscalyears"),
    list: (filters) => invoke("periods:list", filters || {}),
    closingChecklist: (payload) => invoke("periods:checklist", payload),
    close: (payload) => invoke("periods:close", payload),
    reopen: (payload) => invoke("periods:reopen", payload),
    prepareFiscalYear: (payload) => invoke("periods:preparefiscalyear", payload),
  },
  yearClose: {
    listFiscalYears: () => invoke("yearclose:fiscalyears"),
    validate: (payload) => invoke("yearclose:validate", payload),
    close: (payload) => invoke("yearclose:close", payload),
    history: () => invoke("yearclose:history"),
    report: (payload) => invoke("yearclose:report", payload),
    openingBalances: (payload) => invoke("yearclose:openingbalances", payload),
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
  stockLedger: {
    lookups: () => invoke("stockledger:lookups"),
    product: (filters) => invoke("stockledger:product", filters || {}),
    warehouse: (filters) => invoke("stockledger:warehouse", filters || {}),
    batch: (filters) => invoke("stockledger:batch", filters || {}),
    card: (filters) => invoke("stockledger:card", filters || {}),
    history: (filters) => invoke("stockledger:history", filters || {}),
    movements: (filters) => invoke("stockledger:movements", filters || {}),
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

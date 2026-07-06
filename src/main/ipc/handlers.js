import { ipcMain, BrowserWindow } from "electron";
import { registerHandler } from "./middleware/register-handler";
import { loginUser, validateSession, logoutUser } from "../services/auth";
import { listCompanies, createCompany, selectCompany } from "../services/company";
import {
  listUnits,
  saveUnit,
  deleteUnit,
  listWarehouses,
  saveWarehouse,
  deleteWarehouse,
  listAccounts,
  saveAccount,
  deleteAccount,
  listRoutes,
  saveRoute,
  deleteRoute,
  listSalesmen,
  saveSalesman,
  deleteSalesman,
  listProducts,
  saveProduct,
  deleteProduct,
  listCustomers,
  saveCustomer,
  deleteCustomer,
  listVendors,
  saveVendor,
  deleteVendor,
  getMasterLookups,
} from "../services/masters";
import {
  listPurchaseInvoices,
  getPurchaseInvoice,
  savePurchaseInvoice,
  getPurchaseLookups,
  previewPurchaseTotals,
} from "../services/purchase";
import { listPurchaseReturns, savePurchaseReturn } from "../services/purchase-return";
import { listStock } from "../services/stock";
import {
  getInventoryLookups,
  getStockTakeSheet,
  finalizeStockTake,
  saveOpeningStock,
  saveStockAdjustment,
  saveStockTransfer,
  listStockAdjustments,
  listStockTransfers,
  getLowStockReport,
  getExpiryReport,
} from "../services/inventory";
import { listQuotations, saveQuotation, getSalesLookups } from "../services/quotation";
import {
  listSalesInvoices,
  saveSalesInvoice,
  getCustomerOutstandingSummary,
  listPendingDeliveries,
  convertQuotationToInvoice,
} from "../services/sales";
import { listRecoveries, saveRecovery, getCustomerOutstandingInvoices } from "../services/recovery";
import {
  listPurchaseOrders,
  getPurchaseOrder,
  savePurchaseOrder,
  deletePurchaseOrder,
  approvePurchaseOrder,
  cancelPurchaseOrder,
  receivePurchaseOrder,
  convertPurchaseOrderToInvoice,
} from "../services/purchase-order";
import {
  listTradeOffers,
  saveTradeOffer,
  previewInvoiceOffers,
} from "../services/trade-offer";
import {
  getDailyRecoverySheet,
  getRecoveryBySalesman,
  getRecoveryByCustomer,
  getPendingRecoveryReport,
  getRecoveryPerformance,
  getRecoveryAgingReport,
  getRouteReport,
  getDailyRouteSummary,
  getDailyCashSummary,
  getDailyFinalSheet,
  globalSearch,
} from "../services/distributor-reports";
import {
  getDocumentTimeline,
  assertDocumentEditable,
} from "../services/document-lifecycle-service";
import {
  reverseDocument,
  reverseSalesInvoice,
  reversePurchaseInvoice,
  reverseRecoveryVoucher,
} from "../services/document-reversal-service";
import { listSalesmanTargets, saveSalesmanTarget, getSalesmanPerformance } from "../services/salesman-target";
import { listExpenses, saveExpense } from "../services/expense";
import {
  listLoadSlips,
  saveLoadSlip,
  markLoadSlipDelivered,
  listDeliveryMen,
  saveDeliveryMan,
  updateLoadSlipStatus,
} from "../services/load-slip";
import {
  listSalesReturns,
  saveSalesReturn,
  getSalesInvoiceForReturn,
} from "../services/sales-return";
import {
  listClaims,
  saveClaim,
  updateClaimStatus,
  settleClaim,
  getClaimLookups,
  getClaimReport,
} from "../services/claims";
import {
  listVouchers,
  saveVoucher,
  getAccountingLookups,
  buildQuickVoucherLines,
} from "../services/vouchers";
import {
  listJournalEntries,
  getTrialBalance,
  getCashbook,
  getBankbook,
  getAccountLedger,
  getDailyCashPosition,
  getProfitAndLoss,
} from "../services/financial-reports";
import {
  getAgingReport,
  getBalanceSheet,
  getIncomeStatement,
  getCustomerOutstandingReport,
  getCustomerSalesReport,
  getRecoveryReport,
  getSalesmanReport,
  getProductSalesReport,
  getPurchaseReport,
  getStockValuationReport,
  getCommissionReport,
} from "../services/reports";
import {
  createBackup,
  restoreBackup,
  listLocalBackups,
  createLocalBackup,
} from "../services/backup";
import {
  getExportEntities,
  exportEntityCsv,
  importEntityCsv,
} from "../services/import-export";
import { printHtml } from "../services/print";
import { runIntegrityChecks } from "../services/integrity-service";
import {
  getAccountMappings,
  saveAccountMapping,
} from "../services/account-mapping-service";
import {
  getVendorOutstandingInvoices,
  listVendorPayments,
  saveVendorPayment,
} from "../services/vendor-payment";
import {
  getCustomerLedger,
  getSupplierLedger,
  getCustomerStatement,
  getSupplierStatement,
  getOutstandingStatement,
  getSubLedgerLookups,
} from "../services/sub-ledger-service";
import {
  getProductLedger,
  getWarehouseLedger,
  getBatchLedger,
  getStockCard,
  getInventoryHistory,
  getMovementHistory,
  getStockLedgerLookups,
} from "../services/stock-ledger-service";
import {
  getSettings,
  saveSettings,
  listDocumentSequences,
  saveDocumentSequence,
} from "../services/settings-service";
import { extractToken } from "./middleware/ipc-auth";

export function registerIpcHandlers() {
  registerHandler(ipcMain, "auth:login", loginUser);
  registerHandler(ipcMain, "auth:validate", (payload) => validateSession(extractToken(payload)));
  registerHandler(ipcMain, "auth:logout", (payload, ctx) => logoutUser(extractToken(payload), ctx));

  registerHandler(ipcMain, "company:list", listCompanies);
  registerHandler(ipcMain, "company:create", createCompany);
  registerHandler(ipcMain, "company:select", selectCompany);

  registerHandler(ipcMain, "masters:lookups", getMasterLookups);
  registerHandler(ipcMain, "masters:units:list", listUnits);
  registerHandler(ipcMain, "masters:units:save", saveUnit);
  registerHandler(ipcMain, "masters:units:delete", deleteUnit);
  registerHandler(ipcMain, "masters:warehouses:list", listWarehouses);
  registerHandler(ipcMain, "masters:warehouses:save", saveWarehouse);
  registerHandler(ipcMain, "masters:warehouses:delete", deleteWarehouse);
  registerHandler(ipcMain, "masters:accounts:list", listAccounts);
  registerHandler(ipcMain, "masters:accounts:save", saveAccount);
  registerHandler(ipcMain, "masters:accounts:delete", deleteAccount);
  registerHandler(ipcMain, "masters:routes:list", listRoutes);
  registerHandler(ipcMain, "masters:routes:save", saveRoute);
  registerHandler(ipcMain, "masters:routes:delete", deleteRoute);
  registerHandler(ipcMain, "masters:salesmen:list", listSalesmen);
  registerHandler(ipcMain, "masters:salesmen:save", saveSalesman);
  registerHandler(ipcMain, "masters:salesmen:delete", deleteSalesman);
  registerHandler(ipcMain, "masters:products:list", listProducts);
  registerHandler(ipcMain, "masters:products:save", saveProduct);
  registerHandler(ipcMain, "masters:products:delete", deleteProduct);
  registerHandler(ipcMain, "masters:customers:list", listCustomers);
  registerHandler(ipcMain, "masters:customers:save", saveCustomer);
  registerHandler(ipcMain, "masters:customers:delete", deleteCustomer);
  registerHandler(ipcMain, "masters:vendors:list", listVendors);
  registerHandler(ipcMain, "masters:vendors:save", saveVendor);
  registerHandler(ipcMain, "masters:vendors:delete", deleteVendor);

  registerHandler(ipcMain, "purchase:lookups", getPurchaseLookups);
  registerHandler(ipcMain, "purchase:invoices:list", listPurchaseInvoices);
  registerHandler(ipcMain, "purchase:invoices:get", getPurchaseInvoice);
  registerHandler(ipcMain, "purchase:invoices:save", savePurchaseInvoice);
  registerHandler(ipcMain, "purchase:invoices:preview", previewPurchaseTotals);
  registerHandler(ipcMain, "purchase:returns:list", listPurchaseReturns);
  registerHandler(ipcMain, "purchase:returns:save", savePurchaseReturn);
  registerHandler(ipcMain, "purchase:payments:list", listVendorPayments);
  registerHandler(ipcMain, "purchase:payments:save", saveVendorPayment);
  registerHandler(ipcMain, "purchase:payments:outstanding", getVendorOutstandingInvoices);
  registerHandler(ipcMain, "purchase:orders:list", listPurchaseOrders);
  registerHandler(ipcMain, "purchase:orders:get", getPurchaseOrder);
  registerHandler(ipcMain, "purchase:orders:save", savePurchaseOrder);
  registerHandler(ipcMain, "purchase:orders:delete", deletePurchaseOrder);
  registerHandler(ipcMain, "purchase:orders:approve", approvePurchaseOrder);
  registerHandler(ipcMain, "purchase:orders:cancel", cancelPurchaseOrder);
  registerHandler(ipcMain, "purchase:orders:receive", receivePurchaseOrder);
  registerHandler(ipcMain, "purchase:orders:convert", convertPurchaseOrderToInvoice);

  registerHandler(ipcMain, "stock:list", listStock);

  registerHandler(ipcMain, "inventory:lookups", getInventoryLookups);
  registerHandler(ipcMain, "inventory:stocktake:sheet", getStockTakeSheet);
  registerHandler(ipcMain, "inventory:stocktake:finalize", finalizeStockTake);
  registerHandler(ipcMain, "inventory:opening:save", saveOpeningStock);
  registerHandler(ipcMain, "inventory:adjustments:save", saveStockAdjustment);
  registerHandler(ipcMain, "inventory:adjustments:list", listStockAdjustments);
  registerHandler(ipcMain, "inventory:transfers:save", saveStockTransfer);
  registerHandler(ipcMain, "inventory:transfers:list", listStockTransfers);
  registerHandler(ipcMain, "inventory:reports:lowstock", getLowStockReport);
  registerHandler(ipcMain, "inventory:reports:expiry", getExpiryReport);

  registerHandler(ipcMain, "sales:lookups", getSalesLookups);
  registerHandler(ipcMain, "sales:quotations:list", listQuotations);
  registerHandler(ipcMain, "sales:quotations:save", saveQuotation);
  registerHandler(ipcMain, "sales:quotations:convert", convertQuotationToInvoice);
  registerHandler(ipcMain, "sales:invoices:list", listSalesInvoices);
  registerHandler(ipcMain, "sales:invoices:save", saveSalesInvoice);
  registerHandler(ipcMain, "sales:customer:outstanding", getCustomerOutstandingSummary);
  registerHandler(ipcMain, "sales:invoices:pending", listPendingDeliveries);
  registerHandler(ipcMain, "sales:recoveries:list", listRecoveries);
  registerHandler(ipcMain, "sales:recoveries:save", saveRecovery);
  registerHandler(ipcMain, "sales:recoveries:outstanding", getCustomerOutstandingInvoices);
  registerHandler(ipcMain, "sales:loadslips:list", listLoadSlips);
  registerHandler(ipcMain, "sales:loadslips:save", saveLoadSlip);
  registerHandler(ipcMain, "sales:loadslips:status", updateLoadSlipStatus);
  registerHandler(ipcMain, "sales:loadslips:deliver", markLoadSlipDelivered);
  registerHandler(ipcMain, "sales:deliverymen:list", listDeliveryMen);
  registerHandler(ipcMain, "sales:deliverymen:save", saveDeliveryMan);
  registerHandler(ipcMain, "sales:returns:list", listSalesReturns);
  registerHandler(ipcMain, "sales:returns:save", saveSalesReturn);
  registerHandler(ipcMain, "sales:returns:invoice", getSalesInvoiceForReturn);

  registerHandler(ipcMain, "claims:lookups", getClaimLookups);
  registerHandler(ipcMain, "claims:list", listClaims);
  registerHandler(ipcMain, "claims:save", saveClaim);
  registerHandler(ipcMain, "claims:status", updateClaimStatus);
  registerHandler(ipcMain, "claims:settle", settleClaim);
  registerHandler(ipcMain, "claims:report", getClaimReport);

  registerHandler(ipcMain, "accounting:lookups", getAccountingLookups);
  registerHandler(ipcMain, "accounting:vouchers:list", listVouchers);
  registerHandler(ipcMain, "accounting:vouchers:save", saveVoucher);
  registerHandler(ipcMain, "accounting:vouchers:quicklines", buildQuickVoucherLines);
  registerHandler(ipcMain, "accounting:journal:list", listJournalEntries);
  registerHandler(ipcMain, "accounting:trialbalance", getTrialBalance);
  registerHandler(ipcMain, "accounting:cashbook", getCashbook);
  registerHandler(ipcMain, "accounting:bankbook", getBankbook);
  registerHandler(ipcMain, "accounting:ledger", getAccountLedger);
  registerHandler(ipcMain, "accounting:dailycash", getDailyCashPosition);
  registerHandler(ipcMain, "accounting:profitloss", getProfitAndLoss);

  registerHandler(ipcMain, "reports:aging", getAgingReport);
  registerHandler(ipcMain, "reports:balancesheet", getBalanceSheet);
  registerHandler(ipcMain, "reports:incomestatement", getIncomeStatement);
  registerHandler(ipcMain, "reports:customeroutstanding", getCustomerOutstandingReport);
  registerHandler(ipcMain, "reports:customersales", getCustomerSalesReport);
  registerHandler(ipcMain, "reports:recovery", getRecoveryReport);
  registerHandler(ipcMain, "reports:salesmen", getSalesmanReport);
  registerHandler(ipcMain, "reports:productsales", getProductSalesReport);
  registerHandler(ipcMain, "reports:purchases", getPurchaseReport);
  registerHandler(ipcMain, "reports:stockvaluation", getStockValuationReport);
  registerHandler(ipcMain, "reports:commission", getCommissionReport);
  registerHandler(ipcMain, "reports:customerledger", getCustomerLedger);
  registerHandler(ipcMain, "reports:supplierledger", getSupplierLedger);
  registerHandler(ipcMain, "reports:customerstatement", getCustomerStatement);
  registerHandler(ipcMain, "reports:supplierstatement", getSupplierStatement);
  registerHandler(ipcMain, "reports:outstandingstatement", getOutstandingStatement);
  registerHandler(ipcMain, "reports:subledgerlookups", getSubLedgerLookups);

  registerHandler(ipcMain, "stockledger:lookups", getStockLedgerLookups);
  registerHandler(ipcMain, "stockledger:product", getProductLedger);
  registerHandler(ipcMain, "stockledger:warehouse", getWarehouseLedger);
  registerHandler(ipcMain, "stockledger:batch", getBatchLedger);
  registerHandler(ipcMain, "stockledger:card", getStockCard);
  registerHandler(ipcMain, "stockledger:history", getInventoryHistory);
  registerHandler(ipcMain, "stockledger:movements", getMovementHistory);

  registerHandler(ipcMain, "offers:list", listTradeOffers);
  registerHandler(ipcMain, "offers:save", saveTradeOffer);
  registerHandler(ipcMain, "offers:preview", previewInvoiceOffers);

  registerHandler(ipcMain, "distributor:recoverysheet", getDailyRecoverySheet);
  registerHandler(ipcMain, "distributor:recoverysalesman", getRecoveryBySalesman);
  registerHandler(ipcMain, "distributor:recoverycustomer", getRecoveryByCustomer);
  registerHandler(ipcMain, "distributor:recoverypending", getPendingRecoveryReport);
  registerHandler(ipcMain, "distributor:recoveryperformance", getRecoveryPerformance);
  registerHandler(ipcMain, "distributor:recoveryaging", getRecoveryAgingReport);
  registerHandler(ipcMain, "distributor:routereport", getRouteReport);
  registerHandler(ipcMain, "distributor:routesummary", getDailyRouteSummary);
  registerHandler(ipcMain, "distributor:dailycash", getDailyCashSummary);
  registerHandler(ipcMain, "distributor:finalsheet", getDailyFinalSheet);
  registerHandler(ipcMain, "distributor:search", globalSearch);

  registerHandler(ipcMain, "documents:timeline", getDocumentTimeline);
  registerHandler(ipcMain, "documents:editable", assertDocumentEditable);
  registerHandler(ipcMain, "documents:reverse", reverseDocument);
  registerHandler(ipcMain, "documents:reverse:sales", reverseSalesInvoice);
  registerHandler(ipcMain, "documents:reverse:purchase", reversePurchaseInvoice);
  registerHandler(ipcMain, "documents:reverse:recovery", reverseRecoveryVoucher);

  registerHandler(ipcMain, "salesman:targets:list", listSalesmanTargets);
  registerHandler(ipcMain, "salesman:targets:save", saveSalesmanTarget);
  registerHandler(ipcMain, "salesman:performance", getSalesmanPerformance);

  registerHandler(ipcMain, "expenses:list", listExpenses);
  registerHandler(ipcMain, "expenses:save", saveExpense);

  registerHandler(
    ipcMain,
    "tools:backup",
    async (_, __, event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      return createBackup(win);
    },
    { needsWindow: true }
  );
  registerHandler(ipcMain, "tools:backup:local", createLocalBackup);
  registerHandler(ipcMain, "tools:backup:list", listLocalBackups);
  registerHandler(
    ipcMain,
    "tools:restore",
    async (_, __, event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      return restoreBackup(win);
    },
    { needsWindow: true }
  );
  registerHandler(ipcMain, "tools:export:entities", getExportEntities);
  registerHandler(
    ipcMain,
    "tools:export:csv",
    async (entity, __, event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      return exportEntityCsv(win, entity);
    },
    { needsWindow: true }
  );
  registerHandler(
    ipcMain,
    "tools:import:csv",
    async (entity, __, event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      return importEntityCsv(win, entity);
    },
    { needsWindow: true }
  );
  registerHandler(
    ipcMain,
    "tools:printHtml",
    async (html, __, event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      return printHtml(win, html);
    },
    { needsWindow: true }
  );

  registerHandler(ipcMain, "settings:get", getSettings);
  registerHandler(ipcMain, "settings:save", saveSettings);
  registerHandler(ipcMain, "settings:sequences:list", listDocumentSequences);
  registerHandler(ipcMain, "settings:sequences:save", saveDocumentSequence);
  registerHandler(ipcMain, "settings:mappings:list", getAccountMappings);
  registerHandler(ipcMain, "settings:mappings:save", saveAccountMapping);
  registerHandler(ipcMain, "tools:integrity", runIntegrityChecks);
}

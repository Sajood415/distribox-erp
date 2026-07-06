import { ipcMain, BrowserWindow } from "electron";
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
  listPendingDeliveries,
  convertQuotationToInvoice,
} from "../services/sales";
import { listRecoveries, saveRecovery, getCustomerOutstandingInvoices } from "../services/recovery";
import {
  listLoadSlips,
  saveLoadSlip,
  markLoadSlipDelivered,
  listDeliveryMen,
  saveDeliveryMan,
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

function wrap(handler) {
  return async (_, payload) => {
    try {
      return await handler(payload);
    } catch (error) {
      return { success: false, error: error.message || "Unexpected error" };
    }
  };
}

export function registerIpcHandlers() {
  ipcMain.handle("auth:login", wrap(loginUser));
  ipcMain.handle("auth:validate", wrap((token) => validateSession(token)));
  ipcMain.handle("auth:logout", wrap((token) => logoutUser(token)));

  ipcMain.handle("company:list", wrap(listCompanies));
  ipcMain.handle("company:create", wrap(createCompany));
  ipcMain.handle("company:select", wrap(selectCompany));

  ipcMain.handle("masters:lookups", wrap(getMasterLookups));

  ipcMain.handle("masters:units:list", wrap(listUnits));
  ipcMain.handle("masters:units:save", wrap(saveUnit));
  ipcMain.handle("masters:units:delete", wrap(deleteUnit));

  ipcMain.handle("masters:warehouses:list", wrap(listWarehouses));
  ipcMain.handle("masters:warehouses:save", wrap(saveWarehouse));
  ipcMain.handle("masters:warehouses:delete", wrap(deleteWarehouse));

  ipcMain.handle("masters:accounts:list", wrap(listAccounts));
  ipcMain.handle("masters:accounts:save", wrap(saveAccount));
  ipcMain.handle("masters:accounts:delete", wrap(deleteAccount));

  ipcMain.handle("masters:routes:list", wrap(listRoutes));
  ipcMain.handle("masters:routes:save", wrap(saveRoute));
  ipcMain.handle("masters:routes:delete", wrap(deleteRoute));

  ipcMain.handle("masters:salesmen:list", wrap(listSalesmen));
  ipcMain.handle("masters:salesmen:save", wrap(saveSalesman));
  ipcMain.handle("masters:salesmen:delete", wrap(deleteSalesman));

  ipcMain.handle("masters:products:list", wrap(listProducts));
  ipcMain.handle("masters:products:save", wrap(saveProduct));
  ipcMain.handle("masters:products:delete", wrap(deleteProduct));

  ipcMain.handle("masters:customers:list", wrap(listCustomers));
  ipcMain.handle("masters:customers:save", wrap(saveCustomer));
  ipcMain.handle("masters:customers:delete", wrap(deleteCustomer));

  ipcMain.handle("masters:vendors:list", wrap(listVendors));
  ipcMain.handle("masters:vendors:save", wrap(saveVendor));
  ipcMain.handle("masters:vendors:delete", wrap(deleteVendor));

  ipcMain.handle("purchase:lookups", wrap(getPurchaseLookups));
  ipcMain.handle("purchase:invoices:list", wrap(listPurchaseInvoices));
  ipcMain.handle("purchase:invoices:get", wrap(getPurchaseInvoice));
  ipcMain.handle("purchase:invoices:save", wrap(savePurchaseInvoice));
  ipcMain.handle("purchase:invoices:preview", wrap(previewPurchaseTotals));
  ipcMain.handle("purchase:returns:list", wrap(listPurchaseReturns));
  ipcMain.handle("purchase:returns:save", wrap(savePurchaseReturn));
  ipcMain.handle("stock:list", wrap(listStock));
  ipcMain.handle("inventory:lookups", wrap(getInventoryLookups));
  ipcMain.handle("inventory:stocktake:sheet", wrap(getStockTakeSheet));
  ipcMain.handle("inventory:stocktake:finalize", wrap(finalizeStockTake));
  ipcMain.handle("inventory:opening:save", wrap(saveOpeningStock));
  ipcMain.handle("inventory:adjustments:save", wrap(saveStockAdjustment));
  ipcMain.handle("inventory:adjustments:list", wrap(listStockAdjustments));
  ipcMain.handle("inventory:transfers:save", wrap(saveStockTransfer));
  ipcMain.handle("inventory:transfers:list", wrap(listStockTransfers));
  ipcMain.handle("inventory:reports:lowstock", wrap(getLowStockReport));
  ipcMain.handle("inventory:reports:expiry", wrap(getExpiryReport));

  ipcMain.handle("sales:lookups", wrap(getSalesLookups));
  ipcMain.handle("sales:quotations:list", wrap(listQuotations));
  ipcMain.handle("sales:quotations:save", wrap(saveQuotation));
  ipcMain.handle("sales:quotations:convert", wrap(convertQuotationToInvoice));
  ipcMain.handle("sales:invoices:list", wrap(listSalesInvoices));
  ipcMain.handle("sales:invoices:save", wrap(saveSalesInvoice));
  ipcMain.handle("sales:invoices:pending", wrap(listPendingDeliveries));
  ipcMain.handle("sales:recoveries:list", wrap(listRecoveries));
  ipcMain.handle("sales:recoveries:save", wrap(saveRecovery));
  ipcMain.handle("sales:recoveries:outstanding", wrap(getCustomerOutstandingInvoices));
  ipcMain.handle("sales:loadslips:list", wrap(listLoadSlips));
  ipcMain.handle("sales:loadslips:save", wrap(saveLoadSlip));
  ipcMain.handle("sales:loadslips:deliver", wrap(markLoadSlipDelivered));
  ipcMain.handle("sales:deliverymen:list", wrap(listDeliveryMen));
  ipcMain.handle("sales:deliverymen:save", wrap(saveDeliveryMan));

  ipcMain.handle("claims:lookups", wrap(getClaimLookups));
  ipcMain.handle("claims:list", wrap(listClaims));
  ipcMain.handle("claims:save", wrap(saveClaim));
  ipcMain.handle("claims:status", wrap(updateClaimStatus));
  ipcMain.handle("claims:settle", wrap(settleClaim));
  ipcMain.handle("claims:report", wrap(getClaimReport));
  ipcMain.handle("sales:returns:list", wrap(listSalesReturns));
  ipcMain.handle("sales:returns:save", wrap(saveSalesReturn));
  ipcMain.handle("sales:returns:invoice", wrap(getSalesInvoiceForReturn));

  ipcMain.handle("accounting:lookups", wrap(getAccountingLookups));
  ipcMain.handle("accounting:vouchers:list", wrap(listVouchers));
  ipcMain.handle("accounting:vouchers:save", wrap(saveVoucher));
  ipcMain.handle("accounting:vouchers:quicklines", wrap(buildQuickVoucherLines));
  ipcMain.handle("accounting:journal:list", wrap(listJournalEntries));
  ipcMain.handle("accounting:trialbalance", wrap(getTrialBalance));
  ipcMain.handle("accounting:cashbook", wrap(getCashbook));
  ipcMain.handle("accounting:ledger", wrap(getAccountLedger));
  ipcMain.handle("accounting:dailycash", wrap(getDailyCashPosition));
  ipcMain.handle("accounting:profitloss", wrap(getProfitAndLoss));

  ipcMain.handle("reports:aging", wrap(getAgingReport));
  ipcMain.handle("reports:balancesheet", wrap(getBalanceSheet));
  ipcMain.handle("reports:incomestatement", wrap(getIncomeStatement));
  ipcMain.handle("reports:customeroutstanding", wrap(getCustomerOutstandingReport));
  ipcMain.handle("reports:customersales", wrap(getCustomerSalesReport));
  ipcMain.handle("reports:recovery", wrap(getRecoveryReport));
  ipcMain.handle("reports:salesmen", wrap(getSalesmanReport));
  ipcMain.handle("reports:productsales", wrap(getProductSalesReport));
  ipcMain.handle("reports:purchases", wrap(getPurchaseReport));
  ipcMain.handle("reports:stockvaluation", wrap(getStockValuationReport));
  ipcMain.handle("reports:commission", wrap(getCommissionReport));

  ipcMain.handle("tools:backup", async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      return await createBackup(win);
    } catch (error) {
      return { success: false, error: error.message || "Backup failed" };
    }
  });
  ipcMain.handle("tools:backup:local", wrap(createLocalBackup));
  ipcMain.handle("tools:backup:list", wrap(listLocalBackups));
  ipcMain.handle("tools:restore", async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      return await restoreBackup(win);
    } catch (error) {
      return { success: false, error: error.message || "Restore failed" };
    }
  });
  ipcMain.handle("tools:export:entities", wrap(getExportEntities));
  ipcMain.handle("tools:export:csv", async (event, entity) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      return await exportEntityCsv(win, entity);
    } catch (error) {
      return { success: false, error: error.message || "Export failed" };
    }
  });
  ipcMain.handle("tools:import:csv", async (event, entity) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      return await importEntityCsv(win, entity);
    } catch (error) {
      return { success: false, error: error.message || "Import failed" };
    }
  });
  ipcMain.handle("tools:printHtml", async (event, html) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      return await printHtml(win, html);
    } catch (error) {
      return { success: false, error: error.message || "Print failed" };
    }
  });
}

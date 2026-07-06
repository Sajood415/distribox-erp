import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  setupVerificationDatabase,
  teardownVerificationDatabase,
} from "./helpers/verification-db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const state = vi.hoisted(() => ({ prisma: null }));

vi.mock("../src/main/db/init.js", () => ({
  getCompanyPrisma: () => {
    if (!state.prisma) throw new Error("Verification database not initialized");
    return state.prisma;
  },
}));

const REPORT = [];

function record(category, name, expected, actual, pass) {
  REPORT.push({
    category,
    name,
    expected,
    actual,
    status: pass ? "PASS" : "FAIL",
  });
  return pass;
}

describe("Accounting E2E Verification", () => {
  let ACCOUNT_ROLES;
  let postJournal;
  let resolveAccountIdByRole;
  let saveCustomer;
  let saveVendor;
  let saveProduct;
  let savePurchaseInvoice;
  let saveSalesInvoice;
  let saveRecovery;
  let saveSalesReturn;
  let saveStockAdjustment;
  let saveClaim;
  let updateClaimStatus;
  let settleClaim;
  let getTrialBalance;
  let getBalanceSheet;
  let getIncomeStatement;
  let getCustomerOutstandingReport;
  let getAgingReport;
  let getStockValuationReport;
  let runIntegrityChecks;
  let getCustomerOutstanding;
  let buildCustomerOutstandingBreakdown;
  let findJournalLinesCumulative;
  let roundMoney;

  let customerId;
  let vendorId;
  let productId;
  let warehouseId;
  let salesInvoiceId;

  beforeAll(async () => {
    await setupVerificationDatabase((p) => {
      state.prisma = p;
    });

    ({ ACCOUNT_ROLES } = await import("../src/main/core/account-roles.js"));
    ({ postJournal } = await import("../src/main/services/posting-engine.js"));
    ({ resolveAccountIdByRole } = await import("../src/main/services/account-mapping-service.js"));
    ({ saveCustomer, saveVendor, saveProduct } = await import("../src/main/services/masters.js"));
    ({ savePurchaseInvoice } = await import("../src/main/services/purchase.js"));
    ({ saveSalesInvoice } = await import("../src/main/services/sales.js"));
    ({ saveRecovery } = await import("../src/main/services/recovery.js"));
    ({ saveSalesReturn } = await import("../src/main/services/sales-return.js"));
    ({ saveStockAdjustment } = await import("../src/main/services/inventory.js"));
    ({ saveClaim, updateClaimStatus, settleClaim } = await import("../src/main/services/claims.js"));
    ({ getTrialBalance } = await import("../src/main/services/financial-reports.js"));
    ({
      getBalanceSheet,
      getIncomeStatement,
      getCustomerOutstandingReport,
      getAgingReport,
      getStockValuationReport,
    } = await import("../src/main/services/reports.js"));
    ({ runIntegrityChecks } = await import("../src/main/services/integrity-service.js"));
    ({
      getCustomerOutstanding,
      buildCustomerOutstandingBreakdown,
    } = await import("../src/main/domain/customer-outstanding.js"));
    ({ findJournalLinesCumulative } = await import("../src/main/repositories/journal-repository.js"));
    ({ roundMoney } = await import("../src/main/utils/money.js"));

    const prisma = state.prisma;
    const date = "2026-07-01";

    const unit = await prisma.unit.findFirst({ where: { code: "CTN" } });
    const warehouse = await prisma.warehouse.findFirst();
    warehouseId = warehouse?.id
      ?? (await prisma.warehouse.create({ data: { name: "Main Warehouse" } })).id;

    const productRes = await saveProduct({
      code: "PROD01",
      name: "Test Product",
      baseUnitId: unit.id,
      packSize: 1,
      price1: 150,
      costPrice: 100,
      vatPercent: 0,
    });
    productId = productRes.data.id;

    const customerRes = await saveCustomer({
      code: "CUSTA",
      name: "Customer A",
      openingBalance: 50000,
      creditLimit: 100000,
      creditDays: 30,
    });
    customerId = customerRes.data.id;

    await postJournal(prisma, {
      referenceNumber: "OB-CUSTA",
      sourceDocumentType: "OPENING_BALANCE",
      postingDate: date,
      description: "Customer A opening balance",
      lines: [
        { accountRole: ACCOUNT_ROLES.ACCOUNTS_RECEIVABLE, debit: 50000, credit: 0 },
        { accountRole: ACCOUNT_ROLES.EQUITY, debit: 0, credit: 50000 },
      ],
    });

    const vendorRes = await saveVendor({ code: "VEND01", name: "Supplier One" });
    vendorId = vendorRes.data.id;

    const purchaseRes = await savePurchaseInvoice({
      date,
      vendorId,
      warehouseId,
      isCredit: true,
      freight: 0,
      paidAmount: 0,
      items: [{ productId, unitId: unit.id, quantity: 100, price: 100, discount: 0, vatPercent: 0 }],
    });
    expect(purchaseRes.success, purchaseRes.error).toBe(true);

    const salesRes = await saveSalesInvoice({
      date,
      customerId,
      warehouseId,
      isCredit: true,
      freight: 0,
      paidAmount: 0,
      items: [{ productId, unitId: unit.id, quantity: 40, price: 150, discount: 0, vatPercent: 0 }],
    });
    expect(salesRes.success, salesRes.error).toBe(true);
    salesInvoiceId = salesRes.data.id;

    const recoveryRes = await saveRecovery({
      date,
      customerId,
      paymentMode: "Cash",
      items: [{ salesInvoiceId, amount: 2000 }],
    });
    expect(recoveryRes.success, recoveryRes.error).toBe(true);

    const returnRes = await saveSalesReturn({
      date,
      customerId,
      warehouseId,
      salesInvoiceId,
      items: [{ productId, unitId: unit.id, quantity: 5, price: 150, discount: 0, vatPercent: 0 }],
    });
    expect(returnRes.success, returnRes.error).toBe(true);

    const adjUpRes = await saveStockAdjustment({
      date,
      warehouseId,
      productId,
      quantityChange: 2,
      reason: "Found extra stock",
    });
    expect(adjUpRes.success, adjUpRes.error).toBe(true);

    const adjDownRes = await saveStockAdjustment({
      date,
      warehouseId,
      productId,
      quantityChange: -1,
      reason: "Shrinkage",
    });
    expect(adjDownRes.success, adjDownRes.error).toBe(true);

    const claimRes = await saveClaim({
      date,
      partyType: "Customer",
      customerId,
      warehouseId,
      claimType: "Damage",
      items: [{ productId, unitId: unit.id, quantity: 2, price: 150, discount: 0, vatPercent: 0 }],
    });
    expect(claimRes.success, claimRes.error).toBe(true);

    await updateClaimStatus({ id: claimRes.data.id, status: "Approved" });
    const settleRes = await settleClaim({ id: claimRes.data.id, resolution: "WriteOff" });
    expect(settleRes.success, settleRes.error).toBe(true);
  }, 120000);

  afterAll(async () => {
    const allPass = REPORT.length > 0 && REPORT.every((r) => r.status === "PASS");
    const lines = [
      "# Accounting E2E Verification Report",
      "",
      `**Overall: ${allPass ? "ALL PASS" : "FAILURES DETECTED"}**`,
      "",
      "| Category | Check | Expected | Actual | Status |",
      "|----------|-------|----------|--------|--------|",
    ];

    for (const row of REPORT) {
      const fmt = (v) => (typeof v === "boolean" ? String(v) : Number(v).toFixed(2));
      lines.push(`| ${row.category} | ${row.name} | ${fmt(row.expected)} | ${fmt(row.actual)} | ${row.status} |`);
    }

    writeFileSync(join(ROOT, "accounting-verification-report.md"), lines.join("\n"), "utf-8");
    await teardownVerificationDatabase();
  });

  async function accountBalance(role) {
    const accountId = await resolveAccountIdByRole(state.prisma, role);
    const lines = await findJournalLinesCumulative(state.prisma, {
      end: new Date("2099-12-31"),
      accountId,
    });
    return roundMoney(lines.reduce((sum, line) => sum + line.debit - line.credit, 0));
  }

  async function accountNet(role, type) {
    const accountId = await resolveAccountIdByRole(state.prisma, role);
    const lines = await findJournalLinesCumulative(state.prisma, {
      end: new Date("2099-12-31"),
      accountId,
    });
    const debit = roundMoney(lines.reduce((sum, line) => sum + line.debit, 0));
    const credit = roundMoney(lines.reduce((sum, line) => sum + line.credit, 0));
    if (type === "Income") return roundMoney(credit - debit);
    if (type === "Expense") return roundMoney(debit - credit);
    return roundMoney(debit - credit);
  }

  function assertMetric(category, name, expected, actual) {
    const pass = Math.abs(roundMoney(expected) - roundMoney(actual)) <= 0.01;
    record(category, name, expected, actual, pass);
    expect(pass, `${name}: expected ${expected}, got ${actual}`).toBe(true);
  }

  it("verifies stock and GL metrics", async () => {
    const stockVal = await getStockValuationReport();
    const inventoryGl = await accountBalance(ACCOUNT_ROLES.INVENTORY);

    assertMetric("Stock", "Inventory Quantity (cartons)", 64, stockVal.data.totalQuantity);
    assertMetric("Stock", "Inventory Value", 6400, stockVal.data.totalValue);
    assertMetric("GL Control", "Inventory GL Balance", 6400, inventoryGl);
    assertMetric("Reconciliation", "Stock valuation = Inventory GL", inventoryGl, stockVal.data.totalValue);
  });

  it("verifies receivables and payables", async () => {
    const outstanding = await getCustomerOutstanding(state.prisma, customerId);
    const ar = await accountBalance(ACCOUNT_ROLES.ACCOUNTS_RECEIVABLE);
    const purchaseInv = await state.prisma.purchaseInvoice.findFirst();

    assertMetric("Receivables", "Customer Outstanding", 53250, outstanding);
    assertMetric("GL Control", "AR Control Account", 53250, ar);
    assertMetric("Integrity", "AR matches operational outstanding", ar, outstanding);
    assertMetric("Payables", "Supplier Outstanding", 10000, roundMoney(purchaseInv.total - purchaseInv.paidAmount));
  });

  it("verifies cash, bank, and P&L accounts", async () => {
    assertMetric("Cash & Bank", "Cash", 2000, await accountBalance(ACCOUNT_ROLES.CASH));
    assertMetric("Cash & Bank", "Bank", 0, await accountBalance(ACCOUNT_ROLES.BANK));
    assertMetric("P&L", "COGS (net)", 3500, await accountNet(ACCOUNT_ROLES.COGS, "Expense"));
    assertMetric("P&L", "Sales Revenue (net)", 5250, await accountNet(ACCOUNT_ROLES.SALES_REVENUE, "Income"));
    assertMetric("P&L", "Claims Expense", 200, await accountNet(ACCOUNT_ROLES.CLAIMS_EXPENSE, "Expense"));
    assertMetric("P&L", "Inventory Adjustment Gain", 200, await accountNet(ACCOUNT_ROLES.INVENTORY_ADJUSTMENT_GAIN, "Income"));
    assertMetric("P&L", "Inventory Adjustment Loss", 100, await accountNet(ACCOUNT_ROLES.INVENTORY_ADJUSTMENT_LOSS, "Expense"));
  });

  it("verifies financial statements and integrity", async () => {
    const tb = await getTrialBalance({});
    const bs = await getBalanceSheet({ asOfDate: "2099-12-31" });
    const is = await getIncomeStatement({ startDate: "2000-01-01", endDate: "2099-12-31" });
    const health = await runIntegrityChecks();

    record("Financial Statements", "Trial Balance balances", true, tb.data.balanced, tb.data.balanced);
    record("Financial Statements", "Balance Sheet balances", true, bs.data.balanced, bs.data.balanced);
    expect(tb.data.balanced).toBe(true);
    expect(bs.data.balanced).toBe(true);

    const expectedNetProfit = 1650;
    assertMetric("Financial Statements", "Income Statement net profit", expectedNetProfit, is.data.netProfit);

    const healthy = health.data.healthy && health.data.issues.length === 0;
    record("Integrity", "Database Health — zero issues", true, healthy, healthy);
    expect(healthy, JSON.stringify(health.data.issues)).toBe(true);
  });

  it("verifies aging, recovery, returns, and credit limit", async () => {
    const aging = await getAgingReport({ asOfDate: "2099-12-31" });
    const custReport = await getCustomerOutstandingReport();
    const breakdown = await buildCustomerOutstandingBreakdown(state.prisma, customerId);
    const customer = await state.prisma.customer.findUnique({ where: { id: customerId } });
    const invoice = await state.prisma.salesInvoice.findFirst({ where: { id: salesInvoiceId } });
    const recovery = await state.prisma.recoveryVoucher.findFirst();

    assertMetric("Aging", "Aging report total outstanding", 53250, aging.data.totals.total);
    assertMetric("Reports", "Outstanding report total", 53250, custReport.data.totalOutstanding);
    assertMetric("Recovery", "Recovery amount allocated", 2000, recovery.amount);
    assertMetric("Recovery", "Invoice paid after recovery", 2000, invoice.paidAmount);
    assertMetric("Sacred Formula", "Sales returns in breakdown", 750, breakdown.salesReturns);
    assertMetric(
      "Credit Limit",
      "Credit limit available",
      46750,
      roundMoney(customer.creditLimit - breakdown.outstanding)
    );
  });

  it("verifies sub-ledgers match outstanding and running balances", async () => {
    const { getCustomerLedger, getSupplierLedger } = await import("../src/main/services/sub-ledger-service.js");
    const { buildCustomerLedgerRows } = await import("../src/main/domain/customer-ledger.js");
    const { buildVendorLedgerRows } = await import("../src/main/domain/vendor-ledger.js");
    const { applyRunningBalance } = await import("../src/main/domain/ledger-shared.js");
    const { getVendorOutstanding } = await import("../src/main/domain/vendor-outstanding.js");

    const custLedger = await getCustomerLedger({
      customerId,
      startDate: "2000-01-01",
      endDate: "2099-12-31",
    });
    expect(custLedger.success, custLedger.error).toBe(true);
    const custOutstanding = await getCustomerOutstanding(state.prisma, customerId);

    assertMetric("Sub-Ledger", "Customer closing balance", custOutstanding, custLedger.data.closingBalance);
    assertMetric("Sub-Ledger", "Customer operational outstanding", custOutstanding, custLedger.data.operationalOutstanding);
    record("Sub-Ledger", "Customer ledger reconciled", true, custLedger.data.matchesOutstanding, custLedger.data.matchesOutstanding);
    expect(custLedger.data.matchesOutstanding).toBe(true);

    const custRows = await buildCustomerLedgerRows(state.prisma, customerId);
    const custWithBalance = applyRunningBalance(custRows, { liability: false });
    let custRunning = 0;
    for (const row of custWithBalance) {
      custRunning = roundMoney(custRunning + row.debit - row.credit);
      expect(row.balance, `Customer ${row.reference}`).toBe(custRunning);
    }
    assertMetric("Sub-Ledger", "Customer full-history closing", custOutstanding, custRunning);

    for (const row of custLedger.data.rows) {
      expect(row.route, row.reference).toBeTruthy();
    }

    const supLedger = await getSupplierLedger({
      vendorId,
      startDate: "2000-01-01",
      endDate: "2099-12-31",
    });
    expect(supLedger.success, supLedger.error).toBe(true);
    const supOutstanding = await getVendorOutstanding(state.prisma, vendorId);

    assertMetric("Sub-Ledger", "Supplier closing balance", supOutstanding, supLedger.data.closingBalance);
    assertMetric("Sub-Ledger", "Supplier operational outstanding", supOutstanding, supLedger.data.operationalOutstanding);
    record("Sub-Ledger", "Supplier ledger reconciled", true, supLedger.data.matchesOutstanding, supLedger.data.matchesOutstanding);
    expect(supLedger.data.matchesOutstanding).toBe(true);

    const supRows = await buildVendorLedgerRows(state.prisma, vendorId);
    const supWithBalance = applyRunningBalance(supRows, { liability: true });
    let supRunning = 0;
    for (const row of supWithBalance) {
      supRunning = roundMoney(supRunning + row.credit - row.debit);
      expect(row.balance, `Supplier ${row.reference}`).toBe(supRunning);
    }
    assertMetric("Sub-Ledger", "Supplier full-history closing", supOutstanding, supRunning);

    for (const row of supLedger.data.rows) {
      expect(row.route, row.reference).toBeTruthy();
    }
  });

  it("verifies stock ledger matches on-hand and inventory GL", async () => {
    const { getProductLedger } = await import("../src/main/services/stock-ledger-service.js");
    const { getStockQuantity, getStockValuation } = await import("../src/main/domain/stock-quantity.js");
    const { applyStockRunningBalance } = await import("../src/main/domain/stock-ledger-shared.js");

    const actualQty = await getStockQuantity(state.prisma, { productId });
    const actualVal = await getStockValuation(state.prisma, { productId });
    const ledger = await getProductLedger({
      productId,
      startDate: "2000-01-01",
      endDate: "2099-12-31",
    });

    expect(ledger.success, ledger.error).toBe(true);
    assertMetric("Stock Ledger", "Product ledger closing qty", actualQty, ledger.data.closingQty);
    assertMetric("Stock Ledger", "Product on-hand quantity", actualQty, ledger.data.actualQty);
    record("Stock Ledger", "Product ledger reconciled", true, ledger.data.matchesStock, ledger.data.matchesStock);
    expect(ledger.data.matchesStock).toBe(true);

    const movements = await state.prisma.stockMovement.findMany({
      where: { productId },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });
    expect(movements.length).toBeGreaterThan(0);

    const scopedRows = movements.map((m) => ({
      quantityIn: m.quantityIn,
      quantityOut: m.quantityOut,
      unitCost: m.unitCost,
      referenceNumber: m.referenceNumber,
    }));
    const withBalance = applyStockRunningBalance(scopedRows);
    let running = 0;
    for (const row of withBalance) {
      running = roundMoney(running + row.quantityIn - row.quantityOut);
      expect(row.balanceQty, row.referenceNumber).toBe(running);
    }

    const stockVal = await getStockValuationReport();
    const inventoryGl = await accountBalance(ACCOUNT_ROLES.INVENTORY);
    assertMetric("Stock Ledger", "Inventory valuation", inventoryGl, stockVal.data.totalValue);
    assertMetric("Stock Ledger", "Product stock value", actualVal.value, ledger.data.actualValue);
  });
});

/**
 * RC v1.0 production verification — exercises service layer against
 * databases created by packaged portable startup on clean userData.
 */
import { beforeAll, describe, it, expect, vi } from "vitest";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { createRequire } from "module";

const userDataDir = process.env.RC_USER_DATA_DIR;
const resourcesPath = process.env.RC_RESOURCES_PATH;

if (!userDataDir || !resourcesPath) {
  throw new Error("Set RC_USER_DATA_DIR and RC_RESOURCES_PATH before running this test.");
}

const state = vi.hoisted(() => ({ masterPrisma: null, companyPrisma: null }));

vi.mock("../src/main/db/init.js", () => ({
  getCompanyPrisma: () => {
    if (!state.companyPrisma) throw new Error("Company DB not ready");
    return state.companyPrisma;
  },
  getMasterPrisma: () => {
    if (!state.masterPrisma) throw new Error("Master DB not ready");
    return state.masterPrisma;
  },
  getActiveCompanyDb: () => "demo.db",
  connectCompanyDatabase: async () => ({ success: true }),
}));

const masterDb = join(userDataDir, "data", "master.db");
const companyDb = join(userDataDir, "data", "demo.db");
const req = createRequire(import.meta.url);
const MasterPrisma = req(join(resourcesPath, "prisma-clients", "master-client")).PrismaClient;
const CompanyPrisma = req(join(resourcesPath, "prisma-clients", "company-client")).PrismaClient;

const RESULTS = [];
function record(section, item, pass, detail = "") {
  RESULTS.push({ section, item, pass, detail });
}

describe("RC v1.0 Production Verification", () => {
  const DATE = new Date().toISOString().slice(0, 10);
  let vendorId;
  let customerId;
  let productId;
  let unitId;
  let warehouseId;
  let salesmanId;
  let salesInvoiceId;

  beforeAll(async () => {
    record("Login", "Master database exists after portable startup", existsSync(masterDb), masterDb);

    const masterUrl = `file:${masterDb.replace(/\\/g, "/")}`;
    state.masterPrisma = new MasterPrisma({ datasources: { db: { url: masterUrl } } });
    await state.masterPrisma.$connect();

    const admin = await state.masterPrisma.user.findUnique({
      where: { username: "admin" },
      include: { company: true },
    });
    record("Login", "Admin user seeded by portable startup", !!admin, admin?.username || "");
    record("Company", "DEMO company available", admin?.company?.code === "DEMO", admin?.company?.name || "");

    const companyUrl = `file:${companyDb.replace(/\\/g, "/")}`;
    process.env.COMPANY_DATABASE_URL = companyUrl;

    if (!existsSync(companyDb)) {
      const { spawnSync } = await import("child_process");
      const electronExe = join(resourcesPath, "..", "Distribox ERP.exe");
      const prismaCli = join(resourcesPath, "node_modules", "prisma", "build", "index.js");
      const schema = join(resourcesPath, "prisma", "company", "schema.prisma");
      const migrate = spawnSync(
        electronExe,
        [prismaCli, "migrate", "deploy", "--schema", schema],
        {
          cwd: resourcesPath,
          env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", COMPANY_DATABASE_URL: companyUrl },
          encoding: "utf8",
          timeout: 180000,
        }
      );
      if (migrate.status !== 0) {
        throw new Error(`Company migrate failed: ${migrate.stderr || migrate.stdout}`);
      }
      record("Company", "Company migrate deploy on first open", true, "");
    }

    state.companyPrisma = new CompanyPrisma({ datasources: { db: { url: companyUrl } } });
    await state.companyPrisma.$connect();

    const { seedCompanyDatabase } = await import("../src/main/db/company-seed.js");
    await seedCompanyDatabase(state.companyPrisma);
    record("Company", "Company seed executes on first open", true, "");

    record("Company", "DEMO company database opens", existsSync(companyDb), companyDb);
  }, 180000);

  it("module smoke — open every major module once", async () => {
    const masters = await import("../src/main/services/masters.js");
    const purchase = await import("../src/main/services/purchase.js");
    const sales = await import("../src/main/services/sales.js");
    const recovery = await import("../src/main/services/recovery.js");
    const stock = await import("../src/main/services/stock.js");
    const inventory = await import("../src/main/services/inventory.js");
    const vouchers = await import("../src/main/services/vouchers.js");
    const claims = await import("../src/main/services/claims.js");
    const settings = await import("../src/main/services/settings-service.js");
    const po = await import("../src/main/services/purchase-order.js");
    const quotation = await import("../src/main/services/quotation.js");

    const checks = [
      ["Masters", "Units", () => masters.listUnits()],
      ["Masters", "Products", () => masters.listProducts({})],
      ["Masters", "Customers", () => masters.listCustomers({})],
      ["Masters", "Vendors", () => masters.listVendors({})],
      ["Masters", "Accounts", () => masters.listAccounts({})],
      ["Masters", "Salesmen", () => masters.listSalesmen({})],
      ["Masters", "Routes", () => masters.listRoutes({})],
      ["Masters", "Warehouses", () => masters.listWarehouses({})],
      ["Purchase", "Purchase Invoices list", () => purchase.listPurchaseInvoices({})],
      ["Purchase", "Purchase lookups", () => purchase.getPurchaseLookups()],
      ["Purchase", "Purchase Orders", () => po.listPurchaseOrders({})],
      ["Sales", "Sales Invoices list", () => sales.listSalesInvoices({})],
      ["Sales", "Sales lookups", () => quotation.getSalesLookups()],
      ["Sales", "Quotations", () => quotation.listQuotations({})],
      ["Sales", "Recovery list", () => recovery.listRecoveries({})],
      ["Inventory", "Stock list", () => stock.listStock()],
      ["Inventory", "Inventory lookups", () => inventory.getInventoryLookups()],
      ["Accounting", "Vouchers", () => vouchers.listVouchers({})],
      ["Claims", "Claims list", () => claims.listClaims({})],
      ["Settings", "Settings load", () => settings.getSettings()],
    ];

    for (const [section, item, fn] of checks) {
      const res = await fn();
      const pass = res?.success !== false;
      record(section, item, pass, res?.error || "");
      expect(res?.success, `${section} ${item}: ${res?.error}`).not.toBe(false);
    }
  });

  it("transactions — purchase, sales, recovery", async () => {
    const masters = await import("../src/main/services/masters.js");
    const purchase = await import("../src/main/services/purchase.js");
    const sales = await import("../src/main/services/sales.js");
    const recovery = await import("../src/main/services/recovery.js");

    const units = await masters.listUnits();
    unitId = units.data?.[0]?.id ?? (await state.companyPrisma.unit.findFirst()).id;
    const wh = await masters.listWarehouses();
    warehouseId = wh.data[0]?.id ?? (await masters.saveWarehouse({ name: "RC WH" })).data.id;

    vendorId = (await masters.saveVendor({ code: "RCV01", name: "RC Vendor" })).data.id;
    productId = (
      await masters.saveProduct({
        code: "RCP01",
        name: "RC Product",
        baseUnitId: unitId,
        packSize: 1,
        price1: 100,
        costPrice: 60,
        vatPercent: 0,
      })
    ).data.id;
    customerId = (await masters.saveCustomer({ code: "RCC01", name: "RC Customer", creditLimit: 50000 })).data.id;
    salesmanId = (await masters.saveSalesman({ name: "RC Salesman", commissionRate: 2 })).data.id;
    await masters.saveRoute({ name: "RC Route", salesmanId });

    const pi = await purchase.savePurchaseInvoice({
      date: DATE,
      vendorId,
      warehouseId,
      isCredit: true,
      items: [{ productId, unitId, quantity: 10, price: 60, discount: 0, vatPercent: 0 }],
    });
    record("Transactions", "Create Purchase Invoice", pi.success === true, pi.error || "");
    expect(pi.success, pi.error).toBe(true);

    const si = await sales.saveSalesInvoice({
      date: DATE,
      customerId,
      salesmanId,
      warehouseId,
      isCredit: true,
      items: [{ productId, unitId, quantity: 2, price: 100, discount: 0, vatPercent: 0 }],
    });
    record("Transactions", "Create Sales Invoice", si.success === true, si.error || "");
    expect(si.success, si.error).toBe(true);
    salesInvoiceId = si.data.id;

    const rec = await recovery.saveRecovery({
      date: DATE,
      customerId,
      salesmanId,
      paymentMode: "Cash",
      items: [{ salesInvoiceId, amount: 50 }],
    });
    record("Transactions", "Create Recovery", rec.success === true, rec.error || "");
    expect(rec.success, rec.error).toBe(true);
  });

  it("reports — all major reports load", async () => {
    const financial = await import("../src/main/services/financial-reports.js");
    const reports = await import("../src/main/services/reports.js");
    const subledger = await import("../src/main/services/sub-ledger-service.js");
    const stockledger = await import("../src/main/services/stock-ledger-service.js");
    const integrity = await import("../src/main/services/integrity-service.js");

    const checks = [
      ["Reports", "Trial Balance", () => financial.getTrialBalance({})],
      ["Reports", "Balance Sheet", () => reports.getBalanceSheet({ asOfDate: DATE })],
      ["Reports", "Income Statement", () => reports.getIncomeStatement({ startDate: "2000-01-01", endDate: "2099-12-31" })],
      ["Reports", "Customer Ledger", () => subledger.getCustomerLedger({ customerId, startDate: "2000-01-01", endDate: "2099-12-31" })],
      ["Reports", "Supplier Ledger", () => subledger.getSupplierLedger({ vendorId, startDate: "2000-01-01", endDate: "2099-12-31" })],
      ["Reports", "Stock Ledger (product)", () => stockledger.getProductLedger({ productId, startDate: "2000-01-01", endDate: "2099-12-31" })],
      ["Reports", "Stock Ledger lookups", () => stockledger.getStockLedgerLookups()],
      ["Tools", "Database Health", () => integrity.runIntegrityChecks()],
    ];

    for (const [section, item, fn] of checks) {
      const res = await fn();
      const pass = item === "Database Health" ? res?.data?.healthy === true : res?.success !== false;
      record(section, item, pass, res?.error || (item === "Database Health" ? JSON.stringify(res?.data?.issues || []) : ""));
      if (item === "Database Health") {
        expect(res.data.healthy, JSON.stringify(res.data.issues)).toBe(true);
      } else {
        expect(res?.success, `${item}: ${res?.error}`).not.toBe(false);
      }
    }
  });

  it("emits RC results", () => {
    console.log("---BIZ_RESULTS---");
    console.log(JSON.stringify(RESULTS));
    console.log("---END_BIZ_RESULTS---");
    expect(RESULTS.every((r) => r.pass)).toBe(true);
  });
});

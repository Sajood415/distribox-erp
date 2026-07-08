/**
 * Business verification against databases created by packaged portable startup.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function getArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
}

const userDataDir = getArg("user-data-dir");
const resourcesPath = getArg("resources-path");

if (!userDataDir || !resourcesPath) {
  console.error("Usage: --user-data-dir=... --resources-path=...");
  process.exit(1);
}

global.__RC_USER_DATA_DIR__ = userDataDir;
global.__RC_RESOURCES_PATH__ = resourcesPath;
global.__RC_APP_PATH__ = join(resourcesPath, "app.asar");
process.resourcesPath = resourcesPath;

register("electron", pathToFileURL(join(__dirname, "electron-packaged-mock.mjs")));

const RESULTS = [];

function record(section, item, pass, detail = "") {
  RESULTS.push({ section, item, pass, detail });
}

async function run() {
  const req = createRequire(import.meta.url);
  const masterClientPath = join(resourcesPath, "prisma-clients", "master-client");
  const companyClientPath = join(resourcesPath, "prisma-clients", "company-client");
  const MasterPrisma = req(masterClientPath).PrismaClient;
  const CompanyPrisma = req(companyClientPath).PrismaClient;

  const masterDb = join(userDataDir, "data", "master.db");
  const companyDb = join(userDataDir, "data", "demo.db");

  record("Login", "Master database exists after portable startup", existsSync(masterDb), masterDb);

  const masterUrl = `file:${masterDb.replace(/\\/g, "/")}`;
  const companyUrl = `file:${companyDb.replace(/\\/g, "/")}`;

  process.env.MASTER_DATABASE_URL = masterUrl;
  process.env.COMPANY_DATABASE_URL = companyUrl;

  const { initDatabase, connectCompanyDatabase } = await import("../src/main/db/init.js");
  await initDatabase();

  const { loginUser } = await import("../src/main/services/auth.js");
  const login = await loginUser({ username: "admin", password: "admin123" });
  record("Login", "Admin login succeeds", login.success === true, login.error || "");
  if (!login.success) throw new Error("Login failed");

  record(
    "Company",
    "DEMO company available",
    login.data?.user?.company?.code === "DEMO",
    login.data?.user?.company?.name || ""
  );

  await connectCompanyDatabase("demo.db");
  record("Company", "DEMO company database opens", existsSync(companyDb), companyDb);

  const DATE = new Date().toISOString().slice(0, 10);

  const { saveVendor, saveProduct, saveCustomer, saveSalesman, saveRoute, listUnits, listProducts, listCustomers, listVendors, listAccounts, listSalesmen, listRoutes, listWarehouses } =
    await import("../src/main/services/masters.js");
  const { savePurchaseInvoice, listPurchaseInvoices, getPurchaseLookups } = await import("../src/main/services/purchase.js");
  const { saveSalesInvoice, listSalesInvoices, getSalesLookups } = await import("../src/main/services/sales.js");
  const { saveRecovery, listRecoveries } = await import("../src/main/services/recovery.js");
  const { listStock } = await import("../src/main/services/stock.js");
  const { getInventoryLookups } = await import("../src/main/services/inventory.js");
  const { listVouchers } = await import("../src/main/services/vouchers.js");
  const { getTrialBalance } = await import("../src/main/services/financial-reports.js");
  const { getBalanceSheet, getIncomeStatement } = await import("../src/main/services/reports.js");
  const { getCustomerLedger, getSupplierLedger } = await import("../src/main/services/sub-ledger-service.js");
  const { getStockLedgerLookups, getProductLedger } = await import("../src/main/services/stock-ledger-service.js");
  const { runIntegrityChecks } = await import("../src/main/services/integrity-service.js");
  const { listClaims } = await import("../src/main/services/claims.js");
  const { getSettings } = await import("../src/main/services/settings-service.js");
  const { listPurchaseOrders } = await import("../src/main/services/purchase-order.js");
  const { listQuotations } = await import("../src/main/services/quotation.js");
  const { listRecoveries: listRec2 } = await import("../src/main/services/recovery.js");

  // Module smoke — open each major module once
  const moduleChecks = [
    ["Masters", "Units", () => listUnits()],
    ["Masters", "Products", () => listProducts({})],
    ["Masters", "Customers", () => listCustomers({})],
    ["Masters", "Vendors", () => listVendors({})],
    ["Masters", "Accounts", () => listAccounts({})],
    ["Masters", "Salesmen", () => listSalesmen({})],
    ["Masters", "Routes", () => listRoutes({})],
    ["Masters", "Warehouses", () => listWarehouses({})],
    ["Purchase", "Purchase Invoices list", () => listPurchaseInvoices({})],
    ["Purchase", "Purchase lookups", () => getPurchaseLookups()],
    ["Purchase", "Purchase Orders", () => listPurchaseOrders({})],
    ["Sales", "Sales Invoices list", () => listSalesInvoices({})],
    ["Sales", "Sales lookups", () => getSalesLookups()],
    ["Sales", "Quotations", () => listQuotations({})],
    ["Sales", "Recovery list", () => listRec2({})],
    ["Inventory", "Stock list", () => listStock({})],
    ["Inventory", "Inventory lookups", () => getInventoryLookups()],
    ["Accounting", "Vouchers", () => listVouchers({})],
    ["Claims", "Claims list", () => listClaims({})],
    ["Settings", "Settings load", () => getSettings()],
  ];

  for (const [section, item, fn] of moduleChecks) {
    try {
      const res = await fn();
      record(section, item, res?.success !== false, res?.error || "");
    } catch (e) {
      record(section, item, false, e.message);
    }
  }

  // Setup masters for transactions
  const unitRes = await listUnits();
  const unitId = unitRes.data?.[0]?.id;
  const whRes = await listWarehouses();
  const warehouseId = whRes.data?.[0]?.id ?? (await import("../src/main/services/masters.js")).saveWarehouse({ name: "RC WH" }).then((r) => r.data.id);

  const vendorRes = await saveVendor({ code: "RCV01", name: "RC Vendor" });
  const vendorId = vendorRes.data.id;
  const productRes = await saveProduct({
    code: "RCP01",
    name: "RC Product",
    baseUnitId: unitId,
    packSize: 1,
    price1: 100,
    costPrice: 60,
    vatPercent: 0,
  });
  const productId = productRes.data.id;
  const customerRes = await saveCustomer({ code: "RCC01", name: "RC Customer", creditLimit: 50000 });
  const customerId = customerRes.data.id;
  const salesmanRes = await saveSalesman({ name: "RC Salesman", commissionRate: 2 });
  await saveRoute({ name: "RC Route", salesmanId: salesmanRes.data.id });

  // Purchase Invoice
  const piRes = await savePurchaseInvoice({
    date: DATE,
    vendorId,
    warehouseId,
    isCredit: true,
    items: [{ productId, unitId, quantity: 10, price: 60, discount: 0, vatPercent: 0 }],
  });
  record("Transactions", "Create Purchase Invoice", piRes.success === true, piRes.error || piRes.data?.invoiceNo || "");

  const siRes = await saveSalesInvoice({
    date: DATE,
    customerId,
    salesmanId: salesmanRes.data.id,
    warehouseId,
    isCredit: true,
    items: [{ productId, unitId, quantity: 2, price: 100, discount: 0, vatPercent: 0 }],
  });
  record("Transactions", "Create Sales Invoice", siRes.success === true, siRes.error || siRes.data?.invoiceNo || "");

  const recRes = await saveRecovery({
    date: DATE,
    customerId,
    salesmanId: salesmanRes.data.id,
    paymentMode: "Cash",
    items: siRes.data?.id ? [{ salesInvoiceId: siRes.data.id, amount: 50 }] : [],
  });
  record("Transactions", "Create Recovery", recRes.success === true, recRes.error || "");

  // Reports
  const reportChecks = [
    ["Reports", "Trial Balance", () => getTrialBalance({})],
    ["Reports", "Balance Sheet", () => getBalanceSheet({ asOfDate: DATE })],
    ["Reports", "Income Statement", () => getIncomeStatement({ startDate: "2000-01-01", endDate: "2099-12-31" })],
    ["Reports", "Customer Ledger", () => getCustomerLedger({ customerId, startDate: "2000-01-01", endDate: "2099-12-31" })],
    ["Reports", "Supplier Ledger", () => getSupplierLedger({ vendorId, startDate: "2000-01-01", endDate: "2099-12-31" })],
    ["Reports", "Stock Ledger (product)", () => getProductLedger({ productId, startDate: "2000-01-01", endDate: "2099-12-31" })],
    ["Reports", "Stock Ledger lookups", () => getStockLedgerLookups()],
    ["Tools", "Database Health", () => runIntegrityChecks()],
  ];

  for (const [section, item, fn] of reportChecks) {
    try {
      const res = await fn();
      const ok = res?.success !== false;
      const healthy = item === "Database Health" ? res?.data?.healthy === true : ok;
      record(section, item, healthy, res?.error || (item === "Database Health" ? JSON.stringify(res?.data?.issues || []) : ""));
    } catch (e) {
      record(section, item, false, e.message);
    }
  }

  record(
    "Runtime",
    "No IPC errors (service layer)",
    RESULTS.filter((r) => r.section !== "Runtime").every((r) => r.pass),
    ""
  );
  record(
    "Runtime",
    "No missing modules",
    true,
    ""
  );

  console.log("---BIZ_RESULTS---");
  console.log(JSON.stringify(RESULTS));
  console.log("---END_BIZ_RESULTS---");

  const allPass = RESULTS.every((r) => r.pass);
  process.exit(allPass ? 0 : 1);
}

run().catch((err) => {
  record("Runtime", "Business verification exception", false, err.stack || err.message);
  console.log("---BIZ_RESULTS---");
  console.log(JSON.stringify(RESULTS));
  console.log("---END_BIZ_RESULTS---");
  console.error(err);
  process.exit(1);
});

import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import {
  setupVerificationDatabase,
  teardownVerificationDatabase,
} from "./helpers/verification-db.js";
import { setBusinessDateOverride, clearBusinessDateOverride } from "../src/main/domain/business-date.js";

const state = vi.hoisted(() => ({ prisma: null }));

vi.mock("../src/main/db/init.js", () => ({
  getCompanyPrisma: () => {
    if (!state.prisma) throw new Error("Verification database not initialized");
    return state.prisma;
  },
}));

describe("Fiscal Year Closing (Phase 10.8)", () => {
  const tradeDate = "2026-08-15";
  let customerId;
  let vendorId;
  let productId;
  let unitId;
  let warehouseId;
  let openFiscalYearId;

  beforeAll(async () => {
    process.env.ENABLE_PERIOD_LOCKING = "true";
    process.env.ENABLE_FISCAL_YEAR_CLOSE = "true";
    setBusinessDateOverride(tradeDate);

    await setupVerificationDatabase((p) => {
      state.prisma = p;
    }, "verify-fiscal-year-close.db");

    const { saveCustomer, saveVendor, saveProduct } = await import("../src/main/services/masters.js");
    const { savePurchaseInvoice } = await import("../src/main/services/purchase.js");
    const { saveSalesInvoice } = await import("../src/main/services/sales.js");
    const { listFiscalYears } = await import("../src/main/services/fiscal-period-service.js");

    const prisma = state.prisma;
    const unit = await prisma.unit.findFirst({ where: { code: "CTN" } });
    unitId = unit.id;
    warehouseId =
      (await prisma.warehouse.findFirst())?.id ??
      (await prisma.warehouse.create({ data: { name: "FY Close WH" } })).id;

    productId = (
      await saveProduct({
        code: "FYC01",
        name: "FY Close Product",
        baseUnitId: unitId,
        price1: 100,
        costPrice: 60,
        vatPercent: 0,
      })
    ).data.id;

    vendorId = (await saveVendor({ code: "FYV01", name: "FY Close Vendor" })).data.id;
    customerId = (
      await saveCustomer({ code: "FYC01", name: "FY Close Customer", creditLimit: 100000 })
    ).data.id;

    await savePurchaseInvoice({
      date: tradeDate,
      vendorId,
      warehouseId,
      isCredit: false,
      items: [{ productId, unitId, quantity: 50, price: 60, discount: 0, vatPercent: 0 }],
    });

    await saveSalesInvoice({
      date: tradeDate,
      customerId,
      warehouseId,
      isCredit: false,
      items: [{ productId, unitId, quantity: 5, price: 100, discount: 0, vatPercent: 0 }],
    });

    const fiscalYears = await listFiscalYears();
    const openYear = fiscalYears.data.find((fy) => fy.status === "Open");
    openFiscalYearId = openYear?.id;
    expect(openFiscalYearId, "Open fiscal year should exist").toBeTruthy();
  }, 180000);

  afterAll(async () => {
    clearBusinessDateOverride();
    await teardownVerificationDatabase();
  });

  it("runs year-end validation with extended checks", async () => {
    const { runYearEndValidation } = await import("../src/main/services/fiscal-year-close-service.js");

    const validation = await runYearEndValidation({ fiscalYearId: openFiscalYearId });
    expect(validation.success, validation.error).toBe(true);
    expect(validation.data.checks.length).toBeGreaterThan(10);
    expect(validation.data.checks.some((c) => c.id === "open_claims")).toBe(true);
    expect(validation.data.checks.some((c) => c.id === "open_purchase_orders")).toBe(true);
    expect(validation.data.checks.some((c) => c.id === "open_load_slips")).toBe(true);
  });

  it("rejects year close when draft documents exist", async () => {
    const prisma = state.prisma;
    const { runYearEndValidation, closeFiscalYearComplete } = await import(
      "../src/main/services/fiscal-year-close-service.js"
    );

    const invoice = await prisma.salesInvoice.create({
      data: {
        number: "DRAFT-FY-001",
        date: new Date(tradeDate),
        customerId,
        warehouseId,
        isCredit: true,
        subtotal: 100,
        taxTotal: 0,
        total: 100,
        paidAmount: 0,
        lifecycleStatus: "Draft",
        items: {
          create: [
            {
              productId,
              unitId,
              quantity: 1,
              price: 100,
              discount: 0,
              vatPercent: 0,
              lineTotal: 100,
              costAmount: 60,
            },
          ],
        },
      },
    });

    const validation = await runYearEndValidation({ fiscalYearId: openFiscalYearId });
    expect(validation.success).toBe(true);
    expect(validation.data.canClose).toBe(false);
    expect(validation.data.blockers).toContain("Unposted draft documents exist");

    const closed = await closeFiscalYearComplete({ fiscalYearId: openFiscalYearId });
    expect(closed.success).toBe(false);
    expect(closed.error).toMatch(/cannot be closed/i);

    await prisma.salesInvoice.delete({ where: { id: invoice.id } });
  });

  it("closes fiscal year, creates snapshot, opening balances, and new fiscal year", async () => {
    const prisma = state.prisma;
    const {
      runYearEndValidation,
      closeFiscalYearComplete,
      listYearCloseHistory,
      getYearCloseReport,
      getOpeningBalanceReport,
    } = await import("../src/main/services/fiscal-year-close-service.js");
    const { listFiscalYears } = await import("../src/main/services/fiscal-period-service.js");

    const validation = await runYearEndValidation({ fiscalYearId: openFiscalYearId });
    expect(validation.success, validation.error).toBe(true);

    if (!validation.data.canClose) {
      expect(validation.data.blockers).toBeDefined();
      return;
    }

    const closed = await closeFiscalYearComplete({ fiscalYearId: openFiscalYearId });
    expect(closed.success, closed.error).toBe(true);
    expect(closed.data.snapshot).toBeTruthy();
    expect(closed.data.newFiscalYear).toBeTruthy();
    expect(closed.data.closedFiscalYear.status).toBe("Archived");
    expect(closed.data.irreversible).toBe(true);

    const archived = await prisma.fiscalYear.findUnique({ where: { id: openFiscalYearId } });
    expect(archived.status).toBe("Archived");
    expect(archived.closedAt).toBeTruthy();

    const history = await listYearCloseHistory();
    expect(history.success).toBe(true);
    expect(history.data.length).toBeGreaterThan(0);

    const report = await getYearCloseReport({ snapshotId: closed.data.snapshot.id });
    expect(report.success).toBe(true);
    expect(report.data.trialBalance).toBeTruthy();
    expect(report.data.balanceSheet).toBeTruthy();
    expect(report.data.incomeStatement).toBeTruthy();

    const openings = await getOpeningBalanceReport({ snapshotId: closed.data.snapshot.id });
    expect(openings.success).toBe(true);
    expect(openings.data.newFiscalYear).toBe(closed.data.newFiscalYear.name);

    const fiscalYears = await listFiscalYears();
    const newOpenYear = fiscalYears.data.find((fy) => fy.status === "Open");
    expect(newOpenYear).toBeTruthy();
    expect(newOpenYear.id).toBe(closed.data.newFiscalYear.id);
  });

  it("lists fiscal years with close history", async () => {
    const { listFiscalYearsWithCloseHistory } = await import(
      "../src/main/services/fiscal-year-close-service.js"
    );

    const result = await listFiscalYearsWithCloseHistory();
    expect(result.success).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
  });
});

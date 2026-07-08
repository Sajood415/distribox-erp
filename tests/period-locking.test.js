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

describe("Accounting Period Locking (Phase 10.7)", () => {
  const openDate = "2026-07-15";
  let customerId;
  let vendorId;
  let productId;
  let unitId;
  let warehouseId;
  let julyPeriodId;

  beforeAll(async () => {
    process.env.ENABLE_PERIOD_LOCKING = "true";
    setBusinessDateOverride(openDate);

    await setupVerificationDatabase((p) => {
      state.prisma = p;
    }, "verify-period-lock.db");

    const { saveCustomer, saveVendor, saveProduct } = await import("../src/main/services/masters.js");
    const { savePurchaseInvoice } = await import("../src/main/services/purchase.js");
    const { listAccountingPeriods } = await import("../src/main/services/fiscal-period-service.js");

    const prisma = state.prisma;
    const unit = await prisma.unit.findFirst({ where: { code: "CTN" } });
    unitId = unit.id;
    warehouseId =
      (await prisma.warehouse.findFirst())?.id ??
      (await prisma.warehouse.create({ data: { name: "Period WH" } })).id;

    productId = (
      await saveProduct({
        code: "PL01",
        name: "Period Product",
        baseUnitId: unitId,
        price1: 100,
        costPrice: 60,
        vatPercent: 0,
      })
    ).data.id;

    vendorId = (await saveVendor({ code: "PLV01", name: "Period Vendor" })).data.id;
    customerId = (
      await saveCustomer({ code: "PLC01", name: "Period Customer", creditLimit: 100000 })
    ).data.id;

    await savePurchaseInvoice({
      date: openDate,
      vendorId,
      warehouseId,
      isCredit: true,
      items: [{ productId, unitId, quantity: 100, price: 60, discount: 0, vatPercent: 0 }],
    });

    const periods = await listAccountingPeriods();
    const july = periods.data.find((p) => p.month === 7 && p.startDate.getFullYear() === 2026);
    julyPeriodId = july?.id;
    expect(julyPeriodId, "July 2026 period should exist").toBeTruthy();
  }, 180000);

  afterAll(async () => {
    clearBusinessDateOverride();
    await teardownVerificationDatabase();
  });

  it("allows posting in an open period", async () => {
    const { saveSalesInvoice } = await import("../src/main/services/sales.js");
    const sale = await saveSalesInvoice({
      date: openDate,
      customerId,
      warehouseId,
      isCredit: true,
      items: [{ productId, unitId, quantity: 2, price: 100, discount: 0, vatPercent: 0 }],
    });
    expect(sale.success, sale.error).toBe(true);
  });

  it("enforces checklist before closing a period", async () => {
    const { runClosingChecklist, closeAccountingPeriod } = await import(
      "../src/main/services/period-closing-service.js"
    );

    const checklist = await runClosingChecklist({ periodId: julyPeriodId });
    expect(checklist.success).toBe(true);
    expect(checklist.data.checks.length).toBeGreaterThan(5);

    const closed = await closeAccountingPeriod({ id: julyPeriodId });
    if (checklist.data.canClose) {
      expect(closed.success, closed.error).toBe(true);
      expect(closed.data.status).toBe("Closed");
      await state.prisma.accountingPeriod.update({
        where: { id: julyPeriodId },
        data: { status: "Open", lockedAt: null, lockedBy: null },
      });
    } else {
      expect(closed.success).toBe(false);
      expect(closed.error).toMatch(/cannot be closed/i);
      expect(checklist.data.blockers.length).toBeGreaterThan(0);
    }
  });

  it("rejects posting into a closed period", async () => {
    const prisma = state.prisma;
    const { saveSalesInvoice } = await import("../src/main/services/sales.js");

    await prisma.accountingPeriod.update({
      where: { id: julyPeriodId },
      data: { status: "Closed", lockedAt: new Date(), lockedBy: "test" },
    });

    const blocked = await saveSalesInvoice({
      date: openDate,
      customerId,
      warehouseId,
      isCredit: true,
      items: [{ productId, unitId, quantity: 1, price: 100, discount: 0, vatPercent: 0 }],
    });
    expect(blocked.success).toBe(false);
    expect(blocked.error).toMatch(/closed/i);

    await prisma.accountingPeriod.update({
      where: { id: julyPeriodId },
      data: { status: "Open", lockedAt: null, lockedBy: null },
    });
  });

  it("rejects future posting when disabled", async () => {
    const { reopenAccountingPeriod } = await import("../src/main/services/period-closing-service.js");
    const { saveSalesInvoice } = await import("../src/main/services/sales.js");

    await reopenAccountingPeriod({ id: julyPeriodId });

    const blocked = await saveSalesInvoice({
      date: "2026-08-05",
      customerId,
      warehouseId,
      isCredit: true,
      items: [{ productId, unitId, quantity: 1, price: 100, discount: 0, vatPercent: 0 }],
    });
    expect(blocked.success).toBe(false);
    expect(blocked.error).toMatch(/future posting/i);
  });

  it("allows future posting when setting enabled", async () => {
    const prisma = state.prisma;
    await prisma.companySetting.upsert({
      where: { key: "allow_future_posting" },
      create: { key: "allow_future_posting", value: "true" },
      update: { value: "true" },
    });

    const { saveSalesInvoice } = await import("../src/main/services/sales.js");
    const sale = await saveSalesInvoice({
      date: "2026-08-05",
      customerId,
      warehouseId,
      isCredit: true,
      items: [{ productId, unitId, quantity: 1, price: 100, discount: 0, vatPercent: 0 }],
    });
    expect(sale.success, sale.error).toBe(true);

    await prisma.companySetting.upsert({
      where: { key: "allow_future_posting" },
      create: { key: "allow_future_posting", value: "false" },
      update: { value: "false" },
    });
  });

  it("rejects backdated posting when disabled", async () => {
    const prisma = state.prisma;
    await prisma.companySetting.upsert({
      where: { key: "allow_backdated_posting" },
      create: { key: "allow_backdated_posting", value: "false" },
      update: { value: "false" },
    });

    setBusinessDateOverride("2026-08-10");

    const { saveSalesInvoice } = await import("../src/main/services/sales.js");
    const blocked = await saveSalesInvoice({
      date: "2026-07-20",
      customerId,
      warehouseId,
      isCredit: true,
      items: [{ productId, unitId, quantity: 1, price: 100, discount: 0, vatPercent: 0 }],
    });
    expect(blocked.success).toBe(false);
    expect(blocked.error).toMatch(/backdated posting/i);

    await prisma.companySetting.upsert({
      where: { key: "allow_backdated_posting" },
      create: { key: "allow_backdated_posting", value: "true" },
      update: { value: "true" },
    });
    setBusinessDateOverride(openDate);
  });

  it("reopens a closed period and allows posting again", async () => {
    const prisma = state.prisma;
    const { reopenAccountingPeriod } = await import("../src/main/services/period-closing-service.js");
    const { saveSalesInvoice } = await import("../src/main/services/sales.js");

    await prisma.accountingPeriod.update({
      where: { id: julyPeriodId },
      data: { status: "Closed", lockedAt: new Date(), lockedBy: "test" },
    });

    const reopened = await reopenAccountingPeriod({ id: julyPeriodId });
    expect(reopened.success).toBe(true);

    const sale = await saveSalesInvoice({
      date: openDate,
      customerId,
      warehouseId,
      isCredit: true,
      items: [{ productId, unitId, quantity: 1, price: 100, discount: 0, vatPercent: 0 }],
    });
    expect(sale.success, sale.error).toBe(true);
  });

  it("runs closing checklist with trial balance and database health", async () => {
    const { runClosingChecklist } = await import("../src/main/services/period-closing-service.js");
    const checklist = await runClosingChecklist({ periodId: julyPeriodId });
    expect(checklist.success).toBe(true);
    expect(checklist.data.checks.some((c) => c.id === "trial_balance" && c.passed)).toBe(true);
    expect(checklist.data.checks.some((c) => c.id === "database_health")).toBe(true);
    expect(checklist.data.checks.some((c) => c.id === "balance_sheet")).toBe(true);
  });

  it("keeps trial balance balanced after period operations", async () => {
    const { getTrialBalance } = await import("../src/main/services/financial-reports.js");
    const tb = await getTrialBalance({});
    expect(tb.data.balanced).toBe(true);
  });
});

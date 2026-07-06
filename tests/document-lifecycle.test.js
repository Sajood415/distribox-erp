import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import {
  setupVerificationDatabase,
  teardownVerificationDatabase,
} from "./helpers/verification-db.js";

const state = vi.hoisted(() => ({ prisma: null }));

vi.mock("../src/main/db/init.js", () => ({
  getCompanyPrisma: () => {
    if (!state.prisma) throw new Error("Verification database not initialized");
    return state.prisma;
  },
}));

describe("Document Lifecycle (Phase 10.6)", () => {
  const date = "2026-07-01";
  let customerId;
  let vendorId;
  let productId;
  let unitId;
  let warehouseId;

  beforeAll(async () => {
    await setupVerificationDatabase((p) => {
      state.prisma = p;
    }, "verify-lifecycle.db");

    const { saveCustomer, saveVendor, saveProduct } = await import("../src/main/services/masters.js");
    const { savePurchaseInvoice } = await import("../src/main/services/purchase.js");

    const prisma = state.prisma;
    const unit = await prisma.unit.findFirst({ where: { code: "CTN" } });
    unitId = unit.id;
    warehouseId =
      (await prisma.warehouse.findFirst())?.id ??
      (await prisma.warehouse.create({ data: { name: "Lifecycle WH" } })).id;

    productId = (
      await saveProduct({
        code: "LC01",
        name: "Lifecycle Product",
        baseUnitId: unitId,
        price1: 100,
        costPrice: 60,
        vatPercent: 0,
      })
    ).data.id;

    vendorId = (await saveVendor({ code: "LCV01", name: "Lifecycle Vendor" })).data.id;
    customerId = (await saveCustomer({ code: "LCC01", name: "Lifecycle Customer", creditLimit: 100000 })).data.id;

    await savePurchaseInvoice({
      date,
      vendorId,
      warehouseId,
      isCredit: true,
      items: [{ productId, unitId, quantity: 100, price: 60, discount: 0, vatPercent: 0 }],
    });
  }, 120000);

  afterAll(async () => {
    await teardownVerificationDatabase();
  });

  it("records created and posted timeline for sales invoice", async () => {
    const { saveSalesInvoice } = await import("../src/main/services/sales.js");
    const { getDocumentTimeline, LIFECYCLE_STATUS } = await import(
      "../src/main/services/document-lifecycle-service.js"
    );
    const { DOCUMENT_TYPES } = await import("../src/main/core/document-types.js");

    const sale = await saveSalesInvoice({
      date,
      customerId,
      warehouseId,
      isCredit: true,
      items: [{ productId, unitId, quantity: 5, price: 100, discount: 0, vatPercent: 0 }],
    });
    expect(sale.success, sale.error).toBe(true);
    expect(sale.data.lifecycleStatus).toBe(LIFECYCLE_STATUS.POSTED);

    const timeline = await getDocumentTimeline({
      documentType: DOCUMENT_TYPES.SALES_INVOICE,
      documentId: sale.data.id,
    });
    expect(timeline.success).toBe(true);
    expect(timeline.data.some((e) => e.action === "Created")).toBe(true);
    expect(timeline.data.some((e) => e.action === "Posted")).toBe(true);
  });

  it("reverses sales invoice restoring stock and GL balance", async () => {
    const { saveSalesInvoice } = await import("../src/main/services/sales.js");
    const { reverseSalesInvoice } = await import("../src/main/services/document-reversal-service.js");
    const { getStockQuantity } = await import("../src/main/domain/stock-quantity.js");
    const { getTrialBalance } = await import("../src/main/services/financial-reports.js");
    const { LIFECYCLE_STATUS } = await import("../src/main/services/document-lifecycle-service.js");

    const prisma = state.prisma;
    const stockBefore = await getStockQuantity(prisma, productId, warehouseId);

    const sale = await saveSalesInvoice({
      date,
      customerId,
      warehouseId,
      isCredit: true,
      items: [{ productId, unitId, quantity: 3, price: 100, discount: 0, vatPercent: 0 }],
    });
    expect(sale.success).toBe(true);

    const stockAfterSale = await getStockQuantity(prisma, productId, warehouseId);
    expect(stockAfterSale).toBe(stockBefore - 3);

    const reversed = await reverseSalesInvoice({ id: sale.data.id, reason: "Test reversal" });
    expect(reversed.success, reversed.error).toBe(true);
    expect(reversed.data.lifecycleStatus).toBe(LIFECYCLE_STATUS.REVERSED);

    const stockAfterReverse = await getStockQuantity(prisma, productId, warehouseId);
    expect(stockAfterReverse).toBe(stockBefore);

    const tb = await getTrialBalance({});
    expect(tb.data.balanced).toBe(true);
  });

  it("blocks editing posted purchase orders", async () => {
    const { savePurchaseOrder } = await import("../src/main/services/purchase-order.js");
    const { approvePurchaseOrder } = await import("../src/main/services/purchase-order.js");
    const { assertDocumentEditable } = await import("../src/main/services/document-lifecycle-service.js");
    const { DOCUMENT_TYPES } = await import("../src/main/core/document-types.js");

    const po = await savePurchaseOrder({
      date,
      vendorId,
      warehouseId,
      items: [{ productId, unitId, quantity: 10, price: 60, discount: 0, vatPercent: 0 }],
    });
    expect(po.success).toBe(true);

    const editable = await assertDocumentEditable(DOCUMENT_TYPES.PURCHASE_ORDER, po.data.id);
    expect(editable.success).toBe(true);

    await approvePurchaseOrder(po.data.id);

    const editAfterApprove = await savePurchaseOrder({
      id: po.data.id,
      date,
      vendorId,
      warehouseId,
      items: [{ productId, unitId, quantity: 5, price: 60, discount: 0, vatPercent: 0 }],
    });
    expect(editAfterApprove.success).toBe(false);
  });
});

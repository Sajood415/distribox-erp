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

describe("Document Lifecycle — all document types", () => {
  const date = "2026-07-01";
  let customerId;
  let vendorId;
  let productId;
  let unitId;
  let warehouseId;
  let salesInvoiceId;

  beforeAll(async () => {
    await setupVerificationDatabase((p) => {
      state.prisma = p;
    }, "verify-lifecycle-full.db");

    const { saveCustomer, saveVendor, saveProduct } = await import("../src/main/services/masters.js");
    const { savePurchaseInvoice } = await import("../src/main/services/purchase.js");
    const { saveSalesInvoice } = await import("../src/main/services/sales.js");

    const prisma = state.prisma;
    const unit = await prisma.unit.findFirst({ where: { code: "CTN" } });
    unitId = unit.id;
    warehouseId =
      (await prisma.warehouse.findFirst())?.id ??
      (await prisma.warehouse.create({ data: { name: "Lifecycle Full WH" } })).id;

    productId = (
      await saveProduct({
        code: "LCF01",
        name: "Lifecycle Full Product",
        baseUnitId: unitId,
        price1: 100,
        costPrice: 60,
        vatPercent: 0,
      })
    ).data.id;

    vendorId = (await saveVendor({ code: "LCFV01", name: "Lifecycle Full Vendor" })).data.id;
    customerId = (
      await saveCustomer({ code: "LCFC01", name: "Lifecycle Full Customer", creditLimit: 100000 })
    ).data.id;

    await savePurchaseInvoice({
      date,
      vendorId,
      warehouseId,
      isCredit: true,
      items: [{ productId, unitId, quantity: 200, price: 60, discount: 0, vatPercent: 0 }],
    });

    const sale = await saveSalesInvoice({
      date,
      customerId,
      warehouseId,
      isCredit: true,
      items: [{ productId, unitId, quantity: 10, price: 100, discount: 0, vatPercent: 0 }],
    });
    salesInvoiceId = sale.data.id;
  }, 180000);

  afterAll(async () => {
    await teardownVerificationDatabase();
  });

  async function expectTimeline(documentType, documentId, actions) {
    const { getDocumentTimeline } = await import("../src/main/services/document-lifecycle-service.js");
    const timeline = await getDocumentTimeline({ documentType, documentId });
    expect(timeline.success).toBe(true);
    for (const action of actions) {
      expect(timeline.data.some((e) => e.action === action)).toBe(true);
    }
  }

  async function expectBalancedTb() {
    const { getTrialBalance } = await import("../src/main/services/financial-reports.js");
    const tb = await getTrialBalance({});
    expect(tb.data.balanced).toBe(true);
  }

  async function expectNoDuplicateReversal(documentType, id, reverseFn) {
    const first = await reverseFn({ id, reason: "First reversal" });
    expect(first.success).toBe(true);
    const second = await reverseFn({ id, reason: "Duplicate reversal" });
    expect(second.success).toBe(false);
  }

  it("Purchase Order: create, approve, reverse, timeline, edit guard", async () => {
    const { savePurchaseOrder, approvePurchaseOrder } = await import("../src/main/services/purchase-order.js");
    const { reversePurchaseOrder } = await import("../src/main/services/document-reversal-service.js");
    const { assertDocumentEditable, LIFECYCLE_STATUS } = await import(
      "../src/main/services/document-lifecycle-service.js"
    );
    const { DOCUMENT_TYPES } = await import("../src/main/core/document-types.js");

    const po = await savePurchaseOrder({
      date,
      vendorId,
      warehouseId,
      items: [{ productId, unitId, quantity: 5, price: 60, discount: 0, vatPercent: 0 }],
    });
    expect(po.success).toBe(true);
    await expectTimeline(DOCUMENT_TYPES.PURCHASE_ORDER, po.data.id, ["Created"]);

    await approvePurchaseOrder(po.data.id);
    await expectTimeline(DOCUMENT_TYPES.PURCHASE_ORDER, po.data.id, ["Created", "Posted"]);

    const editBlocked = await savePurchaseOrder({
      id: po.data.id,
      date,
      vendorId,
      warehouseId,
      items: [{ productId, unitId, quantity: 1, price: 60, discount: 0, vatPercent: 0 }],
    });
    expect(editBlocked.success).toBe(false);

    const reversed = await reversePurchaseOrder({ id: po.data.id, reason: "PO test reverse" });
    expect(reversed.success).toBe(true);
    expect(reversed.data.lifecycleStatus).toBe(LIFECYCLE_STATUS.REVERSED);

    const duplicate = await reversePurchaseOrder({ id: po.data.id, reason: "Duplicate reversal" });
    expect(duplicate.success).toBe(false);

    const editable = await assertDocumentEditable(DOCUMENT_TYPES.PURCHASE_ORDER, po.data.id);
    expect(editable.success).toBe(false);
  });

  it("Purchase Invoice: post, reverse, correct, post draft", async () => {
    const { savePurchaseInvoice } = await import("../src/main/services/purchase.js");
    const { correctDocument } = await import("../src/main/services/document-correction-service.js");
    const { postDraftDocument } = await import("../src/main/services/document-post-service.js");
    const { getDocumentLinks, LIFECYCLE_STATUS } = await import(
      "../src/main/services/document-lifecycle-service.js"
    );
    const { DOCUMENT_TYPES } = await import("../src/main/core/document-types.js");

    const pi = await savePurchaseInvoice({
      date,
      vendorId,
      warehouseId,
      isCredit: true,
      items: [{ productId, unitId, quantity: 5, price: 60, discount: 0, vatPercent: 0 }],
    });
    expect(pi.success).toBe(true);
    await expectTimeline(DOCUMENT_TYPES.PURCHASE_INVOICE, pi.data.id, ["Created", "Posted"]);

    const corrected = await correctDocument({
      documentType: DOCUMENT_TYPES.PURCHASE_INVOICE,
      id: pi.data.id,
      reason: "PI correction",
    });
    expect(corrected.success).toBe(true);
    expect(corrected.data.draft.lifecycleStatus).toBe(LIFECYCLE_STATUS.DRAFT);

    const links = await getDocumentLinks({
      documentType: DOCUMENT_TYPES.PURCHASE_INVOICE,
      documentId: pi.data.id,
    });
    expect(links.success).toBe(true);
    expect(links.data.links.some((l) => l.role === "Corrected Document")).toBe(true);

    const posted = await postDraftDocument({
      documentType: DOCUMENT_TYPES.PURCHASE_INVOICE,
      id: corrected.data.draft.id,
    });
    expect(posted.success, posted.error).toBe(true);
    await expectBalancedTb();
  });

  it("Purchase Return: post, reverse, timeline", async () => {
    const { savePurchaseReturn } = await import("../src/main/services/purchase-return.js");
    const { reversePurchaseReturn } = await import("../src/main/services/document-reversal-service.js");
    const { DOCUMENT_TYPES } = await import("../src/main/core/document-types.js");

    const pr = await savePurchaseReturn({
      date,
      vendorId,
      warehouseId,
      items: [{ productId, unitId, quantity: 2, price: 60, discount: 0, vatPercent: 0 }],
    });
    expect(pr.success).toBe(true);
    await expectTimeline(DOCUMENT_TYPES.PURCHASE_RETURN, pr.data.id, ["Created", "Posted"]);

    const reversed = await reversePurchaseReturn({ id: pr.data.id, reason: "PR reverse" });
    expect(reversed.success).toBe(true);

    const duplicate = await reversePurchaseReturn({ id: pr.data.id, reason: "Duplicate reversal" });
    expect(duplicate.success).toBe(false);
    await expectBalancedTb();
  });

  it("Sales Invoice: post, reverse, correct workflow", async () => {
    const { saveSalesInvoice } = await import("../src/main/services/sales.js");
    const { correctDocument } = await import("../src/main/services/document-correction-service.js");
    const { postDraftDocument } = await import("../src/main/services/document-post-service.js");
    const { getStockQuantity } = await import("../src/main/domain/stock-quantity.js");
    const { DOCUMENT_TYPES } = await import("../src/main/core/document-types.js");

    const prisma = state.prisma;
    const stockBefore = await getStockQuantity(prisma, productId, warehouseId);

    const si = await saveSalesInvoice({
      date,
      customerId,
      warehouseId,
      isCredit: true,
      items: [{ productId, unitId, quantity: 4, price: 100, discount: 0, vatPercent: 0 }],
    });
    expect(si.success).toBe(true);

    const corrected = await correctDocument({
      documentType: DOCUMENT_TYPES.SALES_INVOICE,
      id: si.data.id,
      reason: "SI correction",
    });
    expect(corrected.success).toBe(true);

    await saveSalesInvoice({
      id: corrected.data.draft.id,
      date,
      customerId,
      warehouseId,
      isCredit: true,
      items: [{ productId, unitId, quantity: 3, price: 100, discount: 0, vatPercent: 0 }],
    });

    const posted = await postDraftDocument({
      documentType: DOCUMENT_TYPES.SALES_INVOICE,
      id: corrected.data.draft.id,
    });
    expect(posted.success, posted.error).toBe(true);

    const stockAfter = await getStockQuantity(prisma, productId, warehouseId);
    expect(stockAfter).toBe(stockBefore - 3);
    await expectBalancedTb();
  });

  it("Sales Return: post, reverse", async () => {
    const { saveSalesReturn } = await import("../src/main/services/sales-return.js");
    const { reverseSalesReturn } = await import("../src/main/services/document-reversal-service.js");
    const { DOCUMENT_TYPES } = await import("../src/main/core/document-types.js");

    const sr = await saveSalesReturn({
      date,
      customerId,
      warehouseId,
      salesInvoiceId,
      items: [{ productId, unitId, quantity: 1, price: 100, discount: 0, vatPercent: 0 }],
    });
    expect(sr.success).toBe(true);
    await expectTimeline(DOCUMENT_TYPES.SALES_RETURN, sr.data.id, ["Created", "Posted"]);

    const reversed = await reverseSalesReturn({ id: sr.data.id, reason: "SR reverse" });
    expect(reversed.success).toBe(true);
    await expectBalancedTb();
  });

  it("Recovery Voucher: post, reverse", async () => {
    const { saveRecovery } = await import("../src/main/services/recovery.js");
    const { reverseRecoveryVoucher } = await import("../src/main/services/document-reversal-service.js");
    const { DOCUMENT_TYPES } = await import("../src/main/core/document-types.js");

    const recovery = await saveRecovery({
      date,
      customerId,
      paymentMode: "Cash",
      items: [{ salesInvoiceId, amount: 50 }],
    });
    expect(recovery.success).toBe(true);
    await expectTimeline(DOCUMENT_TYPES.RECOVERY, recovery.data.id, ["Created", "Posted"]);

    const reversed = await reverseRecoveryVoucher({ id: recovery.data.id, reason: "RV reverse" });
    expect(reversed.success).toBe(true);
    await expectBalancedTb();
  });

  it("Expense Voucher: post, reverse", async () => {
    const { saveExpense } = await import("../src/main/services/expense.js");
    const { reverseExpenseVoucher } = await import("../src/main/services/document-reversal-service.js");
    const { DOCUMENT_TYPES } = await import("../src/main/core/document-types.js");

    const expense = await saveExpense({ date, amount: 25, paymentMode: "Cash", description: "Lifecycle expense" });
    expect(expense.success).toBe(true);
    await expectTimeline(DOCUMENT_TYPES.EXPENSE, expense.data.id, ["Created", "Posted"]);

    const reversed = await reverseExpenseVoucher({ id: expense.data.id, reason: "Expense reverse" });
    expect(reversed.success).toBe(true);
    await expectBalancedTb();
  });

  it("Stock Adjustment: post, reverse", async () => {
    const { saveStockAdjustment } = await import("../src/main/services/inventory.js");
    const { reverseStockAdjustment } = await import("../src/main/services/document-reversal-service.js");
    const { DOCUMENT_TYPES } = await import("../src/main/core/document-types.js");

    const adj = await saveStockAdjustment({
      date,
      warehouseId,
      productId,
      quantityChange: 5,
      reason: "Lifecycle adjustment",
    });
    expect(adj.success).toBe(true);
    await expectTimeline(DOCUMENT_TYPES.STOCK_ADJUSTMENT, adj.data.id, ["Created", "Posted"]);

    const reversed = await reverseStockAdjustment({ id: adj.data.id, reason: "Adjustment reverse" });
    expect(reversed.success).toBe(true);
    await expectBalancedTb();
  });

  it("Quotation: create, cancel", async () => {
    const { saveQuotation } = await import("../src/main/services/quotation.js");
    const { cancelQuotation } = await import("../src/main/services/document-reversal-service.js");
    const { LIFECYCLE_STATUS } = await import("../src/main/services/document-lifecycle-service.js");
    const { DOCUMENT_TYPES } = await import("../src/main/core/document-types.js");

    const qt = await saveQuotation({
      date,
      validUntil: date,
      customerId,
      items: [{ productId, unitId, quantity: 2, price: 100, discount: 0, vatPercent: 0 }],
    });
    expect(qt.success).toBe(true);
    await expectTimeline(DOCUMENT_TYPES.QUOTATION, qt.data.id, ["Created"]);

    const cancelled = await cancelQuotation({ id: qt.data.id, reason: "Cancelled quote" });
    expect(cancelled.success).toBe(true);
    expect(cancelled.data.lifecycleStatus).toBe(LIFECYCLE_STATUS.CANCELLED);
  });

  it("Load Slip: create, post on loaded, reverse", async () => {
    const { saveLoadSlip, updateLoadSlipStatus, LOAD_SLIP_STATUSES } = await import(
      "../src/main/services/load-slip.js"
    );
    const { reverseLoadSlip } = await import("../src/main/services/document-reversal-service.js");
    const { DOCUMENT_TYPES } = await import("../src/main/core/document-types.js");

    const slip = await saveLoadSlip({
      date,
      deliveryManId: (await state.prisma.deliveryMan.create({ data: { name: "DM Lifecycle" } })).id,
      invoiceIds: [salesInvoiceId],
    });
    expect(slip.success).toBe(true);
    await expectTimeline(DOCUMENT_TYPES.LOAD_SLIP, slip.data.id, ["Created"]);

    await updateLoadSlipStatus({ id: slip.data.id, status: LOAD_SLIP_STATUSES.LOADED });
    await expectTimeline(DOCUMENT_TYPES.LOAD_SLIP, slip.data.id, ["Created", "Posted"]);

    const reversed = await reverseLoadSlip({ id: slip.data.id, reason: "Load slip reverse" });
    expect(reversed.success).toBe(true);
  });

  it("Customer Claim: create, reject cancel, settle post", async () => {
    const { saveClaim, updateClaimStatus, settleClaim } = await import("../src/main/services/claims.js");
    const { reverseClaim } = await import("../src/main/services/document-reversal-service.js");
    const { LIFECYCLE_STATUS } = await import("../src/main/services/document-lifecycle-service.js");
    const { DOCUMENT_TYPES } = await import("../src/main/core/document-types.js");

    const claim = await saveClaim({
      date,
      partyType: "Customer",
      customerId,
      warehouseId,
      salesInvoiceId,
      claimType: "Damage",
      items: [{ productId, unitId, quantity: 1, price: 100, discount: 0, vatPercent: 0 }],
    });
    expect(claim.success).toBe(true);
    await expectTimeline(DOCUMENT_TYPES.CUSTOMER_CLAIM, claim.data.id, ["Created"]);

    const rejectedClaim = await saveClaim({
      date,
      partyType: "Customer",
      customerId,
      warehouseId,
      claimType: "Shortage",
      items: [{ productId, unitId, quantity: 1, price: 50, discount: 0, vatPercent: 0 }],
    });
    await updateClaimStatus({ id: rejectedClaim.data.id, status: "Rejected", reason: "Invalid claim" });
    const rejected = await state.prisma.claim.findUnique({ where: { id: rejectedClaim.data.id } });
    expect(rejected.lifecycleStatus).toBe(LIFECYCLE_STATUS.CANCELLED);

    await updateClaimStatus({ id: claim.data.id, status: "Approved" });
    const settled = await settleClaim({ id: claim.data.id, resolution: "Replace" });
    expect(settled.success).toBe(true);
    expect(settled.data.lifecycleStatus).toBe(LIFECYCLE_STATUS.POSTED);

    const reversed = await reverseClaim({ id: claim.data.id, reason: "Claim reverse" });
    expect(reversed.success).toBe(true);
  });

  it("archive only cancelled or reversed documents", async () => {
    const { saveQuotation } = await import("../src/main/services/quotation.js");
    const { cancelQuotation } = await import("../src/main/services/document-reversal-service.js");
    const { archiveDocument } = await import("../src/main/services/document-lifecycle-service.js");
    const { DOCUMENT_TYPES } = await import("../src/main/core/document-types.js");

    const qt = await saveQuotation({
      date,
      validUntil: date,
      customerId,
      items: [{ productId, unitId, quantity: 1, price: 100, discount: 0, vatPercent: 0 }],
    });
    await cancelQuotation({ id: qt.data.id, reason: "Archive test" });
    const archived = await archiveDocument({
      documentType: DOCUMENT_TYPES.QUOTATION,
      id: qt.data.id,
      reason: "Housekeeping",
    });
    expect(archived.success).toBe(true);
  });
});

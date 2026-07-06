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

describe("Distributor Operations (Phase 10.5)", () => {
  let saveVendor;
  let saveProduct;
  let saveCustomer;
  let saveSalesman;
  let saveRoute;
  let savePurchaseInvoice;
  let saveSalesInvoice;
  let saveRecovery;
  let savePurchaseOrder;
  let approvePurchaseOrder;
  let receivePurchaseOrder;
  let convertPurchaseOrderToInvoice;
  let cancelPurchaseOrder;
  let deletePurchaseOrder;
  let saveTradeOffer;
  let previewInvoiceOffers;
  let saveLoadSlip;
  let updateLoadSlipStatus;
  let saveSalesmanTarget;
  let getSalesmanPerformance;
  let saveExpense;
  let saveClaim;
  let updateClaimStatus;
  let getDailyRecoverySheet;
  let getRecoveryBySalesman;
  let getRecoveryPerformance;
  let getRouteReport;
  let getDailyCashSummary;
  let getDailyFinalSheet;
  let globalSearch;
  let runIntegrityChecks;
  let OFFER_TYPES;
  let PO_STATUSES;
  let LOAD_SLIP_STATUSES;

  let vendorId;
  let productId;
  let unitId;
  let warehouseId;
  let customerId;
  let salesmanId;
  let deliveryManId;
  let routeId;
  let purchaseOrderId;
  let poItemId;

  const date = "2026-07-01";

  beforeAll(async () => {
    await setupVerificationDatabase((p) => {
      state.prisma = p;
    }, "verify-distributor.db");

    ({ saveVendor, saveProduct, saveCustomer, saveSalesman, saveRoute } = await import(
      "../src/main/services/masters.js"
    ));
    ({ savePurchaseInvoice } = await import("../src/main/services/purchase.js"));
    ({ saveSalesInvoice } = await import("../src/main/services/sales.js"));
    ({ saveRecovery } = await import("../src/main/services/recovery.js"));
    ({
      savePurchaseOrder,
      approvePurchaseOrder,
      receivePurchaseOrder,
      convertPurchaseOrderToInvoice,
      cancelPurchaseOrder,
      deletePurchaseOrder,
      PO_STATUSES,
    } = await import("../src/main/services/purchase-order.js"));
    ({ saveTradeOffer, previewInvoiceOffers, OFFER_TYPES } = await import(
      "../src/main/services/trade-offer.js"
    ));
    ({ saveLoadSlip, updateLoadSlipStatus, LOAD_SLIP_STATUSES } = await import(
      "../src/main/services/load-slip.js"
    ));
    ({ saveSalesmanTarget, getSalesmanPerformance } = await import(
      "../src/main/services/salesman-target.js"
    ));
    ({ saveExpense } = await import("../src/main/services/expense.js"));
    ({ saveClaim, updateClaimStatus } = await import("../src/main/services/claims.js"));
    ({
      getDailyRecoverySheet,
      getRecoveryBySalesman,
      getRecoveryPerformance,
      getRouteReport,
      getDailyCashSummary,
      getDailyFinalSheet,
      globalSearch,
    } = await import("../src/main/services/distributor-reports.js"));
    ({ runIntegrityChecks } = await import("../src/main/services/integrity-service.js"));

    const prisma = state.prisma;
    const unit = await prisma.unit.findFirst({ where: { code: "CTN" } });
    unitId = unit.id;
    warehouseId = (await prisma.warehouse.findFirst())?.id
      ?? (await prisma.warehouse.create({ data: { name: "Main WH" } })).id;

    const productRes = await saveProduct({
      code: "DIST01",
      name: "Distributor Product",
      baseUnitId: unitId,
      packSize: 1,
      price1: 200,
      costPrice: 120,
      vatPercent: 0,
    });
    productId = productRes.data.id;

    const vendorRes = await saveVendor({ code: "VPO01", name: "PO Vendor" });
    vendorId = vendorRes.data.id;

    const salesmanRes = await saveSalesman({ name: "Route Salesman", commissionRate: 2 });
    salesmanId = salesmanRes.data.id;

    const routeRes = await saveRoute({ name: "North Route", salesmanId });
    routeId = routeRes.data.id;

    const customerRes = await saveCustomer({
      code: "CRTE01",
      name: "Route Customer",
      routeId,
      salesmanId,
      creditLimit: 500000,
      creditDays: 30,
    });
    customerId = customerRes.data.id;

    deliveryManId = (await prisma.deliveryMan.findFirst()).id;

    const purchaseRes = await savePurchaseInvoice({
      date,
      vendorId,
      warehouseId,
      isCredit: true,
      freight: 0,
      paidAmount: 0,
      items: [{ productId, unitId, quantity: 200, price: 120, discount: 0, vatPercent: 0 }],
    });
    expect(purchaseRes.success, purchaseRes.error).toBe(true);

    const salesRes = await saveSalesInvoice({
      date,
      customerId,
      warehouseId,
      salesmanId,
      isCredit: true,
      freight: 0,
      paidAmount: 0,
      items: [{ productId, unitId, quantity: 20, price: 200, discount: 0, vatPercent: 0 }],
    });
    expect(salesRes.success, salesRes.error).toBe(true);

    const recoveryRes = await saveRecovery({
      date,
      customerId,
      salesmanId,
      paymentMode: "Cash",
      items: [{ salesInvoiceId: salesRes.data.id, amount: 1000 }],
    });
    expect(recoveryRes.success, recoveryRes.error).toBe(true);
  }, 120000);

  afterAll(async () => {
    await teardownVerificationDatabase();
  });

  it("creates and manages purchase order lifecycle", async () => {
    const createRes = await savePurchaseOrder({
      date,
      vendorId,
      warehouseId,
      remarks: "Phase 10.5 PO",
      items: [{ productId, unitId, quantity: 100, price: 120, discount: 0, vatPercent: 0 }],
    });
    expect(createRes.success, createRes.error).toBe(true);
    expect(createRes.data.status).toBe(PO_STATUSES.DRAFT);
    purchaseOrderId = createRes.data.id;
    poItemId = createRes.data.items[0].id;

    const editRes = await savePurchaseOrder({
      id: purchaseOrderId,
      date,
      vendorId,
      warehouseId,
      items: [{ productId, unitId, quantity: 80, price: 120, discount: 0, vatPercent: 0 }],
    });
    expect(editRes.success, editRes.error).toBe(true);
    expect(editRes.data.items[0].quantity).toBe(80);

    const draftDelete = await deletePurchaseOrder(purchaseOrderId);
    expect(draftDelete.success).toBe(true);

    const recreateRes = await savePurchaseOrder({
      date,
      vendorId,
      warehouseId,
      items: [{ productId, unitId, quantity: 50, price: 120, discount: 0, vatPercent: 0 }],
    });
    expect(recreateRes.success).toBe(true);
    purchaseOrderId = recreateRes.data.id;
    poItemId = recreateRes.data.items[0].id;

    const approveRes = await approvePurchaseOrder(purchaseOrderId);
    expect(approveRes.success, approveRes.error).toBe(true);
    expect(approveRes.data.status).toBe(PO_STATUSES.APPROVED);

    const partialRes = await receivePurchaseOrder({
      id: purchaseOrderId,
      lines: [{ itemId: poItemId, quantity: 20 }],
    });
    expect(partialRes.success, partialRes.error).toBe(true);
    expect(partialRes.data.status).toBe(PO_STATUSES.PARTIAL);

    const completeRes = await receivePurchaseOrder({
      id: purchaseOrderId,
      lines: [{ itemId: poItemId, quantity: 30 }],
    });
    expect(completeRes.success, completeRes.error).toBe(true);
    expect(completeRes.data.status).toBe(PO_STATUSES.COMPLETED);

    const cancelFail = await cancelPurchaseOrder(purchaseOrderId);
    expect(cancelFail.success).toBe(false);

    const poForConvert = await savePurchaseOrder({
      date,
      vendorId,
      warehouseId,
      items: [{ productId, unitId, quantity: 40, price: 120, discount: 0, vatPercent: 0 }],
    });
    expect(poForConvert.success).toBe(true);
    await approvePurchaseOrder(poForConvert.data.id);
    const convertRes = await convertPurchaseOrderToInvoice({ id: poForConvert.data.id, date });
    expect(convertRes.success, convertRes.error).toBe(true);
    expect(convertRes.data.invoice.items.length).toBeGreaterThan(0);
    const refreshed = await state.prisma.purchaseOrder.findUnique({ where: { id: poForConvert.data.id } });
    expect(refreshed.status).toBe(PO_STATUSES.COMPLETED);
  });

  it("applies trade offers on invoice preview", async () => {
    const offerRes = await saveTradeOffer({
      code: "BXGY10",
      name: "Buy 10 Get 1",
      offerType: OFFER_TYPES.BUY_X_GET_Y,
      priority: 1,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      buyQuantity: 10,
      getQuantity: 1,
      active: true,
    });
    expect(offerRes.success, offerRes.error).toBe(true);

    const previewRes = await previewInvoiceOffers({
      customerId,
      date,
      items: [{ productId, quantity: 25, price: 200, discount: 0, vatPercent: 0 }],
    });
    expect(previewRes.success, previewRes.error).toBe(true);
    expect(previewRes.data.appliedOfferCodes).toContain("BXGY10");
    const line = previewRes.data.lines.find((row) => row.productId === productId);
    expect(line.freeQuantity).toBe(2);
  });

  it("creates load slip and advances status", async () => {
    const prisma = state.prisma;
    const invoice = await prisma.salesInvoice.findFirst({ where: { loadSlipId: null } });
    expect(invoice).toBeTruthy();

    const slipRes = await saveLoadSlip({
      date,
      deliveryManId,
      salesmanId,
      routeId,
      vehicleNo: "KHI-123",
      invoiceIds: [invoice.id],
      items: [{ productId, unitId, loadedQty: 20 }],
    });
    expect(slipRes.success, slipRes.error).toBe(true);
    expect(slipRes.data.status).toBe(LOAD_SLIP_STATUSES.DRAFT);
    expect(slipRes.data.vehicleNo).toBe("KHI-123");

    const loadedRes = await updateLoadSlipStatus({
      id: slipRes.data.id,
      status: LOAD_SLIP_STATUSES.LOADED,
    });
    expect(loadedRes.success).toBe(true);

    const transitRes = await updateLoadSlipStatus({
      id: slipRes.data.id,
      status: LOAD_SLIP_STATUSES.IN_TRANSIT,
    });
    expect(transitRes.success).toBe(true);

    const deliveredRes = await updateLoadSlipStatus({
      id: slipRes.data.id,
      status: LOAD_SLIP_STATUSES.DELIVERED,
    });
    expect(deliveredRes.success).toBe(true);
  });

  it("generates daily recovery and route reports", async () => {
    const sheetRes = await getDailyRecoverySheet({ date });
    expect(sheetRes.success).toBe(true);
    expect(sheetRes.data.rows.length).toBeGreaterThan(0);
    expect(sheetRes.data.totalRecovery).toBeGreaterThan(0);

    const bySalesmanRes = await getRecoveryBySalesman({ date });
    expect(bySalesmanRes.success).toBe(true);
    expect(bySalesmanRes.data.rows.some((row) => row.salesman === "Route Salesman")).toBe(true);

    const perfRes = await getRecoveryPerformance({ date });
    expect(perfRes.success).toBe(true);
    expect(perfRes.data.rows.length).toBeGreaterThan(0);

    const routeRes = await getRouteReport({ date });
    expect(routeRes.success).toBe(true);
    expect(routeRes.data.rows.some((row) => row.route === "North Route")).toBe(true);
  });

  it("tracks salesman targets and performance", async () => {
    const targetRes = await saveSalesmanTarget({
      salesmanId,
      year: 2026,
      month: 7,
      salesTarget: 50000,
      recoveryTarget: 10000,
    });
    expect(targetRes.success, targetRes.error).toBe(true);

    const perfRes = await getSalesmanPerformance({ year: 2026, month: 7 });
    expect(perfRes.success).toBe(true);
    const row = perfRes.data.rows.find((r) => r.salesman === "Route Salesman");
    expect(row).toBeTruthy();
    expect(row.salesTarget).toBe(50000);
    expect(row.actualSales).toBeGreaterThan(0);
  });

  it("records expenses and daily cash position", async () => {
    const expenseRes = await saveExpense({
      date,
      amount: 500,
      paymentMode: "Cash",
      description: "Petrol",
    });
    expect(expenseRes.success, expenseRes.error).toBe(true);

    const cashRes = await getDailyCashSummary({ date });
    expect(cashRes.success).toBe(true);
    expect(cashRes.data.cashRecovery).toBeGreaterThan(0);
    expect(cashRes.data.expenses).toBeGreaterThanOrEqual(500);
  });

  it("completes claim approval and rejection workflow", async () => {
    const claimRes = await saveClaim({
      date,
      partyType: "Customer",
      customerId,
      warehouseId,
      claimType: "Damage",
      items: [{ productId, unitId, quantity: 1, price: 200, discount: 0, vatPercent: 0 }],
    });
    expect(claimRes.success, claimRes.error).toBe(true);

    const approveRes = await updateClaimStatus({ id: claimRes.data.id, status: "Approved" });
    expect(approveRes.success, approveRes.error).toBe(true);
    expect(approveRes.data.status).toBe("Approved");

    const rejectClaimRes = await saveClaim({
      date,
      partyType: "Customer",
      customerId,
      warehouseId,
      claimType: "Shortage",
      items: [{ productId, unitId, quantity: 1, price: 200, discount: 0, vatPercent: 0 }],
    });
    expect(rejectClaimRes.success).toBe(true);
    const rejectRes = await updateClaimStatus({ id: rejectClaimRes.data.id, status: "Rejected" });
    expect(rejectRes.success).toBe(true);
    expect(rejectRes.data.status).toBe("Rejected");

    const prisma = state.prisma;
    const auditCount = await prisma.companyAuditLog.count({
      where: { table: "Claim", recordId: { in: [claimRes.data.id, rejectClaimRes.data.id] } },
    });
    expect(auditCount).toBeGreaterThanOrEqual(2);
  });

  it("generates daily final sheet and global search", async () => {
    const finalRes = await getDailyFinalSheet({ date });
    expect(finalRes.success).toBe(true);
    expect(finalRes.data.sales.count).toBeGreaterThan(0);
    expect(finalRes.data.recovery.totalRecovery).toBeGreaterThan(0);
    expect(finalRes.data.cash).toBeTruthy();

    const searchRes = await globalSearch({ query: "DIST01" });
    expect(searchRes.success).toBe(true);
    expect(searchRes.data.results.some((row) => row.type === "Product")).toBe(true);
  });

  it("passes integrity checks after distributor operations", async () => {
    const checks = await runIntegrityChecks();
    expect(checks.success).toBe(true);
    expect(checks.data.healthy, JSON.stringify(checks.data.issues)).toBe(true);
    expect(checks.data.issues.length).toBe(0);
  });
});

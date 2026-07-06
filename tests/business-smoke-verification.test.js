/**
 * Phase 10.5 Business Smoke Verification
 * Exercises the same business rules validated in the running application.
 */
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

const DATE = "2026-07-01";

describe("Phase 10.5 Business Smoke Verification", () => {
  let ctx = {};

  beforeAll(async () => {
    await setupVerificationDatabase((p) => {
      state.prisma = p;
    }, "verify-smoke.db");

    const prisma = state.prisma;
    const { saveVendor, saveProduct, saveCustomer, saveSalesman, saveRoute } = await import(
      "../src/main/services/masters.js"
    );
    const { savePurchaseInvoice } = await import("../src/main/services/purchase.js");
    const { saveSalesInvoice } = await import("../src/main/services/sales.js");
    const { saveRecovery } = await import("../src/main/services/recovery.js");
    const {
      savePurchaseOrder,
      approvePurchaseOrder,
      receivePurchaseOrder,
      convertPurchaseOrderToInvoice,
      cancelPurchaseOrder,
      deletePurchaseOrder,
      PO_STATUSES,
    } = await import("../src/main/services/purchase-order.js");
    const { saveTradeOffer, previewInvoiceOffers, OFFER_TYPES } = await import(
      "../src/main/services/trade-offer.js"
    );
    const { saveLoadSlip, updateLoadSlipStatus, LOAD_SLIP_STATUSES } = await import(
      "../src/main/services/load-slip.js"
    );
    const { saveClaim, updateClaimStatus, settleClaim } = await import("../src/main/services/claims.js");
    const { saveExpense } = await import("../src/main/services/expense.js");
    const {
      getDailyRecoverySheet,
      getDailyCashSummary,
      getDailyFinalSheet,
      globalSearch,
    } = await import("../src/main/services/distributor-reports.js");
    const { getCashbook, getDailyCashPosition } = await import("../src/main/services/financial-reports.js");
    const { getTrialBalance } = await import("../src/main/services/financial-reports.js");
    const { getCustomerLedger } = await import("../src/main/services/sub-ledger-service.js");
    const { getCustomerOutstanding, getInvoiceOutstanding } = await import(
      "../src/main/domain/customer-outstanding.js"
    );
    const { getStockQuantity } = await import("../src/main/domain/stock-quantity.js");
    const { runIntegrityChecks } = await import("../src/main/services/integrity-service.js");
    const { STOCK_MOVEMENT_TYPES } = await import("../src/main/core/stock-movement-types.js");
    const { SOURCE_DOCUMENT_TYPES } = await import("../src/main/core/account-roles.js");

    ctx = {
      prisma,
      saveVendor,
      saveProduct,
      saveCustomer,
      saveSalesman,
      saveRoute,
      savePurchaseInvoice,
      saveSalesInvoice,
      saveRecovery,
      savePurchaseOrder,
      approvePurchaseOrder,
      receivePurchaseOrder,
      convertPurchaseOrderToInvoice,
      cancelPurchaseOrder,
      deletePurchaseOrder,
      PO_STATUSES,
      saveTradeOffer,
      previewInvoiceOffers,
      OFFER_TYPES,
      saveLoadSlip,
      updateLoadSlipStatus,
      LOAD_SLIP_STATUSES,
      saveClaim,
      updateClaimStatus,
      settleClaim,
      saveExpense,
      getDailyRecoverySheet,
      getDailyCashSummary,
      getDailyFinalSheet,
      globalSearch,
      getCashbook,
      getDailyCashPosition,
      getTrialBalance,
      getCustomerLedger,
      getCustomerOutstanding,
      getInvoiceOutstanding,
      getStockQuantity,
      runIntegrityChecks,
      STOCK_MOVEMENT_TYPES,
      SOURCE_DOCUMENT_TYPES,
    };

    const unit = await prisma.unit.findFirst({ where: { code: "CTN" } });
    ctx.unitId = unit.id;
    ctx.warehouseId =
      (await prisma.warehouse.findFirst())?.id ??
      (await prisma.warehouse.create({ data: { name: "Smoke WH" } })).id;

    const vendorRes = await saveVendor({ code: "SMV01", name: "Smoke Vendor" });
    ctx.vendorId = vendorRes.data.id;

    const productRes = await saveProduct({
      code: "SMK01",
      name: "Smoke Product A",
      category: "Beverages",
      baseUnitId: ctx.unitId,
      packSize: 1,
      price1: 100,
      costPrice: 60,
      vatPercent: 0,
    });
    ctx.productId = productRes.data.id;

    const productBRes = await saveProduct({
      code: "SMK02",
      name: "Smoke Product B",
      category: "Snacks",
      baseUnitId: ctx.unitId,
      packSize: 1,
      price1: 50,
      costPrice: 30,
      vatPercent: 0,
    });
    ctx.productBId = productBRes.data.id;

    const salesmanRes = await saveSalesman({ name: "Smoke Salesman", commissionRate: 3 });
    ctx.salesmanId = salesmanRes.data.id;

    const routeRes = await saveRoute({ name: "Smoke Route", salesmanId: ctx.salesmanId });
    ctx.routeId = routeRes.data.id;

    const customerRes = await saveCustomer({
      code: "SMC01",
      name: "Smoke Customer",
      routeId: ctx.routeId,
      salesmanId: ctx.salesmanId,
      creditLimit: 500000,
      creditDays: 30,
    });
    ctx.customerId = customerRes.data.id;

    const customer2Res = await saveCustomer({
      code: "SMC02",
      name: "Other Customer",
      creditLimit: 100000,
      creditDays: 30,
    });
    ctx.customer2Id = customer2Res.data.id;

    ctx.deliveryManId = (await prisma.deliveryMan.findFirst()).id;

    const stockIn = await savePurchaseInvoice({
      date: DATE,
      vendorId: ctx.vendorId,
      warehouseId: ctx.warehouseId,
      isCredit: true,
      items: [{ productId: ctx.productId, unitId: ctx.unitId, quantity: 500, price: 60, discount: 0, vatPercent: 0 }],
    });
    expect(stockIn.success, stockIn.error).toBe(true);
    ctx.initialStock = await getStockQuantity(prisma, ctx.productId, ctx.warehouseId);
  }, 120000);

  afterAll(async () => {
    await teardownVerificationDatabase();
  });

  describe("1. Purchase Orders", () => {
    it("enforces draft → approve → partial → complete → cancel rules", async () => {
      const {
        savePurchaseOrder,
        approvePurchaseOrder,
        receivePurchaseOrder,
        convertPurchaseOrderToInvoice,
        cancelPurchaseOrder,
        deletePurchaseOrder,
        PO_STATUSES,
        prisma,
        vendorId,
        warehouseId,
        productId,
        unitId,
        STOCK_MOVEMENT_TYPES,
        SOURCE_DOCUMENT_TYPES,
        getStockQuantity,
      } = ctx;

      const stockBefore = await getStockQuantity(prisma, productId, warehouseId);

      const poRes = await savePurchaseOrder({
        date: DATE,
        vendorId,
        warehouseId,
        items: [{ productId, unitId, quantity: 100, price: 60, discount: 0, vatPercent: 0 }],
      });
      expect(poRes.success).toBe(true);
      expect(poRes.data.status).toBe(PO_STATUSES.DRAFT);

      const poId = poRes.data.id;
      const itemId = poRes.data.items[0].id;

      await savePurchaseOrder({
        id: poId,
        date: DATE,
        vendorId,
        warehouseId,
        items: [{ productId, unitId, quantity: 80, price: 60, discount: 0, vatPercent: 0 }],
      });

      await approvePurchaseOrder(poId);
      const delApproved = await deletePurchaseOrder(poId);
      expect(delApproved.success).toBe(false);

      const po2 = await savePurchaseOrder({
        date: DATE,
        vendorId,
        warehouseId,
        items: [{ productId, unitId, quantity: 60, price: 60, discount: 0, vatPercent: 0 }],
      });
      const po2Id = po2.data.id;
      const po2ItemId = po2.data.items[0].id;

      await approvePurchaseOrder(po2Id);

      const overReceive = await receivePurchaseOrder({
        id: po2Id,
        lines: [{ itemId: po2ItemId, quantity: 70 }],
      });
      expect(overReceive.success).toBe(false);

      const partial = await receivePurchaseOrder({
        id: po2Id,
        lines: [{ itemId: po2ItemId, quantity: 25 }],
      });
      expect(partial.success).toBe(true);
      expect(partial.data.status).toBe(PO_STATUSES.PARTIAL);

      const stockAfterReceive = await getStockQuantity(prisma, productId, warehouseId);
      expect(stockAfterReceive).toBe(stockBefore);

      const complete = await receivePurchaseOrder({
        id: po2Id,
        lines: [{ itemId: po2ItemId, quantity: 35 }],
      });
      expect(complete.success).toBe(true);
      expect(complete.data.status).toBe(PO_STATUSES.COMPLETED);

      const cancelCompleted = await cancelPurchaseOrder(po2Id);
      expect(cancelCompleted.success).toBe(false);

      const po3 = await savePurchaseOrder({
        date: DATE,
        vendorId,
        warehouseId,
        items: [{ productId, unitId, quantity: 30, price: 60, discount: 0, vatPercent: 0 }],
      });
      await approvePurchaseOrder(po3.data.id);
      const convert1 = await convertPurchaseOrderToInvoice({ id: po3.data.id, date: DATE });
      expect(convert1.success, convert1.error).toBe(true);
      expect(convert1.data.invoice.purchaseOrderId).toBe(po3.data.id);
      expect(convert1.data.invoice.items[0].quantity).toBe(30);
      ctx.piNumber = convert1.data.invoice.number;
      ctx.poNumber = po3.data.number;

      const convert2 = await convertPurchaseOrderToInvoice({ id: po3.data.id, date: DATE });
      expect(convert2.success).toBe(false);

      const movements = await prisma.stockMovement.findMany({
        where: {
          documentType: SOURCE_DOCUMENT_TYPES.PURCHASE_INVOICE,
          documentId: convert1.data.invoice.id,
        },
      });
      expect(movements.length).toBeGreaterThan(0);
      expect(movements[0].movementType).toBe(STOCK_MOVEMENT_TYPES.PURCHASE);
      expect(movements[0].quantityIn).toBe(30);

      const stockAfterConvert = await getStockQuantity(prisma, productId, warehouseId);
      expect(stockAfterConvert).toBe(stockBefore + 30);

      const po4 = await savePurchaseOrder({
        date: DATE,
        vendorId,
        warehouseId,
        items: [{ productId, unitId, quantity: 10, price: 60, discount: 0, vatPercent: 0 }],
      });
      await approvePurchaseOrder(po4.data.id);
      const cancelOpen = await cancelPurchaseOrder(po4.data.id);
      expect(cancelOpen.success).toBe(true);
      expect(cancelOpen.data.status).toBe(PO_STATUSES.CANCELLED);

      const draftPo = await savePurchaseOrder({
        date: DATE,
        vendorId,
        warehouseId,
        items: [{ productId, unitId, quantity: 5, price: 60, discount: 0, vatPercent: 0 }],
      });
      const draftDelete = await deletePurchaseOrder(draftPo.data.id);
      expect(draftDelete.success).toBe(true);
    });
  });

  describe("2. Trade Offers", () => {
    it("applies all offer types with priority and expiry rules", async () => {
      const {
        saveTradeOffer,
        previewInvoiceOffers,
        OFFER_TYPES,
        saveSalesInvoice,
        prisma,
        customerId,
        customer2Id,
        productId,
        productBId,
        unitId,
        warehouseId,
        getStockQuantity,
      } = ctx;

      await saveTradeOffer({
        code: "BXGY",
        name: "Buy 10 Get 1",
        offerType: OFFER_TYPES.BUY_X_GET_Y,
        priority: 10,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        buyQuantity: 10,
        getQuantity: 1,
      });

      await saveTradeOffer({
        code: "SLAB",
        name: "Qty Slab",
        offerType: OFFER_TYPES.SLAB_DISCOUNT,
        priority: 20,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        productId,
        slabs: [
          { minQty: 1, maxQty: 10, discountPercent: 5 },
          { minQty: 11, maxQty: 20, discountPercent: 10 },
          { minQty: 21, maxQty: null, discountPercent: 15 },
        ],
      });

      await saveTradeOffer({
        code: "PCT",
        name: "10% Off",
        offerType: OFFER_TYPES.PERCENT_DISCOUNT,
        priority: 30,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        discountPercent: 10,
        productId: productBId,
      });

      await saveTradeOffer({
        code: "FIXED",
        name: "Fixed 50",
        offerType: OFFER_TYPES.FIXED_DISCOUNT,
        priority: 40,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        discountAmount: 50,
        customerId,
      });

      await saveTradeOffer({
        code: "CUST",
        name: "Customer Only",
        offerType: OFFER_TYPES.PERCENT_DISCOUNT,
        priority: 5,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        discountPercent: 20,
        customerId,
        productId,
      });

      await saveTradeOffer({
        code: "CAT",
        name: "Category Beverages",
        offerType: OFFER_TYPES.FIXED_DISCOUNT,
        priority: 50,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        category: "Beverages",
        discountAmount: 25,
      });

      await saveTradeOffer({
        code: "EXPIRED",
        name: "Expired",
        offerType: OFFER_TYPES.PERCENT_DISCOUNT,
        priority: 1,
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        discountPercent: 99,
        productId,
      });

      const bxgy = await previewInvoiceOffers({
        customerId,
        date: DATE,
        items: [{ productId, quantity: 25, price: 100, discount: 0, vatPercent: 0 }],
      });
      const bxgyLine = bxgy.data.lines.find((l) => l.productId === productId);
      expect(bxgyLine.freeQuantity).toBe(2);
      expect(bxgy.data.appliedOfferCodes).toContain("BXGY");
      expect(bxgy.data.appliedOfferCodes).not.toContain("EXPIRED");

      const slab = await previewInvoiceOffers({
        customerId: customer2Id,
        date: DATE,
        items: [{ productId, quantity: 15, price: 100, discount: 0, vatPercent: 0 }],
      });
      const slabLine = slab.data.lines.find((l) => l.productId === productId);
      expect(slabLine.discount).toBeGreaterThanOrEqual(10);
      expect(slab.data.appliedOfferCodes).toContain("SLAB");

      const cust1 = await previewInvoiceOffers({
        customerId,
        date: DATE,
        items: [{ productId, quantity: 10, price: 100, discount: 0, vatPercent: 0 }],
      });
      const cust2 = await previewInvoiceOffers({
        customerId: customer2Id,
        date: DATE,
        items: [{ productId, quantity: 10, price: 100, discount: 0, vatPercent: 0 }],
      });
      expect(cust1.data.appliedOfferCodes).toContain("CUST");
      expect(cust2.data.appliedOfferCodes).not.toContain("CUST");

      const stockBefore = await getStockQuantity(prisma, productId, warehouseId);
      const saleRes = await saveSalesInvoice({
        date: DATE,
        customerId,
        warehouseId,
        isCredit: true,
        items: [
          {
            productId,
            unitId,
            quantity: 20,
            freeQuantity: 2,
            price: 100,
            discount: 10,
            vatPercent: 0,
          },
        ],
      });
      expect(saleRes.success, saleRes.error).toBe(true);
      expect(saleRes.data.total).toBe(1980);

      const stockAfter = await getStockQuantity(prisma, productId, warehouseId);
      expect(stockAfter).toBe(stockBefore - 22);

      ctx.salesNumber = saleRes.data.number;
    });
  });

  describe("3. Load Slips", () => {
    it("tracks quantities through status flow without changing stock", async () => {
      const {
        saveLoadSlip,
        updateLoadSlipStatus,
        LOAD_SLIP_STATUSES,
        saveSalesInvoice,
        prisma,
        customerId,
        warehouseId,
        productId,
        unitId,
        salesmanId,
        routeId,
        deliveryManId,
        getStockQuantity,
      } = ctx;

      const stockBefore = await getStockQuantity(prisma, productId, warehouseId);

      const invoiceRes = await saveSalesInvoice({
        date: DATE,
        customerId,
        warehouseId,
        isCredit: true,
        items: [{ productId, unitId, quantity: 5, price: 100, discount: 0, vatPercent: 0 }],
      });
      expect(invoiceRes.success).toBe(true);

      const slipRes = await saveLoadSlip({
        date: DATE,
        deliveryManId,
        salesmanId,
        routeId,
        vehicleNo: "SMOKE-1",
        invoiceIds: [invoiceRes.data.id],
        items: [
          {
            productId,
            unitId,
            loadedQty: 5,
            deliveredQty: 0,
            returnedQty: 0,
            shortQty: 0,
            damageQty: 0,
          },
        ],
      });
      expect(slipRes.success, slipRes.error).toBe(true);
      expect(slipRes.data.status).toBe(LOAD_SLIP_STATUSES.DRAFT);
      ctx.loadSlipNumber = slipRes.data.number;

      const statuses = [
        LOAD_SLIP_STATUSES.LOADED,
        LOAD_SLIP_STATUSES.IN_TRANSIT,
        LOAD_SLIP_STATUSES.DELIVERED,
        LOAD_SLIP_STATUSES.CLOSED,
      ];
      let slipId = slipRes.data.id;
      for (const status of statuses) {
        const updated = await updateLoadSlipStatus({
          id: slipId,
          status,
          items: [
            {
              productId,
              unitId,
              loadedQty: 5,
              deliveredQty: 4,
              returnedQty: 0,
              shortQty: 1,
              damageQty: 0,
            },
          ],
        });
        expect(updated.success, updated.error).toBe(true);
        expect(updated.data.status).toBe(status);
      }

      const stockAfter = await getStockQuantity(prisma, productId, warehouseId);
      expect(stockAfter).toBe(stockBefore - 5);
    });
  });

  describe("4. Daily Recovery", () => {
    it("handles cash, bank, partial, and multi-invoice recovery with ledger updates", async () => {
      const {
        saveSalesInvoice,
        saveRecovery,
        getDailyRecoverySheet,
        getCustomerLedger,
        getCustomerOutstanding,
        getInvoiceOutstanding,
        prisma,
        customerId,
        salesmanId,
        warehouseId,
        productId,
        unitId,
      } = ctx;

      const inv1 = await saveSalesInvoice({
        date: DATE,
        customerId,
        warehouseId,
        isCredit: true,
        items: [{ productId, unitId, quantity: 10, price: 100, discount: 0, vatPercent: 0 }],
      });
      const inv2 = await saveSalesInvoice({
        date: DATE,
        customerId,
        warehouseId,
        isCredit: true,
        items: [{ productId, unitId, quantity: 5, price: 100, discount: 0, vatPercent: 0 }],
      });
      expect(inv1.success && inv2.success).toBe(true);

      const outstandingBefore = await getCustomerOutstanding(prisma, customerId);

      const cashRec = await saveRecovery({
        date: DATE,
        customerId,
        salesmanId,
        paymentMode: "Cash",
        items: [{ salesInvoiceId: inv1.data.id, amount: 300 }],
      });
      expect(cashRec.success, cashRec.error).toBe(true);

      const bankRec = await saveRecovery({
        date: DATE,
        customerId,
        salesmanId,
        paymentMode: "Bank",
        items: [{ salesInvoiceId: inv2.data.id, amount: 200 }],
      });
      expect(bankRec.success, bankRec.error).toBe(true);

      const multiRec = await saveRecovery({
        date: DATE,
        customerId,
        salesmanId,
        paymentMode: "Cash",
        items: [
          { salesInvoiceId: inv1.data.id, amount: 200 },
          { salesInvoiceId: inv2.data.id, amount: 100 },
        ],
      });
      expect(multiRec.success, multiRec.error).toBe(true);

      const overRec = await saveRecovery({
        date: DATE,
        customerId,
        paymentMode: "Cash",
        items: [{ salesInvoiceId: inv1.data.id, amount: 99999 }],
      });
      expect(overRec.success).toBe(false);

      const outstandingAfter = await getCustomerOutstanding(prisma, customerId);
      expect(outstandingAfter).toBeLessThan(outstandingBefore);

      const inv1Fresh = await prisma.salesInvoice.findUnique({ where: { id: inv1.data.id } });
      const inv1Outstanding = await getInvoiceOutstanding(prisma, inv1Fresh);
      expect(inv1Outstanding).toBe(500);

      const sheet = await getDailyRecoverySheet({ date: DATE });
      expect(sheet.success).toBe(true);
      expect(sheet.data.totalRecovery).toBeGreaterThanOrEqual(800);

      const ledger = await getCustomerLedger({ customerId, startDate: DATE, endDate: DATE });
      expect(ledger.success).toBe(true);
      expect(ledger.data.rows.some((r) => r.reference?.startsWith("RV-"))).toBe(true);

      const journalCount = await prisma.journalEntry.count({
        where: { sourceDocumentType: "RECOVERY" },
      });
      expect(journalCount).toBeGreaterThan(0);

      ctx.recoveryNumber = cashRec.data.number;
    });
  });

  describe("5. Claims", () => {
    it("approve, reject, settle with inventory, accounting, audit, and events", async () => {
      const {
        saveClaim,
        updateClaimStatus,
        settleClaim,
        prisma,
        customerId,
        warehouseId,
        productId,
        unitId,
        getStockQuantity,
      } = ctx;

      const stockBefore = await getStockQuantity(prisma, productId, warehouseId);

      const claimRes = await saveClaim({
        date: DATE,
        partyType: "Customer",
        customerId,
        warehouseId,
        claimType: "Damage",
        items: [{ productId, unitId, quantity: 2, price: 100, discount: 0, vatPercent: 0 }],
      });
      expect(claimRes.success, claimRes.error).toBe(true);
      ctx.claimNumber = claimRes.data.number;

      const approveRes = await updateClaimStatus({ id: claimRes.data.id, status: "Approved" });
      expect(approveRes.success).toBe(true);

      const rejectClaim = await saveClaim({
        date: DATE,
        partyType: "Customer",
        customerId,
        warehouseId,
        claimType: "Shortage",
        items: [{ productId, unitId, quantity: 1, price: 100, discount: 0, vatPercent: 0 }],
      });
      const rejectRes = await updateClaimStatus({ id: rejectClaim.data.id, status: "Rejected" });
      expect(rejectRes.success).toBe(true);

      const settleRes = await settleClaim({ id: claimRes.data.id, resolution: "WriteOff" });
      expect(settleRes.success, settleRes.error).toBe(true);
      expect(settleRes.data.status).toBe("Settled");

      const stockAfter = await getStockQuantity(prisma, productId, warehouseId);
      expect(stockAfter).toBe(stockBefore - 2);

      const auditCount = await prisma.companyAuditLog.count({
        where: { table: "Claim" },
      });
      const eventCount = await prisma.companyEventLog.count({
        where: { entityType: "CLAIM" },
      });
      expect(auditCount).toBeGreaterThanOrEqual(3);
      expect(eventCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe("6. Daily Cash Position", () => {
    it("matches opening + inflows - outflows = closing against cashbook", async () => {
      const { saveExpense, getDailyCashSummary, getCashbook, getDailyCashPosition } = ctx;

      await saveExpense({
        date: DATE,
        amount: 250,
        paymentMode: "Cash",
        description: "Smoke expense",
      });

      const start = new Date(DATE);
      start.setHours(0, 0, 0, 0);
      const end = new Date(DATE);
      end.setHours(23, 59, 59, 999);

      const cashbook = await getCashbook({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      const summary = await getDailyCashSummary({ date: DATE });
      const position = await getDailyCashPosition({ date: DATE });

      expect(cashbook.success).toBe(true);
      expect(summary.success).toBe(true);
      expect(position.success).toBe(true);

      const computedClosing = summary.data.openingCash
        + summary.data.cashSales
        + summary.data.cashRecovery
        - summary.data.cashPayments
        - summary.data.expenses;

      expect(summary.data.closingCash).toBeCloseTo(position.data.closing, 2);
      expect(computedClosing).toBeCloseTo(summary.data.closingCash, 2);
      expect(cashbook.data.closing).toBeCloseTo(summary.data.closingCash, 2);
    });
  });

  describe("7. Daily Final Sheet", () => {
    it("reconciles with sales, recovery, cash, claims, and trial balance", async () => {
      const { getDailyFinalSheet, getDailyRecoverySheet, getDailyCashSummary, getTrialBalance, prisma } =
        ctx;

      const finalSheet = await getDailyFinalSheet({ date: DATE });
      const recoverySheet = await getDailyRecoverySheet({ date: DATE });
      const cashSummary = await getDailyCashSummary({ date: DATE });
      const trialBalance = await getTrialBalance({});

      expect(finalSheet.success).toBe(true);
      expect(recoverySheet.success).toBe(true);
      expect(cashSummary.success).toBe(true);
      expect(trialBalance.success).toBe(true);

      expect(finalSheet.data.recovery.totalRecovery).toBe(recoverySheet.data.totalRecovery);
      expect(finalSheet.data.cash.closingCash).toBe(cashSummary.data.closingCash);
      expect(finalSheet.data.sales.count).toBeGreaterThan(0);
      expect(trialBalance.data.balanced).toBe(true);

      const claimsOnDay = await prisma.claim.count({
        where: {
          date: {
            gte: new Date(`${DATE}T00:00:00`),
            lte: new Date(`${DATE}T23:59:59`),
          },
        },
      });
      expect(finalSheet.data.claims.count).toBe(claimsOnDay);
    });
  });

  describe("8. Global Search", () => {
    it("finds all document types with correct routes", async () => {
      const { globalSearch } = ctx;

      const searches = [
        { query: ctx.salesNumber, type: "Sales Invoice", route: "/sales/invoices" },
        { query: ctx.piNumber, type: "Purchase Invoice", route: "/purchase/invoices" },
        { query: "SMC01", type: "Customer", route: "/masters/customers" },
        { query: "SMV01", type: "Supplier", route: "/masters/vendors" },
        { query: "SMK01", type: "Product", route: "/masters/products" },
        { query: ctx.recoveryNumber, type: "Recovery", route: "/sales/recovery" },
        { query: ctx.claimNumber, type: "Claim", route: "/claims" },
        { query: ctx.poNumber, type: "Purchase Order", route: "/purchase/orders" },
        { query: ctx.loadSlipNumber, type: "Load Slip", route: "/sales/load-slips" },
      ].filter((item) => item.query);

      for (const item of searches) {
        const result = await globalSearch({ query: item.query });
        expect(result.success).toBe(true);
        const match = result.data.results.find((r) => r.type === item.type);
        expect(match, `Missing ${item.type} for ${item.query}`).toBeTruthy();
        expect(match.route).toContain(item.route);
      }
    });
  });

  describe("Integrity", () => {
    it("database health remains clean after all smoke scenarios", async () => {
      const checks = await ctx.runIntegrityChecks();
      expect(checks.success).toBe(true);
      expect(checks.data.healthy, JSON.stringify(checks.data.issues)).toBe(true);
    });
  });
});

import { getCompanyPrisma } from "../db/init";
import { calcLineNet, calcLineVat, roundMoney } from "../utils/money";
import { increaseStock, decreaseStock } from "./stock";
import { postClaimWriteOffJournal } from "./accounting";
import { savePurchaseReturn } from "./purchase-return";
import { saveSalesReturn } from "./sales-return";
import { recordStockMovement } from "../domain/stock-movement-recorder";
import { STOCK_MOVEMENT_TYPES } from "../core/stock-movement-types";
import { SOURCE_DOCUMENT_TYPES } from "../core/account-roles";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

export const CLAIM_TYPES = ["Damage", "Expiry", "Shortage", "Other"];
export const CLAIM_STATUSES = ["Open", "Approved", "Rejected", "Settled"];
export const CLAIM_RESOLUTIONS = ["Credit", "Replace", "WriteOff", "SupplierReturn"];

function normalizeClaimItems(items = []) {
  return items
    .filter((item) => item.productId && Number(item.quantity) > 0)
    .map((item) => {
      const net = calcLineNet({ ...item, freeQuantity: 0 });
      const vat = calcLineVat(net, item.vatPercent);
      const lineTotal = roundMoney(net + vat);
      return {
        productId: Number(item.productId),
        unitId: Number(item.unitId),
        quantity: Number(item.quantity),
        batchNo: item.batchNo?.trim() || null,
        price: Number(item.price) || 0,
        discount: Number(item.discount) || 0,
        vatPercent: Number(item.vatPercent) || 0,
        lineTotal,
        reason: item.reason?.trim() || null,
        net,
        vat,
      };
    });
}

async function nextClaimNumber(tx) {
  const year = new Date().getFullYear();
  const prefix = `CL-${year}-`;
  const latest = await tx.claim.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
  });
  const next = latest ? Number(latest.number.split("-").pop()) + 1 : 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

async function resolveClaimCogs(tx, items, warehouseId) {
  let cogsTotal = 0;
  for (const item of items) {
    const stock = await tx.stock.findFirst({
      where: { productId: item.productId, warehouseId },
      orderBy: { createdAt: "desc" },
    });
    const unitCost = stock?.costPerUnit || 0;
    const product = await tx.product.findUnique({ where: { id: item.productId } });
    cogsTotal = roundMoney(cogsTotal + item.quantity * (unitCost || product?.costPrice || 0));
  }
  return cogsTotal;
}

export async function getClaimLookups() {
  const prisma = getCompanyPrisma();
  const [customers, vendors, products, warehouses, units, salesmen] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { active: true },
      include: { baseUnit: true },
      orderBy: { name: "asc" },
    }),
    prisma.warehouse.findMany({ orderBy: { name: "asc" } }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
    prisma.salesman.findMany({ orderBy: { name: "asc" } }),
  ]);
  return success({ customers, vendors, products, warehouses, units, salesmen });
}

export async function listClaims(payload = {}) {
  const prisma = getCompanyPrisma();
  const where = {};
  if (payload.status) where.status = payload.status;
  if (payload.partyType) where.partyType = payload.partyType;

  const data = await prisma.claim.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      customer: true,
      vendor: true,
      warehouse: true,
      salesman: true,
      salesInvoice: true,
      purchaseInvoice: true,
      items: { include: { product: true } },
      salesReturn: true,
      purchaseReturn: true,
    },
  });
  return success(data);
}

export async function saveClaim(payload) {
  const prisma = getCompanyPrisma();
  const items = normalizeClaimItems(payload.items);
  const partyType = payload.partyType || "Customer";

  if (partyType === "Customer" && !payload.customerId) {
    return failure("Customer is required");
  }
  if (partyType === "Supplier" && !payload.vendorId) {
    return failure("Vendor is required");
  }
  if (!payload.warehouseId) {
    return failure("Warehouse is required");
  }
  if (items.length === 0) {
    return failure("Add at least one claim line");
  }

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.net, 0));
  const taxTotal = roundMoney(items.reduce((sum, item) => sum + item.vat, 0));
  const total = roundMoney(subtotal + taxTotal);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const number = payload.number || (await nextClaimNumber(tx));
      return tx.claim.create({
        data: {
          number,
          date: new Date(payload.date),
          partyType,
          customerId: partyType === "Customer" ? Number(payload.customerId) : null,
          vendorId: partyType === "Supplier" ? Number(payload.vendorId) : null,
          warehouseId: Number(payload.warehouseId),
          salesmanId: payload.salesmanId ? Number(payload.salesmanId) : null,
          salesInvoiceId: payload.salesInvoiceId ? Number(payload.salesInvoiceId) : null,
          purchaseInvoiceId: payload.purchaseInvoiceId ? Number(payload.purchaseInvoiceId) : null,
          deliveryDate: payload.deliveryDate ? new Date(payload.deliveryDate) : null,
          claimType: payload.claimType || "Damage",
          status: "Open",
          remarks: payload.remarks?.trim() || null,
          subtotal,
          taxTotal,
          total,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              unitId: item.unitId,
              quantity: item.quantity,
              batchNo: item.batchNo,
              price: item.price,
              discount: item.discount,
              vatPercent: item.vatPercent,
              lineTotal: item.lineTotal,
              reason: item.reason,
            })),
          },
        },
        include: {
          customer: true,
          vendor: true,
          warehouse: true,
          items: { include: { product: true } },
        },
      });
    });

    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to save claim");
  }
}

export async function updateClaimStatus(payload) {
  const prisma = getCompanyPrisma();
  const id = Number(payload.id);
  const status = payload.status;

  if (!id || !CLAIM_STATUSES.includes(status)) {
    return failure("Invalid claim status update");
  }

  const claim = await prisma.claim.findUnique({ where: { id } });
  if (!claim) {
    return failure("Claim not found");
  }
  if (claim.status === "Settled" || claim.status === "Rejected") {
    return failure("Claim is already closed");
  }
  if (status === "Approved" && claim.status !== "Open") {
    return failure("Only open claims can be approved");
  }
  if (status === "Rejected" && !["Open", "Approved"].includes(claim.status)) {
    return failure("Claim cannot be rejected");
  }

  const updated = await prisma.claim.update({
    where: { id },
    data: { status },
  });
  return success(updated);
}

export async function settleClaim(payload) {
  const prisma = getCompanyPrisma();
  const id = Number(payload.id);
  const resolution = payload.resolution;

  if (!id || !CLAIM_RESOLUTIONS.includes(resolution)) {
    return failure("Valid resolution is required");
  }

  const claim = await prisma.claim.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!claim) {
    return failure("Claim not found");
  }
  if (claim.status !== "Approved") {
    return failure("Only approved claims can be settled");
  }

  try {
    if (claim.partyType === "Customer") {
      if (resolution === "Credit") {
        const returnResult = await saveSalesReturn({
          date: payload.date || claim.date,
          customerId: claim.customerId,
          warehouseId: claim.warehouseId,
          salesInvoiceId: claim.salesInvoiceId,
          claimId: claim.id,
          remarks: `Settled from claim ${claim.number}`,
          items: claim.items.map((item) => ({
            productId: item.productId,
            unitId: item.unitId,
            batchNo: item.batchNo,
            quantity: item.quantity,
            price: item.price,
            discount: item.discount,
            vatPercent: item.vatPercent,
          })),
        });
        if (!returnResult.success) {
          return returnResult;
        }

        const updated = await prisma.claim.update({
          where: { id },
          data: { status: "Settled", resolution },
          include: { salesReturn: true, items: { include: { product: true } } },
        });
        return success(updated);
      }

      if (resolution === "Replace") {
        await prisma.$transaction(async (tx) => {
          for (const item of claim.items) {
            const stock = await tx.stock.findFirst({
              where: { productId: item.productId, warehouseId: claim.warehouseId },
              orderBy: { createdAt: "desc" },
            });
            const unitCost = stock?.costPerUnit || 0;
            const product = await tx.product.findUnique({ where: { id: item.productId } });
            await increaseStock(tx, {
              productId: item.productId,
              warehouseId: claim.warehouseId,
              batchNo: item.batchNo,
              quantity: item.quantity,
              costPerUnit: unitCost || product?.costPrice || 0,
            });

            await recordStockMovement(tx, {
              date: claim.date,
              productId: item.productId,
              warehouseId: claim.warehouseId,
              batchNo: item.batchNo,
              movementType: STOCK_MOVEMENT_TYPES.POSITIVE_ADJUSTMENT,
              documentType: SOURCE_DOCUMENT_TYPES.CLAIM,
              documentId: claim.id,
              referenceNumber: claim.number,
              quantityIn: item.quantity,
              quantityOut: 0,
              unitCost: unitCost || product?.costPrice || 0,
              remarks: `Claim replace ${claim.number}`,
            });
          }
        });

        const updated = await prisma.claim.update({
          where: { id },
          data: { status: "Settled", resolution },
          include: { items: { include: { product: true } } },
        });
        return success(updated);
      }

      if (resolution === "WriteOff") {
        const cogsTotal = await resolveClaimCogs(prisma, claim.items, claim.warehouseId);
        await prisma.$transaction(async (tx) => {
          for (const item of claim.items) {
            const { costPerUnit } = await decreaseStock(tx, {
              productId: item.productId,
              warehouseId: claim.warehouseId,
              batchNo: item.batchNo,
              quantity: item.quantity,
            });

            await recordStockMovement(tx, {
              date: claim.date,
              productId: item.productId,
              warehouseId: claim.warehouseId,
              batchNo: item.batchNo,
              movementType: STOCK_MOVEMENT_TYPES.CLAIM_WRITEOFF,
              documentType: SOURCE_DOCUMENT_TYPES.CLAIM,
              documentId: claim.id,
              referenceNumber: claim.number,
              quantityIn: 0,
              quantityOut: item.quantity,
              unitCost: costPerUnit,
              remarks: `Claim write-off ${claim.number}`,
            });
          }

          await postClaimWriteOffJournal(tx, { ...claim, cogsTotal });
        });

        const updated = await prisma.claim.update({
          where: { id },
          data: { status: "Settled", resolution },
          include: { items: { include: { product: true } } },
        });
        return success(updated);
      }
    }

    if (claim.partyType === "Supplier" && resolution === "SupplierReturn") {
      const returnResult = await savePurchaseReturn({
        date: payload.date || claim.date,
        vendorId: claim.vendorId,
        warehouseId: claim.warehouseId,
        purchaseInvoiceId: claim.purchaseInvoiceId,
        remarks: `Settled from supplier claim ${claim.number}`,
        items: claim.items.map((item) => ({
          productId: item.productId,
          unitId: item.unitId,
          quantity: item.quantity,
          price: item.price,
          discount: item.discount,
          vatPercent: item.vatPercent,
        })),
      });
      if (!returnResult.success) {
        return returnResult;
      }

      const updated = await prisma.claim.update({
        where: { id },
        data: {
          status: "Settled",
          resolution,
          purchaseReturnId: returnResult.data.id,
        },
        include: { purchaseReturn: true, items: { include: { product: true } } },
      });
      return success(updated);
    }

    return failure("Resolution is not valid for this claim type");
  } catch (error) {
    return failure(error.message || "Failed to settle claim");
  }
}

export async function getClaimReport(payload = {}) {
  const prisma = getCompanyPrisma();
  const { start, end } = (() => {
    const startDate = payload.startDate ? new Date(payload.startDate) : new Date("2000-01-01");
    const endDate = payload.endDate ? new Date(payload.endDate) : new Date();
    endDate.setHours(23, 59, 59, 999);
    return { start: startDate, end: endDate };
  })();

  const claims = await prisma.claim.findMany({
    where: { date: { gte: start, lte: end } },
    include: {
      customer: true,
      vendor: true,
      items: { include: { product: true } },
    },
    orderBy: { date: "desc" },
  });

  const summary = {
    total: claims.length,
    open: claims.filter((c) => c.status === "Open").length,
    approved: claims.filter((c) => c.status === "Approved").length,
    settled: claims.filter((c) => c.status === "Settled").length,
    rejected: claims.filter((c) => c.status === "Rejected").length,
    customerClaims: claims.filter((c) => c.partyType === "Customer").length,
    supplierClaims: claims.filter((c) => c.partyType === "Supplier").length,
    claimValue: roundMoney(claims.reduce((sum, claim) => sum + claim.total, 0)),
  };

  return success({ claims, summary });
}

import { getCompanyPrisma } from "../db/init";
import { calcLineNet, calcLineVat, roundMoney } from "../utils/money";
import { decreaseStock } from "./stock";
import { postPurchaseReturnJournal } from "./accounting";
import { recordStockMovement } from "../domain/stock-movement-recorder";
import { STOCK_MOVEMENT_TYPES } from "../core/stock-movement-types";
import { SOURCE_DOCUMENT_TYPES } from "../core/account-roles";
import { DOCUMENT_TYPES } from "../core/document-types";
import { onDocumentCreated, onDocumentPosted } from "./document-lifecycle-service";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

function normalizeItems(items = []) {
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
        price: Number(item.price) || 0,
        discount: Number(item.discount) || 0,
        vatPercent: Number(item.vatPercent) || 0,
        lineTotal,
        net,
        vat,
      };
    });
}

async function nextReturnNumber(tx) {
  const year = new Date().getFullYear();
  const prefix = `PR-${year}-`;
  const latest = await tx.purchaseReturn.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
  });
  const next = latest ? Number(latest.number.split("-").pop()) + 1 : 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

export async function listPurchaseReturns() {
  const prisma = getCompanyPrisma();
  const data = await prisma.purchaseReturn.findMany({
    orderBy: { date: "desc" },
    include: {
      vendor: true,
      warehouse: true,
      items: { include: { product: true } },
    },
  });
  return success(data);
}

export async function savePurchaseReturn(payload) {
  const prisma = getCompanyPrisma();
  const items = normalizeItems(payload.items);

  if (!payload.vendorId) {
    return failure("Vendor is required");
  }
  if (!payload.warehouseId) {
    return failure("Warehouse is required");
  }
  if (items.length === 0) {
    return failure("Add at least one return line");
  }

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.net, 0));
  const taxTotal = roundMoney(items.reduce((sum, item) => sum + item.vat, 0));
  const total = roundMoney(subtotal + taxTotal);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const number = payload.number || (await nextReturnNumber(tx));
      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          number,
          date: new Date(payload.date),
          vendorId: Number(payload.vendorId),
          warehouseId: Number(payload.warehouseId),
          purchaseInvoiceId: payload.purchaseInvoiceId ? Number(payload.purchaseInvoiceId) : null,
          subtotal,
          taxTotal,
          total,
          remarks: payload.remarks?.trim() || null,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              unitId: item.unitId,
              quantity: item.quantity,
              price: item.price,
              discount: item.discount,
              vatPercent: item.vatPercent,
              lineTotal: item.lineTotal,
            })),
          },
        },
      });

      for (const item of items) {
        const { costPerUnit } = await decreaseStock(tx, {
          productId: item.productId,
          warehouseId: purchaseReturn.warehouseId,
          batchNo: null,
          quantity: item.quantity,
        });

        await recordStockMovement(tx, {
          date: purchaseReturn.date,
          productId: item.productId,
          warehouseId: purchaseReturn.warehouseId,
          batchNo: null,
          movementType: STOCK_MOVEMENT_TYPES.PURCHASE_RETURN,
          documentType: SOURCE_DOCUMENT_TYPES.PURCHASE_RETURN,
          documentId: purchaseReturn.id,
          referenceNumber: purchaseReturn.number,
          quantityIn: 0,
          quantityOut: item.quantity,
          unitCost: costPerUnit,
        });
      }

      await onDocumentCreated(tx, {
        documentType: DOCUMENT_TYPES.PURCHASE_RETURN,
        documentId: purchaseReturn.id,
        documentNumber: purchaseReturn.number,
      });
      await postPurchaseReturnJournal(tx, purchaseReturn);
      await onDocumentPosted(tx, {
        documentType: DOCUMENT_TYPES.PURCHASE_RETURN,
        documentId: purchaseReturn.id,
        documentNumber: purchaseReturn.number,
        postedAt: purchaseReturn.date,
      });
      return purchaseReturn;
    });

    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to save purchase return");
  }
}

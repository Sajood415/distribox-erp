import { getCompanyPrisma } from "../db/init";
import { calcLineNet, calcLineVat, roundMoney } from "../utils/money";
import { savePurchaseInvoice } from "./purchase";
import { logOperation } from "./operation-log";
import { EVENT_TYPES } from "./event-service";
import { DOCUMENT_TYPES } from "../core/document-types";
import { onDocumentCreated, onDocumentPosted, onDocumentCancelled } from "./document-lifecycle-service";

export const PO_STATUSES = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  PARTIAL: "Partial",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

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
        receivedQty: Number(item.receivedQty) || 0,
        price: Number(item.price) || 0,
        discount: Number(item.discount) || 0,
        vatPercent: Number(item.vatPercent) || 0,
        lineTotal,
        net,
        vat,
      };
    });
}

async function nextPoNumber(tx) {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;
  const latest = await tx.purchaseOrder.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
  });
  const next = latest ? Number(latest.number.split("-").pop()) + 1 : 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

function deriveStatus(items) {
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  const receivedQty = items.reduce((sum, item) => sum + item.receivedQty, 0);
  if (receivedQty <= 0) return PO_STATUSES.APPROVED;
  if (receivedQty >= totalQty) return PO_STATUSES.COMPLETED;
  return PO_STATUSES.PARTIAL;
}

export async function listPurchaseOrders() {
  const prisma = getCompanyPrisma();
  const data = await prisma.purchaseOrder.findMany({
    orderBy: { date: "desc" },
    include: {
      vendor: true,
      warehouse: true,
      items: { include: { product: true } },
    },
  });
  return success(data);
}

export async function getPurchaseOrder(id) {
  const prisma = getCompanyPrisma();
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: Number(id) },
    include: {
      vendor: true,
      warehouse: true,
      items: { include: { product: true, unit: true } },
      invoices: true,
    },
  });
  if (!order) return failure("Purchase order not found");
  return success(order);
}

export async function savePurchaseOrder(payload) {
  const prisma = getCompanyPrisma();
  const items = normalizeItems(payload.items);
  if (!payload.vendorId || !payload.warehouseId) return failure("Vendor and warehouse are required");
  if (items.length === 0) return failure("Add at least one line");

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.net, 0));
  const taxTotal = roundMoney(items.reduce((sum, item) => sum + item.vat, 0));
  const total = roundMoney(subtotal + taxTotal);

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (payload.id) {
        const existing = await tx.purchaseOrder.findUnique({ where: { id: Number(payload.id) } });
        if (!existing) throw new Error("Purchase order not found");
        if (existing.status !== PO_STATUSES.DRAFT) {
          throw new Error("Only draft purchase orders can be edited");
        }
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: existing.id } });
        const updated = await tx.purchaseOrder.update({
          where: { id: existing.id },
          data: {
            date: new Date(payload.date),
            vendorId: Number(payload.vendorId),
            warehouseId: Number(payload.warehouseId),
            subtotal,
            taxTotal,
            total,
            remarks: payload.remarks?.trim() || null,
            items: {
              create: items.map((item) => ({
                productId: item.productId,
                unitId: item.unitId,
                quantity: item.quantity,
                receivedQty: 0,
                price: item.price,
                discount: item.discount,
                vatPercent: item.vatPercent,
                lineTotal: item.lineTotal,
              })),
            },
          },
          include: { vendor: true, warehouse: true, items: { include: { product: true } } },
        });
        await logOperation(tx, {
          table: "PurchaseOrder",
          recordId: updated.id,
          action: "UPDATE",
          entityType: "PURCHASE_ORDER",
          referenceNumber: updated.number,
          message: `Purchase order ${updated.number} updated`,
        });
        return updated;
      }

      const created = await tx.purchaseOrder.create({
        data: {
          number: payload.number || (await nextPoNumber(tx)),
          date: new Date(payload.date),
          vendorId: Number(payload.vendorId),
          warehouseId: Number(payload.warehouseId),
          status: PO_STATUSES.DRAFT,
          subtotal,
          taxTotal,
          total,
          remarks: payload.remarks?.trim() || null,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              unitId: item.unitId,
              quantity: item.quantity,
              receivedQty: 0,
              price: item.price,
              discount: item.discount,
              vatPercent: item.vatPercent,
              lineTotal: item.lineTotal,
            })),
          },
        },
        include: { vendor: true, warehouse: true, items: { include: { product: true } } },
      });
      await onDocumentCreated(tx, {
        documentType: DOCUMENT_TYPES.PURCHASE_ORDER,
        documentId: created.id,
        documentNumber: created.number,
      });
      await logOperation(tx, {
        table: "PurchaseOrder",
        recordId: created.id,
        action: "CREATE",
        entityType: "PURCHASE_ORDER",
        referenceNumber: created.number,
        message: `Purchase order ${created.number} created`,
      });
      return created;
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to save purchase order");
  }
}

export async function deletePurchaseOrder(id) {
  const prisma = getCompanyPrisma();
  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findUnique({ where: { id: Number(id) } });
      if (!order) throw new Error("Purchase order not found");
      if (order.status !== PO_STATUSES.DRAFT) throw new Error("Only draft purchase orders can be deleted");
      await tx.purchaseOrder.delete({ where: { id: order.id } });
      await logOperation(tx, {
        table: "PurchaseOrder",
        recordId: order.id,
        action: "DELETE",
        eventType: EVENT_TYPES.VOIDED,
        entityType: "PURCHASE_ORDER",
        referenceNumber: order.number,
        message: `Purchase order ${order.number} deleted`,
      });
    });
    return success({ deleted: true });
  } catch (error) {
    return failure(error.message || "Failed to delete purchase order");
  }
}

export async function approvePurchaseOrder(id) {
  return updatePoStatus(id, PO_STATUSES.DRAFT, PO_STATUSES.APPROVED, "approved");
}

export async function cancelPurchaseOrder(id) {
  const prisma = getCompanyPrisma();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findUnique({ where: { id: Number(id) } });
      if (!order) throw new Error("Purchase order not found");
      if ([PO_STATUSES.COMPLETED, PO_STATUSES.CANCELLED].includes(order.status)) {
        throw new Error("Purchase order cannot be cancelled");
      }
      const updated = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: PO_STATUSES.CANCELLED },
      });
      await onDocumentCancelled(tx, {
        documentType: DOCUMENT_TYPES.PURCHASE_ORDER,
        documentId: updated.id,
        documentNumber: updated.number,
        reason: "Purchase order cancelled",
      });
      await logOperation(tx, {
        table: "PurchaseOrder",
        recordId: updated.id,
        action: "CANCEL",
        eventType: EVENT_TYPES.VOIDED,
        entityType: "PURCHASE_ORDER",
        referenceNumber: updated.number,
        message: `Purchase order ${updated.number} cancelled`,
      });
      return updated;
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to cancel purchase order");
  }
}

async function updatePoStatus(id, fromStatus, toStatus, label) {
  const prisma = getCompanyPrisma();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findUnique({ where: { id: Number(id) } });
      if (!order) throw new Error("Purchase order not found");
      if (order.status !== fromStatus) throw new Error(`Purchase order is not ${fromStatus.toLowerCase()}`);
      const updated = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: toStatus },
      });
      await logOperation(tx, {
        table: "PurchaseOrder",
        recordId: updated.id,
        action: label.toUpperCase(),
        eventType: EVENT_TYPES.APPROVED,
        entityType: "PURCHASE_ORDER",
        referenceNumber: updated.number,
        message: `Purchase order ${updated.number} ${label}`,
      });
      return updated;
    });
    return success(result);
  } catch (error) {
    return failure(error.message || `Failed to ${label} purchase order`);
  }
}

export async function receivePurchaseOrder(payload) {
  const prisma = getCompanyPrisma();
  const lines = payload.lines || [];
  if (!payload.id || lines.length === 0) return failure("Receiving lines are required");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findUnique({
        where: { id: Number(payload.id) },
        include: { items: true },
      });
      if (!order) throw new Error("Purchase order not found");
      if (![PO_STATUSES.APPROVED, PO_STATUSES.PARTIAL].includes(order.status)) {
        throw new Error("Purchase order is not open for receiving");
      }

      for (const line of lines) {
        const item = order.items.find((row) => row.id === Number(line.itemId));
        if (!item) continue;
        const receiveQty = roundMoney(line.quantity);
        const pending = roundMoney(item.quantity - item.receivedQty);
        if (receiveQty <= 0 || receiveQty > pending) {
          throw new Error(`Invalid receive quantity for product #${item.productId}`);
        }
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { receivedQty: roundMoney(item.receivedQty + receiveQty) },
        });
      }

      const refreshedItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: order.id } });
      const status = deriveStatus(refreshedItems);
      const updated = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status },
        include: { items: { include: { product: true } }, vendor: true, warehouse: true },
      });
      await logOperation(tx, {
        table: "PurchaseOrder",
        recordId: updated.id,
        action: "RECEIVE",
        entityType: "PURCHASE_ORDER",
        referenceNumber: updated.number,
        message: `Purchase order ${updated.number} received (${status})`,
      });
      return updated;
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to receive purchase order");
  }
}

export async function convertPurchaseOrderToInvoice(payload) {
  const prisma = getCompanyPrisma();
  const orderResult = await getPurchaseOrder(payload.id);
  if (!orderResult.success) return orderResult;
  const order = orderResult.data;
  if (![PO_STATUSES.APPROVED, PO_STATUSES.PARTIAL, PO_STATUSES.COMPLETED].includes(order.status)) {
    return failure("Purchase order must be approved before invoicing");
  }

  const items = order.items
    .map((item) => ({
      productId: item.productId,
      unitId: item.unitId,
      quantity: roundMoney(item.quantity - item.receivedQty),
      price: item.price,
      discount: item.discount,
      vatPercent: item.vatPercent,
    }))
    .filter((item) => item.quantity > 0);

  if (items.length === 0) return failure("No pending quantity to invoice");

  const invoiceResult = await savePurchaseInvoice({
    date: payload.date || order.date,
    vendorId: order.vendorId,
    warehouseId: order.warehouseId,
    isCredit: payload.isCredit ?? true,
    freight: payload.freight || 0,
    paidAmount: 0,
    remarks: `From PO ${order.number}`,
    purchaseOrderId: order.id,
    items,
  });

  if (!invoiceResult.success) return invoiceResult;

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: { receivedQty: item.quantity },
      });
    }
    await tx.purchaseOrder.update({
      where: { id: order.id },
      data: { status: PO_STATUSES.COMPLETED },
    });
    await logOperation(tx, {
      table: "PurchaseOrder",
      recordId: order.id,
      action: "CONVERT",
      eventType: EVENT_TYPES.POSTED,
      entityType: "PURCHASE_ORDER",
      referenceNumber: order.number,
      message: `Purchase order ${order.number} converted to invoice ${invoiceResult.data.number}`,
    });
  });

  return success({ purchaseOrder: order, invoice: invoiceResult.data });
}

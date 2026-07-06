import { getCompanyPrisma } from "../db/init";
import { DOCUMENT_TYPES } from "../core/document-types";
import { assertDocumentEditable, onDocumentPosted, LIFECYCLE_STATUS } from "./document-lifecycle-service";
import { issueStockFIFO } from "./stock";
import { postSalesJournal, postPurchaseJournal, postRecoveryJournal } from "./accounting";
import { SOURCE_DOCUMENT_TYPES } from "../core/account-roles";
import { recordStockMovement } from "../domain/stock-movement-recorder";
import { STOCK_MOVEMENT_TYPES } from "../core/stock-movement-types";
import { increaseStock } from "./stock";
import { getInvoiceOutstanding } from "../domain/customer-outstanding";
import { roundMoney } from "../utils/money";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

export async function postDraftDocument(payload = {}) {
  const documentType = payload.documentType;
  const id = Number(payload.id);
  const editable = await assertDocumentEditable(documentType, id);
  if (!editable.success) return editable;

  const prisma = getCompanyPrisma();

  switch (documentType) {
    case DOCUMENT_TYPES.SALES_INVOICE:
      return postDraftSalesInvoice(id, payload.performedBy);
    case DOCUMENT_TYPES.PURCHASE_INVOICE:
      return postDraftPurchaseInvoice(id, payload.performedBy);
    case DOCUMENT_TYPES.RECOVERY:
      return postDraftRecovery(id, payload.performedBy);
    default:
      return failure(`Posting draft not supported for ${documentType}`);
  }
}

async function postDraftSalesInvoice(id, performedBy) {
  const prisma = getCompanyPrisma();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.findUnique({
        where: { id },
        include: { items: true },
      });
      if (invoice.lifecycleStatus !== LIFECYCLE_STATUS.DRAFT) {
        throw new Error("Only draft invoices can be posted");
      }

      let cogsTotal = 0;
      for (const item of invoice.items) {
        const stockQty = item.quantity + item.freeQuantity;
        const { totalCost, allocations } = await issueStockFIFO(tx, {
          productId: item.productId,
          warehouseId: invoice.warehouseId,
          quantity: stockQty,
        });
        cogsTotal += totalCost;
        await tx.salesItem.update({
          where: { id: item.id },
          data: { costAmount: totalCost, batchNo: allocations[0]?.batchNo || item.batchNo },
        });
        for (const allocation of allocations) {
          await recordStockMovement(tx, {
            date: invoice.date,
            productId: item.productId,
            warehouseId: invoice.warehouseId,
            batchNo: allocation.batchNo,
            movementType: STOCK_MOVEMENT_TYPES.SALES,
            documentType: SOURCE_DOCUMENT_TYPES.SALES_INVOICE,
            documentId: invoice.id,
            referenceNumber: invoice.number,
            quantityIn: 0,
            quantityOut: allocation.quantity,
            unitCost: allocation.costPerUnit,
          });
        }
      }

      await tx.salesInvoice.update({
        where: { id },
        data: { cogsTotal: roundMoney(cogsTotal) },
      });

      const refreshed = await tx.salesInvoice.findUnique({ where: { id }, include: { items: true } });
      await postSalesJournal(tx, refreshed);
      await onDocumentPosted(tx, {
        documentType: DOCUMENT_TYPES.SALES_INVOICE,
        documentId: id,
        documentNumber: refreshed.number,
        performedBy,
        postedAt: refreshed.date,
      });
      return refreshed;
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to post draft sales invoice");
  }
}

async function postDraftPurchaseInvoice(id, performedBy) {
  const prisma = getCompanyPrisma();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.findUnique({
        where: { id },
        include: { items: true },
      });
      if (invoice.lifecycleStatus !== LIFECYCLE_STATUS.DRAFT) {
        throw new Error("Only draft invoices can be posted");
      }

      for (const item of invoice.items) {
        const stockQty = item.quantity + (item.freeQuantity || 0);
        await increaseStock(tx, {
          productId: item.productId,
          warehouseId: invoice.warehouseId,
          batchNo: item.batchNo,
          expiryDate: item.expiryDate,
          quantity: stockQty,
          costPerUnit: item.price,
        });
        await recordStockMovement(tx, {
          date: invoice.date,
          productId: item.productId,
          warehouseId: invoice.warehouseId,
          batchNo: item.batchNo,
          movementType: STOCK_MOVEMENT_TYPES.PURCHASE,
          documentType: SOURCE_DOCUMENT_TYPES.PURCHASE_INVOICE,
          documentId: invoice.id,
          referenceNumber: invoice.number,
          quantityIn: stockQty,
          quantityOut: 0,
          unitCost: item.price,
        });
      }

      await postPurchaseJournal(tx, invoice);
      await onDocumentPosted(tx, {
        documentType: DOCUMENT_TYPES.PURCHASE_INVOICE,
        documentId: id,
        documentNumber: invoice.number,
        performedBy,
        postedAt: invoice.date,
      });
      return invoice;
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to post draft purchase invoice");
  }
}

async function postDraftRecovery(id, performedBy) {
  const prisma = getCompanyPrisma();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const recovery = await tx.recoveryVoucher.findUnique({
        where: { id },
        include: { items: true },
      });
      if (recovery.lifecycleStatus !== LIFECYCLE_STATUS.DRAFT) {
        throw new Error("Only draft recoveries can be posted");
      }

      for (const item of recovery.items) {
        const invoice = await tx.salesInvoice.findUnique({ where: { id: item.salesInvoiceId } });
        if (!invoice) throw new Error("Invoice not found");
        const outstanding = await getInvoiceOutstanding(tx, invoice);
        if (item.amount > outstanding) {
          throw new Error(`Amount exceeds outstanding for ${invoice.number}`);
        }
        await tx.salesInvoice.update({
          where: { id: invoice.id },
          data: { paidAmount: roundMoney(invoice.paidAmount + item.amount) },
        });
      }

      await postRecoveryJournal(tx, recovery);
      await onDocumentPosted(tx, {
        documentType: DOCUMENT_TYPES.RECOVERY,
        documentId: id,
        documentNumber: recovery.number,
        performedBy,
        postedAt: recovery.date,
      });
      return recovery;
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to post draft recovery");
  }
}

import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";
import { postJournal } from "./posting-engine";
import { findJournalEntryBySource } from "../repositories/journal-repository";
import { increaseStock, decreaseStock } from "./stock";
import { recordStockMovement } from "../domain/stock-movement-recorder";
import { STOCK_MOVEMENT_TYPES } from "../core/stock-movement-types";
import { SOURCE_DOCUMENT_TYPES } from "../core/account-roles";
import { DOCUMENT_TYPES } from "../core/document-types";
import {
  onDocumentReversed,
  LIFECYCLE_STATUS,
} from "./document-lifecycle-service";
import { isEnabled, FLAGS } from "../core/feature-flags";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

async function reverseJournalForDocument(tx, {
  sourceDocumentType,
  sourceDocumentId,
  reversalNumber,
  postingDate,
  description,
}) {
  const entry = await findJournalEntryBySource(tx, { sourceDocumentType, sourceDocumentId });
  if (!entry) return null;

  return postJournal(tx, {
    referenceNumber: reversalNumber,
    sourceDocumentType: `${sourceDocumentType}_REVERSAL`,
    sourceDocumentId,
    postingDate,
    description: description || `Reversal of ${entry.referenceNumber}`,
    lines: entry.lines.map((line) => ({
      accountId: line.accountId,
      debit: line.credit,
      credit: line.debit,
      description: line.description,
    })),
  });
}

async function reverseStockForDocument(tx, { documentType, documentId, referenceNumber, date }) {
  const movements = await tx.stockMovement.findMany({
    where: { documentType, documentId },
    orderBy: { id: "asc" },
  });

  for (const movement of movements) {
    if (movement.quantityOut > 0) {
      const product = await tx.product.findUnique({ where: { id: movement.productId } });
      await increaseStock(tx, {
        productId: movement.productId,
        warehouseId: movement.warehouseId,
        batchNo: movement.batchNo,
        quantity: movement.quantityOut,
        costPerUnit: movement.unitCost || product?.costPrice || 0,
      });
      await recordStockMovement(tx, {
        date,
        productId: movement.productId,
        warehouseId: movement.warehouseId,
        batchNo: movement.batchNo,
        movementType: STOCK_MOVEMENT_TYPES.REVERSAL,
        documentType,
        documentId,
        referenceNumber: `REV-${referenceNumber}`,
        quantityIn: movement.quantityOut,
        quantityOut: 0,
        unitCost: movement.unitCost,
        remarks: `Reversal of ${referenceNumber}`,
      });
    }

    if (movement.quantityIn > 0) {
      await decreaseStock(tx, {
        productId: movement.productId,
        warehouseId: movement.warehouseId,
        batchNo: movement.batchNo,
        quantity: movement.quantityIn,
      });
      await recordStockMovement(tx, {
        date,
        productId: movement.productId,
        warehouseId: movement.warehouseId,
        batchNo: movement.batchNo,
        movementType: STOCK_MOVEMENT_TYPES.REVERSAL,
        documentType,
        documentId,
        referenceNumber: `REV-${referenceNumber}`,
        quantityIn: 0,
        quantityOut: movement.quantityIn,
        unitCost: movement.unitCost,
        remarks: `Reversal of ${referenceNumber}`,
      });
    }
  }
}

export async function reverseSalesInvoice(payload = {}) {
  if (!isEnabled("ENABLE_DOCUMENT_REVERSAL")) {
    return failure("Document reversal is disabled");
  }

  const prisma = getCompanyPrisma();
  const id = Number(payload.id);
  const reason = payload.reason?.trim() || "Sales invoice reversed";

  const invoice = await prisma.salesInvoice.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!invoice) return failure("Sales invoice not found");
  if (invoice.lifecycleStatus === LIFECYCLE_STATUS.REVERSED) {
    return failure("Sales invoice is already reversed");
  }
  if (invoice.lifecycleStatus !== LIFECYCLE_STATUS.POSTED) {
    return failure("Only posted sales invoices can be reversed");
  }
  if (invoice.paidAmount > 0) {
    return failure("Reverse recoveries before reversing a partially paid invoice");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reversalNumber = `REV-${invoice.number}`;
      await reverseJournalForDocument(tx, {
        sourceDocumentType: SOURCE_DOCUMENT_TYPES.SALES_INVOICE,
        sourceDocumentId: invoice.id,
        reversalNumber,
        postingDate: payload.date || new Date(),
        description: reason,
      });

      await reverseStockForDocument(tx, {
        documentType: SOURCE_DOCUMENT_TYPES.SALES_INVOICE,
        documentId: invoice.id,
        referenceNumber: invoice.number,
        date: payload.date || invoice.date,
      });

      await onDocumentReversed(tx, {
        documentType: DOCUMENT_TYPES.SALES_INVOICE,
        documentId: invoice.id,
        documentNumber: invoice.number,
        reason,
        performedBy: payload.performedBy || null,
      });

      return tx.salesInvoice.findUnique({ where: { id: invoice.id } });
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to reverse sales invoice");
  }
}

export async function reversePurchaseInvoice(payload = {}) {
  if (!isEnabled("ENABLE_DOCUMENT_REVERSAL")) {
    return failure("Document reversal is disabled");
  }

  const prisma = getCompanyPrisma();
  const id = Number(payload.id);
  const reason = payload.reason?.trim() || "Purchase invoice reversed";

  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!invoice) return failure("Purchase invoice not found");
  if (invoice.lifecycleStatus === LIFECYCLE_STATUS.REVERSED) {
    return failure("Purchase invoice is already reversed");
  }
  if (invoice.lifecycleStatus !== LIFECYCLE_STATUS.POSTED) {
    return failure("Only posted purchase invoices can be reversed");
  }
  if (invoice.paidAmount > 0) {
    return failure("Reverse vendor payments before reversing this invoice");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reversalNumber = `REV-${invoice.number}`;
      await reverseJournalForDocument(tx, {
        sourceDocumentType: SOURCE_DOCUMENT_TYPES.PURCHASE_INVOICE,
        sourceDocumentId: invoice.id,
        reversalNumber,
        postingDate: payload.date || new Date(),
        description: reason,
      });

      await reverseStockForDocument(tx, {
        documentType: SOURCE_DOCUMENT_TYPES.PURCHASE_INVOICE,
        documentId: invoice.id,
        referenceNumber: invoice.number,
        date: payload.date || invoice.date,
      });

      await onDocumentReversed(tx, {
        documentType: DOCUMENT_TYPES.PURCHASE_INVOICE,
        documentId: invoice.id,
        documentNumber: invoice.number,
        reason,
        performedBy: payload.performedBy || null,
      });

      return tx.purchaseInvoice.findUnique({ where: { id: invoice.id } });
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to reverse purchase invoice");
  }
}

export async function reverseRecoveryVoucher(payload = {}) {
  if (!isEnabled("ENABLE_DOCUMENT_REVERSAL")) {
    return failure("Document reversal is disabled");
  }

  const prisma = getCompanyPrisma();
  const id = Number(payload.id);
  const reason = payload.reason?.trim() || "Recovery reversed";

  const recovery = await prisma.recoveryVoucher.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!recovery) return failure("Recovery voucher not found");
  if (recovery.lifecycleStatus === LIFECYCLE_STATUS.REVERSED) {
    return failure("Recovery is already reversed");
  }
  if (recovery.lifecycleStatus !== LIFECYCLE_STATUS.POSTED) {
    return failure("Only posted recoveries can be reversed");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      for (const item of recovery.items) {
        const invoice = await tx.salesInvoice.findUnique({ where: { id: item.salesInvoiceId } });
        if (invoice) {
          await tx.salesInvoice.update({
            where: { id: invoice.id },
            data: { paidAmount: roundMoney(Math.max(0, invoice.paidAmount - item.amount)) },
          });
        }
      }

      await reverseJournalForDocument(tx, {
        sourceDocumentType: SOURCE_DOCUMENT_TYPES.RECOVERY,
        sourceDocumentId: recovery.id,
        reversalNumber: `REV-${recovery.number}`,
        postingDate: payload.date || new Date(),
        description: reason,
      });

      await onDocumentReversed(tx, {
        documentType: DOCUMENT_TYPES.RECOVERY,
        documentId: recovery.id,
        documentNumber: recovery.number,
        reason,
        performedBy: payload.performedBy || null,
      });

      return tx.recoveryVoucher.findUnique({ where: { id: recovery.id } });
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to reverse recovery");
  }
}

export async function reverseDocument(payload = {}) {
  switch (payload.documentType) {
    case DOCUMENT_TYPES.SALES_INVOICE:
      return reverseSalesInvoice(payload);
    case DOCUMENT_TYPES.PURCHASE_INVOICE:
      return reversePurchaseInvoice(payload);
    case DOCUMENT_TYPES.RECOVERY:
      return reverseRecoveryVoucher(payload);
    default:
      return failure(`Reversal not yet implemented for ${payload.documentType}`);
  }
}

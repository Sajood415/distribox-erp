import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";
import { postJournal } from "./posting-engine";
import { findJournalEntryBySource } from "../repositories/journal-repository";
import { increaseStock, decreaseStock } from "./stock";
import { recordStockMovement } from "../domain/stock-movement-recorder";
import { STOCK_MOVEMENT_TYPES } from "../core/stock-movement-types";
import { SOURCE_DOCUMENT_TYPES } from "../core/account-roles";
import { DOCUMENT_TYPES, resolveClaimDocumentType } from "../core/document-types";
import {
  onDocumentReversed,
  onDocumentCancelled,
  LIFECYCLE_STATUS,
  assertReversible,
} from "./document-lifecycle-service";
import { isEnabled } from "../core/feature-flags";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

function ensureReversalEnabled() {
  if (!isEnabled("ENABLE_DOCUMENT_REVERSAL")) {
    return failure("Document reversal is disabled");
  }
  return null;
}

async function ensureNotAlreadyReversed(tx, sourceDocumentType, sourceDocumentId) {
  const existing = await findJournalEntryBySource(tx, {
    sourceDocumentType: `${sourceDocumentType}_REVERSAL`,
    sourceDocumentId,
  });
  if (existing) throw new Error("Document has already been reversed");
}

async function reverseJournalForDocument(tx, {
  sourceDocumentType,
  sourceDocumentId,
  reversalNumber,
  postingDate,
  description,
}) {
  await ensureNotAlreadyReversed(tx, sourceDocumentType, sourceDocumentId);
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

function guardPosted(doc, label) {
  if (!doc) return failure(`${label} not found`);
  if (doc.lifecycleStatus === LIFECYCLE_STATUS.REVERSED) return failure(`${label} is already reversed`);
  if (!assertReversible(doc.lifecycleStatus)) return failure(`Only posted ${label.toLowerCase()}s can be reversed`);
  return null;
}

export async function reverseSalesInvoice(payload = {}) {
  const disabled = ensureReversalEnabled();
  if (disabled) return disabled;

  const prisma = getCompanyPrisma();
  const invoice = await prisma.salesInvoice.findUnique({ where: { id: Number(payload.id) }, include: { items: true } });
  const guard = guardPosted(invoice, "Sales invoice");
  if (guard) return guard;
  if (invoice.paidAmount > 0) return failure("Reverse recoveries before reversing a partially paid invoice");

  const reason = payload.reason?.trim() || "Sales invoice reversed";
  try {
    const result = await prisma.$transaction(async (tx) => {
      await reverseJournalForDocument(tx, {
        sourceDocumentType: SOURCE_DOCUMENT_TYPES.SALES_INVOICE,
        sourceDocumentId: invoice.id,
        reversalNumber: `REV-${invoice.number}`,
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
        performedBy: payload.performedBy,
      });
      return tx.salesInvoice.findUnique({ where: { id: invoice.id } });
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to reverse sales invoice");
  }
}

export async function reversePurchaseInvoice(payload = {}) {
  const disabled = ensureReversalEnabled();
  if (disabled) return disabled;

  const prisma = getCompanyPrisma();
  const invoice = await prisma.purchaseInvoice.findUnique({ where: { id: Number(payload.id) } });
  const guard = guardPosted(invoice, "Purchase invoice");
  if (guard) return guard;
  if (invoice.paidAmount > 0) return failure("Reverse vendor payments before reversing this invoice");

  const reason = payload.reason?.trim() || "Purchase invoice reversed";
  try {
    const result = await prisma.$transaction(async (tx) => {
      await reverseJournalForDocument(tx, {
        sourceDocumentType: SOURCE_DOCUMENT_TYPES.PURCHASE_INVOICE,
        sourceDocumentId: invoice.id,
        reversalNumber: `REV-${invoice.number}`,
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
        performedBy: payload.performedBy,
      });
      return tx.purchaseInvoice.findUnique({ where: { id: invoice.id } });
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to reverse purchase invoice");
  }
}

export async function reversePurchaseReturn(payload = {}) {
  const disabled = ensureReversalEnabled();
  if (disabled) return disabled;

  const prisma = getCompanyPrisma();
  const doc = await prisma.purchaseReturn.findUnique({ where: { id: Number(payload.id) } });
  const guard = guardPosted(doc, "Purchase return");
  if (guard) return guard;

  const reason = payload.reason?.trim() || "Purchase return reversed";
  try {
    const result = await prisma.$transaction(async (tx) => {
      await reverseJournalForDocument(tx, {
        sourceDocumentType: SOURCE_DOCUMENT_TYPES.PURCHASE_RETURN,
        sourceDocumentId: doc.id,
        reversalNumber: `REV-${doc.number}`,
        postingDate: payload.date || new Date(),
        description: reason,
      });
      await reverseStockForDocument(tx, {
        documentType: SOURCE_DOCUMENT_TYPES.PURCHASE_RETURN,
        documentId: doc.id,
        referenceNumber: doc.number,
        date: payload.date || doc.date,
      });
      await onDocumentReversed(tx, {
        documentType: DOCUMENT_TYPES.PURCHASE_RETURN,
        documentId: doc.id,
        documentNumber: doc.number,
        reason,
        performedBy: payload.performedBy,
      });
      return tx.purchaseReturn.findUnique({ where: { id: doc.id } });
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to reverse purchase return");
  }
}

export async function reverseSalesReturn(payload = {}) {
  const disabled = ensureReversalEnabled();
  if (disabled) return disabled;

  const prisma = getCompanyPrisma();
  const doc = await prisma.salesReturn.findUnique({ where: { id: Number(payload.id) } });
  const guard = guardPosted(doc, "Sales return");
  if (guard) return guard;

  const reason = payload.reason?.trim() || "Sales return reversed";
  try {
    const result = await prisma.$transaction(async (tx) => {
      await reverseJournalForDocument(tx, {
        sourceDocumentType: SOURCE_DOCUMENT_TYPES.SALES_RETURN,
        sourceDocumentId: doc.id,
        reversalNumber: `REV-${doc.number}`,
        postingDate: payload.date || new Date(),
        description: reason,
      });
      await reverseStockForDocument(tx, {
        documentType: SOURCE_DOCUMENT_TYPES.SALES_RETURN,
        documentId: doc.id,
        referenceNumber: doc.number,
        date: payload.date || doc.date,
      });
      await onDocumentReversed(tx, {
        documentType: DOCUMENT_TYPES.SALES_RETURN,
        documentId: doc.id,
        documentNumber: doc.number,
        reason,
        performedBy: payload.performedBy,
      });
      return tx.salesReturn.findUnique({ where: { id: doc.id } });
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to reverse sales return");
  }
}

export async function reverseRecoveryVoucher(payload = {}) {
  const disabled = ensureReversalEnabled();
  if (disabled) return disabled;

  const prisma = getCompanyPrisma();
  const recovery = await prisma.recoveryVoucher.findUnique({
    where: { id: Number(payload.id) },
    include: { items: true },
  });
  const guard = guardPosted(recovery, "Recovery voucher");
  if (guard) return guard;

  const reason = payload.reason?.trim() || "Recovery reversed";
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
        performedBy: payload.performedBy,
      });
      return tx.recoveryVoucher.findUnique({ where: { id: recovery.id } });
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to reverse recovery");
  }
}

export async function reverseExpenseVoucher(payload = {}) {
  const disabled = ensureReversalEnabled();
  if (disabled) return disabled;

  const prisma = getCompanyPrisma();
  const doc = await prisma.expenseVoucher.findUnique({ where: { id: Number(payload.id) } });
  const guard = guardPosted(doc, "Expense voucher");
  if (guard) return guard;

  const reason = payload.reason?.trim() || "Expense reversed";
  try {
    const result = await prisma.$transaction(async (tx) => {
      await reverseJournalForDocument(tx, {
        sourceDocumentType: SOURCE_DOCUMENT_TYPES.VOUCHER,
        sourceDocumentId: doc.id,
        reversalNumber: `REV-${doc.number}`,
        postingDate: payload.date || new Date(),
        description: reason,
      });
      await onDocumentReversed(tx, {
        documentType: DOCUMENT_TYPES.EXPENSE,
        documentId: doc.id,
        documentNumber: doc.number,
        reason,
        performedBy: payload.performedBy,
      });
      return tx.expenseVoucher.findUnique({ where: { id: doc.id } });
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to reverse expense");
  }
}

export async function reverseStockAdjustment(payload = {}) {
  const disabled = ensureReversalEnabled();
  if (disabled) return disabled;

  const prisma = getCompanyPrisma();
  const doc = await prisma.stockAdjustment.findUnique({ where: { id: Number(payload.id) } });
  const guard = guardPosted(doc, "Stock adjustment");
  if (guard) return guard;

  const reason = payload.reason?.trim() || "Stock adjustment reversed";
  try {
    const result = await prisma.$transaction(async (tx) => {
      await reverseJournalForDocument(tx, {
        sourceDocumentType: SOURCE_DOCUMENT_TYPES.STOCK_ADJUSTMENT,
        sourceDocumentId: doc.id,
        reversalNumber: `REV-${doc.number}`,
        postingDate: payload.date || new Date(),
        description: reason,
      });
      await reverseStockForDocument(tx, {
        documentType: SOURCE_DOCUMENT_TYPES.STOCK_ADJUSTMENT,
        documentId: doc.id,
        referenceNumber: doc.number,
        date: payload.date || doc.date,
      });
      await onDocumentReversed(tx, {
        documentType: DOCUMENT_TYPES.STOCK_ADJUSTMENT,
        documentId: doc.id,
        documentNumber: doc.number,
        reason,
        performedBy: payload.performedBy,
      });
      return tx.stockAdjustment.findUnique({ where: { id: doc.id } });
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to reverse stock adjustment");
  }
}

export async function reversePurchaseOrder(payload = {}) {
  const disabled = ensureReversalEnabled();
  if (disabled) return disabled;

  const prisma = getCompanyPrisma();
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: Number(payload.id) },
    include: { invoices: true },
  });
  if (!order) return failure("Purchase order not found");
  if (order.lifecycleStatus === LIFECYCLE_STATUS.REVERSED) return failure("Purchase order is already reversed");
  if (order.lifecycleStatus !== LIFECYCLE_STATUS.POSTED) {
    return failure("Only posted purchase orders can be reversed");
  }
  if (order.invoices.length > 0) return failure("Reverse linked purchase invoices first");

  const reason = payload.reason?.trim() || "Purchase order reversed";
  try {
    const result = await prisma.$transaction(async (tx) => {
      await onDocumentReversed(tx, {
        documentType: DOCUMENT_TYPES.PURCHASE_ORDER,
        documentId: order.id,
        documentNumber: order.number,
        reason,
        performedBy: payload.performedBy,
      });
      return tx.purchaseOrder.findUnique({ where: { id: order.id } });
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to reverse purchase order");
  }
}

export async function reverseClaim(payload = {}) {
  const disabled = ensureReversalEnabled();
  if (disabled) return disabled;

  const prisma = getCompanyPrisma();
  const claim = await prisma.claim.findUnique({
    where: { id: Number(payload.id) },
    include: { salesReturn: true, purchaseReturn: true },
  });
  if (!claim) return failure("Claim not found");
  if (claim.lifecycleStatus === LIFECYCLE_STATUS.REVERSED) return failure("Claim is already reversed");
  if (claim.lifecycleStatus !== LIFECYCLE_STATUS.POSTED) {
    return failure("Only settled (posted) claims can be reversed");
  }

  const reason = payload.reason?.trim() || "Claim reversed";
  const claimType = resolveClaimDocumentType(claim.partyType);

  try {
    if (claim.salesReturn) {
      const rev = await reverseSalesReturn({ id: claim.salesReturn.id, reason, performedBy: payload.performedBy });
      if (!rev.success) return rev;
    } else if (claim.purchaseReturn) {
      const rev = await reversePurchaseReturn({ id: claim.purchaseReturn.id, reason, performedBy: payload.performedBy });
      if (!rev.success) return rev;
    } else {
      await prisma.$transaction(async (tx) => {
        await reverseJournalForDocument(tx, {
          sourceDocumentType: SOURCE_DOCUMENT_TYPES.CLAIM,
          sourceDocumentId: claim.id,
          reversalNumber: `REV-${claim.number}`,
          postingDate: payload.date || new Date(),
          description: reason,
        });
        await reverseStockForDocument(tx, {
          documentType: SOURCE_DOCUMENT_TYPES.CLAIM,
          documentId: claim.id,
          referenceNumber: claim.number,
          date: payload.date || claim.date,
        });
        await onDocumentReversed(tx, {
          documentType: claimType,
          documentId: claim.id,
          documentNumber: claim.number,
          reason,
          performedBy: payload.performedBy,
        });
      });
      return success(await prisma.claim.findUnique({ where: { id: claim.id } }));
    }

    await prisma.$transaction(async (tx) => {
      await onDocumentReversed(tx, {
        documentType: claimType,
        documentId: claim.id,
        documentNumber: claim.number,
        reason,
        performedBy: payload.performedBy,
      });
    });
    return success(await prisma.claim.findUnique({ where: { id: claim.id } }));
  } catch (error) {
    return failure(error.message || "Failed to reverse claim");
  }
}

export async function cancelQuotation(payload = {}) {
  const prisma = getCompanyPrisma();
  const doc = await prisma.quotation.findUnique({ where: { id: Number(payload.id) } });
  if (!doc) return failure("Quotation not found");
  if (doc.lifecycleStatus !== LIFECYCLE_STATUS.DRAFT) return failure("Only draft quotations can be cancelled");
  if (doc.status === "Converted") return failure("Converted quotations cannot be cancelled");

  await prisma.$transaction(async (tx) => {
    await tx.quotation.update({ where: { id: doc.id }, data: { status: "Cancelled" } });
    await onDocumentCancelled(tx, {
      documentType: DOCUMENT_TYPES.QUOTATION,
      documentId: doc.id,
      documentNumber: doc.number,
      reason: payload.reason,
      performedBy: payload.performedBy,
    });
  });
  return success(await prisma.quotation.findUnique({ where: { id: doc.id } }));
}

export async function reverseLoadSlip(payload = {}) {
  const prisma = getCompanyPrisma();
  const doc = await prisma.loadSlip.findUnique({ where: { id: Number(payload.id) } });
  if (!doc) return failure("Load slip not found");
  if (doc.lifecycleStatus === LIFECYCLE_STATUS.REVERSED) return failure("Load slip is already reversed");
  if (doc.lifecycleStatus !== LIFECYCLE_STATUS.POSTED) {
    return failure("Only posted load slips can be reversed");
  }

  const reason = payload.reason?.trim() || "Load slip reversed";
  await prisma.$transaction(async (tx) => {
    await onDocumentReversed(tx, {
      documentType: DOCUMENT_TYPES.LOAD_SLIP,
      documentId: doc.id,
      documentNumber: doc.number,
      reason,
      performedBy: payload.performedBy,
    });
  });
  return success(await prisma.loadSlip.findUnique({ where: { id: doc.id } }));
}

export async function reverseDocument(payload = {}) {
  switch (payload.documentType) {
    case DOCUMENT_TYPES.SALES_INVOICE:
      return reverseSalesInvoice(payload);
    case DOCUMENT_TYPES.PURCHASE_INVOICE:
      return reversePurchaseInvoice(payload);
    case DOCUMENT_TYPES.PURCHASE_RETURN:
      return reversePurchaseReturn(payload);
    case DOCUMENT_TYPES.SALES_RETURN:
      return reverseSalesReturn(payload);
    case DOCUMENT_TYPES.RECOVERY:
      return reverseRecoveryVoucher(payload);
    case DOCUMENT_TYPES.EXPENSE:
      return reverseExpenseVoucher(payload);
    case DOCUMENT_TYPES.STOCK_ADJUSTMENT:
      return reverseStockAdjustment(payload);
    case DOCUMENT_TYPES.PURCHASE_ORDER:
      return reversePurchaseOrder(payload);
    case DOCUMENT_TYPES.CUSTOMER_CLAIM:
    case DOCUMENT_TYPES.SUPPLIER_CLAIM:
    case DOCUMENT_TYPES.CLAIM:
      return reverseClaim(payload);
    case DOCUMENT_TYPES.QUOTATION:
      return cancelQuotation(payload);
    case DOCUMENT_TYPES.LOAD_SLIP:
      return reverseLoadSlip(payload);
    default:
      return failure(`Unknown document type: ${payload.documentType}`);
  }
}

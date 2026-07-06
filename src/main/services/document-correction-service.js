import { getCompanyPrisma } from "../db/init";
import { DOCUMENT_TYPES, resolveClaimDocumentType } from "../core/document-types";
import { onDocumentCreated, onDocumentCorrected, LIFECYCLE_STATUS } from "./document-lifecycle-service";
import { reverseDocument } from "./document-reversal-service";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

async function copySalesInvoiceDraft(tx, original, parentType, parentId) {
  const year = new Date().getFullYear();
  const prefix = `SI-${year}-`;
  const latest = await tx.salesInvoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
  });
  const next = latest ? Number(latest.number.split("-").pop()) + 1 : 1;
  const number = `${prefix}${String(next).padStart(5, "0")}`;

  const draft = await tx.salesInvoice.create({
    data: {
      number,
      date: original.date,
      customerId: original.customerId,
      warehouseId: original.warehouseId,
      salesmanId: original.salesmanId,
      deliveryManId: original.deliveryManId,
      isCredit: original.isCredit,
      dueDate: original.dueDate,
      freight: original.freight,
      taxTotal: original.taxTotal,
      subtotal: original.subtotal,
      total: original.total,
      paidAmount: 0,
      cogsTotal: 0,
      lifecycleStatus: LIFECYCLE_STATUS.DRAFT,
      parentDocumentType: parentType,
      parentDocumentId: parentId,
      remarks: original.remarks ? `Correction of ${original.number}: ${original.remarks}` : `Correction of ${original.number}`,
      items: {
        create: original.items.map((item) => ({
          productId: item.productId,
          unitId: item.unitId,
          batchNo: item.batchNo,
          quantity: item.quantity,
          freeQuantity: item.freeQuantity,
          price: item.price,
          discount: item.discount,
          vatPercent: item.vatPercent,
          lineTotal: item.lineTotal,
          costAmount: 0,
        })),
      },
    },
    include: { items: true },
  });
  return draft;
}

async function copyPurchaseInvoiceDraft(tx, original, parentType, parentId) {
  const year = new Date().getFullYear();
  const prefix = `PI-${year}-`;
  const latest = await tx.purchaseInvoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
  });
  const next = latest ? Number(latest.number.split("-").pop()) + 1 : 1;
  const number = `${prefix}${String(next).padStart(5, "0")}`;

  return tx.purchaseInvoice.create({
    data: {
      number,
      date: original.date,
      vendorId: original.vendorId,
      warehouseId: original.warehouseId,
      isCredit: original.isCredit,
      freight: original.freight,
      taxTotal: original.taxTotal,
      subtotal: original.subtotal,
      total: original.total,
      paidAmount: 0,
      lifecycleStatus: LIFECYCLE_STATUS.DRAFT,
      parentDocumentType: parentType,
      parentDocumentId: parentId,
      remarks: `Correction of ${original.number}`,
      items: {
        create: original.items.map((item) => ({
          productId: item.productId,
          unitId: item.unitId,
          batchNo: item.batchNo,
          expiryDate: item.expiryDate,
          quantity: item.quantity,
          freeQuantity: item.freeQuantity,
          price: item.price,
          discount: item.discount,
          vatPercent: item.vatPercent,
          lineTotal: item.lineTotal,
        })),
      },
    },
    include: { items: true },
  });
}

async function copyRecoveryDraft(tx, original, parentType, parentId) {
  const year = new Date().getFullYear();
  const prefix = `RV-${year}-`;
  const latest = await tx.recoveryVoucher.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
  });
  const next = latest ? Number(latest.number.split("-").pop()) + 1 : 1;
  const number = `${prefix}${String(next).padStart(5, "0")}`;

  return tx.recoveryVoucher.create({
    data: {
      number,
      date: original.date,
      customerId: original.customerId,
      salesmanId: original.salesmanId,
      deliveryManId: original.deliveryManId,
      paymentMode: original.paymentMode,
      amount: original.amount,
      lifecycleStatus: LIFECYCLE_STATUS.DRAFT,
      parentDocumentType: parentType,
      parentDocumentId: parentId,
      remarks: `Correction of ${original.number}`,
      items: {
        create: original.items.map((item) => ({
          salesInvoiceId: item.salesInvoiceId,
          amount: item.amount,
        })),
      },
    },
    include: { items: true },
  });
}

const COPY_HANDLERS = {
  [DOCUMENT_TYPES.SALES_INVOICE]: {
    load: (prisma, id) =>
      prisma.salesInvoice.findUnique({ where: { id }, include: { items: true } }),
    copy: copySalesInvoiceDraft,
  },
  [DOCUMENT_TYPES.PURCHASE_INVOICE]: {
    load: (prisma, id) =>
      prisma.purchaseInvoice.findUnique({ where: { id }, include: { items: true } }),
    copy: copyPurchaseInvoiceDraft,
  },
  [DOCUMENT_TYPES.RECOVERY]: {
    load: (prisma, id) =>
      prisma.recoveryVoucher.findUnique({ where: { id }, include: { items: true } }),
    copy: copyRecoveryDraft,
  },
};

export async function correctDocument(payload = {}) {
  const documentType = payload.documentType;
  const id = Number(payload.id);
  const reason = payload.reason?.trim() || "Document correction";

  if (!documentType || !id) return failure("Document type and id are required");
  if (!COPY_HANDLERS[documentType]) {
    return failure(`Correction not supported for ${documentType}`);
  }

  const reverseResult = await reverseDocument({ documentType, id, reason, performedBy: payload.performedBy });
  if (!reverseResult.success) return reverseResult;

  const prisma = getCompanyPrisma();
  const handler = COPY_HANDLERS[documentType];

  try {
    const result = await prisma.$transaction(async (tx) => {
      const original = await handler.load(tx, id);
      const draft = await handler.copy(tx, original, documentType, id);

      await onDocumentCreated(tx, {
        documentType,
        documentId: draft.id,
        documentNumber: draft.number,
        lifecycleStatus: LIFECYCLE_STATUS.DRAFT,
        performedBy: payload.performedBy,
        parentDocumentType: documentType,
        parentDocumentId: id,
      });

      await onDocumentCorrected(tx, {
        documentType,
        documentId: id,
        documentNumber: original.number,
        childDocumentType: documentType,
        childDocumentId: draft.id,
        childDocumentNumber: draft.number,
        reason,
        performedBy: payload.performedBy,
      });

      return { original: reverseResult.data, draft };
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to create correction draft");
  }
}

export async function correctClaimDocument(payload = {}) {
  const id = Number(payload.id);
  const prisma = getCompanyPrisma();
  const claim = await prisma.claim.findUnique({ where: { id } });
  if (!claim) return failure("Claim not found");

  const documentType = resolveClaimDocumentType(claim.partyType);
  return correctDocument({ ...payload, documentType, id });
}

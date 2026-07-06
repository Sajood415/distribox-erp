import { getCompanyPrisma } from "../db/init";
import {
  DOCUMENT_TYPES,
  LIFECYCLE_STATUS,
  LIFECYCLE_ACTIONS,
  DOCUMENT_TABLES,
} from "../core/document-types";
import { logOperation } from "./operation-log";
import { EVENT_TYPES } from "./event-service";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

export { DOCUMENT_TYPES, LIFECYCLE_STATUS, LIFECYCLE_ACTIONS };

export function canEditDocument(lifecycleStatus) {
  return lifecycleStatus === LIFECYCLE_STATUS.DRAFT;
}

export function canDeleteDocument(lifecycleStatus) {
  return lifecycleStatus === LIFECYCLE_STATUS.DRAFT;
}

export function isImmutable(lifecycleStatus) {
  return [
    LIFECYCLE_STATUS.POSTED,
    LIFECYCLE_STATUS.CANCELLED,
    LIFECYCLE_STATUS.VOIDED,
    LIFECYCLE_STATUS.REVERSED,
    LIFECYCLE_STATUS.ARCHIVED,
  ].includes(lifecycleStatus);
}

export async function recordLifecycleEvent(
  tx,
  {
    documentType,
    documentId,
    documentNumber = null,
    status,
    action,
    reason = null,
    performedBy = null,
    parentDocumentType = null,
    parentDocumentId = null,
    childDocumentType = null,
    childDocumentId = null,
  }
) {
  await tx.documentLifecycleEvent.create({
    data: {
      documentType,
      documentId,
      documentNumber,
      status,
      action,
      reason,
      performedBy,
      parentDocumentType,
      parentDocumentId,
      childDocumentType,
      childDocumentId,
    },
  });
}

export async function onDocumentCreated(tx, {
  documentType,
  documentId,
  documentNumber,
  lifecycleStatus = LIFECYCLE_STATUS.DRAFT,
  performedBy = null,
  parentDocumentType = null,
  parentDocumentId = null,
}) {
  const table = DOCUMENT_TABLES[documentType];
  if (table) {
    await tx[table].update({
      where: { id: documentId },
      data: { lifecycleStatus },
    });
  }

  await recordLifecycleEvent(tx, {
    documentType,
    documentId,
    documentNumber,
    status: lifecycleStatus,
    action: LIFECYCLE_ACTIONS.CREATED,
    performedBy,
    parentDocumentType,
    parentDocumentId,
  });

  await logOperation(tx, {
    table: documentType,
    recordId: documentId,
    action: "CREATE",
    eventType: EVENT_TYPES.CREATED,
    entityType: documentType,
    referenceNumber: documentNumber,
    message: `${documentType} ${documentNumber || documentId} created`,
  });
}

export async function onDocumentPosted(tx, {
  documentType,
  documentId,
  documentNumber,
  performedBy = null,
  postedAt = new Date(),
}) {
  const table = DOCUMENT_TABLES[documentType];
  if (table) {
    await tx[table].update({
      where: { id: documentId },
      data: {
        lifecycleStatus: LIFECYCLE_STATUS.POSTED,
        postedAt,
        postedBy: performedBy,
      },
    });
  }

  await recordLifecycleEvent(tx, {
    documentType,
    documentId,
    documentNumber,
    status: LIFECYCLE_STATUS.POSTED,
    action: LIFECYCLE_ACTIONS.POSTED,
    performedBy,
  });

  await logOperation(tx, {
    table: documentType,
    recordId: documentId,
    action: "POST",
    eventType: EVENT_TYPES.POSTED,
    entityType: documentType,
    referenceNumber: documentNumber,
    message: `${documentType} ${documentNumber} posted`,
  });
}

export async function onDocumentCancelled(tx, {
  documentType,
  documentId,
  documentNumber,
  reason = null,
  performedBy = null,
}) {
  const table = DOCUMENT_TABLES[documentType];
  if (table) {
    await tx[table].update({
      where: { id: documentId },
      data: {
        lifecycleStatus: LIFECYCLE_STATUS.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: performedBy,
        lifecycleReason: reason,
      },
    });
  }

  await recordLifecycleEvent(tx, {
    documentType,
    documentId,
    documentNumber,
    status: LIFECYCLE_STATUS.CANCELLED,
    action: LIFECYCLE_ACTIONS.CANCELLED,
    reason,
    performedBy,
  });
}

export async function onDocumentReversed(tx, {
  documentType,
  documentId,
  documentNumber,
  reason = null,
  performedBy = null,
  childDocumentType = null,
  childDocumentId = null,
}) {
  const table = DOCUMENT_TABLES[documentType];
  if (table) {
    await tx[table].update({
      where: { id: documentId },
      data: {
        lifecycleStatus: LIFECYCLE_STATUS.REVERSED,
        reversedAt: new Date(),
        reversedBy: performedBy,
        lifecycleReason: reason,
        childDocumentType,
        childDocumentId,
      },
    });
  }

  await recordLifecycleEvent(tx, {
    documentType,
    documentId,
    documentNumber,
    status: LIFECYCLE_STATUS.REVERSED,
    action: LIFECYCLE_ACTIONS.REVERSED,
    reason,
    performedBy,
    childDocumentType,
    childDocumentId,
  });

  await logOperation(tx, {
    table: documentType,
    recordId: documentId,
    action: "REVERSE",
    eventType: EVENT_TYPES.REVERSED,
    entityType: documentType,
    referenceNumber: documentNumber,
    message: `${documentType} ${documentNumber} reversed`,
  });
}

export async function getDocumentTimeline(payload = {}) {
  const prisma = getCompanyPrisma();
  const documentType = payload.documentType;
  const documentId = Number(payload.documentId);
  if (!documentType || !documentId) return failure("Document type and id are required");

  const events = await prisma.documentLifecycleEvent.findMany({
    where: { documentType, documentId },
    orderBy: { performedAt: "asc" },
  });
  return success(events);
}

export async function assertDocumentEditable(documentType, documentId) {
  const prisma = getCompanyPrisma();
  const table = DOCUMENT_TABLES[documentType];
  if (!table) return failure("Unknown document type");
  const doc = await prisma[table].findUnique({ where: { id: Number(documentId) } });
  if (!doc) return failure("Document not found");
  if (!canEditDocument(doc.lifecycleStatus)) {
    return failure("Posted documents cannot be edited");
  }
  return success(doc);
}

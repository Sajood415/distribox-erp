import { getCompanyPrisma } from "../db/init";
import {
  DOCUMENT_TYPES,
  LIFECYCLE_STATUS,
  LIFECYCLE_ACTIONS,
  DOCUMENT_TABLES,
  DOCUMENT_ROUTES,
  normalizeDocumentType,
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
    LIFECYCLE_STATUS.REVERSED,
    LIFECYCLE_STATUS.ARCHIVED,
  ].includes(lifecycleStatus);
}

export function assertReversible(lifecycleStatus) {
  return lifecycleStatus === LIFECYCLE_STATUS.POSTED;
}

function tableFor(documentType) {
  return DOCUMENT_TABLES[normalizeDocumentType(documentType)] || DOCUMENT_TABLES[documentType];
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
      documentType: normalizeDocumentType(documentType),
      documentId,
      documentNumber,
      status,
      action,
      reason,
      performedBy,
      parentDocumentType: parentDocumentType ? normalizeDocumentType(parentDocumentType) : null,
      parentDocumentId,
      childDocumentType: childDocumentType ? normalizeDocumentType(childDocumentType) : null,
      childDocumentId,
    },
  });
}

async function writeAudit(tx, { documentType, documentId, documentNumber, action, eventType, message }) {
  await logOperation(tx, {
    table: normalizeDocumentType(documentType),
    recordId: documentId,
    action,
    eventType,
    entityType: normalizeDocumentType(documentType),
    referenceNumber: documentNumber,
    message,
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
  const table = tableFor(documentType);
  if (table) {
    await tx[table].update({
      where: { id: documentId },
      data: {
        lifecycleStatus,
        parentDocumentType: parentDocumentType ? normalizeDocumentType(parentDocumentType) : null,
        parentDocumentId,
      },
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

  await writeAudit(tx, {
    documentType,
    documentId,
    documentNumber,
    action: "CREATE",
    eventType: EVENT_TYPES.CREATED,
    message: `${documentType} ${documentNumber || documentId} created`,
  });
}

export async function onDocumentEdited(tx, {
  documentType,
  documentId,
  documentNumber,
  performedBy = null,
  reason = null,
}) {
  await recordLifecycleEvent(tx, {
    documentType,
    documentId,
    documentNumber,
    status: LIFECYCLE_STATUS.DRAFT,
    action: LIFECYCLE_ACTIONS.EDITED,
    performedBy,
    reason,
  });

  await writeAudit(tx, {
    documentType,
    documentId,
    documentNumber,
    action: "UPDATE",
    eventType: EVENT_TYPES.CREATED,
    message: `${documentType} ${documentNumber} edited`,
  });
}

export async function onDocumentPosted(tx, {
  documentType,
  documentId,
  documentNumber,
  performedBy = null,
  postedAt = new Date(),
}) {
  const table = tableFor(documentType);
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

  await writeAudit(tx, {
    documentType,
    documentId,
    documentNumber,
    action: "POST",
    eventType: EVENT_TYPES.POSTED,
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
  const table = tableFor(documentType);
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

  await writeAudit(tx, {
    documentType,
    documentId,
    documentNumber,
    action: "CANCEL",
    eventType: EVENT_TYPES.VOIDED,
    message: `${documentType} ${documentNumber} cancelled`,
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
  const table = tableFor(documentType);
  if (table) {
    await tx[table].update({
      where: { id: documentId },
      data: {
        lifecycleStatus: LIFECYCLE_STATUS.REVERSED,
        reversedAt: new Date(),
        reversedBy: performedBy,
        lifecycleReason: reason,
        childDocumentType: childDocumentType ? normalizeDocumentType(childDocumentType) : null,
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

  await writeAudit(tx, {
    documentType,
    documentId,
    documentNumber,
    action: "REVERSE",
    eventType: EVENT_TYPES.REVERSED,
    message: `${documentType} ${documentNumber} reversed`,
  });
}

export async function onDocumentCorrected(tx, {
  documentType,
  documentId,
  documentNumber,
  childDocumentType,
  childDocumentId,
  childDocumentNumber,
  reason = null,
  performedBy = null,
}) {
  const table = tableFor(documentType);
  if (table) {
    await tx[table].update({
      where: { id: documentId },
      data: {
        childDocumentType: childDocumentType ? normalizeDocumentType(childDocumentType) : null,
        childDocumentId,
      },
    });
  }

  await recordLifecycleEvent(tx, {
    documentType,
    documentId,
    documentNumber,
    status: LIFECYCLE_STATUS.REVERSED,
    action: LIFECYCLE_ACTIONS.CORRECTED,
    reason,
    performedBy,
    childDocumentType,
    childDocumentId,
  });

  await recordLifecycleEvent(tx, {
    documentType: childDocumentType,
    documentId: childDocumentId,
    documentNumber: childDocumentNumber,
    status: LIFECYCLE_STATUS.DRAFT,
    action: LIFECYCLE_ACTIONS.CREATED,
    reason: reason || "Correction draft",
    performedBy,
    parentDocumentType: documentType,
    parentDocumentId: documentId,
  });
}

export async function onDocumentArchived(tx, {
  documentType,
  documentId,
  documentNumber,
  reason = null,
  performedBy = null,
}) {
  const table = tableFor(documentType);
  if (table) {
    await tx[table].update({
      where: { id: documentId },
      data: { lifecycleStatus: LIFECYCLE_STATUS.ARCHIVED, lifecycleReason: reason },
    });
  }

  await recordLifecycleEvent(tx, {
    documentType,
    documentId,
    documentNumber,
    status: LIFECYCLE_STATUS.ARCHIVED,
    action: LIFECYCLE_ACTIONS.ARCHIVED,
    reason,
    performedBy,
  });
}

export async function getDocumentTimeline(payload = {}) {
  const prisma = getCompanyPrisma();
  const documentType = normalizeDocumentType(payload.documentType);
  const documentId = Number(payload.documentId);
  if (!documentType || !documentId) return failure("Document type and id are required");

  const events = await prisma.documentLifecycleEvent.findMany({
    where: { documentType, documentId },
    orderBy: { performedAt: "asc" },
  });
  return success(events);
}

export async function getDocumentLinks(payload = {}) {
  const prisma = getCompanyPrisma();
  const documentType = payload.documentType;
  const documentId = Number(payload.documentId);
  const table = tableFor(documentType);
  if (!table || !documentId) return failure("Document type and id are required");

  const doc = await prisma[table].findUnique({ where: { id: documentId } });
  if (!doc) return failure("Document not found");

  const links = [];
  const route = DOCUMENT_ROUTES[documentType] || DOCUMENT_ROUTES[normalizeDocumentType(documentType)];

  if (doc.parentDocumentType && doc.parentDocumentId) {
    links.push({
      role: "Parent",
      documentType: doc.parentDocumentType,
      documentId: doc.parentDocumentId,
      route: DOCUMENT_ROUTES[doc.parentDocumentType],
    });
  }
  if (doc.childDocumentType && doc.childDocumentId) {
    links.push({
      role: "Child",
      documentType: doc.childDocumentType,
      documentId: doc.childDocumentId,
      route: DOCUMENT_ROUTES[doc.childDocumentType],
    });
  }

  const reversal = await prisma.documentLifecycleEvent.findFirst({
    where: { documentType: normalizeDocumentType(documentType), documentId, action: LIFECYCLE_ACTIONS.REVERSED },
    orderBy: { performedAt: "desc" },
  });
  if (reversal) {
    links.push({ role: "Reversal Event", reference: reversal.reason, date: reversal.performedAt });
  }

  const corrected = await prisma.documentLifecycleEvent.findFirst({
    where: { documentType: normalizeDocumentType(documentType), documentId, action: LIFECYCLE_ACTIONS.CORRECTED },
    orderBy: { performedAt: "desc" },
  });
  if (corrected?.childDocumentId) {
    links.push({
      role: "Corrected Document",
      documentType: corrected.childDocumentType,
      documentId: corrected.childDocumentId,
      route: DOCUMENT_ROUTES[corrected.childDocumentType],
    });
  }

  return success({
    document: { id: doc.id, number: doc.number, lifecycleStatus: doc.lifecycleStatus, route },
    links,
  });
}

export async function assertDocumentEditable(documentType, documentId) {
  const prisma = getCompanyPrisma();
  const table = tableFor(documentType);
  if (!table) return failure("Unknown document type");
  const doc = await prisma[table].findUnique({ where: { id: Number(documentId) } });
  if (!doc) return failure("Document not found");
  if (!canEditDocument(doc.lifecycleStatus)) {
    return failure("Posted documents cannot be edited");
  }
  return success(doc);
}

export async function assertDocumentDeletable(documentType, documentId) {
  return assertDocumentEditable(documentType, documentId);
}

export async function archiveDocument(payload = {}) {
  const prisma = getCompanyPrisma();
  const table = tableFor(payload.documentType);
  const id = Number(payload.id);
  const doc = await prisma[table]?.findUnique({ where: { id } });
  if (!doc) return failure("Document not found");
  if (doc.lifecycleStatus !== LIFECYCLE_STATUS.CANCELLED && doc.lifecycleStatus !== LIFECYCLE_STATUS.REVERSED) {
    return failure("Only cancelled or reversed documents can be archived");
  }

  await prisma.$transaction(async (tx) => {
    await onDocumentArchived(tx, {
      documentType: payload.documentType,
      documentId: id,
      documentNumber: doc.number,
      reason: payload.reason,
      performedBy: payload.performedBy,
    });
  });
  return success({ archived: true });
}

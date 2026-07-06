import { logCompanyAudit } from "./audit-service";
import { logCompanyEvent, EVENT_TYPES } from "./event-service";

export async function logOperation(tx, {
  userId = null,
  table,
  recordId,
  action,
  eventType = EVENT_TYPES.CREATED,
  entityType,
  referenceNumber = null,
  message,
}) {
  await logCompanyAudit(tx, { userId, table, recordId, action, details: message });
  await logCompanyEvent(tx, {
    eventType,
    entityType,
    entityId: recordId,
    referenceNumber,
    message,
    performedBy: userId,
  });
}

import { getBusinessDate } from "../domain/business-date";
import { createCompanyEventLog } from "../repositories/company-repository";
import { getActiveCompanyDb } from "../db/init";

export const EVENT_TYPES = {
  POSTED: "POSTED",
  COLLECTED: "COLLECTED",
  APPROVED: "APPROVED",
  SETTLED: "SETTLED",
  VOIDED: "VOIDED",
  REVERSED: "REVERSED",
  YEAR_CLOSE: "YEAR_CLOSE",
  RESTORED: "RESTORED",
  CREATED: "CREATED",
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
};

/**
 * Company Event Log: what happened in the business (timeline feed).
 */
export async function logCompanyEvent(tx, {
  eventType,
  entityType,
  entityId = null,
  referenceNumber = null,
  message,
  performedBy = null,
}) {
  const data = {
    eventType,
    entityType,
    entityId,
    referenceNumber,
    message,
    performedBy,
    createdAt: getBusinessDate(),
  };

  if (tx?.companyEventLog) {
    return tx.companyEventLog.create({ data });
  }

  if (!getActiveCompanyDb()) return null;
  return createCompanyEventLog(data);
}

export function formatPostedMessage(entityLabel, referenceNumber) {
  return `${entityLabel} ${referenceNumber} posted.`;
}

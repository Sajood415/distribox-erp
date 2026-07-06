import { getBusinessDate } from "../domain/business-date";
import { createMasterAuditLog } from "../repositories/master-repository";
import { createCompanyAuditLog } from "../repositories/company-repository";
import { getActiveCompanyDb } from "../db/init";

/**
 * Audit: who changed what (master + company DB).
 */
export async function logMasterAudit(txOrNull, { userId, companyId, table, recordId, action, details }) {
  const data = {
    userId: userId ?? null,
    companyId: companyId ?? null,
    table,
    recordId,
    action,
    details: details ? (typeof details === "string" ? details : JSON.stringify(details)) : null,
    timestamp: getBusinessDate(),
  };

  if (txOrNull?.auditLog) {
    return txOrNull.auditLog.create({ data });
  }
  return createMasterAuditLog(data);
}

export async function logCompanyAudit(tx, { userId, table, recordId, action, details }) {
  if (!tx?.companyAuditLog) {
    if (!getActiveCompanyDb()) return null;
    return createCompanyAuditLog({
      userId: userId ?? null,
      table,
      recordId,
      action,
      details: details ? (typeof details === "string" ? details : JSON.stringify(details)) : null,
      timestamp: getBusinessDate(),
    });
  }

  return tx.companyAuditLog.create({
    data: {
      userId: userId ?? null,
      table,
      recordId,
      action,
      details: details ? (typeof details === "string" ? details : JSON.stringify(details)) : null,
      timestamp: getBusinessDate(),
    },
  });
}

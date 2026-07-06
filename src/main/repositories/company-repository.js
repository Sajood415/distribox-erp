import { getCompanyPrisma } from "../db/init";

export function getCompanyClient() {
  return getCompanyPrisma();
}

export async function createCompanyAuditLog(data) {
  const prisma = getCompanyClient();
  return prisma.companyAuditLog.create({ data });
}

export async function createCompanyEventLog(data) {
  const prisma = getCompanyClient();
  return prisma.companyEventLog.create({ data });
}

export async function createStoredDocumentRecord(data) {
  const prisma = getCompanyClient();
  return prisma.storedDocument.create({ data });
}

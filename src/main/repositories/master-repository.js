import { getMasterPrisma } from "../db/init";

export function getMasterClient() {
  return getMasterPrisma();
}

export async function findSessionByToken(token) {
  const prisma = getMasterClient();
  return prisma.userSession.findUnique({
    where: { token },
    include: {
      user: {
        include: { role: true, company: true },
      },
    },
  });
}

export async function deleteExpiredSessions(beforeDate) {
  const prisma = getMasterClient();
  return prisma.userSession.deleteMany({
    where: { expiresAt: { lt: beforeDate } },
  });
}

export async function createJobRunLog(data) {
  const prisma = getMasterClient();
  return prisma.jobRunLog.create({ data });
}

export async function updateJobRunLog(id, data) {
  const prisma = getMasterClient();
  return prisma.jobRunLog.update({ where: { id }, data });
}

export async function createMasterAuditLog(data) {
  const prisma = getMasterClient();
  return prisma.auditLog.create({ data });
}

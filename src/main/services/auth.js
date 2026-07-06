import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { connectCompanyDatabase, getMasterPrisma } from "../db/init";
import { getBusinessDate } from "../domain/business-date";
import { resolveSession, getSessionExpiry } from "./session-service";
import { logMasterAudit } from "./audit-service";

export async function loginUser({ username, password }) {
  const prisma = getMasterPrisma();
  const user = await prisma.user.findUnique({
    where: { username },
    include: { role: true, company: true },
  });

  if (!user || !user.isActive) {
    return { success: false, error: "Invalid username or password" };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { success: false, error: "Invalid username or password" };
  }

  const token = randomUUID();
  const expiresAt = getSessionExpiry();

  await prisma.userSession.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  await logMasterAudit(null, {
    userId: user.id,
    companyId: user.companyId,
    table: "User",
    recordId: user.id,
    action: "LOGIN",
    details: { username: user.username },
  });

  return {
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role.name,
        companyId: user.companyId,
        company: user.company
          ? {
              id: user.company.id,
              name: user.company.name,
              code: user.company.code,
              dbFile: user.company.dbFile,
            }
          : null,
      },
    },
  };
}

export async function validateSession(token) {
  const result = await resolveSession(token);
  if (!result.success) {
    return { success: false };
  }
  return { success: true, data: { user: result.data.user } };
}

export async function logoutUser(token, ctx = null) {
  const prisma = getMasterPrisma();
  const session = await prisma.userSession.findUnique({
    where: { token },
    include: { user: true },
  });

  await prisma.userSession.deleteMany({ where: { token } });

  const userId = ctx?.user?.id ?? session?.userId ?? null;
  const companyId = ctx?.user?.companyId ?? session?.user?.companyId ?? null;

  if (userId) {
    await logMasterAudit(null, {
      userId,
      companyId,
      table: "User",
      recordId: userId,
      action: "LOGOUT",
      details: { username: session?.user?.username ?? ctx?.user?.username },
    });
  }

  return { success: true };
}

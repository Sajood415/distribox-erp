import { connectCompanyDatabase } from "../db/init";
import { getBusinessDate } from "../domain/business-date";
import { findSessionByToken } from "../repositories/master-repository";
import { UnauthorizedError } from "../core/errors";

const SESSION_HOURS = 12;

export function buildSessionUser(user) {
  return {
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
  };
}

export async function resolveSession(token) {
  if (!token) {
    return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
  }

  const session = await findSessionByToken(token);
  const now = getBusinessDate();

  if (!session || session.expiresAt < now || !session.user.isActive) {
    return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
  }

  if (session.user.company?.dbFile) {
    await connectCompanyDatabase(session.user.company.dbFile);
  }

  return {
    success: true,
    data: {
      user: buildSessionUser(session.user),
      token: session.token,
    },
  };
}

export async function requireSession(token) {
  const result = await resolveSession(token);
  if (!result.success) {
    throw new UnauthorizedError(result.error);
  }
  return result.data;
}

export function getSessionExpiry() {
  return new Date(getBusinessDate().getTime() + SESSION_HOURS * 60 * 60 * 1000);
}

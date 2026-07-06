import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { connectCompanyDatabase, getMasterPrisma } from "../db/init";

const SESSION_HOURS = 12;

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
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);

  await prisma.userSession.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      table: "User",
      recordId: user.id,
      action: "LOGIN",
      details: `User ${user.username} logged in`,
    },
  });

  return {
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role.name,
        permissions: JSON.parse(user.role.permissions),
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
  const prisma = getMasterPrisma();
  const session = await prisma.userSession.findUnique({
    where: { token },
    include: {
      user: {
        include: { role: true, company: true },
      },
    },
  });

  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    return { success: false };
  }

  if (session.user.company?.dbFile) {
    await connectCompanyDatabase(session.user.company.dbFile);
  }

  return {
    success: true,
    data: {
      user: {
        id: session.user.id,
        username: session.user.username,
        role: session.user.role.name,
        permissions: JSON.parse(session.user.role.permissions),
        companyId: session.user.companyId,
        company: session.user.company
          ? {
              id: session.user.company.id,
              name: session.user.company.name,
              code: session.user.company.code,
              dbFile: session.user.company.dbFile,
            }
          : null,
      },
    },
  };
}

export async function logoutUser(token) {
  const prisma = getMasterPrisma();
  await prisma.userSession.deleteMany({ where: { token } });
  return { success: true };
}

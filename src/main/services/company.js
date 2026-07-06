import { getMasterPrisma, connectCompanyDatabase } from "../db/init";
import { logMasterAudit } from "./audit-service";

export async function listCompanies() {
  const prisma = getMasterPrisma();
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, dbFile: true },
  });
  return { success: true, data: companies };
}

export async function createCompany({ name, code }, ctx) {
  const prisma = getMasterPrisma();
  const normalizedCode = code.trim().toUpperCase();

  const existing = await prisma.company.findUnique({
    where: { code: normalizedCode },
  });

  if (existing) {
    return { success: false, error: "Company code already exists" };
  }

  const dbFile = `${normalizedCode.toLowerCase()}.db`;
  const company = await prisma.company.create({
    data: {
      name: name.trim(),
      code: normalizedCode,
      dbFile,
    },
  });

  await connectCompanyDatabase(dbFile);

  await logMasterAudit(null, {
    userId: ctx?.user?.id,
    companyId: company.id,
    table: "Company",
    recordId: company.id,
    action: "CREATE",
    details: { code: company.code, name: company.name },
  });

  return { success: true, data: company };
}

export async function selectCompany({ companyId }, ctx) {
  const prisma = getMasterPrisma();
  const userId = ctx?.user?.id;

  if (!userId) {
    return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });

  if (!company) {
    return { success: false, error: "Company not found" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { companyId },
  });

  await connectCompanyDatabase(company.dbFile);

  await logMasterAudit(null, {
    userId,
    companyId: company.id,
    table: "Company",
    recordId: company.id,
    action: "SELECT",
    details: { code: company.code },
  });

  return {
    success: true,
    data: {
      id: company.id,
      name: company.name,
      code: company.code,
      dbFile: company.dbFile,
    },
  };
}

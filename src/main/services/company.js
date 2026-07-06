import { getMasterPrisma, connectCompanyDatabase } from "../db/init";

export async function listCompanies() {
  const prisma = getMasterPrisma();
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, dbFile: true },
  });
  return { success: true, data: companies };
}

export async function createCompany({ name, code }) {
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

  return { success: true, data: company };
}

export async function selectCompany({ userId, companyId }) {
  const prisma = getMasterPrisma();
  const company = await prisma.company.findUnique({ where: { id: companyId } });

  if (!company) {
    return { success: false, error: "Company not found" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { companyId },
  });

  await connectCompanyDatabase(company.dbFile);

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

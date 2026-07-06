import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";
import { logOperation } from "./operation-log";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

export async function listSalesmanTargets(payload = {}) {
  const prisma = getCompanyPrisma();
  const where = {};
  if (payload.salesmanId) where.salesmanId = Number(payload.salesmanId);
  if (payload.year) where.year = Number(payload.year);
  const data = await prisma.salesmanTarget.findMany({
    where,
    include: { salesman: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
  return success(data);
}

export async function saveSalesmanTarget(payload) {
  const prisma = getCompanyPrisma();
  if (!payload.salesmanId || !payload.year || !payload.month) {
    return failure("Salesman, year, and month are required");
  }

  const data = {
    salesmanId: Number(payload.salesmanId),
    year: Number(payload.year),
    month: Number(payload.month),
    salesTarget: roundMoney(payload.salesTarget),
    recoveryTarget: roundMoney(payload.recoveryTarget),
  };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const saved = await tx.salesmanTarget.upsert({
        where: {
          salesmanId_year_month: {
            salesmanId: data.salesmanId,
            year: data.year,
            month: data.month,
          },
        },
        create: data,
        update: {
          salesTarget: data.salesTarget,
          recoveryTarget: data.recoveryTarget,
        },
        include: { salesman: true },
      });
      await logOperation(tx, {
        table: "SalesmanTarget",
        recordId: saved.id,
        action: "SAVE",
        entityType: "SALESMAN_TARGET",
        referenceNumber: `${saved.salesman.name}-${saved.year}-${saved.month}`,
        message: `Salesman target saved for ${saved.salesman.name}`,
      });
      return saved;
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to save salesman target");
  }
}

export async function getSalesmanPerformance(payload = {}) {
  const prisma = getCompanyPrisma();
  const year = Number(payload.year) || new Date().getFullYear();
  const month = Number(payload.month) || new Date().getMonth() + 1;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  const salesmen = await prisma.salesman.findMany({ orderBy: { name: "asc" } });
  const rows = [];

  for (const salesman of salesmen) {
    const target = await prisma.salesmanTarget.findUnique({
      where: { salesmanId_year_month: { salesmanId: salesman.id, year, month } },
    });
    const sales = await prisma.salesInvoice.findMany({
      where: { salesmanId: salesman.id, date: { gte: start, lte: end } },
    });
    const recoveries = await prisma.recoveryVoucher.findMany({
      where: { salesmanId: salesman.id, date: { gte: start, lte: end } },
    });
    const actualSales = roundMoney(sales.reduce((sum, row) => sum + row.total, 0));
    const actualRecovery = roundMoney(recoveries.reduce((sum, row) => sum + row.amount, 0));
    const salesTarget = target?.salesTarget || 0;
    const recoveryTarget = target?.recoveryTarget || 0;

    rows.push({
      salesman: salesman.name,
      salesTarget,
      actualSales,
      salesAchievement: salesTarget > 0 ? roundMoney((actualSales / salesTarget) * 100) : 0,
      recoveryTarget,
      actualRecovery,
      recoveryAchievement: recoveryTarget > 0 ? roundMoney((actualRecovery / recoveryTarget) * 100) : 0,
      commissionRate: salesman.commissionRate,
      commission: roundMoney(actualSales * (salesman.commissionRate / 100)),
    });
  }

  return success({ year, month, rows });
}

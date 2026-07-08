import { getCompanyPrisma } from "../db/init";
import {
  getFiscalYearBounds,
  getFiscalYearStartMonth,
  startOfDay,
  endOfDay,
  getBusinessDate,
} from "../domain/business-date";
import { FISCAL_YEAR_STATUS, ACCOUNTING_PERIOD_STATUS } from "../core/period-status";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

function monthBounds(year, month) {
  const start = startOfDay(new Date(year, month - 1, 1));
  const end = endOfDay(new Date(year, month, 0));
  return { start, end };
}

function fiscalMonthsInYear(fyStart, fyEnd) {
  const months = [];
  const cursor = startOfDay(new Date(fyStart));
  const end = startOfDay(new Date(fyEnd));

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const bounds = monthBounds(year, month);
    months.push({ year, month, ...bounds });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

export async function ensureFiscalYearWithPeriods(tx, referenceDate = getBusinessDate()) {
  const bounds = getFiscalYearBounds(referenceDate, getFiscalYearStartMonth());
  let fiscalYear = await tx.fiscalYear.findUnique({ where: { name: bounds.label } });

  if (!fiscalYear) {
    fiscalYear = await tx.fiscalYear.create({
      data: {
        name: bounds.label,
        startDate: bounds.start,
        endDate: bounds.end,
        status: FISCAL_YEAR_STATUS.OPEN,
      },
    });
  }

  const months = fiscalMonthsInYear(bounds.start, bounds.end);
  for (const row of months) {
    const existing = await tx.accountingPeriod.findUnique({
      where: { fiscalYearId_month: { fiscalYearId: fiscalYear.id, month: row.month } },
    });
    if (!existing) {
      await tx.accountingPeriod.create({
        data: {
          fiscalYearId: fiscalYear.id,
          month: row.month,
          startDate: row.start,
          endDate: row.end,
          status: ACCOUNTING_PERIOD_STATUS.OPEN,
        },
      });
    }
  }

  return fiscalYear;
}

export async function seedFiscalPeriods(prisma) {
  const current = await ensureFiscalYearWithPeriods(prisma);
  const priorDate = new Date(current.startDate);
  priorDate.setDate(priorDate.getDate() - 1);
  await ensureFiscalYearWithPeriods(prisma, priorDate);
}

export async function listFiscalYears() {
  const prisma = getCompanyPrisma();
  await ensureFiscalYearWithPeriods(prisma);
  const rows = await prisma.fiscalYear.findMany({
    orderBy: { startDate: "desc" },
    include: {
      periods: { orderBy: { startDate: "asc" } },
    },
  });
  return success(rows);
}

export async function listAccountingPeriods(payload = {}) {
  const prisma = getCompanyPrisma();
  await ensureFiscalYearWithPeriods(prisma);

  const where = {};
  if (payload.fiscalYearId) where.fiscalYearId = Number(payload.fiscalYearId);
  if (payload.status) where.status = payload.status;

  const rows = await prisma.accountingPeriod.findMany({
    where,
    orderBy: { startDate: "desc" },
    include: { fiscalYear: true },
  });
  return success(rows);
}

export async function findPeriodForDate(tx, postingDate) {
  const date = startOfDay(new Date(postingDate));
  await ensureFiscalYearWithPeriods(tx, date);

  return tx.accountingPeriod.findFirst({
    where: {
      startDate: { lte: date },
      endDate: { gte: date },
    },
    include: { fiscalYear: true },
    orderBy: { startDate: "desc" },
  });
}

export async function getPeriodById(id) {
  const prisma = getCompanyPrisma();
  const period = await prisma.accountingPeriod.findUnique({
    where: { id: Number(id) },
    include: { fiscalYear: true },
  });
  if (!period) return failure("Accounting period not found");
  return success(period);
}

import { getCompanyPrisma } from "../db/init";
import { endOfDay } from "../domain/business-date";
import { ACCOUNTING_PERIOD_STATUS, FISCAL_YEAR_STATUS } from "../core/period-status";
import { runIntegrityChecks, verifyTrialBalanceIntegrity } from "./integrity-service";
import { getBalanceSheet, getIncomeStatement } from "./reports";
import { LIFECYCLE_STATUS } from "../core/document-types";

function success(data) {
  return { success: true, data };
}

function failure(error, extra = {}) {
  return { success: false, error, ...extra };
}

const DRAFT_TABLES = [
  "salesInvoice",
  "purchaseInvoice",
  "purchaseReturn",
  "salesReturn",
  "recoveryVoucher",
  "claim",
  "expenseVoucher",
  "stockAdjustment",
  "quotation",
  "loadSlip",
  "purchaseOrder",
];

async function countDraftDocuments(prisma) {
  let total = 0;
  const breakdown = [];

  for (const table of DRAFT_TABLES) {
    if (!prisma[table]?.count) continue;
    const count = await prisma[table].count({
      where: { lifecycleStatus: LIFECYCLE_STATUS.DRAFT },
    });
    if (count > 0) {
      breakdown.push({ table, count });
      total += count;
    }
  }

  return { total, breakdown };
}

export async function runClosingChecklist(payload = {}) {
  const prisma = getCompanyPrisma();
  const periodId = Number(payload.periodId);
  const period = await prisma.accountingPeriod.findUnique({
    where: { id: periodId },
    include: { fiscalYear: true },
  });

  if (!period) return failure("Accounting period not found");

  const asOfDate = endOfDay(period.endDate);
  const range = {
    startDate: period.startDate.toISOString().slice(0, 10),
    endDate: period.endDate.toISOString().slice(0, 10),
  };

  const checks = [];
  const blockers = [];

  const tb = await verifyTrialBalanceIntegrity(range);
  const tbOk = tb.success && tb.data.balanced;
  checks.push({
    id: "trial_balance",
    label: "Trial Balance balances",
    passed: tbOk,
    detail: tbOk ? "Debits equal credits" : "Trial balance is out of balance",
  });
  if (!tbOk) blockers.push("Trial balance is not balanced");

  const bs = await getBalanceSheet({ asOfDate: asOfDate.toISOString().slice(0, 10) });
  const bsOk = bs.success && bs.data.balanced;
  checks.push({
    id: "balance_sheet",
    label: "Balance Sheet balances",
    passed: bsOk,
    detail: bsOk ? "Assets equal liabilities + equity" : "Balance sheet does not balance",
  });
  if (!bsOk) blockers.push("Balance sheet does not balance");

  const is = await getIncomeStatement(range);
  const isOk = is.success;
  checks.push({
    id: "income_statement",
    label: "Income Statement computes",
    passed: isOk,
    detail: isOk ? "Income statement generated successfully" : is.error || "Income statement failed",
  });
  if (!isOk) blockers.push("Income statement could not be generated");

  const health = await runIntegrityChecks();
  const healthOk = health.success && health.data.healthy;
  checks.push({
    id: "database_health",
    label: "Database Health clean",
    passed: healthOk,
    detail: healthOk
      ? "No integrity issues detected"
      : `${health.data?.summary?.issueCount ?? 0} integrity issue(s) found`,
    issues: health.data?.issues?.slice(0, 10) || [],
  });
  if (!healthOk) blockers.push("Database health check failed");

  const inventoryOk = health.success && !health.data.summary.inventoryGlMismatch;
  checks.push({
    id: "inventory_gl",
    label: "Inventory equals GL",
    passed: inventoryOk,
    detail: inventoryOk ? "Stock valuation matches inventory GL" : "Inventory GL mismatch",
  });
  if (!inventoryOk) blockers.push("Inventory GL does not match stock valuation");

  const arOk = health.success && !health.data.summary.arMismatch;
  checks.push({
    id: "ar_outstanding",
    label: "AR equals Customer Outstanding",
    passed: arOk,
    detail: arOk ? "AR GL matches customer outstanding" : "AR operational mismatch",
  });
  if (!arOk) blockers.push("AR does not match customer outstanding");

  const apOk = health.success && !health.data.summary.apMismatch;
  checks.push({
    id: "ap_outstanding",
    label: "AP equals Supplier Outstanding",
    passed: apOk,
    detail: apOk ? "AP GL matches supplier outstanding" : "AP operational mismatch",
  });
  if (!apOk) blockers.push("AP does not match supplier outstanding");

  const negativeStock = health.data?.summary?.negativeStockCount ?? 0;
  const stockOk = negativeStock === 0;
  checks.push({
    id: "negative_stock",
    label: "No negative stock",
    passed: stockOk,
    detail: stockOk ? "All stock quantities are non-negative" : `${negativeStock} negative stock row(s)`,
  });
  if (!stockOk) blockers.push("Negative stock exists");

  const orphans = health.data?.summary?.orphanJournalLineCount ?? 0;
  const orphanOk = orphans === 0;
  checks.push({
    id: "orphan_journals",
    label: "No orphan journals",
    passed: orphanOk,
    detail: orphanOk ? "All journal lines have parent entries" : `${orphans} orphan journal line(s)`,
  });
  if (!orphanOk) blockers.push("Orphan journal lines exist");

  const drafts = await countDraftDocuments(prisma);
  const draftOk = drafts.total === 0;
  checks.push({
    id: "draft_documents",
    label: "No draft documents",
    passed: draftOk,
    detail: draftOk ? "No unposted draft documents" : `${drafts.total} draft document(s) remain`,
    breakdown: drafts.breakdown,
  });
  if (!draftOk) blockers.push("Unposted draft documents exist");

  const canClose = blockers.length === 0;

  return success({
    period,
    checks,
    blockers,
    canClose,
    ready: canClose,
  });
}

export async function closeAccountingPeriod(payload = {}) {
  const prisma = getCompanyPrisma();
  const periodId = Number(payload.id);
  const performedBy = payload.performedBy || null;

  const checklist = await runClosingChecklist({ periodId });
  if (!checklist.success) return checklist;
  if (!checklist.data.canClose) {
    return failure("Period cannot be closed until all checklist items pass", {
      checklist: checklist.data,
    });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const period = await tx.accountingPeriod.findUnique({ where: { id: periodId } });
      if (!period) throw new Error("Accounting period not found");
      if (period.status === ACCOUNTING_PERIOD_STATUS.CLOSED) {
        throw new Error("Accounting period is already closed");
      }

      return tx.accountingPeriod.update({
        where: { id: periodId },
        data: {
          status: ACCOUNTING_PERIOD_STATUS.CLOSED,
          lockedAt: new Date(),
          lockedBy: performedBy,
        },
        include: { fiscalYear: true },
      });
    });
    return success(updated);
  } catch (error) {
    return failure(error.message || "Failed to close accounting period");
  }
}

export async function reopenAccountingPeriod(payload = {}) {
  const prisma = getCompanyPrisma();
  const periodId = Number(payload.id);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const period = await tx.accountingPeriod.findUnique({
        where: { id: periodId },
        include: { fiscalYear: true },
      });
      if (!period) throw new Error("Accounting period not found");
      if (period.status !== ACCOUNTING_PERIOD_STATUS.CLOSED) {
        throw new Error("Only closed periods can be reopened");
      }
      if (period.fiscalYear?.status === FISCAL_YEAR_STATUS.ARCHIVED) {
        throw new Error("Cannot reopen a period in an archived fiscal year");
      }

      return tx.accountingPeriod.update({
        where: { id: periodId },
        data: {
          status: ACCOUNTING_PERIOD_STATUS.OPEN,
          lockedAt: null,
          lockedBy: null,
        },
        include: { fiscalYear: true },
      });
    });
    return success(updated);
  } catch (error) {
    return failure(error.message || "Failed to reopen accounting period");
  }
}

export async function prepareCloseFiscalYear(payload = {}) {
  const prisma = getCompanyPrisma();
  const fiscalYearId = Number(payload.fiscalYearId);

  const fiscalYear = await prisma.fiscalYear.findUnique({
    where: { id: fiscalYearId },
    include: { periods: { orderBy: { startDate: "asc" } } },
  });
  if (!fiscalYear) return failure("Fiscal year not found");

  const openPeriods = fiscalYear.periods.filter((p) => p.status === ACCOUNTING_PERIOD_STATUS.OPEN);
  const periodChecks = [];

  for (const period of fiscalYear.periods) {
    const checklist = await runClosingChecklist({ periodId: period.id });
    periodChecks.push({
      periodId: period.id,
      month: period.month,
      status: period.status,
      canClose: checklist.data?.canClose ?? false,
      blockers: checklist.data?.blockers ?? [],
    });
  }

  const canCloseYear =
    openPeriods.length === 0 ||
    openPeriods.every((p) => {
      const row = periodChecks.find((c) => c.periodId === p.id);
      return row?.canClose;
    });

  return success({
    fiscalYear,
    openPeriodCount: openPeriods.length,
    periodChecks,
    canCloseYear,
    message: canCloseYear
      ? "All open periods are ready for close, or all periods are already closed"
      : "Close all open periods before closing the fiscal year",
  });
}

export async function closeFiscalYear(payload = {}) {
  const prisma = getCompanyPrisma();
  const fiscalYearId = Number(payload.fiscalYearId);

  const prep = await prepareCloseFiscalYear({ fiscalYearId });
  if (!prep.success) return prep;

  const openPeriods = prep.data.fiscalYear.periods.filter(
    (p) => p.status === ACCOUNTING_PERIOD_STATUS.OPEN
  );

  for (const period of openPeriods) {
    const closed = await closeAccountingPeriod({ id: period.id, performedBy: payload.performedBy });
    if (!closed.success) return closed;
  }

  try {
    const updated = await prisma.fiscalYear.update({
      where: { id: fiscalYearId },
      data: { status: FISCAL_YEAR_STATUS.CLOSED },
      include: { periods: true },
    });
    return success(updated);
  } catch (error) {
    return failure(error.message || "Failed to close fiscal year");
  }
}

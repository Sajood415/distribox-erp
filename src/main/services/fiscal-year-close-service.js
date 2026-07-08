import { getCompanyPrisma } from "../db/init";
import { endOfDay, startOfDay, getBusinessDate, setBusinessDateOverride } from "../domain/business-date";
import { ACCOUNTING_PERIOD_STATUS, FISCAL_YEAR_STATUS } from "../core/period-status";
import { runClosingChecklist } from "./period-closing-service";
import { createNextFiscalYear } from "./fiscal-period-service";
import { postJournal } from "./posting-engine";
import { ACCOUNT_ROLES, SOURCE_DOCUMENT_TYPES } from "../core/account-roles";
import { resolveAccountIdByRole } from "./account-mapping-service";
import { listAccounts } from "../repositories/account-repository";
import { findJournalLinesCumulative, findJournalLinesInRange } from "../repositories/journal-repository";
import {
  getCustomerOutstanding,
  sumSalesReturns,
} from "../domain/customer-outstanding";
import {
  getVendorOutstanding,
  sumPurchaseReturns,
} from "../domain/vendor-outstanding";
import { getStockValuation } from "../domain/stock-quantity";
import { CLAIM_STATUSES } from "./claims";
import { PO_STATUSES } from "./purchase-order";
import { LOAD_SLIP_STATUSES } from "./load-slip";
import { roundMoney } from "../utils/money";
import { isEnabled } from "../core/feature-flags";

function success(data) {
  return { success: true, data };
}

function failure(error, extra = {}) {
  return { success: false, error, ...extra };
}

const OPEN_CLAIM_STATUSES = [CLAIM_STATUSES[0], CLAIM_STATUSES[1]];
const OPEN_PO_STATUSES = [PO_STATUSES.DRAFT, PO_STATUSES.APPROVED, PO_STATUSES.PARTIAL];
const OPEN_LOAD_SLIP_STATUSES = [
  LOAD_SLIP_STATUSES.DRAFT,
  LOAD_SLIP_STATUSES.LOADED,
  LOAD_SLIP_STATUSES.IN_TRANSIT,
];

async function getAccountClosingBalance(tx, accountRole, asOfDate) {
  const accountId = await resolveAccountIdByRole(tx, accountRole);
  const lines = await findJournalLinesCumulative(tx, { end: endOfDay(asOfDate) });
  const accountLines = lines.filter((line) => line.accountId === accountId);
  return roundMoney(accountLines.reduce((sum, line) => sum + line.debit - line.credit, 0));
}

async function buildCumulativeGlBalances(tx, asOfDate) {
  const accounts = await listAccounts(tx);
  const lines = await findJournalLinesCumulative(tx, { end: endOfDay(asOfDate) });

  return accounts
    .map((account) => {
      const accountLines = lines.filter((line) => line.accountId === account.id);
      const debit = roundMoney(accountLines.reduce((sum, line) => sum + line.debit, 0));
      const credit = roundMoney(accountLines.reduce((sum, line) => sum + line.credit, 0));
      const balance = roundMoney(debit - credit);
      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        debit,
        credit,
        balance,
      };
    })
    .filter((row) => row.debit > 0 || row.credit > 0 || row.balance !== 0);
}

async function countOpenOperationalDocuments(prisma) {
  const [openClaims, openPurchaseOrders, openLoadSlips] = await Promise.all([
    prisma.claim.count({ where: { status: { in: OPEN_CLAIM_STATUSES } } }),
    prisma.purchaseOrder.count({ where: { status: { in: OPEN_PO_STATUSES } } }),
    prisma.loadSlip.count({ where: { status: { in: OPEN_LOAD_SLIP_STATUSES } } }),
  ]);

  return { openClaims, openPurchaseOrders, openLoadSlips };
}

export async function runYearEndValidation(payload = {}) {
  if (!isEnabled("ENABLE_PERIOD_LOCKING")) {
    return failure("Period locking must be enabled for fiscal year close");
  }

  const prisma = getCompanyPrisma();
  const fiscalYearId = Number(payload.fiscalYearId);

  const fiscalYear = await prisma.fiscalYear.findUnique({
    where: { id: fiscalYearId },
    include: { periods: { orderBy: { startDate: "asc" } } },
  });

  if (!fiscalYear) return failure("Fiscal year not found");
  if (fiscalYear.status !== FISCAL_YEAR_STATUS.OPEN) {
    return failure(`Fiscal year is ${fiscalYear.status}; only open fiscal years can be closed`);
  }

  const lastPeriod = fiscalYear.periods[fiscalYear.periods.length - 1];
  if (!lastPeriod) return failure("Fiscal year has no accounting periods");

  const baseChecklist = await runClosingChecklist({ periodId: lastPeriod.id });
  if (!baseChecklist.success) return baseChecklist;

  const checks = [...baseChecklist.data.checks];
  const blockers = [...baseChecklist.data.blockers];

  const ops = await countOpenOperationalDocuments(prisma);

  const claimsOk = ops.openClaims === 0;
  checks.push({
    id: "open_claims",
    label: "No open claims",
    passed: claimsOk,
    detail: claimsOk ? "All claims are settled or rejected" : `${ops.openClaims} open claim(s) remain`,
  });
  if (!claimsOk) blockers.push("Open claims exist");

  const poOk = ops.openPurchaseOrders === 0;
  checks.push({
    id: "open_purchase_orders",
    label: "No open purchase orders",
    passed: poOk,
    detail: poOk
      ? "All purchase orders are completed or cancelled"
      : `${ops.openPurchaseOrders} open purchase order(s) remain`,
  });
  if (!poOk) blockers.push("Open purchase orders exist");

  const loadSlipOk = ops.openLoadSlips === 0;
  checks.push({
    id: "open_load_slips",
    label: "No open load slips",
    passed: loadSlipOk,
    detail: loadSlipOk
      ? "All load slips are delivered or closed"
      : `${ops.openLoadSlips} open load slip(s) remain`,
  });
  if (!loadSlipOk) blockers.push("Open load slips exist");

  const canClose = blockers.length === 0;

  return success({
    fiscalYear,
    lastPeriod,
    checks,
    blockers,
    canClose,
    ready: canClose,
    operationalCounts: ops,
  });
}

async function postYearEndClosingJournal(tx, fiscalYear) {
  const asOf = endOfDay(fiscalYear.endDate);
  const accounts = await listAccounts(tx);
  const lines = await findJournalLinesCumulative(tx, { end: asOf });

  const journalLines = [];
  let netIncome = 0;

  for (const account of accounts) {
    const accountLines = lines.filter((line) => line.accountId === account.id);
    const debit = roundMoney(accountLines.reduce((sum, line) => sum + line.debit, 0));
    const credit = roundMoney(accountLines.reduce((sum, line) => sum + line.credit, 0));
    const balance = roundMoney(debit - credit);

    if (account.type === "Income" && balance < -0.009) {
      const amount = roundMoney(-balance);
      journalLines.push({
        accountId: account.id,
        debit: amount,
        credit: 0,
        description: "Year-end close",
      });
      netIncome = roundMoney(netIncome + amount);
    } else if (account.type === "Expense" && balance > 0.009) {
      journalLines.push({
        accountId: account.id,
        debit: 0,
        credit: balance,
        description: "Year-end close",
      });
      netIncome = roundMoney(netIncome - balance);
    }
  }

  if (journalLines.length === 0) {
    return { netIncome: 0, entry: null };
  }

  const equityAccountId = await resolveAccountIdByRole(tx, ACCOUNT_ROLES.EQUITY);
  if (netIncome > 0.009) {
    journalLines.push({
      accountId: equityAccountId,
      debit: 0,
      credit: netIncome,
      description: "Retained earnings transfer",
    });
  } else if (netIncome < -0.009) {
    journalLines.push({
      accountId: equityAccountId,
      debit: roundMoney(-netIncome),
      credit: 0,
      description: "Retained earnings transfer",
    });
  }

  const entry = await postJournal(tx, {
    referenceNumber: `YEC-${fiscalYear.name}`,
    sourceDocumentType: SOURCE_DOCUMENT_TYPES.VOUCHER,
    sourceDocumentId: fiscalYear.id,
    postingDate: fiscalYear.endDate,
    description: `Fiscal year close — ${fiscalYear.name}`,
    sourceType: "YEAR_CLOSE",
    lines: journalLines,
  });

  return { netIncome, entry };
}

async function carryForwardCustomerBalances(tx) {
  const customers = await tx.customer.findMany({ orderBy: { code: "asc" } });
  const rows = [];

  for (const customer of customers) {
    const priorOutstanding = await getCustomerOutstanding(tx, customer.id);
    const salesReturns = await sumSalesReturns(tx, customer.id);
    const newOpening = roundMoney(priorOutstanding + salesReturns);

    const invoices = await tx.salesInvoice.findMany({
      where: { customerId: customer.id, isCredit: true },
    });

    for (const invoice of invoices) {
      await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: { paidAmount: invoice.total },
      });
    }

    await tx.customer.update({
      where: { id: customer.id },
      data: { openingBalance: newOpening },
    });

    const verifiedOutstanding = await getCustomerOutstanding(tx, customer.id);
    rows.push({
      customerId: customer.id,
      code: customer.code,
      name: customer.name,
      priorOutstanding,
      openingBalance: newOpening,
      verifiedOutstanding,
    });
  }

  return rows;
}

async function carryForwardSupplierBalances(tx) {
  const vendors = await tx.vendor.findMany({ orderBy: { code: "asc" } });
  const rows = [];

  for (const vendor of vendors) {
    const priorOutstanding = await getVendorOutstanding(tx, vendor.id);
    const purchaseReturns = await sumPurchaseReturns(tx, vendor.id);
    const newOpening = roundMoney(priorOutstanding + purchaseReturns);

    const invoices = await tx.purchaseInvoice.findMany({
      where: { vendorId: vendor.id, isCredit: true },
    });

    for (const invoice of invoices) {
      await tx.purchaseInvoice.update({
        where: { id: invoice.id },
        data: { paidAmount: invoice.total },
      });
    }

    await tx.vendor.update({
      where: { id: vendor.id },
      data: { openingBalance: newOpening },
    });

    const verifiedOutstanding = await getVendorOutstanding(tx, vendor.id);
    rows.push({
      vendorId: vendor.id,
      code: vendor.code,
      name: vendor.name,
      priorOutstanding,
      openingBalance: newOpening,
      verifiedOutstanding,
    });
  }

  return rows;
}

async function buildStockSnapshot(tx) {
  const rows = await tx.stock.findMany({
    where: { quantity: { gt: 0 } },
    include: { product: true, warehouse: true },
    orderBy: [{ warehouseId: "asc" }, { productId: "asc" }],
  });

  return rows.map((row) => ({
    productId: row.productId,
    productCode: row.product.code,
    productName: row.product.name,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouse.name,
    batchNo: row.batchNo,
    quantity: row.quantity,
    costPerUnit: row.costPerUnit,
    value: roundMoney(row.quantity * row.costPerUnit),
  }));
}

async function buildTrialBalanceFromTx(tx, fiscalYear) {
  const start = startOfDay(fiscalYear.startDate);
  const end = endOfDay(fiscalYear.endDate);
  const accounts = await listAccounts(tx);
  const lines = await findJournalLinesInRange(tx, { start, end });

  const rows = accounts
    .map((account) => {
      const accountLines = lines.filter((line) => line.accountId === account.id);
      const debit = roundMoney(accountLines.reduce((sum, line) => sum + line.debit, 0));
      const credit = roundMoney(accountLines.reduce((sum, line) => sum + line.credit, 0));
      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        debit,
        credit,
        balance: roundMoney(debit - credit),
      };
    })
    .filter((row) => row.debit > 0 || row.credit > 0);

  const totalDebit = roundMoney(rows.reduce((sum, row) => sum + row.debit, 0));
  const totalCredit = roundMoney(rows.reduce((sum, row) => sum + row.credit, 0));

  return {
    rows,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.01,
  };
}

async function buildBalanceSheetFromTx(tx, asOfDate) {
  const asOf = endOfDay(asOfDate);
  const glBalances = await buildCumulativeGlBalances(tx, asOfDate);
  const leafAccounts = glBalances.filter((row) => !["1000", "2000"].includes(row.code));

  const assets = leafAccounts
    .filter((row) => row.type === "Asset" && row.balance !== 0)
    .map((row) => ({ ...row, amount: row.balance }));

  const liabilities = leafAccounts
    .filter((row) => row.type === "Liability" && row.balance !== 0)
    .map((row) => ({ ...row, amount: roundMoney(-row.balance) }));

  const equityAccounts = leafAccounts
    .filter((row) => row.type === "Equity" && row.balance !== 0)
    .map((row) => ({ ...row, amount: roundMoney(-row.balance) }));

  const incomeLines = await findJournalLinesCumulative(tx, { end: asOf, accountType: "Income" });
  const expenseLines = await findJournalLinesCumulative(tx, { end: asOf, accountType: "Expense" });

  const retainedEarnings = roundMoney(
    incomeLines.reduce((sum, line) => sum + line.credit - line.debit, 0) -
      expenseLines.reduce((sum, line) => sum + line.debit - line.credit, 0)
  );

  const totalAssets = roundMoney(assets.reduce((sum, row) => sum + row.amount, 0));
  const totalLiabilities = roundMoney(liabilities.reduce((sum, row) => sum + row.amount, 0));
  const totalEquity = roundMoney(
    equityAccounts.reduce((sum, row) => sum + row.amount, 0) + retainedEarnings
  );

  return {
    asOf,
    assets,
    liabilities,
    equity: equityAccounts,
    retainedEarnings,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity: roundMoney(totalLiabilities + totalEquity),
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  };
}

async function buildIncomeStatementFromTx(tx, fiscalYear) {
  const start = startOfDay(fiscalYear.startDate);
  const end = endOfDay(fiscalYear.endDate);
  const accounts = await listAccounts(tx);
  const lines = await findJournalLinesInRange(tx, { start, end });

  const incomeRows = accounts
    .filter((account) => account.type === "Income")
    .map((account) => {
      const accountLines = lines.filter((line) => line.accountId === account.id);
      const debit = roundMoney(accountLines.reduce((sum, line) => sum + line.debit, 0));
      const credit = roundMoney(accountLines.reduce((sum, line) => sum + line.credit, 0));
      return { code: account.code, name: account.name, amount: roundMoney(credit - debit) };
    })
    .filter((row) => row.amount !== 0);

  const expenseRows = accounts
    .filter((account) => account.type === "Expense")
    .map((account) => {
      const accountLines = lines.filter((line) => line.accountId === account.id);
      const debit = roundMoney(accountLines.reduce((sum, line) => sum + line.debit, 0));
      const credit = roundMoney(accountLines.reduce((sum, line) => sum + line.credit, 0));
      return { code: account.code, name: account.name, amount: roundMoney(debit - credit) };
    })
    .filter((row) => row.amount !== 0);

  const totalIncome = roundMoney(incomeRows.reduce((sum, row) => sum + row.amount, 0));
  const totalExpenses = roundMoney(expenseRows.reduce((sum, row) => sum + row.amount, 0));
  const netProfit = roundMoney(totalIncome - totalExpenses);

  return { start, end, incomeRows, expenseRows, totalIncome, totalExpenses, netProfit };
}

async function collectSnapshotMetrics(tx, fiscalYear) {
  const asOfDate = fiscalYear.endDate;

  const [trialBalance, balanceSheet, incomeStatement, glBalances, stockSnapshot] =
    await Promise.all([
      buildTrialBalanceFromTx(tx, fiscalYear),
      buildBalanceSheetFromTx(tx, asOfDate),
      buildIncomeStatementFromTx(tx, fiscalYear),
      buildCumulativeGlBalances(tx, asOfDate),
      buildStockSnapshot(tx),
    ]);

  const inventory = await getStockValuation(tx);
  const cashPosition = await getAccountClosingBalance(tx, ACCOUNT_ROLES.CASH, asOfDate);
  const bankPosition = await getAccountClosingBalance(tx, ACCOUNT_ROLES.BANK, asOfDate);

  const customers = await tx.customer.findMany({ orderBy: { code: "asc" } });
  const customerBalances = [];
  let customerOutstanding = 0;
  for (const customer of customers) {
    const outstanding = await getCustomerOutstanding(tx, customer.id);
    if (outstanding !== 0) {
      customerBalances.push({
        customerId: customer.id,
        code: customer.code,
        name: customer.name,
        outstanding,
      });
      customerOutstanding = roundMoney(customerOutstanding + outstanding);
    }
  }

  const vendors = await tx.vendor.findMany({ orderBy: { code: "asc" } });
  const supplierBalances = [];
  let supplierOutstanding = 0;
  for (const vendor of vendors) {
    const outstanding = await getVendorOutstanding(tx, vendor.id);
    if (outstanding !== 0) {
      supplierBalances.push({
        vendorId: vendor.id,
        code: vendor.code,
        name: vendor.name,
        outstanding,
      });
      supplierOutstanding = roundMoney(supplierOutstanding + outstanding);
    }
  }

  const retainedEarnings = incomeStatement.netProfit;

  return {
    trialBalance,
    balanceSheet,
    incomeStatement,
    glBalances,
    stockSnapshot,
    inventoryValuation: inventory.value,
    customerBalances,
    supplierBalances,
    customerOutstanding,
    supplierOutstanding,
    cashPosition,
    bankPosition,
    retainedEarnings,
  };
}

export async function closeFiscalYearComplete(payload = {}) {
  const validation = await runYearEndValidation(payload);
  if (!validation.success) return validation;
  if (!validation.data.canClose) {
    return failure("Fiscal year cannot be closed until all validations pass", {
      validation: validation.data,
    });
  }

  const prisma = getCompanyPrisma();
  const fiscalYearId = Number(payload.fiscalYearId);
  const performedBy = payload.performedBy || null;
  const archiveYear = payload.archive !== false;

  const fiscalYear = await prisma.fiscalYear.findUnique({
    where: { id: fiscalYearId },
    include: { periods: { orderBy: { startDate: "asc" } } },
  });
  if (!fiscalYear) return failure("Fiscal year not found");

  const savedBusinessDate = getBusinessDate();
  setBusinessDateOverride(fiscalYear.endDate);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const year = await tx.fiscalYear.findUnique({
        where: { id: fiscalYearId },
        include: { periods: { orderBy: { startDate: "asc" } } },
      });

      if (!year) throw new Error("Fiscal year not found");
      if (year.status !== FISCAL_YEAR_STATUS.OPEN) {
        throw new Error(`Fiscal year is already ${year.status}`);
      }

      const { netIncome } = await postYearEndClosingJournal(tx, year);

      const customerCarryForward = await carryForwardCustomerBalances(tx);
      const supplierCarryForward = await carryForwardSupplierBalances(tx);

      const metrics = await collectSnapshotMetrics(tx, year);

      for (const period of year.periods) {
        if (period.status === ACCOUNTING_PERIOD_STATUS.OPEN) {
          await tx.accountingPeriod.update({
            where: { id: period.id },
            data: {
              status: ACCOUNTING_PERIOD_STATUS.CLOSED,
              lockedAt: new Date(),
              lockedBy: performedBy,
            },
          });
        }
      }

      const newFiscalYear = await createNextFiscalYear(tx, year);

      const closedFiscalYear = await tx.fiscalYear.update({
        where: { id: fiscalYearId },
        data: {
          status: archiveYear ? FISCAL_YEAR_STATUS.ARCHIVED : FISCAL_YEAR_STATUS.CLOSED,
          closedAt: new Date(),
          closedBy: performedBy,
        },
        include: { periods: true },
      });

      const snapshot = await tx.yearCloseSnapshot.create({
        data: {
          fiscalYearId: year.id,
          fiscalYearName: year.name,
          newFiscalYearId: newFiscalYear.id,
          newFiscalYearName: newFiscalYear.name,
          closedBy: performedBy,
          inventoryValuation: metrics.inventoryValuation,
          customerOutstanding: metrics.customerOutstanding,
          supplierOutstanding: metrics.supplierOutstanding,
          cashPosition: metrics.cashPosition,
          bankPosition: metrics.bankPosition,
          retainedEarnings: metrics.retainedEarnings,
          trialBalanceJson: JSON.stringify(metrics.trialBalance),
          balanceSheetJson: JSON.stringify(metrics.balanceSheet),
          incomeStatementJson: JSON.stringify(metrics.incomeStatement),
          customerBalancesJson: JSON.stringify({
            carried: customerCarryForward,
            closing: metrics.customerBalances,
          }),
          supplierBalancesJson: JSON.stringify({
            carried: supplierCarryForward,
            closing: metrics.supplierBalances,
          }),
          glBalancesJson: JSON.stringify(metrics.glBalances),
          stockSnapshotJson: JSON.stringify(metrics.stockSnapshot),
        },
      });

      return {
        closedFiscalYear,
        newFiscalYear,
        snapshot,
        netIncome,
        customerCarryForward,
        supplierCarryForward,
        metrics,
        irreversible: true,
        message:
          "Fiscal year closed successfully. This action cannot be reversed from the application — restore from backup if needed.",
      };
    });

    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to close fiscal year");
  } finally {
    setBusinessDateOverride(savedBusinessDate);
  }
}

export async function listYearCloseHistory() {
  const prisma = getCompanyPrisma();
  const rows = await prisma.yearCloseSnapshot.findMany({
    orderBy: { closedAt: "desc" },
  });
  return success(rows);
}

export async function getYearCloseReport(payload = {}) {
  const prisma = getCompanyPrisma();
  const snapshotId = Number(payload.snapshotId);
  const fiscalYearId = payload.fiscalYearId ? Number(payload.fiscalYearId) : null;

  const snapshot = snapshotId
    ? await prisma.yearCloseSnapshot.findUnique({ where: { id: snapshotId } })
    : fiscalYearId
      ? await prisma.yearCloseSnapshot.findFirst({
          where: { fiscalYearId },
          orderBy: { closedAt: "desc" },
        })
      : null;

  if (!snapshot) return failure("Year close snapshot not found");

  return success({
    ...snapshot,
    trialBalance: JSON.parse(snapshot.trialBalanceJson),
    balanceSheet: JSON.parse(snapshot.balanceSheetJson),
    incomeStatement: JSON.parse(snapshot.incomeStatementJson),
    customerBalances: snapshot.customerBalancesJson
      ? JSON.parse(snapshot.customerBalancesJson)
      : null,
    supplierBalances: snapshot.supplierBalancesJson
      ? JSON.parse(snapshot.supplierBalancesJson)
      : null,
    glBalances: snapshot.glBalancesJson ? JSON.parse(snapshot.glBalancesJson) : null,
    stockSnapshot: snapshot.stockSnapshotJson ? JSON.parse(snapshot.stockSnapshotJson) : null,
  });
}

export async function getOpeningBalanceReport(payload = {}) {
  const prisma = getCompanyPrisma();

  let snapshot = null;
  if (payload.snapshotId) {
    snapshot = await prisma.yearCloseSnapshot.findUnique({
      where: { id: Number(payload.snapshotId) },
    });
  } else if (payload.fiscalYearId) {
    snapshot = await prisma.yearCloseSnapshot.findFirst({
      where: { newFiscalYearId: Number(payload.fiscalYearId) },
      orderBy: { closedAt: "desc" },
    });
  } else {
    snapshot = await prisma.yearCloseSnapshot.findFirst({
      orderBy: { closedAt: "desc" },
    });
  }

  if (!snapshot) return failure("No opening balance snapshot found");

  const customerData = snapshot.customerBalancesJson
    ? JSON.parse(snapshot.customerBalancesJson)
    : { carried: [] };
  const supplierData = snapshot.supplierBalancesJson
    ? JSON.parse(snapshot.supplierBalancesJson)
    : { carried: [] };
  const glBalances = snapshot.glBalancesJson ? JSON.parse(snapshot.glBalancesJson) : [];
  const stockSnapshot = snapshot.stockSnapshotJson ? JSON.parse(snapshot.stockSnapshotJson) : [];

  const customers = customerData.carried || [];
  const vendors = supplierData.carried || [];

  const glOpening = glBalances
    .filter((row) => ["Asset", "Liability", "Equity"].includes(row.type))
    .map((row) => ({
      code: row.code,
      name: row.name,
      type: row.type,
      balance: row.balance,
    }));

  return success({
    snapshotId: snapshot.id,
    fiscalYearClosed: snapshot.fiscalYearName,
    newFiscalYear: snapshot.newFiscalYearName,
    closedAt: snapshot.closedAt,
    cashOpening: snapshot.cashPosition,
    bankOpening: snapshot.bankPosition,
    inventoryValuation: snapshot.inventoryValuation,
    customerOpenings: customers.map((row) => ({
      code: row.code,
      name: row.name,
      openingBalance: row.openingBalance,
      verifiedOutstanding: row.verifiedOutstanding,
    })),
    supplierOpenings: vendors.map((row) => ({
      code: row.code,
      name: row.name,
      openingBalance: row.openingBalance,
      verifiedOutstanding: row.verifiedOutstanding,
    })),
    glOpening,
    stockOpening: stockSnapshot,
  });
}

export async function listFiscalYearsWithCloseHistory() {
  const prisma = getCompanyPrisma();
  const fiscalYears = await prisma.fiscalYear.findMany({
    include: {
      periods: { orderBy: { startDate: "asc" } },
      snapshots: { orderBy: { closedAt: "desc" }, take: 1 },
    },
    orderBy: { startDate: "desc" },
  });
  return success(fiscalYears);
}

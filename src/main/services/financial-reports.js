import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";

function success(data) {
  return { success: true, data };
}

function parseDateRange(payload = {}) {
  const start = payload.startDate ? new Date(payload.startDate) : new Date("2000-01-01");
  const end = payload.endDate ? new Date(payload.endDate) : new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function listJournalEntries(payload = {}) {
  const prisma = getCompanyPrisma();
  const { start, end } = parseDateRange(payload);

  const data = await prisma.journalEntry.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: { date: "desc" },
    include: {
      lines: { include: { account: true } },
      voucher: true,
    },
  });

  return success(data);
}

export async function getTrialBalance(payload = {}) {
  const prisma = getCompanyPrisma();
  const { start, end } = parseDateRange(payload);

  const accounts = await prisma.account.findMany({ orderBy: { code: "asc" } });
  const lines = await prisma.ledgerLine.findMany({
    where: {
      entry: { date: { gte: start, lte: end } },
    },
    include: { account: true },
  });

  const balances = accounts.map((account) => {
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
  }).filter((row) => row.debit > 0 || row.credit > 0);

  const totalDebit = roundMoney(balances.reduce((sum, row) => sum + row.debit, 0));
  const totalCredit = roundMoney(balances.reduce((sum, row) => sum + row.credit, 0));

  return success({
    rows: balances,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.01,
  });
}

export async function getCashbook(payload = {}) {
  const prisma = getCompanyPrisma();
  const { start, end } = parseDateRange(payload);
  const cashAccount = await prisma.account.findUnique({ where: { code: "1100" } });

  if (!cashAccount) {
    return success({ opening: 0, closing: 0, rows: [], receipts: 0, payments: 0 });
  }

  const lines = await prisma.ledgerLine.findMany({
    where: {
      accountId: cashAccount.id,
      entry: { date: { gte: start, lte: end } },
    },
    include: {
      entry: { include: { voucher: true } },
      account: true,
    },
    orderBy: { entry: { date: "asc" } },
  });

  let running = 0;
  const rows = lines.map((line) => {
    running = roundMoney(running + line.debit - line.credit);
    return {
      date: line.entry.date,
      reference: line.entry.reference,
      description: line.entry.description,
      voucherType: line.entry.voucher?.type ?? line.entry.sourceType,
      debit: line.debit,
      credit: line.credit,
      balance: running,
      narrative: line.narrative,
    };
  });

  const receipts = roundMoney(rows.reduce((sum, row) => sum + row.debit, 0));
  const payments = roundMoney(rows.reduce((sum, row) => sum + row.credit, 0));

  return success({
    account: cashAccount,
    receipts,
    payments,
    closing: running,
    rows,
  });
}

export async function getAccountLedger(payload) {
  const prisma = getCompanyPrisma();
  const accountId = Number(payload.accountId);
  if (!accountId) {
    return { success: false, error: "Account is required" };
  }

  const { start, end } = parseDateRange(payload);
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    return { success: false, error: "Account not found" };
  }

  const lines = await prisma.ledgerLine.findMany({
    where: {
      accountId,
      entry: { date: { gte: start, lte: end } },
    },
    include: { entry: true },
    orderBy: { entry: { date: "asc" } },
  });

  let running = 0;
  const rows = lines.map((line) => {
    running = roundMoney(running + line.debit - line.credit);
    return {
      date: line.entry.date,
      reference: line.entry.reference,
      description: line.entry.description,
      debit: line.debit,
      credit: line.credit,
      balance: running,
      narrative: line.narrative,
    };
  });

  return success({ account, rows, closing: running });
}

export async function getDailyCashPosition(payload = {}) {
  const date = payload.date ? new Date(payload.date) : new Date();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const cashbook = await getCashbook({ startDate: start.toISOString(), endDate: end.toISOString() });
  if (!cashbook.success) {
    return cashbook;
  }

  return success({
    date,
    opening: roundMoney(cashbook.data.closing - cashbook.data.receipts + cashbook.data.payments),
    received: cashbook.data.receipts,
    paid: cashbook.data.payments,
    closing: cashbook.data.closing,
  });
}

export async function getProfitAndLoss(payload = {}) {
  const prisma = getCompanyPrisma();
  const { start, end } = parseDateRange(payload);

  const lines = await prisma.ledgerLine.findMany({
    where: { entry: { date: { gte: start, lte: end } } },
    include: { account: true },
  });

  const income = roundMoney(
    lines
      .filter((line) => line.account.type === "Income")
      .reduce((sum, line) => sum + line.credit - line.debit, 0)
  );
  const expenses = roundMoney(
    lines
      .filter((line) => line.account.type === "Expense")
      .reduce((sum, line) => sum + line.debit - line.credit, 0)
  );

  return success({
    income,
    expenses,
    netProfit: roundMoney(income - expenses),
  });
}

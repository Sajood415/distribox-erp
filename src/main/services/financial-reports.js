import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";
import { resolveAccountIdByRole } from "./account-mapping-service";
import { ACCOUNT_ROLES } from "../core/account-roles";
import {
  findJournalLinesInRange,
  listJournalEntries as fetchJournalEntries,
} from "../repositories/journal-repository";
import { listAccounts } from "../repositories/account-repository";

function success(data) {
  return { success: true, data };
}

function parseDateRange(payload = {}) {
  const start = payload.startDate ? new Date(payload.startDate) : new Date("2000-01-01");
  const end = payload.endDate ? new Date(payload.endDate) : new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function buildAccountBook(payload, accountRole) {
  const prisma = getCompanyPrisma();
  const { start, end } = parseDateRange(payload);
  const accountId = await resolveAccountIdByRole(prisma, accountRole);

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    return success({ opening: 0, closing: 0, rows: [], receipts: 0, payments: 0, account: null });
  }

  const lines = await findJournalLinesInRange(prisma, { start, end, accountId });

  let running = 0;
  const rows = lines.map((line) => {
    running = roundMoney(running + line.debit - line.credit);
    return {
      date: line.journalEntry.date,
      reference: line.journalEntry.referenceNumber || line.journalEntry.reference,
      description: line.journalEntry.description,
      voucherType: line.journalEntry.voucher?.type ?? line.journalEntry.sourceType,
      debit: line.debit,
      credit: line.credit,
      balance: running,
      narrative: line.description,
    };
  });

  const receipts = roundMoney(rows.reduce((sum, row) => sum + row.debit, 0));
  const payments = roundMoney(rows.reduce((sum, row) => sum + row.credit, 0));

  return success({
    account,
    receipts,
    payments,
    closing: running,
    rows,
  });
}

export async function listJournalEntries(payload = {}) {
  const prisma = getCompanyPrisma();
  const { start, end } = parseDateRange(payload);
  const data = await fetchJournalEntries(prisma, { start, end });
  return success(data);
}

export async function getTrialBalance(payload = {}) {
  const prisma = getCompanyPrisma();
  const { start, end } = parseDateRange(payload);

  const accounts = await listAccounts(prisma);
  const lines = await findJournalLinesInRange(prisma, { start, end });

  const balances = accounts
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
    .filter((row) => row.debit > 0 || row.credit > 0);

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
  return buildAccountBook(payload, ACCOUNT_ROLES.CASH);
}

export async function getBankbook(payload = {}) {
  const book = await buildAccountBook(payload, ACCOUNT_ROLES.BANK);
  if (book.success && book.data) {
    book.data.reconciliation = {
      status: "foundation",
      note: "Bank reconciliation workflow will match statement lines in a future phase.",
    };
  }
  return book;
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

  const lines = await findJournalLinesInRange(prisma, { start, end, accountId });

  let running = 0;
  const rows = lines.map((line) => {
    running = roundMoney(running + line.debit - line.credit);
    return {
      date: line.journalEntry.date,
      reference: line.journalEntry.referenceNumber || line.journalEntry.reference,
      description: line.journalEntry.description,
      debit: line.debit,
      credit: line.credit,
      balance: running,
      narrative: line.description,
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

  const lines = await findJournalLinesInRange(prisma, { start, end });

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

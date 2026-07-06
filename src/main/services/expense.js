import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";
import { postJournal } from "./posting-engine";
import { ACCOUNT_ROLES, SOURCE_DOCUMENT_TYPES } from "../core/account-roles";
import { logOperation } from "./operation-log";
import { EVENT_TYPES } from "./event-service";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

async function nextExpenseNumber(tx) {
  const year = new Date().getFullYear();
  const prefix = `EXP-${year}-`;
  const latest = await tx.expenseVoucher.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
  });
  const next = latest ? Number(latest.number.split("-").pop()) + 1 : 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

export async function listExpenses() {
  const prisma = getCompanyPrisma();
  const data = await prisma.expenseVoucher.findMany({ orderBy: { date: "desc" } });
  return success(data);
}

export async function saveExpense(payload) {
  const prisma = getCompanyPrisma();
  const amount = roundMoney(payload.amount);
  if (amount <= 0) return failure("Amount must be greater than zero");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const voucher = await tx.expenseVoucher.create({
        data: {
          number: payload.number || (await nextExpenseNumber(tx)),
          date: new Date(payload.date),
          amount,
          paymentMode: payload.paymentMode || "Cash",
          description: payload.description?.trim() || null,
        },
      });

      await postJournal(tx, {
        referenceNumber: voucher.number,
        sourceDocumentType: SOURCE_DOCUMENT_TYPES.VOUCHER,
        sourceDocumentId: voucher.id,
        postingDate: voucher.date,
        description: voucher.description || `Expense ${voucher.number}`,
        lines: [
          { accountRole: ACCOUNT_ROLES.CLAIMS_EXPENSE, debit: amount, credit: 0 },
          { accountRole: ACCOUNT_ROLES.CASH, debit: 0, credit: amount },
        ],
      });

      await logOperation(tx, {
        table: "ExpenseVoucher",
        recordId: voucher.id,
        action: "CREATE",
        eventType: EVENT_TYPES.POSTED,
        entityType: "EXPENSE",
        referenceNumber: voucher.number,
        message: `Expense ${voucher.number} posted`,
      });

      return voucher;
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to save expense");
  }
}

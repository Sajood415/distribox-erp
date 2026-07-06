import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";
import { postJournal } from "./posting-engine";
import { SOURCE_DOCUMENT_TYPES } from "../core/account-roles";
import { getAccountMappings } from "./account-mapping-service";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

const VOUCHER_PREFIX = {
  Opening: "OV",
  Payment: "PV",
  Receiving: "RV",
  Journal: "JV",
  BankPayment: "BP",
  BankReceiving: "BR",
};

export const VOUCHER_TYPES = [
  { value: "Opening", label: "Opening Voucher" },
  { value: "Payment", label: "Payment Voucher" },
  { value: "Receiving", label: "Receiving Voucher" },
  { value: "Journal", label: "Journal Voucher" },
  { value: "BankPayment", label: "Bank Payment Voucher" },
  { value: "BankReceiving", label: "Bank Receiving Voucher" },
];

async function nextVoucherNumber(tx, type) {
  const prefixCode = VOUCHER_PREFIX[type] || "JV";
  const year = new Date().getFullYear();
  const prefix = `${prefixCode}-${year}-`;
  const latest = await tx.voucher.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
  });
  const next = latest ? Number(latest.number.split("-").pop()) + 1 : 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

function normalizeLines(lines = []) {
  return lines
    .filter((line) => line.accountId && (Number(line.debit) > 0 || Number(line.credit) > 0))
    .map((line) => ({
      accountId: Number(line.accountId),
      debit: roundMoney(line.debit),
      credit: roundMoney(line.credit),
      narrative: line.narrative?.trim() || null,
    }));
}

function validateBalanced(lines) {
  const totalDebit = roundMoney(lines.reduce((sum, line) => sum + line.debit, 0));
  const totalCredit = roundMoney(lines.reduce((sum, line) => sum + line.credit, 0));
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Voucher is not balanced (Debit ${totalDebit} vs Credit ${totalCredit})`);
  }
  if (totalDebit === 0) {
    throw new Error("Voucher must have at least one debit and one credit line");
  }
  return totalDebit;
}

export async function getAccountingLookups() {
  const prisma = getCompanyPrisma();
  const accounts = await prisma.account.findMany({ orderBy: { code: "asc" } });
  const mappingsResult = await getAccountMappings();
  return success({
    accounts,
    mappings: mappingsResult.success ? mappingsResult.data.mappings : {},
  });
}

export async function listVouchers(payload = {}) {
  const prisma = getCompanyPrisma();
  const where = payload.type ? { type: payload.type } : {};
  const data = await prisma.voucher.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      journal: {
        include: {
          lines: { include: { account: true } },
        },
      },
    },
  });
  return success(data);
}

export async function saveVoucher(payload) {
  const prisma = getCompanyPrisma();
  const lines = normalizeLines(payload.lines);
  const type = payload.type || "Journal";

  if (!VOUCHER_PREFIX[type]) {
    return failure("Invalid voucher type");
  }
  if (lines.length < 2) {
    return failure("Add at least two ledger lines");
  }

  try {
    const amount = validateBalanced(lines);

    const result = await prisma.$transaction(async (tx) => {
      const number = payload.number || (await nextVoucherNumber(tx, type));
      const journal = await postJournal(tx, {
        referenceNumber: number,
        sourceDocumentType: SOURCE_DOCUMENT_TYPES.VOUCHER,
        sourceDocumentId: null,
        postingDate: payload.date,
        description: payload.description?.trim() || `${type} Voucher ${number}`,
        sourceType: type,
        lines,
      });

      const voucher = await tx.voucher.create({
        data: {
          number,
          type,
          date: new Date(payload.date),
          description: payload.description?.trim() || null,
          amount,
          journalId: journal.id,
        },
        include: {
          journal: {
            include: {
              lines: { include: { account: true } },
            },
          },
        },
      });

      return voucher;
    });

    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to save voucher");
  }
}

export async function buildQuickVoucherLines(payload) {
  const { type, amount, debitAccountId, creditAccountId } = payload;
  const value = roundMoney(amount);

  if (!value || value <= 0) {
    return failure("Amount must be greater than zero");
  }
  if (!debitAccountId || !creditAccountId) {
    return failure("Debit and credit accounts are required");
  }

  const lines = [
    { accountId: Number(debitAccountId), debit: value, credit: 0 },
    { accountId: Number(creditAccountId), debit: 0, credit: value },
  ];

  return success({ lines, amount: value, type });
}

import { roundMoney } from "../utils/money";
import { postJournalEntry } from "./accounting";

async function getAccountId(tx, code) {
  const account = await tx.account.findUnique({ where: { code } });
  if (!account) {
    throw new Error(`Account ${code} not found`);
  }
  return account.id;
}

export async function postStockAdjustmentJournal(tx, adjustment) {
  const inventoryId = await getAccountId(tx, "1300");
  const expenseId = await getAccountId(tx, "5100");
  const equityId = await getAccountId(tx, "3000");
  const value = Math.abs(adjustment.valueChange);

  if (value <= 0) {
    return null;
  }

  let lines = [];

  if (adjustment.type === "Opening") {
    lines = [
      { accountId: inventoryId, debit: value, credit: 0 },
      { accountId: equityId, debit: 0, credit: value },
    ];
  } else if (adjustment.quantityChange > 0) {
    lines = [
      { accountId: inventoryId, debit: value, credit: 0 },
      { accountId: expenseId, debit: 0, credit: value },
    ];
  } else {
    lines = [
      { accountId: expenseId, debit: value, credit: 0 },
      { accountId: inventoryId, debit: 0, credit: value },
    ];
  }

  return postJournalEntry(tx, {
    date: adjustment.date,
    description: `${adjustment.type} ${adjustment.number}`,
    reference: adjustment.number,
    lines,
  });
}

export function calcAdjustmentValue(quantityChange, costPerUnit) {
  return roundMoney(quantityChange * costPerUnit);
}

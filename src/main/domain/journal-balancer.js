import { roundMoney } from "../utils/money";

const BALANCE_TOLERANCE = 0.01;

export function sumDebits(lines) {
  return roundMoney(lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0));
}

export function sumCredits(lines) {
  return roundMoney(lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0));
}

export function assertBalanced(lines) {
  const totalDebit = sumDebits(lines);
  const totalCredit = sumCredits(lines);

  if (Math.abs(totalDebit - totalCredit) > BALANCE_TOLERANCE) {
    throw new Error(`Journal is not balanced (Debit ${totalDebit} vs Credit ${totalCredit})`);
  }

  if (totalDebit === 0) {
    throw new Error("Journal must have at least one debit and one credit line");
  }

  return { totalDebit, totalCredit };
}

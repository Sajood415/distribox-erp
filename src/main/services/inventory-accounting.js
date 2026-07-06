import { roundMoney } from "../utils/money";
import { ACCOUNT_ROLES, SOURCE_DOCUMENT_TYPES } from "../core/account-roles";
import { postJournal } from "./posting-engine";

export async function postStockAdjustmentJournal(tx, adjustment) {
  const value = Math.abs(adjustment.valueChange);

  if (value <= 0) {
    return null;
  }

  let lines = [];

  if (adjustment.type === "Opening") {
    lines = [
      { accountRole: ACCOUNT_ROLES.INVENTORY, debit: value, credit: 0 },
      { accountRole: ACCOUNT_ROLES.EQUITY, debit: 0, credit: value },
    ];
  } else if (adjustment.quantityChange > 0) {
    lines = [
      { accountRole: ACCOUNT_ROLES.INVENTORY, debit: value, credit: 0 },
      { accountRole: ACCOUNT_ROLES.INVENTORY_ADJUSTMENT, debit: 0, credit: value },
    ];
  } else {
    lines = [
      { accountRole: ACCOUNT_ROLES.INVENTORY_ADJUSTMENT, debit: value, credit: 0 },
      { accountRole: ACCOUNT_ROLES.INVENTORY, debit: 0, credit: value },
    ];
  }

  return postJournal(tx, {
    referenceNumber: adjustment.number,
    sourceDocumentType: SOURCE_DOCUMENT_TYPES.STOCK_ADJUSTMENT,
    sourceDocumentId: adjustment.id,
    postingDate: adjustment.date,
    description: `${adjustment.type} ${adjustment.number}`,
    lines,
  });
}

export function calcAdjustmentValue(quantityChange, costPerUnit) {
  return roundMoney(quantityChange * costPerUnit);
}

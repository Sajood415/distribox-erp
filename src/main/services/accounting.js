import { roundMoney } from "../utils/money";
import { ACCOUNT_ROLES, SOURCE_DOCUMENT_TYPES } from "../core/account-roles";
import { postJournal } from "./posting-engine";

function buildSalesRevenueLines(invoice) {
  const lines = [
    { accountRole: ACCOUNT_ROLES.SALES_REVENUE, debit: 0, credit: invoice.subtotal },
  ];

  if (invoice.taxTotal > 0) {
    lines.push({ accountRole: ACCOUNT_ROLES.TAX_PAYABLE, debit: 0, credit: invoice.taxTotal });
  }

  if (invoice.freight > 0) {
    lines.push({ accountRole: ACCOUNT_ROLES.FREIGHT_INCOME, debit: 0, credit: invoice.freight });
  }

  return lines;
}

export async function postPurchaseJournal(tx, invoice) {
  const inventoryAmount = roundMoney(invoice.subtotal + invoice.freight + invoice.taxTotal);
  const lines = [
    { accountRole: ACCOUNT_ROLES.INVENTORY, debit: inventoryAmount, credit: 0 },
  ];

  if (invoice.isCredit) {
    lines.push({ accountRole: ACCOUNT_ROLES.ACCOUNTS_PAYABLE, debit: 0, credit: invoice.total });
    if (invoice.paidAmount > 0) {
      lines.push({ accountRole: ACCOUNT_ROLES.ACCOUNTS_PAYABLE, debit: invoice.paidAmount, credit: 0 });
      lines.push({ accountRole: ACCOUNT_ROLES.CASH, debit: 0, credit: invoice.paidAmount });
    }
  } else {
    lines.push({ accountRole: ACCOUNT_ROLES.CASH, debit: 0, credit: invoice.total });
  }

  return postJournal(tx, {
    referenceNumber: invoice.number,
    sourceDocumentType: SOURCE_DOCUMENT_TYPES.PURCHASE_INVOICE,
    sourceDocumentId: invoice.id,
    postingDate: invoice.date,
    description: `Purchase Invoice ${invoice.number}`,
    lines,
  });
}

export async function postPurchaseReturnJournal(tx, purchaseReturn) {
  return postJournal(tx, {
    referenceNumber: purchaseReturn.number,
    sourceDocumentType: SOURCE_DOCUMENT_TYPES.PURCHASE_RETURN,
    sourceDocumentId: purchaseReturn.id,
    postingDate: purchaseReturn.date,
    description: `Purchase Return ${purchaseReturn.number}`,
    lines: [
      { accountRole: ACCOUNT_ROLES.ACCOUNTS_PAYABLE, debit: purchaseReturn.total, credit: 0 },
      { accountRole: ACCOUNT_ROLES.INVENTORY, debit: 0, credit: purchaseReturn.total },
    ],
  });
}

export async function postSalesJournal(tx, invoice) {
  const lines = [
    ...buildSalesRevenueLines(invoice),
    { accountRole: ACCOUNT_ROLES.COGS, debit: invoice.cogsTotal, credit: 0 },
    { accountRole: ACCOUNT_ROLES.INVENTORY, debit: 0, credit: invoice.cogsTotal },
  ];

  if (invoice.isCredit) {
    lines.unshift({ accountRole: ACCOUNT_ROLES.ACCOUNTS_RECEIVABLE, debit: invoice.total, credit: 0 });
    if (invoice.paidAmount > 0) {
      lines.push({ accountRole: ACCOUNT_ROLES.ACCOUNTS_RECEIVABLE, debit: 0, credit: invoice.paidAmount });
      lines.push({ accountRole: ACCOUNT_ROLES.CASH, debit: invoice.paidAmount, credit: 0 });
    }
  } else {
    lines.unshift({ accountRole: ACCOUNT_ROLES.CASH, debit: invoice.total, credit: 0 });
  }

  return postJournal(tx, {
    referenceNumber: invoice.number,
    sourceDocumentType: SOURCE_DOCUMENT_TYPES.SALES_INVOICE,
    sourceDocumentId: invoice.id,
    postingDate: invoice.date,
    description: `Sales Invoice ${invoice.number}`,
    lines,
  });
}

export async function postRecoveryJournal(tx, recovery) {
  const creditRole =
    recovery.paymentMode === "Bank" ? ACCOUNT_ROLES.BANK : ACCOUNT_ROLES.CASH;

  return postJournal(tx, {
    referenceNumber: recovery.number,
    sourceDocumentType: SOURCE_DOCUMENT_TYPES.RECOVERY,
    sourceDocumentId: recovery.id,
    postingDate: recovery.date,
    description: `Recovery ${recovery.number}`,
    lines: [
      { accountRole: creditRole, debit: recovery.amount, credit: 0 },
      { accountRole: ACCOUNT_ROLES.ACCOUNTS_RECEIVABLE, debit: 0, credit: recovery.amount },
    ],
  });
}

export async function postSalesReturnJournal(tx, salesReturn) {
  const cogsTotal = salesReturn.cogsTotal || 0;
  const lines = [
    { accountRole: ACCOUNT_ROLES.SALES_RETURN, debit: salesReturn.total, credit: 0 },
    { accountRole: ACCOUNT_ROLES.ACCOUNTS_RECEIVABLE, debit: 0, credit: salesReturn.total },
  ];

  if (cogsTotal > 0) {
    lines.push(
      { accountRole: ACCOUNT_ROLES.INVENTORY, debit: cogsTotal, credit: 0 },
      { accountRole: ACCOUNT_ROLES.COGS, debit: 0, credit: cogsTotal }
    );
  }

  return postJournal(tx, {
    referenceNumber: salesReturn.number,
    sourceDocumentType: SOURCE_DOCUMENT_TYPES.SALES_RETURN,
    sourceDocumentId: salesReturn.id,
    postingDate: salesReturn.date,
    description: `Sales Return ${salesReturn.number}`,
    lines,
  });
}

export async function postClaimWriteOffJournal(tx, claim) {
  const writeOffValue = claim.cogsTotal || claim.total;

  return postJournal(tx, {
    referenceNumber: claim.number,
    sourceDocumentType: SOURCE_DOCUMENT_TYPES.CLAIM,
    sourceDocumentId: claim.id,
    postingDate: claim.date,
    description: `Claim Write-off ${claim.number}`,
    lines: [
      { accountRole: ACCOUNT_ROLES.CLAIMS_EXPENSE, debit: writeOffValue, credit: 0 },
      { accountRole: ACCOUNT_ROLES.INVENTORY, debit: 0, credit: writeOffValue },
    ],
  });
}

export { postJournal as postJournalEntry };

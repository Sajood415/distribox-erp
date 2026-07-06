import { roundMoney } from "../utils/money";
import { SOURCE_DOCUMENT_TYPES } from "../core/account-roles";
import { LEDGER_DOCUMENT_TYPES, getDocumentRoute } from "./ledger-shared";

export async function buildCustomerLedgerRows(tx, customerId) {
  const customer = await tx.customer.findUnique({ where: { id: customerId } });
  if (!customer) return [];

  const rows = [
    {
      sortDate: new Date("1900-01-01"),
      date: null,
      documentType: LEDGER_DOCUMENT_TYPES.OPENING_BALANCE,
      reference: "OPENING",
      description: "Opening Balance",
      debit: roundMoney(customer.openingBalance || 0),
      credit: 0,
      documentId: customer.id,
      route: null,
    },
  ];

  const invoices = await tx.salesInvoice.findMany({
    where: { customerId, isCredit: true },
    orderBy: { date: "asc" },
  });

  for (const invoice of invoices) {
    rows.push({
      sortDate: new Date(invoice.date),
      date: invoice.date,
      documentType: SOURCE_DOCUMENT_TYPES.SALES_INVOICE,
      reference: invoice.number,
      description: `Sales Invoice ${invoice.number}`,
      debit: roundMoney(invoice.total),
      credit: 0,
      documentId: invoice.id,
      route: getDocumentRoute(SOURCE_DOCUMENT_TYPES.SALES_INVOICE, invoice.id),
    });
  }

  const recoveries = await tx.recoveryVoucher.findMany({
    where: { customerId },
    orderBy: { date: "asc" },
  });

  for (const recovery of recoveries) {
    rows.push({
      sortDate: new Date(recovery.date),
      date: recovery.date,
      documentType: SOURCE_DOCUMENT_TYPES.RECOVERY,
      reference: recovery.number,
      description: `Recovery ${recovery.number}`,
      debit: 0,
      credit: roundMoney(recovery.amount),
      documentId: recovery.id,
      route: getDocumentRoute(SOURCE_DOCUMENT_TYPES.RECOVERY, recovery.id),
    });
  }

  const returns = await tx.salesReturn.findMany({
    where: { customerId },
    orderBy: { date: "asc" },
  });

  for (const salesReturn of returns) {
    rows.push({
      sortDate: new Date(salesReturn.date),
      date: salesReturn.date,
      documentType: SOURCE_DOCUMENT_TYPES.SALES_RETURN,
      reference: salesReturn.number,
      description: `Sales Return ${salesReturn.number}`,
      debit: 0,
      credit: roundMoney(salesReturn.total),
      documentId: salesReturn.id,
      route: getDocumentRoute(SOURCE_DOCUMENT_TYPES.SALES_RETURN, salesReturn.id),
    });
  }

  return rows.sort((a, b) => a.sortDate - b.sortDate);
}

import { roundMoney } from "../utils/money";
import { SOURCE_DOCUMENT_TYPES } from "../core/account-roles";
import { LEDGER_DOCUMENT_TYPES, getDocumentRoute } from "./ledger-shared";

export async function buildVendorLedgerRows(tx, vendorId) {
  const vendor = await tx.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return [];

  const rows = [
    {
      sortDate: new Date("1900-01-01"),
      date: null,
      documentType: LEDGER_DOCUMENT_TYPES.OPENING_BALANCE,
      reference: "OPENING",
      description: "Opening Balance",
      debit: 0,
      credit: roundMoney(vendor.openingBalance || 0),
      documentId: vendor.id,
      route: null,
    },
  ];

  const invoices = await tx.purchaseInvoice.findMany({
    where: { vendorId, isCredit: true },
    orderBy: { date: "asc" },
  });

  const paymentItems = await tx.vendorPaymentItem.findMany({
    where: { purchaseInvoice: { vendorId } },
    include: { vendorPaymentVoucher: true },
  });

  const voucherPaidByInvoice = new Map();
  for (const item of paymentItems) {
    const current = voucherPaidByInvoice.get(item.purchaseInvoiceId) || 0;
    voucherPaidByInvoice.set(item.purchaseInvoiceId, roundMoney(current + item.amount));
  }

  for (const invoice of invoices) {
    rows.push({
      sortDate: new Date(invoice.date),
      date: invoice.date,
      documentType: SOURCE_DOCUMENT_TYPES.PURCHASE_INVOICE,
      reference: invoice.number,
      description: `Purchase Invoice ${invoice.number}`,
      debit: 0,
      credit: roundMoney(invoice.total),
      documentId: invoice.id,
      route: getDocumentRoute(SOURCE_DOCUMENT_TYPES.PURCHASE_INVOICE, invoice.id),
    });

    const voucherPaid = voucherPaidByInvoice.get(invoice.id) || 0;
    const initialPaid = roundMoney(invoice.paidAmount - voucherPaid);
    if (initialPaid > 0) {
      rows.push({
        sortDate: new Date(invoice.date),
        date: invoice.date,
        documentType: SOURCE_DOCUMENT_TYPES.VENDOR_PAYMENT,
        reference: `${invoice.number}-PAID`,
        description: `Payment on ${invoice.number}`,
        debit: initialPaid,
        credit: 0,
        documentId: invoice.id,
        route: getDocumentRoute(SOURCE_DOCUMENT_TYPES.PURCHASE_INVOICE, invoice.id),
      });
    }
  }

  const payments = await tx.vendorPaymentVoucher.findMany({
    where: { vendorId },
    orderBy: { date: "asc" },
  });

  for (const payment of payments) {
    rows.push({
      sortDate: new Date(payment.date),
      date: payment.date,
      documentType: SOURCE_DOCUMENT_TYPES.VENDOR_PAYMENT,
      reference: payment.number,
      description: `Vendor Payment ${payment.number}`,
      debit: roundMoney(payment.amount),
      credit: 0,
      documentId: payment.id,
      route: getDocumentRoute(SOURCE_DOCUMENT_TYPES.VENDOR_PAYMENT, payment.id),
    });
  }

  const returns = await tx.purchaseReturn.findMany({
    where: { vendorId },
    orderBy: { date: "asc" },
  });

  for (const purchaseReturn of returns) {
    rows.push({
      sortDate: new Date(purchaseReturn.date),
      date: purchaseReturn.date,
      documentType: SOURCE_DOCUMENT_TYPES.PURCHASE_RETURN,
      reference: purchaseReturn.number,
      description: `Purchase Return ${purchaseReturn.number}`,
      debit: roundMoney(purchaseReturn.total),
      credit: 0,
      documentId: purchaseReturn.id,
      route: getDocumentRoute(SOURCE_DOCUMENT_TYPES.PURCHASE_RETURN, purchaseReturn.id),
    });
  }

  return rows.sort((a, b) => a.sortDate - b.sortDate);
}

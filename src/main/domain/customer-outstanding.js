import { roundMoney } from "../utils/money";

export async function sumSalesReturns(tx, customerId, options = {}) {
  const where = { customerId };

  if (options.unlinkedOnly) {
    where.salesInvoiceId = null;
  } else if (options.salesInvoiceId != null) {
    where.salesInvoiceId = options.salesInvoiceId;
  }

  const returns = await tx.salesReturn.findMany({
    where,
    select: { total: true },
  });

  return roundMoney(returns.reduce((sum, row) => sum + row.total, 0));
}

/**
 * Sacred formula: Opening + Sales - Recovery - Sales Returns = Outstanding
 */
export async function getCustomerOutstanding(tx, customerId) {
  const customer = await tx.customer.findUnique({ where: { id: customerId } });
  const invoices = await tx.salesInvoice.findMany({
    where: { customerId, isCredit: true },
    select: { total: true, paidAmount: true },
  });

  const sales = roundMoney(invoices.reduce((sum, inv) => sum + inv.total, 0));
  const recovery = roundMoney(invoices.reduce((sum, inv) => sum + inv.paidAmount, 0));
  const salesReturns = await sumSalesReturns(tx, customerId);
  const opening = customer?.openingBalance || 0;

  return roundMoney(opening + sales - recovery - salesReturns);
}

export async function getInvoiceOutstanding(tx, invoice) {
  const returns = await sumSalesReturns(tx, invoice.customerId, { salesInvoiceId: invoice.id });
  return roundMoney(invoice.total - invoice.paidAmount - returns);
}

export async function buildCustomerOutstandingBreakdown(tx, customerId) {
  const customer = await tx.customer.findUnique({ where: { id: customerId } });
  const invoices = await tx.salesInvoice.findMany({
    where: { customerId, isCredit: true },
    select: { total: true, paidAmount: true },
  });

  const sales = roundMoney(invoices.reduce((sum, inv) => sum + inv.total, 0));
  const recovery = roundMoney(invoices.reduce((sum, inv) => sum + inv.paidAmount, 0));
  const salesReturns = await sumSalesReturns(tx, customerId);
  const opening = customer?.openingBalance || 0;
  const outstanding = roundMoney(opening + sales - recovery - salesReturns);

  return { opening, sales, recovery, salesReturns, outstanding };
}

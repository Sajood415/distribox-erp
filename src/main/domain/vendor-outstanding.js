import { roundMoney } from "../utils/money";

export async function sumPurchaseReturns(tx, vendorId, options = {}) {
  const where = { vendorId };
  if (options.purchaseInvoiceId != null) {
    where.purchaseInvoiceId = options.purchaseInvoiceId;
  }

  const returns = await tx.purchaseReturn.findMany({
    where,
    select: { total: true },
  });

  return roundMoney(returns.reduce((sum, row) => sum + row.total, 0));
}

/**
 * Opening + Purchases - Payments - Purchase Returns = Supplier Outstanding
 */
export async function getVendorOutstanding(tx, vendorId) {
  const vendor = await tx.vendor.findUnique({ where: { id: vendorId } });
  const invoices = await tx.purchaseInvoice.findMany({
    where: { vendorId, isCredit: true },
    select: { total: true, paidAmount: true },
  });

  const purchases = roundMoney(invoices.reduce((sum, inv) => sum + inv.total, 0));
  const payments = roundMoney(invoices.reduce((sum, inv) => sum + inv.paidAmount, 0));
  const purchaseReturns = await sumPurchaseReturns(tx, vendorId);
  const opening = vendor?.openingBalance || 0;

  return roundMoney(opening + purchases - payments - purchaseReturns);
}

export async function getPurchaseInvoiceOutstanding(tx, invoice) {
  const linkedReturns = await tx.purchaseReturn.findMany({
    where: { vendorId: invoice.vendorId, purchaseInvoiceId: invoice.id },
    select: { total: true },
  });
  const returnTotal = roundMoney(linkedReturns.reduce((sum, row) => sum + row.total, 0));
  return roundMoney(invoice.total - invoice.paidAmount - returnTotal);
}

export async function buildVendorOutstandingBreakdown(tx, vendorId) {
  const vendor = await tx.vendor.findUnique({ where: { id: vendorId } });
  const invoices = await tx.purchaseInvoice.findMany({
    where: { vendorId, isCredit: true },
    select: { total: true, paidAmount: true },
  });

  const purchases = roundMoney(invoices.reduce((sum, inv) => sum + inv.total, 0));
  const payments = roundMoney(invoices.reduce((sum, inv) => sum + inv.paidAmount, 0));
  const purchaseReturns = await sumPurchaseReturns(tx, vendorId);
  const opening = vendor?.openingBalance || 0;
  const outstanding = roundMoney(opening + purchases - payments - purchaseReturns);

  return { opening, purchases, payments, purchaseReturns, outstanding };
}

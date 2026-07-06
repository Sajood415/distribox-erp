import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";
import { postVendorPaymentJournal } from "./accounting";
import { getPurchaseInvoiceOutstanding } from "../domain/vendor-outstanding";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

async function nextPaymentNumber(tx) {
  const year = new Date().getFullYear();
  const prefix = `VP-${year}-`;
  const latest = await tx.vendorPaymentVoucher.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
  });
  const next = latest ? Number(latest.number.split("-").pop()) + 1 : 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

export async function getVendorOutstandingInvoices(vendorId) {
  const prisma = getCompanyPrisma();
  const invoices = await prisma.purchaseInvoice.findMany({
    where: { vendorId: Number(vendorId), isCredit: true },
    orderBy: { date: "asc" },
  });

  const data = [];
  for (const invoice of invoices) {
    const outstanding = await getPurchaseInvoiceOutstanding(prisma, invoice);
    if (outstanding > 0) {
      data.push({
        id: invoice.id,
        number: invoice.number,
        date: invoice.date,
        total: invoice.total,
        paidAmount: invoice.paidAmount,
        outstanding,
      });
    }
  }

  return success(data);
}

export async function listVendorPayments() {
  const prisma = getCompanyPrisma();
  const data = await prisma.vendorPaymentVoucher.findMany({
    orderBy: { date: "desc" },
    include: {
      vendor: true,
      items: { include: { purchaseInvoice: true } },
    },
  });
  return success(data);
}

export async function saveVendorPayment(payload) {
  const prisma = getCompanyPrisma();
  const items = (payload.items || []).filter(
    (item) => item.purchaseInvoiceId && Number(item.amount) > 0
  );

  if (!payload.vendorId) {
    return failure("Vendor is required");
  }

  const amount = roundMoney(items.reduce((sum, item) => sum + Number(item.amount), 0));
  if (amount <= 0) {
    return failure("Payment amount must be greater than zero");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const paymentItems = [];

      for (const item of items) {
        const invoice = await tx.purchaseInvoice.findUnique({
          where: { id: Number(item.purchaseInvoiceId) },
        });
        if (!invoice) {
          throw new Error("Purchase invoice not found");
        }
        const outstanding = await getPurchaseInvoiceOutstanding(tx, invoice);
        const applyAmount = roundMoney(item.amount);
        if (applyAmount > outstanding) {
          throw new Error(`Amount exceeds outstanding for ${invoice.number}`);
        }
        await tx.purchaseInvoice.update({
          where: { id: invoice.id },
          data: { paidAmount: roundMoney(invoice.paidAmount + applyAmount) },
        });
        paymentItems.push({
          purchaseInvoiceId: invoice.id,
          amount: applyAmount,
        });
      }

      const payment = await tx.vendorPaymentVoucher.create({
        data: {
          number: payload.number || (await nextPaymentNumber(tx)),
          date: new Date(payload.date),
          vendorId: Number(payload.vendorId),
          paymentMode: payload.paymentMode || "Cash",
          amount,
          remarks: payload.remarks?.trim() || null,
          items: { create: paymentItems },
        },
        include: { items: true },
      });

      await postVendorPaymentJournal(tx, payment);
      return payment;
    });

    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to save vendor payment");
  }
}

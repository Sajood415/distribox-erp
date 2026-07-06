import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";
import { postRecoveryJournal } from "./accounting";
import { getInvoiceOutstanding } from "../domain/customer-outstanding";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

async function nextRecoveryNumber(tx) {
  const year = new Date().getFullYear();
  const prefix = `RV-${year}-`;
  const latest = await tx.recoveryVoucher.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
  });
  const next = latest ? Number(latest.number.split("-").pop()) + 1 : 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

export async function getCustomerOutstandingInvoices(customerId) {
  const prisma = getCompanyPrisma();
  const invoices = await prisma.salesInvoice.findMany({
    where: {
      customerId: Number(customerId),
      isCredit: true,
    },
    orderBy: { date: "asc" },
  });

  const data = [];
  for (const invoice of invoices) {
    const outstanding = await getInvoiceOutstanding(prisma, invoice);
    if (outstanding > 0) {
      data.push({
        id: invoice.id,
        number: invoice.number,
        date: invoice.date,
        dueDate: invoice.dueDate,
        total: invoice.total,
        paidAmount: invoice.paidAmount,
        outstanding,
      });
    }
  }

  return success(data);
}

export async function listRecoveries() {
  const prisma = getCompanyPrisma();
  const data = await prisma.recoveryVoucher.findMany({
    orderBy: { date: "desc" },
    include: {
      customer: true,
      salesman: true,
      items: { include: { salesInvoice: true } },
    },
  });
  return success(data);
}

export async function saveRecovery(payload) {
  const prisma = getCompanyPrisma();
  const items = (payload.items || []).filter((item) => item.salesInvoiceId && Number(item.amount) > 0);

  if (!payload.customerId) {
    return failure("Customer is required");
  }

  const amount = roundMoney(
    items.length > 0
      ? items.reduce((sum, item) => sum + Number(item.amount), 0)
      : payload.amount
  );

  if (amount <= 0) {
    return failure("Recovery amount must be greater than zero");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const recoveryItems = [];

      if (items.length > 0) {
        for (const item of items) {
          const invoice = await tx.salesInvoice.findUnique({
            where: { id: Number(item.salesInvoiceId) },
          });
          if (!invoice) {
            throw new Error("Invoice not found");
          }
          const outstanding = await getInvoiceOutstanding(tx, invoice);
          const applyAmount = roundMoney(item.amount);
          if (applyAmount > outstanding) {
            throw new Error(`Amount exceeds outstanding for ${invoice.number}`);
          }
          await tx.salesInvoice.update({
            where: { id: invoice.id },
            data: { paidAmount: roundMoney(invoice.paidAmount + applyAmount) },
          });
          recoveryItems.push({
            salesInvoiceId: invoice.id,
            amount: applyAmount,
          });
        }
      }

      const recovery = await tx.recoveryVoucher.create({
        data: {
          number: payload.number || (await nextRecoveryNumber(tx)),
          date: new Date(payload.date),
          customerId: Number(payload.customerId),
          salesmanId: payload.salesmanId ? Number(payload.salesmanId) : null,
          deliveryManId: payload.deliveryManId ? Number(payload.deliveryManId) : null,
          paymentMode: payload.paymentMode || "Cash",
          amount,
          remarks: payload.remarks?.trim() || null,
          items: {
            create: recoveryItems,
          },
        },
        include: { items: true },
      });

      await postRecoveryJournal(tx, recovery);
      return recovery;
    });

    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to save recovery");
  }
}

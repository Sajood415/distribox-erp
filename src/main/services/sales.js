import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";
import { issueStockFIFO } from "./stock";
import { postSalesJournal } from "./accounting";
import { getSettingValue } from "./settings-service";
import { SETTING_KEYS, CREDIT_LIMIT_POLICIES } from "../core/settings-keys";
import {
  getCustomerOutstanding,
  getInvoiceOutstanding,
  buildCustomerOutstandingBreakdown,
  normalizeSaleItems,
} from "./quotation";

function success(data) {
  return { success: true, data };
}

function failure(error, extra = {}) {
  return { success: false, error, ...extra };
}

async function nextSalesNumber(tx) {
  const year = new Date().getFullYear();
  const prefix = `SI-${year}-`;
  const latest = await tx.salesInvoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
  });
  const next = latest ? Number(latest.number.split("-").pop()) + 1 : 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

export async function listSalesInvoices() {
  const prisma = getCompanyPrisma();
  const data = await prisma.salesInvoice.findMany({
    orderBy: { date: "desc" },
    include: {
      customer: true,
      warehouse: true,
      salesman: true,
      deliveryMan: true,
      items: { include: { product: true } },
    },
  });

  const rows = [];
  for (const invoice of data) {
    const outstanding = invoice.isCredit
      ? await getInvoiceOutstanding(prisma, invoice)
      : 0;
    rows.push({ ...invoice, outstanding });
  }

  return success(rows);
}

export async function listPendingDeliveries() {
  const prisma = getCompanyPrisma();
  const data = await prisma.salesInvoice.findMany({
    where: { loadSlipId: null, status: "Posted" },
    orderBy: { date: "desc" },
    include: { customer: true, salesman: true },
  });
  return success(data);
}

export async function saveSalesInvoice(payload) {
  const prisma = getCompanyPrisma();
  const items = normalizeSaleItems(payload.items);

  if (!payload.customerId) {
    return failure("Customer is required");
  }
  if (!payload.warehouseId) {
    return failure("Warehouse is required");
  }
  if (items.length === 0) {
    return failure("Add at least one product line");
  }

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.net, 0));
  const taxTotal = roundMoney(items.reduce((sum, item) => sum + item.vat, 0));
  const freight = roundMoney(payload.freight);
  const total = roundMoney(subtotal + taxTotal + freight);
  const paidAmount = roundMoney(payload.paidAmount);

  if (paidAmount > total) {
    return failure("Paid amount cannot exceed invoice total");
  }

  const customer = await prisma.customer.findUnique({
    where: { id: Number(payload.customerId) },
  });
  if (!customer) {
    return failure("Customer not found");
  }

  if (payload.isCredit && customer.creditLimit > 0) {
    const outstanding = await getCustomerOutstanding(prisma, customer.id);
    if (outstanding + total > customer.creditLimit) {
      const policy = (await getSettingValue(SETTING_KEYS.CREDIT_LIMIT_POLICY)) || CREDIT_LIMIT_POLICIES.BLOCK;
      if (policy === CREDIT_LIMIT_POLICIES.BLOCK) {
        return failure("Customer credit limit exceeded");
      }
      if (!payload.confirmCreditOverride) {
        return failure("Customer credit limit exceeded. Confirm to proceed.", {
          requiresConfirmation: true,
          code: "CREDIT_LIMIT_WARN",
        });
      }
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let cogsTotal = 0;
      const itemRecords = [];

      for (const item of items) {
        const stockQty = item.quantity + item.freeQuantity;
        const { totalCost, allocations } = await issueStockFIFO(tx, {
          productId: item.productId,
          warehouseId: Number(payload.warehouseId),
          quantity: stockQty,
        });
        cogsTotal += totalCost;
        itemRecords.push({
          ...item,
          batchNo: allocations[0]?.batchNo || null,
          costAmount: totalCost,
        });
      }

      const dueDate = payload.isCredit
        ? new Date(
            Date.now() + (customer.creditDays || 0) * 24 * 60 * 60 * 1000
          )
        : null;

      const number = payload.number || (await nextSalesNumber(tx));
      const invoice = await tx.salesInvoice.create({
        data: {
          number,
          date: new Date(payload.date),
          customerId: Number(payload.customerId),
          warehouseId: Number(payload.warehouseId),
          salesmanId: payload.salesmanId ? Number(payload.salesmanId) : customer.salesmanId,
          deliveryManId: payload.deliveryManId ? Number(payload.deliveryManId) : null,
          quotationId: payload.quotationId ? Number(payload.quotationId) : null,
          isCredit: Boolean(payload.isCredit),
          dueDate,
          freight,
          taxTotal,
          subtotal,
          total,
          paidAmount,
          cogsTotal: roundMoney(cogsTotal),
          remarks: payload.remarks?.trim() || null,
          items: {
            create: itemRecords.map((item) => ({
              productId: item.productId,
              unitId: item.unitId,
              batchNo: item.batchNo,
              quantity: item.quantity,
              freeQuantity: item.freeQuantity,
              price: item.price,
              discount: item.discount,
              vatPercent: item.vatPercent,
              lineTotal: item.lineTotal,
              costAmount: item.costAmount,
            })),
          },
        },
        include: { items: true },
      });

      if (payload.quotationId) {
        await tx.quotation.update({
          where: { id: Number(payload.quotationId) },
          data: { status: "Converted" },
        });
      }

      await postSalesJournal(tx, invoice);
      return invoice;
    });

    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to save sales invoice");
  }
}

export async function getCustomerOutstandingSummary(payload) {
  const customerId = payload?.customerId ?? payload;
  const prisma = getCompanyPrisma();
  const breakdown = await buildCustomerOutstandingBreakdown(prisma, Number(customerId));
  return success(breakdown);
}

export async function convertQuotationToInvoice(quotationId) {
  const prisma = getCompanyPrisma();
  const quotation = await prisma.quotation.findUnique({
    where: { id: Number(quotationId) },
    include: { items: true },
  });

  if (!quotation) {
    return failure("Quotation not found");
  }
  if (quotation.status === "Converted") {
    return failure("Quotation already converted");
  }

  const warehouse = await prisma.warehouse.findFirst({ orderBy: { id: "asc" } });
  if (!warehouse) {
    return failure("Create a warehouse before converting quotation");
  }

  return saveSalesInvoice({
    date: new Date().toISOString().slice(0, 10),
    customerId: quotation.customerId,
    warehouseId: warehouse.id,
    salesmanId: quotation.salesmanId,
    quotationId: quotation.id,
    isCredit: true,
    freight: 0,
    paidAmount: 0,
    remarks: `Converted from ${quotation.number}`,
    items: quotation.items.map((item) => ({
      productId: item.productId,
      unitId: item.unitId,
      quantity: item.quantity,
      freeQuantity: 0,
      price: item.price,
      discount: item.discount,
      vatPercent: item.vatPercent,
    })),
  });
}

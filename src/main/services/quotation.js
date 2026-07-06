import { getCompanyPrisma } from "../db/init";
import { calcLineNet, calcLineVat, roundMoney } from "../utils/money";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

export { getCustomerOutstanding, getInvoiceOutstanding } from "../domain/customer-outstanding";
export { buildCustomerOutstandingBreakdown } from "../domain/customer-outstanding";

export function normalizeSaleItems(items = []) {
  return items
    .filter((item) => item.productId && Number(item.quantity) > 0)
    .map((item) => {
      const net = calcLineNet(item);
      const vat = calcLineVat(net, item.vatPercent);
      const lineTotal = roundMoney(net + vat);
      return {
        productId: Number(item.productId),
        unitId: Number(item.unitId),
        batchNo: item.batchNo?.trim() || null,
        quantity: Number(item.quantity),
        freeQuantity: Number(item.freeQuantity) || 0,
        price: Number(item.price) || 0,
        discount: Number(item.discount) || 0,
        vatPercent: Number(item.vatPercent) || 0,
        lineTotal,
        net,
        vat,
      };
    });
}

async function nextNumber(tx, model, prefixCode) {
  const year = new Date().getFullYear();
  const prefix = `${prefixCode}-${year}-`;
  const latest = await tx[model].findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
  });
  const next = latest ? Number(latest.number.split("-").pop()) + 1 : 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

export async function getSalesLookups() {
  const prisma = getCompanyPrisma();
  const [customers, products, warehouses, units, salesmen, deliveryMen] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" }, include: { salesman: true } }),
    prisma.product.findMany({
      where: { active: true },
      include: { baseUnit: true },
      orderBy: { name: "asc" },
    }),
    prisma.warehouse.findMany({ orderBy: { name: "asc" } }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
    prisma.salesman.findMany({ orderBy: { name: "asc" } }),
    prisma.deliveryMan.findMany({ orderBy: { name: "asc" } }),
  ]);
  return success({ customers, products, warehouses, units, salesmen, deliveryMen });
}

export async function listQuotations() {
  const prisma = getCompanyPrisma();
  const data = await prisma.quotation.findMany({
    orderBy: { date: "desc" },
    include: { customer: true, salesman: true, items: { include: { product: true } } },
  });
  return success(data);
}

export async function saveQuotation(payload) {
  const prisma = getCompanyPrisma();
  const items = normalizeSaleItems(payload.items);

  if (!payload.customerId) {
    return failure("Customer is required");
  }
  if (items.length === 0) {
    return failure("Add at least one line");
  }

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.net, 0));
  const taxTotal = roundMoney(items.reduce((sum, item) => sum + item.vat, 0));
  const total = roundMoney(subtotal + taxTotal);

  try {
    const quotation = await prisma.quotation.create({
      data: {
        number: payload.number || (await nextNumber(prisma, "quotation", "QT")),
        date: new Date(payload.date),
        validUntil: new Date(payload.validUntil),
        customerId: Number(payload.customerId),
        salesmanId: payload.salesmanId ? Number(payload.salesmanId) : null,
        subtotal,
        taxTotal,
        total,
        remarks: payload.remarks?.trim() || null,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            unitId: item.unitId,
            quantity: item.quantity,
            price: item.price,
            discount: item.discount,
            vatPercent: item.vatPercent,
            lineTotal: item.lineTotal,
          })),
        },
      },
    });
    return success(quotation);
  } catch (error) {
    return failure(error.message || "Failed to save quotation");
  }
}

import { getCompanyPrisma } from "../db/init";
import { calcLineNet, calcLineVat, roundMoney } from "../utils/money";
import { increaseStock } from "./stock";
import { postPurchaseJournal } from "./accounting";
import { getPurchaseInvoiceOutstanding } from "../domain/vendor-outstanding";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

function normalizeItems(items = []) {
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
        expiryDate: item.expiryDate || null,
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

async function nextInvoiceNumber(tx) {
  const year = new Date().getFullYear();
  const prefix = `PI-${year}-`;
  const latest = await tx.purchaseInvoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
  });

  const next = latest ? Number(latest.number.split("-").pop()) + 1 : 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

export async function getPurchaseLookups() {
  const prisma = getCompanyPrisma();
  const [vendors, products, warehouses, units] = await Promise.all([
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { active: true },
      include: { baseUnit: true },
      orderBy: { name: "asc" },
    }),
    prisma.warehouse.findMany({ orderBy: { name: "asc" } }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
  ]);
  return success({ vendors, products, warehouses, units });
}

export async function listPurchaseInvoices() {
  const prisma = getCompanyPrisma();
  const data = await prisma.purchaseInvoice.findMany({
    orderBy: { date: "desc" },
    include: {
      vendor: true,
      warehouse: true,
      items: { include: { product: true } },
    },
  });

  const rows = [];
  for (const invoice of data) {
    const outstanding = invoice.isCredit
      ? await getPurchaseInvoiceOutstanding(prisma, invoice)
      : 0;
    rows.push({ ...invoice, outstanding });
  }
  return success(rows);
}

export async function getPurchaseInvoice(id) {
  const prisma = getCompanyPrisma();
  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id: Number(id) },
    include: {
      vendor: true,
      warehouse: true,
      items: { include: { product: true, unit: true } },
    },
  });
  if (!invoice) {
    return failure("Purchase invoice not found");
  }
  return success(invoice);
}

export async function savePurchaseInvoice(payload) {
  const prisma = getCompanyPrisma();
  const items = normalizeItems(payload.items);

  if (!payload.vendorId) {
    return failure("Vendor is required");
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

  try {
    const result = await prisma.$transaction(async (tx) => {
      const number = payload.number || (await nextInvoiceNumber(tx));
      const invoice = await tx.purchaseInvoice.create({
        data: {
          number,
          date: new Date(payload.date),
          vendorId: Number(payload.vendorId),
          warehouseId: Number(payload.warehouseId),
          isCredit: Boolean(payload.isCredit),
          freight,
          taxTotal,
          subtotal,
          total,
          paidAmount,
          remarks: payload.remarks?.trim() || null,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              unitId: item.unitId,
              batchNo: item.batchNo,
              expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
              quantity: item.quantity,
              freeQuantity: item.freeQuantity,
              price: item.price,
              discount: item.discount,
              vatPercent: item.vatPercent,
              lineTotal: item.lineTotal,
            })),
          },
        },
        include: { items: true },
      });

      for (const item of items) {
        const stockQty = item.quantity + item.freeQuantity;
        await increaseStock(tx, {
          productId: item.productId,
          warehouseId: invoice.warehouseId,
          batchNo: item.batchNo,
          expiryDate: item.expiryDate,
          quantity: stockQty,
          costPerUnit: item.price,
        });

        await tx.product.update({
          where: { id: item.productId },
          data: { costPrice: item.price },
        });
      }

      await postPurchaseJournal(tx, invoice);
      return invoice;
    });

    return success(result);
  } catch (error) {
    if (error.code === "P2002") {
      return failure("Invoice number already exists");
    }
    return failure(error.message || "Failed to save purchase invoice");
  }
}

export async function previewPurchaseTotals(payload) {
  const items = normalizeItems(payload.items);
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.net, 0));
  const taxTotal = roundMoney(items.reduce((sum, item) => sum + item.vat, 0));
  const freight = roundMoney(payload.freight);
  const total = roundMoney(subtotal + taxTotal + freight);
  const paidAmount = roundMoney(payload.paidAmount);
  return success({
    subtotal,
    taxTotal,
    freight,
    total,
    paidAmount,
    outstanding: roundMoney(total - paidAmount),
    items,
  });
}

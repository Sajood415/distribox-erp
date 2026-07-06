import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";
import { increaseStock } from "./stock";
import { postSalesReturnJournal } from "./accounting";
import { normalizeSaleItems } from "./quotation";
import { recordStockMovement } from "../domain/stock-movement-recorder";
import { STOCK_MOVEMENT_TYPES } from "../core/stock-movement-types";
import { SOURCE_DOCUMENT_TYPES } from "../core/account-roles";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

async function nextReturnNumber(tx) {
  const year = new Date().getFullYear();
  const prefix = `SR-${year}-`;
  const latest = await tx.salesReturn.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
  });
  const next = latest ? Number(latest.number.split("-").pop()) + 1 : 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

async function resolveLineCost(tx, { productId, salesInvoiceId, quantity }) {
  if (salesInvoiceId) {
    const invoiceItem = await tx.salesItem.findFirst({
      where: {
        salesInvoiceId,
        productId,
        quantity: { gte: quantity },
      },
      orderBy: { id: "desc" },
    });
    if (invoiceItem?.costAmount) {
      const unitCost = invoiceItem.costAmount / invoiceItem.quantity;
      return roundMoney(unitCost * quantity);
    }
  }

  const product = await tx.product.findUnique({ where: { id: productId } });
  return roundMoney((product?.costPrice || 0) * quantity);
}

export async function listSalesReturns() {
  const prisma = getCompanyPrisma();
  const data = await prisma.salesReturn.findMany({
    orderBy: { date: "desc" },
    include: {
      customer: true,
      warehouse: true,
      salesInvoice: true,
      items: { include: { product: true } },
    },
  });
  return success(data);
}

export async function getSalesInvoiceForReturn(invoiceId) {
  const prisma = getCompanyPrisma();
  const invoice = await prisma.salesInvoice.findUnique({
    where: { id: Number(invoiceId) },
    include: {
      customer: true,
      warehouse: true,
      items: { include: { product: { include: { baseUnit: true } } } },
    },
  });
  if (!invoice) {
    return failure("Sales invoice not found");
  }
  return success(invoice);
}

export async function saveSalesReturn(payload) {
  const prisma = getCompanyPrisma();
  const items = normalizeSaleItems(payload.items);

  if (!payload.customerId) {
    return failure("Customer is required");
  }
  if (!payload.warehouseId) {
    return failure("Warehouse is required");
  }
  if (items.length === 0) {
    return failure("Add at least one return line");
  }

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.net, 0));
  const taxTotal = roundMoney(items.reduce((sum, item) => sum + item.vat, 0));
  const total = roundMoney(subtotal + taxTotal);
  const salesInvoiceId = payload.salesInvoiceId ? Number(payload.salesInvoiceId) : null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      let cogsTotal = 0;
      const enrichedItems = [];

      for (const item of items) {
        const costAmount = await resolveLineCost(tx, {
          productId: item.productId,
          salesInvoiceId,
          quantity: item.quantity,
        });
        cogsTotal = roundMoney(cogsTotal + costAmount);
        enrichedItems.push({ ...item, costAmount });
      }

      const number = payload.number || (await nextReturnNumber(tx));
      const salesReturn = await tx.salesReturn.create({
        data: {
          number,
          date: new Date(payload.date),
          customerId: Number(payload.customerId),
          warehouseId: Number(payload.warehouseId),
          salesInvoiceId,
          claimId: payload.claimId ? Number(payload.claimId) : null,
          subtotal,
          taxTotal,
          total,
          cogsTotal,
          remarks: payload.remarks?.trim() || null,
          items: {
            create: enrichedItems.map((item) => ({
              productId: item.productId,
              unitId: item.unitId,
              batchNo: item.batchNo,
              quantity: item.quantity,
              price: item.price,
              discount: item.discount,
              vatPercent: item.vatPercent,
              lineTotal: item.lineTotal,
              costAmount: item.costAmount,
            })),
          },
        },
        include: {
          customer: true,
          warehouse: true,
          items: { include: { product: true } },
        },
      });

      for (const item of enrichedItems) {
        const unitCost = item.quantity > 0 ? item.costAmount / item.quantity : 0;
        await increaseStock(tx, {
          productId: item.productId,
          warehouseId: salesReturn.warehouseId,
          batchNo: item.batchNo,
          quantity: item.quantity,
          costPerUnit: unitCost,
        });

        await recordStockMovement(tx, {
          date: salesReturn.date,
          productId: item.productId,
          warehouseId: salesReturn.warehouseId,
          batchNo: item.batchNo,
          movementType: STOCK_MOVEMENT_TYPES.SALES_RETURN,
          documentType: SOURCE_DOCUMENT_TYPES.SALES_RETURN,
          documentId: salesReturn.id,
          referenceNumber: salesReturn.number,
          quantityIn: item.quantity,
          quantityOut: 0,
          unitCost,
        });
      }

      await postSalesReturnJournal(tx, salesReturn);
      return salesReturn;
    });

    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to save sales return");
  }
}

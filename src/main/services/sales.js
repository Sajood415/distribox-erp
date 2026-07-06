import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";
import { issueStockFIFO } from "./stock";
import { postSalesJournal } from "./accounting";
import { getSettingValue } from "./settings-service";
import { SETTING_KEYS, CREDIT_LIMIT_POLICIES } from "../core/settings-keys";
import { recordStockMovement } from "../domain/stock-movement-recorder";
import { STOCK_MOVEMENT_TYPES } from "../core/stock-movement-types";
import { SOURCE_DOCUMENT_TYPES } from "../core/account-roles";
import {
  getCustomerOutstanding,
  getInvoiceOutstanding,
  buildCustomerOutstandingBreakdown,
  normalizeSaleItems,
} from "./quotation";
import { DOCUMENT_TYPES } from "../core/document-types";
import { onDocumentCreated, onDocumentPosted, onDocumentEdited, assertDocumentEditable } from "./document-lifecycle-service";

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
    if (payload.id) {
      const editable = await assertDocumentEditable(DOCUMENT_TYPES.SALES_INVOICE, payload.id);
      if (!editable.success) return editable;

      const result = await prisma.$transaction(async (tx) => {
        await tx.salesItem.deleteMany({ where: { salesInvoiceId: Number(payload.id) } });
        const invoice = await tx.salesInvoice.update({
          where: { id: Number(payload.id) },
          data: {
            date: new Date(payload.date),
            customerId: Number(payload.customerId),
            warehouseId: Number(payload.warehouseId),
            salesmanId: payload.salesmanId ? Number(payload.salesmanId) : null,
            deliveryManId: payload.deliveryManId ? Number(payload.deliveryManId) : null,
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
                quantity: item.quantity,
                freeQuantity: item.freeQuantity,
                price: item.price,
                discount: item.discount,
                vatPercent: item.vatPercent,
                lineTotal: item.lineTotal,
                costAmount: 0,
              })),
            },
          },
          include: { items: true },
        });
        await onDocumentEdited(tx, {
          documentType: DOCUMENT_TYPES.SALES_INVOICE,
          documentId: invoice.id,
          documentNumber: invoice.number,
        });
        return invoice;
      });
      return success(result);
    }

    const result = await prisma.$transaction(async (tx) => {
      let cogsTotal = 0;
      const itemRecords = [];
      const stockIssues = [];

      for (const item of items) {
        const stockQty = item.quantity + item.freeQuantity;
        const { totalCost, allocations } = await issueStockFIFO(tx, {
          productId: item.productId,
          warehouseId: Number(payload.warehouseId),
          quantity: stockQty,
        });
        cogsTotal += totalCost;
        stockIssues.push({ productId: item.productId, allocations });
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

      await onDocumentCreated(tx, {
        documentType: DOCUMENT_TYPES.SALES_INVOICE,
        documentId: invoice.id,
        documentNumber: invoice.number,
        lifecycleStatus: "Draft",
      });

      await postSalesJournal(tx, invoice);

      for (const issue of stockIssues) {
        for (const allocation of issue.allocations) {
          await recordStockMovement(tx, {
            date: invoice.date,
            productId: issue.productId,
            warehouseId: invoice.warehouseId,
            batchNo: allocation.batchNo,
            movementType: STOCK_MOVEMENT_TYPES.SALES,
            documentType: SOURCE_DOCUMENT_TYPES.SALES_INVOICE,
            documentId: invoice.id,
            referenceNumber: invoice.number,
            quantityIn: 0,
            quantityOut: allocation.quantity,
            unitCost: allocation.costPerUnit,
          });
        }
      }

      await onDocumentPosted(tx, {
        documentType: DOCUMENT_TYPES.SALES_INVOICE,
        documentId: invoice.id,
        documentNumber: invoice.number,
        postedAt: invoice.date,
      });

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

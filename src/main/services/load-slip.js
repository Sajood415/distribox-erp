import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";
import { logOperation } from "./operation-log";
import { EVENT_TYPES } from "./event-service";

export const LOAD_SLIP_STATUSES = {
  DRAFT: "Draft",
  LOADED: "Loaded",
  IN_TRANSIT: "In Transit",
  DELIVERED: "Delivered",
  CLOSED: "Closed",
};

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

async function nextLoadSlipNumber(tx) {
  const year = new Date().getFullYear();
  const prefix = `LS-${year}-`;
  const latest = await tx.loadSlip.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
  });
  const next = latest ? Number(latest.number.split("-").pop()) + 1 : 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

export async function listLoadSlips() {
  const prisma = getCompanyPrisma();
  const data = await prisma.loadSlip.findMany({
    orderBy: { date: "desc" },
    include: {
      deliveryMan: true,
      salesman: true,
      route: true,
      invoices: { include: { customer: true } },
      items: { include: { product: true } },
    },
  });
  return success(data);
}

export async function saveLoadSlip(payload) {
  const prisma = getCompanyPrisma();
  const invoiceIds = (payload.invoiceIds || []).map(Number).filter(Boolean);
  const items = (payload.items || []).filter((item) => item.productId && Number(item.loadedQty) > 0);

  if (!payload.deliveryManId) return failure("Delivery man is required");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const loadSlip = await tx.loadSlip.create({
        data: {
          number: payload.number || (await nextLoadSlipNumber(tx)),
          date: new Date(payload.date),
          deliveryManId: Number(payload.deliveryManId),
          salesmanId: payload.salesmanId ? Number(payload.salesmanId) : null,
          routeId: payload.routeId ? Number(payload.routeId) : null,
          vehicleNo: payload.vehicleNo?.trim() || null,
          status: LOAD_SLIP_STATUSES.DRAFT,
          remarks: payload.remarks?.trim() || null,
          items: items.length
            ? {
                create: items.map((item) => ({
                  productId: Number(item.productId),
                  unitId: Number(item.unitId) || 1,
                  loadedQty: Number(item.loadedQty),
                  deliveredQty: Number(item.deliveredQty) || 0,
                  returnedQty: Number(item.returnedQty) || 0,
                  shortQty: Number(item.shortQty) || 0,
                  damageQty: Number(item.damageQty) || 0,
                })),
              }
            : undefined,
        },
      });

      if (invoiceIds.length > 0) {
        await tx.salesInvoice.updateMany({
          where: { id: { in: invoiceIds }, loadSlipId: null },
          data: {
            loadSlipId: loadSlip.id,
            deliveryManId: Number(payload.deliveryManId),
            salesmanId: payload.salesmanId ? Number(payload.salesmanId) : undefined,
            status: "Assigned",
          },
        });
      }

      await logOperation(tx, {
        table: "LoadSlip",
        recordId: loadSlip.id,
        action: "CREATE",
        entityType: "LOAD_SLIP",
        referenceNumber: loadSlip.number,
        message: `Load slip ${loadSlip.number} created`,
      });

      return tx.loadSlip.findUnique({
        where: { id: loadSlip.id },
        include: {
          deliveryMan: true,
          salesman: true,
          route: true,
          invoices: { include: { customer: true, items: { include: { product: true } } } },
          items: { include: { product: true } },
        },
      });
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to create load slip");
  }
}

export async function updateLoadSlipStatus(payload) {
  const prisma = getCompanyPrisma();
  const status = payload.status;
  if (!payload.id || !status) return failure("Load slip and status are required");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const loadSlip = await tx.loadSlip.update({
        where: { id: Number(payload.id) },
        data: {
          status,
          items: payload.items
            ? {
                deleteMany: {},
                create: payload.items.map((item) => ({
                  productId: Number(item.productId),
                  unitId: Number(item.unitId) || 1,
                  loadedQty: Number(item.loadedQty) || 0,
                  deliveredQty: Number(item.deliveredQty) || 0,
                  returnedQty: Number(item.returnedQty) || 0,
                  shortQty: Number(item.shortQty) || 0,
                  damageQty: Number(item.damageQty) || 0,
                })),
              }
            : undefined,
        },
        include: { items: true, invoices: true },
      });

      if (status === LOAD_SLIP_STATUSES.DELIVERED || status === LOAD_SLIP_STATUSES.CLOSED) {
        await tx.salesInvoice.updateMany({
          where: { loadSlipId: loadSlip.id },
          data: { status: "Delivered" },
        });
      }

      await logOperation(tx, {
        table: "LoadSlip",
        recordId: loadSlip.id,
        action: "STATUS",
        eventType: EVENT_TYPES.APPROVED,
        entityType: "LOAD_SLIP",
        referenceNumber: loadSlip.number,
        message: `Load slip ${loadSlip.number} marked ${status}`,
      });
      return loadSlip;
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to update load slip");
  }
}

export async function markLoadSlipDelivered(id) {
  return updateLoadSlipStatus({ id, status: LOAD_SLIP_STATUSES.DELIVERED });
}

export async function listDeliveryMen() {
  const prisma = getCompanyPrisma();
  const data = await prisma.deliveryMan.findMany({ orderBy: { name: "asc" } });
  return success(data);
}

export async function saveDeliveryMan(payload) {
  const prisma = getCompanyPrisma();
  const data = { name: payload.name?.trim() };
  if (payload.id) {
    const updated = await prisma.deliveryMan.update({ where: { id: payload.id }, data });
    return success(updated);
  }
  const created = await prisma.deliveryMan.create({ data });
  return success(created);
}

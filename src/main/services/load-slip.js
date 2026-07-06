import { getCompanyPrisma } from "../db/init";

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
      invoices: { include: { customer: true } },
    },
  });
  return success(data);
}

export async function saveLoadSlip(payload) {
  const prisma = getCompanyPrisma();
  const invoiceIds = (payload.invoiceIds || []).map(Number).filter(Boolean);

  if (!payload.deliveryManId) {
    return failure("Delivery man is required");
  }
  if (invoiceIds.length === 0) {
    return failure("Select at least one invoice");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const loadSlip = await tx.loadSlip.create({
        data: {
          number: payload.number || (await nextLoadSlipNumber(tx)),
          date: new Date(payload.date),
          deliveryManId: Number(payload.deliveryManId),
          remarks: payload.remarks?.trim() || null,
        },
      });

      await tx.salesInvoice.updateMany({
        where: { id: { in: invoiceIds }, loadSlipId: null },
        data: {
          loadSlipId: loadSlip.id,
          deliveryManId: Number(payload.deliveryManId),
          status: "Assigned",
        },
      });

      return tx.loadSlip.findUnique({
        where: { id: loadSlip.id },
        include: {
          deliveryMan: true,
          invoices: { include: { customer: true, items: { include: { product: true } } } },
        },
      });
    });

    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to create load slip");
  }
}

export async function markLoadSlipDelivered(id) {
  const prisma = getCompanyPrisma();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const loadSlip = await tx.loadSlip.update({
        where: { id: Number(id) },
        data: { status: "Delivered" },
      });
      await tx.salesInvoice.updateMany({
        where: { loadSlipId: loadSlip.id },
        data: { status: "Delivered" },
      });
      return loadSlip;
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to update load slip");
  }
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

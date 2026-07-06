import { getCompanyPrisma } from "../db/init";

async function findStockRecord(tx, { productId, warehouseId, batchNo }) {
  return tx.stock.findFirst({
    where: {
      productId,
      warehouseId,
      batchNo: batchNo || null,
    },
  });
}

export async function increaseStock(tx, { productId, warehouseId, batchNo, expiryDate, quantity, costPerUnit }) {
  const existing = await findStockRecord(tx, { productId, warehouseId, batchNo });

  if (existing) {
    const newQty = existing.quantity + quantity;
    const blendedCost =
      newQty === 0
        ? costPerUnit
        : (existing.quantity * existing.costPerUnit + quantity * costPerUnit) / newQty;

    return tx.stock.update({
      where: { id: existing.id },
      data: {
        quantity: newQty,
        costPerUnit: blendedCost,
        expiryDate: expiryDate ? new Date(expiryDate) : existing.expiryDate,
      },
    });
  }

  return tx.stock.create({
    data: {
      productId,
      warehouseId,
      batchNo: batchNo || null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      quantity,
      costPerUnit,
    },
  });
}

export async function issueStockFIFO(tx, { productId, warehouseId, quantity }) {
  const stocks = await tx.stock.findMany({
    where: { productId, warehouseId, quantity: { gt: 0 } },
    orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
  });

  let remaining = quantity;
  let totalCost = 0;
  const allocations = [];

  for (const stock of stocks) {
    if (remaining <= 0) {
      break;
    }

    const take = Math.min(stock.quantity, remaining);
    const newQty = stock.quantity - take;

    if (newQty === 0) {
      await tx.stock.delete({ where: { id: stock.id } });
    } else {
      await tx.stock.update({
        where: { id: stock.id },
        data: { quantity: newQty },
      });
    }

    totalCost += take * stock.costPerUnit;
    allocations.push({
      batchNo: stock.batchNo,
      quantity: take,
      costPerUnit: stock.costPerUnit,
    });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error("Insufficient stock for sale");
  }

  return { totalCost, allocations };
}

export async function decreaseStock(tx, { productId, warehouseId, batchNo, quantity }) {
  const existing = await findStockRecord(tx, { productId, warehouseId, batchNo });

  if (!existing || existing.quantity < quantity) {
    throw new Error("Insufficient stock for return");
  }

  const costPerUnit = existing.costPerUnit;
  const newQty = existing.quantity - quantity;
  if (newQty === 0) {
    await tx.stock.delete({ where: { id: existing.id } });
    return { costPerUnit };
  }

  await tx.stock.update({
    where: { id: existing.id },
    data: { quantity: newQty },
  });
  return { costPerUnit };
}

export async function getStockUnitCost(tx, { productId, warehouseId, batchNo }) {
  const existing = await findStockRecord(tx, { productId, warehouseId, batchNo });
  return existing?.costPerUnit || 0;
}

export async function listStock() {
  const prisma = getCompanyPrisma();
  const data = await prisma.stock.findMany({
    include: {
      product: { include: { baseUnit: true } },
      warehouse: true,
    },
    orderBy: [{ warehouseId: "asc" }, { productId: "asc" }],
  });
  return { success: true, data };
}

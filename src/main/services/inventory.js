import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";
import { increaseStock, issueStockFIFO } from "./stock";
import { calcAdjustmentValue, postStockAdjustmentJournal } from "./inventory-accounting";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
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

async function getSystemQty(tx, productId, warehouseId) {
  const rows = await tx.stock.findMany({
    where: { productId, warehouseId },
  });
  return roundMoney(rows.reduce((sum, row) => sum + row.quantity, 0));
}

async function getAverageCost(tx, productId, warehouseId) {
  const product = await tx.product.findUnique({ where: { id: productId } });
  const rows = await tx.stock.findMany({
    where: { productId, warehouseId, quantity: { gt: 0 } },
  });
  if (rows.length === 0) {
    return product?.costPrice || 0;
  }
  const totalQty = rows.reduce((sum, row) => sum + row.quantity, 0);
  const totalValue = rows.reduce((sum, row) => sum + row.quantity * row.costPerUnit, 0);
  return totalQty > 0 ? roundMoney(totalValue / totalQty) : product?.costPrice || 0;
}

async function setProductWarehouseQty(tx, { productId, warehouseId, targetQty, batchNo, costPerUnit }) {
  const existingRows = await tx.stock.findMany({
    where: { productId, warehouseId },
  });
  const currentQty = existingRows.reduce((sum, row) => sum + row.quantity, 0);
  const delta = roundMoney(targetQty - currentQty);

  if (delta === 0) {
    return { quantityBefore: currentQty, quantityAfter: currentQty, quantityChange: 0, costPerUnit };
  }

  if (delta > 0) {
    await increaseStock(tx, {
      productId,
      warehouseId,
      batchNo: batchNo || null,
      quantity: delta,
      costPerUnit,
    });
  } else {
    await issueStockFIFO(tx, {
      productId,
      warehouseId,
      quantity: Math.abs(delta),
    });
  }

  return {
    quantityBefore: currentQty,
    quantityAfter: targetQty,
    quantityChange: delta,
    costPerUnit,
  };
}

export async function getInventoryLookups() {
  const prisma = getCompanyPrisma();
  const [warehouses, products] = await Promise.all([
    prisma.warehouse.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { active: true },
      include: { baseUnit: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return success({ warehouses, products });
}

export async function getStockTakeSheet(warehouseId) {
  const prisma = getCompanyPrisma();
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { baseUnit: true },
  });

  const sheet = [];
  for (const product of products) {
    const systemQty = await getSystemQty(prisma, product.id, Number(warehouseId));
    sheet.push({
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      unit: product.baseUnit?.code ?? "",
      systemQty,
      countedQty: systemQty,
      difference: 0,
    });
  }

  return success(sheet);
}

export async function finalizeStockTake(payload) {
  const prisma = getCompanyPrisma();
  const lines = (payload.lines || []).filter(
    (line) => line.productId && line.countedQty != null && line.countedQty !== ""
  );

  if (!payload.warehouseId) {
    return failure("Warehouse is required");
  }
  if (lines.length === 0) {
    return failure("Enter counted quantities");
  }

  try {
    const adjustments = await prisma.$transaction(async (tx) => {
      const created = [];

      for (const line of lines) {
        const productId = Number(line.productId);
        const countedQty = roundMoney(line.countedQty);
        const systemQty = await getSystemQty(tx, productId, Number(payload.warehouseId));
        const difference = roundMoney(countedQty - systemQty);

        if (difference === 0) {
          continue;
        }

        const costPerUnit = await getAverageCost(tx, productId, Number(payload.warehouseId));
        const change = await setProductWarehouseQty(tx, {
          productId,
          warehouseId: Number(payload.warehouseId),
          targetQty: countedQty,
          costPerUnit,
        });

        const valueChange = calcAdjustmentValue(change.quantityChange, costPerUnit);
        const adjustment = await tx.stockAdjustment.create({
          data: {
            number: await nextNumber(tx, "stockAdjustment", "ST"),
            date: new Date(payload.date),
            warehouseId: Number(payload.warehouseId),
            productId,
            type: "StockTake",
            quantityBefore: change.quantityBefore,
            quantityAfter: change.quantityAfter,
            quantityChange: change.quantityChange,
            costPerUnit,
            valueChange,
            reason: payload.reason?.trim() || "Stock take adjustment",
          },
        });

        await postStockAdjustmentJournal(tx, adjustment);
        created.push(adjustment);
      }

      if (created.length === 0) {
        throw new Error("No differences found — stock already matches counts");
      }

      return created;
    });

    return success(adjustments);
  } catch (error) {
    return failure(error.message || "Failed to finalize stock take");
  }
}

export async function saveOpeningStock(payload) {
  const prisma = getCompanyPrisma();
  const lines = (payload.lines || []).filter(
    (line) => line.productId && Number(line.quantity) > 0
  );

  if (!payload.warehouseId) {
    return failure("Warehouse is required");
  }
  if (lines.length === 0) {
    return failure("Add at least one opening stock line");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const created = [];

      for (const line of lines) {
        const productId = Number(line.productId);
        const quantity = roundMoney(line.quantity);
        const costPerUnit = roundMoney(line.costPerUnit ?? 0);
        const systemQty = await getSystemQty(tx, productId, Number(payload.warehouseId));
        const targetQty = roundMoney(systemQty + quantity);

        const change = await setProductWarehouseQty(tx, {
          productId,
          warehouseId: Number(payload.warehouseId),
          targetQty,
          batchNo: line.batchNo?.trim() || null,
          costPerUnit,
        });

        const adjustment = await tx.stockAdjustment.create({
          data: {
            number: await nextNumber(tx, "stockAdjustment", "OS"),
            date: new Date(payload.date),
            warehouseId: Number(payload.warehouseId),
            productId,
            batchNo: line.batchNo?.trim() || null,
            type: "Opening",
            quantityBefore: change.quantityBefore,
            quantityAfter: change.quantityAfter,
            quantityChange: quantity,
            costPerUnit,
            valueChange: calcAdjustmentValue(quantity, costPerUnit),
            reason: payload.remarks?.trim() || "Opening stock entry",
          },
        });

        await tx.product.update({
          where: { id: productId },
          data: { costPrice: costPerUnit },
        });

        await postStockAdjustmentJournal(tx, adjustment);
        created.push(adjustment);
      }

      return created;
    });

    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to save opening stock");
  }
}

export async function saveStockAdjustment(payload) {
  const prisma = getCompanyPrisma();
  const quantityChange = roundMoney(payload.quantityChange);

  if (!payload.warehouseId || !payload.productId) {
    return failure("Warehouse and product are required");
  }
  if (quantityChange === 0) {
    return failure("Quantity change cannot be zero");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const productId = Number(payload.productId);
      const warehouseId = Number(payload.warehouseId);
      const systemQty = await getSystemQty(tx, productId, warehouseId);
      const targetQty = roundMoney(systemQty + quantityChange);
      const costPerUnit = await getAverageCost(tx, productId, warehouseId);

      if (targetQty < 0) {
        throw new Error("Adjustment would result in negative stock");
      }

      const change = await setProductWarehouseQty(tx, {
        productId,
        warehouseId,
        targetQty,
        batchNo: payload.batchNo?.trim() || null,
        costPerUnit,
      });

      const adjustment = await tx.stockAdjustment.create({
        data: {
          number: await nextNumber(tx, "stockAdjustment", "SA"),
          date: new Date(payload.date),
          warehouseId,
          productId,
          batchNo: payload.batchNo?.trim() || null,
          type: "Adjustment",
          quantityBefore: change.quantityBefore,
          quantityAfter: change.quantityAfter,
          quantityChange,
          costPerUnit,
          valueChange: calcAdjustmentValue(quantityChange, costPerUnit),
          reason: payload.reason?.trim() || "Manual stock adjustment",
        },
      });

      await postStockAdjustmentJournal(tx, adjustment);
      return adjustment;
    });

    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to save adjustment");
  }
}

export async function saveStockTransfer(payload) {
  const prisma = getCompanyPrisma();
  const items = (payload.items || []).filter(
    (item) => item.productId && Number(item.quantity) > 0
  );

  if (!payload.fromWarehouseId || !payload.toWarehouseId) {
    return failure("Source and destination warehouses are required");
  }
  if (Number(payload.fromWarehouseId) === Number(payload.toWarehouseId)) {
    return failure("Source and destination must be different");
  }
  if (items.length === 0) {
    return failure("Add at least one transfer line");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.create({
        data: {
          number: await nextNumber(tx, "stockTransfer", "TR"),
          date: new Date(payload.date),
          fromWarehouseId: Number(payload.fromWarehouseId),
          toWarehouseId: Number(payload.toWarehouseId),
          remarks: payload.remarks?.trim() || null,
          items: {
            create: items.map((item) => ({
              productId: Number(item.productId),
              batchNo: item.batchNo?.trim() || null,
              quantity: Number(item.quantity),
            })),
          },
        },
        include: { items: true },
      });

      for (const item of transfer.items) {
        const { allocations } = await issueStockFIFO(tx, {
          productId: item.productId,
          warehouseId: transfer.fromWarehouseId,
          quantity: item.quantity,
        });

        for (const allocation of allocations) {
          await increaseStock(tx, {
            productId: item.productId,
            warehouseId: transfer.toWarehouseId,
            batchNo: allocation.batchNo,
            quantity: allocation.quantity,
            costPerUnit: allocation.costPerUnit,
          });
        }
      }

      return transfer;
    });

    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to save stock transfer");
  }
}

export async function listStockAdjustments() {
  const prisma = getCompanyPrisma();
  const data = await prisma.stockAdjustment.findMany({
    orderBy: { date: "desc" },
    include: { product: true, warehouse: true },
  });
  return success(data);
}

export async function listStockTransfers() {
  const prisma = getCompanyPrisma();
  const data = await prisma.stockTransfer.findMany({
    orderBy: { date: "desc" },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      items: { include: { product: true } },
    },
  });
  return success(data);
}

export async function getLowStockReport() {
  const prisma = getCompanyPrisma();
  const products = await prisma.product.findMany({
    where: { active: true, reorderLevel: { gt: 0 } },
    orderBy: { name: "asc" },
  });

  const report = [];
  for (const product of products) {
    const rows = await prisma.stock.findMany({ where: { productId: product.id } });
    const onHand = roundMoney(rows.reduce((sum, row) => sum + row.quantity, 0));
    if (onHand <= product.reorderLevel) {
      report.push({
        productId: product.id,
        code: product.code,
        name: product.name,
        onHand,
        reorderLevel: product.reorderLevel,
        shortfall: roundMoney(product.reorderLevel - onHand),
      });
    }
  }

  return success(report);
}

export async function getExpiryReport() {
  const prisma = getCompanyPrisma();
  const now = new Date();
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const rows = await prisma.stock.findMany({
    where: {
      quantity: { gt: 0 },
      expiryDate: { not: null, lte: soon },
    },
    include: { product: true, warehouse: true },
    orderBy: { expiryDate: "asc" },
  });

  return success(
    rows.map((row) => ({
      ...row,
      status: row.expiryDate < now ? "Expired" : "Near Expiry",
    }))
  );
}

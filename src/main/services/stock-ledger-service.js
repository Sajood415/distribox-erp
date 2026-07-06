import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";
import { ACCOUNT_ROLES } from "../core/account-roles";
import { resolveAccountIdByRole } from "./account-mapping-service";
import { findJournalLinesCumulative } from "../repositories/journal-repository";
import { getStockQuantity, getStockValuation } from "../domain/stock-quantity";
import { mapMovementRow, sliceStockLedger } from "../domain/stock-ledger-shared";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

async function fetchMovements(prisma, where = {}) {
  return prisma.stockMovement.findMany({
    where,
    include: { product: true, warehouse: true },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
}

async function getInventoryGlBalance(prisma) {
  const accountId = await resolveAccountIdByRole(prisma, ACCOUNT_ROLES.INVENTORY);
  const lines = await findJournalLinesCumulative(prisma, {
    end: new Date("2099-12-31"),
    accountId,
  });
  return roundMoney(lines.reduce((sum, line) => sum + line.debit - line.credit, 0));
}

function buildLedgerResponse(period, scope, actual, glBalance = null) {
  const lastStored = period.rows.length > 0 ? period.rows[period.rows.length - 1] : null;
  const storedClosingQty = lastStored?.runningQuantity ?? period.openingQty;
  const storedClosingValue = lastStored?.runningInventoryValue ?? period.openingValue;

  return {
    ...period,
    scope,
    actualQty: actual.quantity,
    actualValue: actual.value,
    glBalance,
    matchesStock: Math.abs(storedClosingQty - actual.quantity) < 0.01,
    matchesValuation: glBalance == null || Math.abs(storedClosingValue - glBalance) < 0.01,
  };
}

export async function getProductLedger(payload = {}) {
  const prisma = getCompanyPrisma();
  const productId = Number(payload.productId);
  if (!productId) return failure("Product is required");

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return failure("Product not found");

  const movements = await fetchMovements(prisma, { productId });
  const rows = movements.map((m) => mapMovementRow(m));
  const period = sliceStockLedger(rows, payload);
  const actual = await getStockValuation(prisma, { productId });

  return success(
    buildLedgerResponse(
      period,
      { type: "product", product },
      actual,
      await getInventoryGlBalance(prisma)
    )
  );
}

export async function getWarehouseLedger(payload = {}) {
  const prisma = getCompanyPrisma();
  const warehouseId = Number(payload.warehouseId);
  if (!warehouseId) return failure("Warehouse is required");

  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) return failure("Warehouse not found");

  const movements = await fetchMovements(prisma, { warehouseId });
  const rows = movements.map((m) => mapMovementRow(m));
  const period = sliceStockLedger(rows, { ...payload, warehouseId });
  const actual = await getStockValuation(prisma, { warehouseId });

  return success(buildLedgerResponse(period, { type: "warehouse", warehouse }, actual));
}

export async function getBatchLedger(payload = {}) {
  const prisma = getCompanyPrisma();
  const productId = Number(payload.productId);
  const warehouseId = Number(payload.warehouseId);
  if (!productId || !warehouseId) return failure("Product and warehouse are required");

  const batchNo = payload.batchNo?.trim() || null;
  const movements = await fetchMovements(prisma, {
    productId,
    warehouseId,
    batchNo,
  });
  const rows = movements.map((m) => mapMovementRow(m));
  const period = sliceStockLedger(rows, { ...payload, warehouseId, batchNo: batchNo || "" });
  const actual = await getStockValuation(prisma, { productId, warehouseId, batchNo });

  return success(
    buildLedgerResponse(
      period,
      { type: "batch", productId, warehouseId, batchNo },
      actual
    )
  );
}

export async function getStockCard(payload = {}) {
  const prisma = getCompanyPrisma();
  const productId = Number(payload.productId);
  const warehouseId = Number(payload.warehouseId);
  if (!productId || !warehouseId) return failure("Product and warehouse are required");

  const [product, warehouse] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId } }),
    prisma.warehouse.findUnique({ where: { id: warehouseId } }),
  ]);
  if (!product || !warehouse) return failure("Product or warehouse not found");

  const movements = await fetchMovements(prisma, { productId, warehouseId });
  const rows = movements.map((m) => mapMovementRow(m));
  const period = sliceStockLedger(rows, { ...payload, warehouseId });
  const actual = await getStockValuation(prisma, { productId, warehouseId });

  return success({
    ...buildLedgerResponse(period, { type: "stockCard", product, warehouse }, actual),
    cardType: "STOCK_CARD",
  });
}

export async function getInventoryHistory(payload = {}) {
  return getMovementHistory(payload);
}

export async function getMovementHistory(payload = {}) {
  const prisma = getCompanyPrisma();
  const where = {};
  if (payload.productId) where.productId = Number(payload.productId);
  if (payload.warehouseId) where.warehouseId = Number(payload.warehouseId);
  if (payload.batchNo) where.batchNo = payload.batchNo.trim();
  if (payload.movementType) where.movementType = payload.movementType;

  const movements = await fetchMovements(prisma, where);
  const rows = movements.map((m) => mapMovementRow(m));
  const period = sliceStockLedger(rows, payload);

  let actualQty = 0;
  if (payload.productId) {
    actualQty = await getStockQuantity(prisma, {
      productId: Number(payload.productId),
      warehouseId: payload.warehouseId ? Number(payload.warehouseId) : undefined,
      batchNo: payload.batchNo,
    });
  }

  return success({
    ...period,
    actualQty,
    rows: period.rows,
  });
}

export async function getStockLedgerLookups() {
  const prisma = getCompanyPrisma();
  const [products, warehouses] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.warehouse.findMany({ orderBy: { name: "asc" } }),
  ]);
  return success({ products, warehouses });
}

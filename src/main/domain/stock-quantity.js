import { roundMoney } from "../utils/money";

function normalizeBatch(batchNo) {
  if (batchNo === undefined) return undefined;
  return batchNo?.trim() || null;
}

export async function getStockQuantity(tx, { productId, warehouseId, batchNo }) {
  const where = { productId, quantity: { gt: 0 } };
  if (warehouseId != null) where.warehouseId = warehouseId;
  const normalizedBatch = normalizeBatch(batchNo);
  if (normalizedBatch !== undefined) where.batchNo = normalizedBatch;

  const rows = await tx.stock.findMany({ where });
  return roundMoney(rows.reduce((sum, row) => sum + row.quantity, 0));
}

export async function getStockValuation(tx, { productId, warehouseId, batchNo } = {}) {
  const where = { quantity: { gt: 0 } };
  if (productId != null) where.productId = productId;
  if (warehouseId != null) where.warehouseId = warehouseId;
  const normalizedBatch = normalizeBatch(batchNo);
  if (normalizedBatch !== undefined) where.batchNo = normalizedBatch;

  const rows = await tx.stock.findMany({ where });
  const quantity = roundMoney(rows.reduce((sum, row) => sum + row.quantity, 0));
  const value = roundMoney(rows.reduce((sum, row) => sum + row.quantity * row.costPerUnit, 0));
  return { quantity, value };
}

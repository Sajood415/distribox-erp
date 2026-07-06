import { roundMoney } from "../utils/money";
import { STOCK_DOCUMENT_ROUTES } from "../core/stock-movement-types";

export function getStockDocumentRoute(documentType, documentId) {
  const base = STOCK_DOCUMENT_ROUTES[documentType];
  if (!base || !documentId) return null;
  return `${base}?docId=${documentId}`;
}

function parseDateRange(payload = {}) {
  const start = payload.startDate ? new Date(payload.startDate) : new Date("2000-01-01");
  const end = payload.endDate ? new Date(payload.endDate) : new Date("2099-12-31");
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function matchesFilters(row, { movementType, reference, start, end, warehouseId, batchNo }) {
  if (movementType && row.movementType !== movementType) return false;
  if (reference && !String(row.referenceNumber || "").toLowerCase().includes(String(reference).toLowerCase())) {
    return false;
  }
  if (warehouseId && row.warehouseId !== Number(warehouseId)) return false;
  if (batchNo !== undefined && batchNo !== "") {
    const rowBatch = row.batchNo || "";
    if (rowBatch !== batchNo) return false;
  }
  const rowDate = new Date(row.date);
  return rowDate >= start && rowDate <= end;
}

export function applyStockRunningBalance(rows) {
  let runningQty = 0;
  let runningValue = 0;
  return rows.map((row) => {
    const qtyDelta = roundMoney(row.quantityIn - row.quantityOut);
    const valueDelta = roundMoney(row.quantityIn * row.unitCost - row.quantityOut * row.unitCost);
    runningQty = roundMoney(runningQty + qtyDelta);
    runningValue = roundMoney(runningValue + valueDelta);
    return {
      ...row,
      balanceQty: runningQty,
      balanceValue: runningValue,
    };
  });
}

export function sliceStockLedger(allRows, payload = {}) {
  const { start, end } = parseDateRange(payload);
  const withBalance = applyStockRunningBalance(allRows);

  let openingQty = 0;
  let openingValue = 0;
  const periodRows = [];

  for (const row of withBalance) {
    const rowDate = new Date(row.date);
    if (rowDate < start) {
      openingQty = row.balanceQty;
      openingValue = row.balanceValue;
      continue;
    }
    if (rowDate > end) continue;
    if (!matchesFilters(row, { ...payload, start, end })) continue;
    periodRows.push(row);
  }

  const closingQty = periodRows.length > 0 ? periodRows[periodRows.length - 1].balanceQty : openingQty;
  const closingValue = periodRows.length > 0 ? periodRows[periodRows.length - 1].balanceValue : openingValue;

  return {
    start,
    end,
    openingQty,
    openingValue,
    closingQty,
    closingValue,
    rows: periodRows,
  };
}

export function mapMovementRow(movement, include = {}) {
  const product = include.product || movement.product;
  const warehouse = include.warehouse || movement.warehouse;
  return {
    id: movement.id,
    date: movement.date,
    productId: movement.productId,
    productCode: product?.code,
    productName: product?.name,
    warehouseId: movement.warehouseId,
    warehouseName: warehouse?.name,
    batchNo: movement.batchNo,
    movementType: movement.movementType,
    documentType: movement.documentType,
    documentId: movement.documentId,
    referenceNumber: movement.referenceNumber,
    quantityIn: movement.quantityIn,
    quantityOut: movement.quantityOut,
    unitCost: movement.unitCost,
    runningQuantity: movement.runningQuantity,
    runningInventoryValue: movement.runningInventoryValue,
    remarks: movement.remarks,
    route: getStockDocumentRoute(movement.documentType, movement.documentId),
    description: movement.remarks || movement.referenceNumber || movement.movementType,
  };
}

export { parseDateRange, matchesFilters };

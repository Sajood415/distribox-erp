import { roundMoney } from "../utils/money";

function normalizeBatch(batchNo) {
  return batchNo?.trim() || null;
}

async function getLastMovement(tx, { productId, warehouseId, batchNo }) {
  return tx.stockMovement.findFirst({
    where: {
      productId,
      warehouseId,
      batchNo: normalizeBatch(batchNo),
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
}

export async function recordStockMovement(tx, payload) {
  const quantityIn = roundMoney(payload.quantityIn || 0);
  const quantityOut = roundMoney(payload.quantityOut || 0);
  const unitCost = roundMoney(payload.unitCost || 0);

  if (quantityIn === 0 && quantityOut === 0) {
    throw new Error("Stock movement must have quantity in or out");
  }

  const last = await getLastMovement(tx, payload);
  const qtyDelta = roundMoney(quantityIn - quantityOut);
  const runningQuantity = roundMoney((last?.runningQuantity || 0) + qtyDelta);
  const valueDelta = roundMoney(quantityIn * unitCost - quantityOut * unitCost);
  const runningInventoryValue = roundMoney((last?.runningInventoryValue || 0) + valueDelta);

  return tx.stockMovement.create({
    data: {
      date: new Date(payload.date),
      productId: payload.productId,
      warehouseId: payload.warehouseId,
      batchNo: normalizeBatch(payload.batchNo),
      movementType: payload.movementType,
      documentType: payload.documentType || null,
      documentId: payload.documentId ?? null,
      referenceNumber: payload.referenceNumber || null,
      quantityIn,
      quantityOut,
      runningQuantity,
      unitCost,
      runningInventoryValue,
      remarks: payload.remarks || null,
      createdBy: payload.createdBy ?? null,
    },
  });
}

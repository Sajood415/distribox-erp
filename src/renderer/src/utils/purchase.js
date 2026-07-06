export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function calcPurchaseLine(item) {
  const qty = (Number(item.quantity) || 0) + (Number(item.freeQuantity) || 0);
  const price = Number(item.price) || 0;
  const discount = Number(item.discount) || 0;
  const vatPercent = Number(item.vatPercent) || 0;
  const net = roundMoney(qty * price * (1 - discount / 100));
  const vat = roundMoney(net * (vatPercent / 100));
  return { net, vat, lineTotal: roundMoney(net + vat) };
}

export function calcPurchaseTotals(items, freight = 0, paidAmount = 0) {
  const lines = items.map(calcPurchaseLine);
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.net, 0));
  const taxTotal = roundMoney(lines.reduce((sum, line) => sum + line.vat, 0));
  const total = roundMoney(subtotal + taxTotal + Number(freight || 0));
  const paid = roundMoney(paidAmount);
  return {
    subtotal,
    taxTotal,
    total,
    paidAmount: paid,
    outstanding: roundMoney(total - paid),
  };
}

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function emptyPurchaseLine() {
  return {
    productId: "",
    unitId: "",
    batchNo: "",
    expiryDate: "",
    quantity: 1,
    freeQuantity: 0,
    price: 0,
    discount: 0,
    vatPercent: 0,
  };
}

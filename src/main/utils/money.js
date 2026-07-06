import Decimal from "decimal.js";

export function roundMoney(value) {
  return new Decimal(value || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function calcLineTotal({ quantity, freeQuantity, price, discount, vatPercent }) {
  const qty = new Decimal(quantity || 0).plus(freeQuantity || 0);
  const unitPrice = new Decimal(price || 0);
  const discFactor = new Decimal(1).minus(new Decimal(discount || 0).div(100));
  const net = qty.times(unitPrice).times(discFactor);
  const vat = net.times(new Decimal(vatPercent || 0).div(100));
  return roundMoney(net.plus(vat));
}

export function calcLineNet({ quantity, freeQuantity, price, discount }) {
  const qty = new Decimal(quantity || 0).plus(freeQuantity || 0);
  const unitPrice = new Decimal(price || 0);
  const discFactor = new Decimal(1).minus(new Decimal(discount || 0).div(100));
  return roundMoney(qty.times(unitPrice).times(discFactor));
}

export function calcLineVat(net, vatPercent) {
  return roundMoney(new Decimal(net || 0).times(new Decimal(vatPercent || 0).div(100)));
}

export function sumLines(items, key = "lineTotal") {
  return roundMoney(items.reduce((sum, item) => sum.plus(item[key] || 0), new Decimal(0)));
}

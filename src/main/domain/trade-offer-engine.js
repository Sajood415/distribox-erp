import { roundMoney } from "../utils/money";

export const OFFER_TYPES = {
  BUY_X_GET_Y: "BUY_X_GET_Y",
  SLAB_DISCOUNT: "SLAB_DISCOUNT",
  PERCENT_DISCOUNT: "PERCENT_DISCOUNT",
  FIXED_DISCOUNT: "FIXED_DISCOUNT",
  FREE_PRODUCT: "FREE_PRODUCT",
};

function parseSlabs(offer) {
  if (!offer.slabsJson) return [];
  try {
    const parsed = JSON.parse(offer.slabsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function matchesOffer(offer, { customerId, product, date }) {
  const onDate = new Date(date);
  if (!offer.active) return false;
  if (onDate < new Date(offer.startDate) || onDate > new Date(offer.endDate)) return false;
  if (offer.customerId && offer.customerId !== Number(customerId)) return false;
  if (offer.productId && offer.productId !== product.productId) return false;
  if (offer.category && offer.category !== product.category) return false;
  return true;
}

function applyBuyXGetY(line, offer) {
  const buy = offer.buyQuantity || 0;
  const get = offer.getQuantity || 0;
  if (buy <= 0 || get <= 0) return line;
  const sets = Math.floor(line.quantity / buy);
  const freeQuantity = roundMoney(sets * get);
  return {
    ...line,
    freeQuantity: roundMoney((line.freeQuantity || 0) + freeQuantity),
    appliedOffers: [...(line.appliedOffers || []), { code: offer.code, type: offer.offerType, freeQuantity }],
  };
}

function applyPercentDiscount(line, percent) {
  if (!percent) return line;
  const discount = roundMoney((line.price * line.quantity * percent) / 100);
  return {
    ...line,
    discount: roundMoney((line.discount || 0) + percent),
    discountAmount: roundMoney((line.discountAmount || 0) + discount),
    appliedOffers: [...(line.appliedOffers || []), { type: "PERCENT_DISCOUNT", discount }],
  };
}

function applyFixedDiscount(line, amount) {
  if (!amount) return line;
  const gross = (line.price || 0) * (line.quantity || 0);
  if (gross <= 0) return line;
  const percent = roundMoney((amount / gross) * 100);
  return applyPercentDiscount(line, percent);
}

function applySlabDiscount(line, offer) {
  const slabs = parseSlabs(offer).sort((a, b) => a.minQty - b.minQty);
  const slab = slabs.find((row) => {
    const min = row.minQty || 0;
    const max = row.maxQty == null ? Infinity : row.maxQty;
    return line.quantity >= min && line.quantity <= max;
  });
  if (!slab) return line;
  if (slab.discountPercent) return applyPercentDiscount(line, slab.discountPercent);
  if (slab.discountAmount) return applyFixedDiscount(line, slab.discountAmount);
  return line;
}

function applyFreeProduct(line, offer, productCatalog) {
  if (!offer.freeProductId || !offer.freeQuantity) return { lines: [line], extras: [] };
  const freeProduct = productCatalog.find((p) => p.id === offer.freeProductId);
  if (!freeProduct) return { lines: [line], extras: [] };
  const sets = offer.buyQuantity ? Math.floor(line.quantity / offer.buyQuantity) : 1;
  const qty = roundMoney(sets * offer.freeQuantity);
  return {
    lines: [line],
    extras: [
      {
        productId: offer.freeProductId,
        unitId: freeProduct.baseUnitId,
        quantity: qty,
        freeQuantity: qty,
        price: 0,
        discount: 0,
        vatPercent: 0,
        appliedOffers: [{ code: offer.code, type: OFFER_TYPES.FREE_PRODUCT, quantity: qty }],
      },
    ],
  };
}

export function previewTradeOffers({ lines = [], offers = [], customerId, date, products = [] }) {
  const applicable = offers
    .filter((offer) => lines.some((line) => matchesOffer(offer, { customerId, product: line, date })))
    .sort((a, b) => a.priority - b.priority);

  let resultLines = lines.map((line) => ({ ...line, appliedOffers: [] }));
  const extraLines = [];

  for (const offer of applicable) {
    resultLines = resultLines.map((line) => {
      if (!matchesOffer(offer, { customerId, product: line, date })) return line;
      switch (offer.offerType) {
        case OFFER_TYPES.BUY_X_GET_Y:
          return applyBuyXGetY(line, offer);
        case OFFER_TYPES.PERCENT_DISCOUNT:
          return applyPercentDiscount(line, offer.discountPercent);
        case OFFER_TYPES.FIXED_DISCOUNT:
          return applyFixedDiscount(line, offer.discountAmount);
        case OFFER_TYPES.SLAB_DISCOUNT:
          return applySlabDiscount(line, offer);
        case OFFER_TYPES.FREE_PRODUCT: {
          const applied = applyFreeProduct(line, offer, products);
          extraLines.push(...applied.extras);
          return applied.lines[0];
        }
        default:
          return line;
      }
    });
  }

  return {
    lines: [...resultLines, ...extraLines],
    appliedOfferCodes: applicable.map((offer) => offer.code),
  };
}

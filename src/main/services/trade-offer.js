import { getCompanyPrisma } from "../db/init";
import { previewTradeOffers, OFFER_TYPES } from "../domain/trade-offer-engine";
import { logOperation } from "./operation-log";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

export { OFFER_TYPES };

export async function listTradeOffers() {
  const prisma = getCompanyPrisma();
  const data = await prisma.tradeOffer.findMany({
    orderBy: [{ priority: "asc" }, { startDate: "desc" }],
    include: { customer: true, product: true },
  });
  return success(data);
}

export async function saveTradeOffer(payload) {
  const prisma = getCompanyPrisma();
  if (!payload.code || !payload.name || !payload.offerType) {
    return failure("Code, name, and offer type are required");
  }

  const data = {
    code: payload.code.trim(),
    name: payload.name.trim(),
    offerType: payload.offerType,
    priority: Number(payload.priority) || 100,
    startDate: new Date(payload.startDate),
    endDate: new Date(payload.endDate),
    active: payload.active !== false,
    customerId: payload.customerId ? Number(payload.customerId) : null,
    productId: payload.productId ? Number(payload.productId) : null,
    category: payload.category?.trim() || null,
    buyQuantity: payload.buyQuantity != null ? Number(payload.buyQuantity) : null,
    getQuantity: payload.getQuantity != null ? Number(payload.getQuantity) : null,
    discountPercent: payload.discountPercent != null ? Number(payload.discountPercent) : null,
    discountAmount: payload.discountAmount != null ? Number(payload.discountAmount) : null,
    freeProductId: payload.freeProductId ? Number(payload.freeProductId) : null,
    freeQuantity: payload.freeQuantity != null ? Number(payload.freeQuantity) : null,
    slabsJson: payload.slabs ? JSON.stringify(payload.slabs) : null,
    remarks: payload.remarks?.trim() || null,
  };

  try {
    const result = await prisma.$transaction(async (tx) => {
      let saved;
      if (payload.id) {
        saved = await tx.tradeOffer.update({ where: { id: Number(payload.id) }, data });
      } else {
        saved = await tx.tradeOffer.create({ data });
      }
      await logOperation(tx, {
        table: "TradeOffer",
        recordId: saved.id,
        action: payload.id ? "UPDATE" : "CREATE",
        entityType: "TRADE_OFFER",
        referenceNumber: saved.code,
        message: `Trade offer ${saved.code} saved`,
      });
      return saved;
    });
    return success(result);
  } catch (error) {
    return failure(error.message || "Failed to save trade offer");
  }
}

export async function previewInvoiceOffers(payload) {
  const prisma = getCompanyPrisma();
  const [offers, products] = await Promise.all([
    prisma.tradeOffer.findMany({ where: { active: true }, orderBy: { priority: "asc" } }),
    prisma.product.findMany({ where: { active: true } }),
  ]);

  const lines = (payload.items || []).map((item) => ({
    productId: Number(item.productId),
    category: products.find((p) => p.id === Number(item.productId))?.category,
    quantity: Number(item.quantity),
    freeQuantity: Number(item.freeQuantity) || 0,
    price: Number(item.price) || 0,
    discount: Number(item.discount) || 0,
    vatPercent: Number(item.vatPercent) || 0,
  }));

  const preview = previewTradeOffers({
    lines,
    offers,
    customerId: payload.customerId,
    date: payload.date || new Date(),
    products,
  });

  return success(preview);
}

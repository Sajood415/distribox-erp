import { getBusinessDate, getCurrentFiscalYear } from "../domain/business-date";
import { getCompanyPrisma } from "../db/init";

function getResetPeriod(resetPolicy, documentDate) {
  const date = new Date(documentDate || getBusinessDate());

  if (resetPolicy === "CALENDAR_YEAR") {
    return String(date.getFullYear());
  }

  if (resetPolicy === "FISCAL_YEAR") {
    return getCurrentFiscalYear(date).label;
  }

  return "ALL";
}

function formatNumber(prefix, sequence, padding) {
  return `${prefix}-${String(sequence).padStart(padding, "0")}`;
}

/**
 * Allocate next document number inside an open transaction.
 * All document services must use this — never generate numbers locally.
 */
export async function allocateDocumentNumber(tx, documentType, documentDate) {
  const seq = await tx.documentSequence.findUnique({ where: { documentType } });

  if (!seq) {
    throw new Error(`Document sequence not configured: ${documentType}`);
  }

  const period = getResetPeriod(seq.resetPolicy, documentDate);
  let next = seq.currentSequence;

  if (seq.resetPolicy !== "NEVER" && seq.lastResetPeriod !== period) {
    next = 0;
  }

  next += 1;

  await tx.documentSequence.update({
    where: { documentType },
    data: {
      currentSequence: next,
      lastResetPeriod: seq.resetPolicy === "NEVER" ? seq.lastResetPeriod : period,
      updatedAt: getBusinessDate(),
    },
  });

  return formatNumber(seq.prefix, next, seq.padding);
}

export async function previewNextNumber(documentType, documentDate) {
  const prisma = getCompanyPrisma();
  const seq = await prisma.documentSequence.findUnique({ where: { documentType } });

  if (!seq) {
    return { success: false, error: `Sequence not found: ${documentType}` };
  }

  const period = getResetPeriod(seq.resetPolicy, documentDate);
  let next = seq.currentSequence;
  if (seq.resetPolicy !== "NEVER" && seq.lastResetPeriod !== period) {
    next = 0;
  }

  return {
    success: true,
    data: {
      number: formatNumber(seq.prefix, next + 1, seq.padding),
      documentType,
      period,
    },
  };
}

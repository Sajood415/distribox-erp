import { getCompanyPrisma } from "../db/init";
import { getBusinessDate, setFiscalYearStartMonth } from "../domain/business-date";
import { DEFAULT_SETTINGS, DEFAULT_SEQUENCES, SETTING_KEYS } from "../core/settings-keys";
import { logCompanyAudit } from "./audit-service";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

export async function getSettingValue(key, tx = null) {
  const prisma = tx ?? getCompanyPrisma();
  const row = await prisma.companySetting.findUnique({ where: { key } });
  if (row) return row.value;
  return DEFAULT_SETTINGS[key] ?? null;
}

export async function applyRuntimeSettings() {
  const month = Number(await getSettingValue(SETTING_KEYS.FISCAL_YEAR_START_MONTH));
  if (month >= 1 && month <= 12) {
    setFiscalYearStartMonth(month);
  }
}

export async function seedCompanySettings(prisma) {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await prisma.companySetting.findUnique({ where: { key } });
    if (!existing) {
      await prisma.companySetting.create({ data: { key, value } });
    }
  }

  for (const seq of DEFAULT_SEQUENCES) {
    const existing = await prisma.documentSequence.findUnique({
      where: { documentType: seq.documentType },
    });
    if (!existing) {
      await prisma.documentSequence.create({ data: seq });
    }
  }
}

export async function getSettings() {
  const prisma = getCompanyPrisma();
  const rows = await prisma.companySetting.findMany({ orderBy: { key: "asc" } });
  const map = { ...DEFAULT_SETTINGS };

  for (const row of rows) {
    map[row.key] = row.value;
  }

  return success({
    settings: map,
    meta: {
      fiscalYearStartMonth: Number(map[SETTING_KEYS.FISCAL_YEAR_START_MONTH] || 7),
      dateFormat: map[SETTING_KEYS.DATE_FORMAT],
      currencySymbol: map[SETTING_KEYS.CURRENCY_SYMBOL],
    },
  });
}

export async function saveSettings(payload = {}, ctx) {
  const prisma = getCompanyPrisma();
  const entries = Object.entries(payload.settings || payload);

  await prisma.$transaction(async (tx) => {
    for (const [key, value] of entries) {
      if (!(key in DEFAULT_SETTINGS)) continue;
      await tx.companySetting.upsert({
        where: { key },
        create: { key, value: String(value ?? "") },
        update: { value: String(value ?? "") },
      });
    }

    await logCompanyAudit(tx, {
      userId: ctx?.user?.id,
      table: "CompanySetting",
      recordId: 0,
      action: "UPDATE",
      details: { keys: entries.map(([k]) => k) },
    });
  });

  await applyRuntimeSettings();
  return getSettings();
}

export async function listDocumentSequences() {
  const prisma = getCompanyPrisma();
  const rows = await prisma.documentSequence.findMany({ orderBy: { documentType: "asc" } });
  return success({ rows });
}

export async function saveDocumentSequence(payload, ctx) {
  const prisma = getCompanyPrisma();
  const { documentType, prefix, padding, resetPolicy } = payload;

  if (!documentType || !prefix?.trim()) {
    return failure("Document type and prefix are required");
  }

  const row = await prisma.$transaction(async (tx) => {
    const saved = await tx.documentSequence.upsert({
      where: { documentType },
      create: {
        documentType,
        prefix: prefix.trim().toUpperCase(),
        padding: Number(padding) || 6,
        resetPolicy: resetPolicy || "FISCAL_YEAR",
      },
      update: {
        prefix: prefix.trim().toUpperCase(),
        padding: Number(padding) || 6,
        resetPolicy: resetPolicy || "FISCAL_YEAR",
      },
    });

    await logCompanyAudit(tx, {
      userId: ctx?.user?.id,
      table: "DocumentSequence",
      recordId: 0,
      action: "UPDATE",
      details: { documentType, prefix: saved.prefix },
    });

    return saved;
  });

  return success({ row });
}

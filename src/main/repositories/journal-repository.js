import { assertPeriodOpenForPosting } from "../services/period-lock-service";

export async function findJournalEntryBySource(tx, { sourceDocumentType, sourceDocumentId }) {
  return tx.journalEntry.findFirst({
    where: { sourceDocumentType, sourceDocumentId },
    include: { lines: true },
    orderBy: { id: "desc" },
  });
}

export async function createJournalEntry(tx, data) {
  await assertPeriodOpenForPosting(tx, data.postingDate, {
    sourceDocumentType: data.sourceDocumentType,
    sourceDocumentId: data.sourceDocumentId,
  });

  return tx.journalEntry.create({
    data: {
      referenceNumber: data.referenceNumber,
      sourceDocumentType: data.sourceDocumentType,
      sourceDocumentId: data.sourceDocumentId ?? null,
      postingDate: data.postingDate,
      date: data.postingDate,
      reference: data.referenceNumber,
      sourceType: data.sourceType || data.sourceDocumentType || "System",
      description: data.description,
      lines: {
        create: data.lines.map((line) => ({
          accountId: line.accountId,
          debit: line.debit || 0,
          credit: line.credit || 0,
          description: line.description || null,
        })),
      },
    },
    include: {
      lines: { include: { account: true } },
    },
  });
}

export async function findJournalLinesInRange(tx, { start, end, accountId }) {
  const where = {
    journalEntry: {
      date: { gte: start, lte: end },
    },
  };

  if (accountId) {
    where.accountId = accountId;
  }

  return tx.journalLine.findMany({
    where,
    include: {
      account: true,
      journalEntry: { include: { voucher: true } },
    },
    orderBy: { journalEntry: { date: "asc" } },
  });
}

export async function findJournalLinesCumulative(tx, { end, accountId, accountType }) {
  const where = {
    journalEntry: { date: { lte: end } },
  };

  if (accountId) {
    where.accountId = accountId;
  }

  if (accountType) {
    where.account = { type: accountType };
  }

  return tx.journalLine.findMany({
    where,
    include: { account: true, journalEntry: true },
  });
}

export async function listJournalEntries(tx, { start, end }) {
  return tx.journalEntry.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: { date: "desc" },
    include: {
      lines: { include: { account: true } },
      voucher: true,
    },
  });
}

export async function findAllJournalLinesWithEntries(tx) {
  return tx.journalLine.findMany({
    include: { journalEntry: true, account: true },
  });
}

export async function findOrphanJournalLines(tx) {
  const lines = await tx.journalLine.findMany({ select: { id: true, journalEntryId: true } });
  const orphans = [];

  for (const line of lines) {
    const entry = await tx.journalEntry.findUnique({ where: { id: line.journalEntryId } });
    if (!entry) orphans.push(line);
  }

  return orphans;
}

import { getBusinessDate } from "../domain/business-date";
import { assertBalanced } from "../domain/journal-balancer";
import { roundMoney } from "../utils/money";
import { resolveAccountIdByRole } from "./account-mapping-service";
import { createJournalEntry } from "../repositories/journal-repository";

async function normalizeLines(tx, lines = []) {
  const resolved = [];

  for (const line of lines) {
    if (!line) continue;

    const debit = roundMoney(line.debit || 0);
    const credit = roundMoney(line.credit || 0);
    if (debit <= 0 && credit <= 0) continue;

    let accountId = line.accountId ? Number(line.accountId) : null;
    if (!accountId && line.accountRole) {
      accountId = await resolveAccountIdByRole(tx, line.accountRole);
    }

    if (!accountId) {
      throw new Error("Journal line requires accountId or accountRole");
    }

    resolved.push({
      accountId,
      debit,
      credit,
      description: line.description || line.narrative || null,
    });
  }

  return resolved;
}

/**
 * Single entry point for all journal posting.
 * Total debit must equal total credit.
 */
export async function postJournal(tx, {
  referenceNumber,
  sourceDocumentType,
  sourceDocumentId = null,
  postingDate,
  description,
  sourceType,
  lines,
}) {
  const resolvedLines = await normalizeLines(tx, lines);
  assertBalanced(resolvedLines);

  const date = postingDate ? new Date(postingDate) : getBusinessDate();

  return createJournalEntry(tx, {
    referenceNumber,
    sourceDocumentType,
    sourceDocumentId,
    postingDate: date,
    description,
    sourceType: sourceType || sourceDocumentType || "System",
    lines: resolvedLines,
  });
}

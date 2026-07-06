import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";
import { assertBalanced } from "../domain/journal-balancer";
import { listAccounts } from "../repositories/account-repository";
import { listMappings } from "../repositories/account-mapping-repository";
import {
  findOrphanJournalLines,
} from "../repositories/journal-repository";
import { ACCOUNT_ROLES } from "../core/account-roles";

function success(data) {
  return { success: true, data };
}

export async function runIntegrityChecks() {
  const prisma = getCompanyPrisma();
  const issues = [];

  const entries = await prisma.journalEntry.findMany({
    include: { lines: true },
  });

  let unbalancedCount = 0;
  for (const entry of entries) {
    try {
      assertBalanced(entry.lines);
    } catch {
      unbalancedCount += 1;
      if (issues.length < 20) {
        issues.push({
          type: "UNBALANCED_JOURNAL",
          message: `Journal #${entry.id} (${entry.referenceNumber || entry.reference}) is unbalanced`,
          recordId: entry.id,
        });
      }
    }
  }

  const orphans = await findOrphanJournalLines(prisma);
  for (const orphan of orphans.slice(0, 20)) {
    issues.push({
      type: "ORPHAN_JOURNAL_LINE",
      message: `Journal line #${orphan.id} has no parent entry`,
      recordId: orphan.id,
    });
  }

  const mappings = await listMappings(prisma);
  const accounts = await listAccounts(prisma);
  const accountIds = new Set(accounts.map((a) => a.id));

  let invalidMappingCount = 0;
  for (const mapping of mappings) {
    if (!accountIds.has(mapping.accountId)) {
      invalidMappingCount += 1;
      issues.push({
        type: "INVALID_MAPPING",
        message: `Mapping ${mapping.role} points to missing account #${mapping.accountId}`,
        recordId: mapping.id,
      });
    }
  }

  const requiredRoles = Object.values(ACCOUNT_ROLES);
  const mappedRoles = new Set(mappings.map((m) => m.role));
  const missingRoles = requiredRoles.filter((role) => !mappedRoles.has(role));

  for (const role of missingRoles) {
    issues.push({
      type: "MISSING_MAPPING",
      message: `Account mapping missing for role: ${role}`,
      recordId: 0,
    });
  }

  const negativeStock = await prisma.stock.findMany({ where: { quantity: { lt: 0 } } });

  return success({
    summary: {
      journalCount: entries.length,
      unbalancedJournalCount: unbalancedCount,
      orphanJournalLineCount: orphans.length,
      invalidMappingCount,
      missingMappingCount: missingRoles.length,
      negativeStockCount: negativeStock.length,
      issueCount: issues.length,
    },
    issues,
    healthy: unbalancedCount === 0 && orphans.length === 0 && missingRoles.length === 0,
  });
}

export async function verifyTrialBalanceIntegrity(payload = {}) {
  const { getTrialBalance } = await import("./financial-reports");
  const result = await getTrialBalance(payload);
  if (!result.success) return result;
  return success({
    balanced: result.data.balanced,
    totalDebit: result.data.totalDebit,
    totalCredit: result.data.totalCredit,
  });
}

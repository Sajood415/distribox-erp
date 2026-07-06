import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";
import { assertBalanced } from "../domain/journal-balancer";
import { listAccounts } from "../repositories/account-repository";
import { listMappings } from "../repositories/account-mapping-repository";
import {
  findOrphanJournalLines,
  findJournalLinesCumulative,
} from "../repositories/journal-repository";
import { ACCOUNT_ROLES } from "../core/account-roles";
import {
  getVendorOutstanding,
  buildVendorOutstandingBreakdown,
} from "../domain/vendor-outstanding";
import { getCustomerOutstanding } from "../domain/customer-outstanding";
import { resolveAccountIdByRole } from "./account-mapping-service";

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

  let arMismatch = false;
  try {
    const arAccountId = await resolveAccountIdByRole(prisma, ACCOUNT_ROLES.ACCOUNTS_RECEIVABLE);
    const arLines = await findJournalLinesCumulative(prisma, {
      end: new Date(),
      accountId: arAccountId,
    });
    const arBalance = roundMoney(arLines.reduce((sum, line) => sum + line.debit - line.credit, 0));

    const customers = await prisma.customer.findMany({ select: { id: true } });
    let operationalTotal = 0;
    for (const customer of customers) {
      operationalTotal = roundMoney(operationalTotal + (await getCustomerOutstanding(prisma, customer.id)));
    }

    if (Math.abs(arBalance - operationalTotal) > 0.01) {
      arMismatch = true;
      issues.push({
        type: "AR_OPERATIONAL_MISMATCH",
        message: `GL AR (${arBalance}) does not match operational outstanding (${operationalTotal})`,
        recordId: 0,
      });
    }
  } catch (error) {
    issues.push({
      type: "AR_CHECK_FAILED",
      message: error.message || "Failed to compare AR balances",
      recordId: 0,
    });
  }

  let apMismatch = false;
  try {
    const apAccountId = await resolveAccountIdByRole(prisma, ACCOUNT_ROLES.ACCOUNTS_PAYABLE);
    const apLines = await findJournalLinesCumulative(prisma, {
      end: new Date(),
      accountId: apAccountId,
    });
    const apBalance = roundMoney(apLines.reduce((sum, line) => sum + line.credit - line.debit, 0));

    const vendors = await prisma.vendor.findMany({ select: { id: true } });
    let vendorOperational = 0;
    for (const vendor of vendors) {
      vendorOperational = roundMoney(vendorOperational + (await getVendorOutstanding(prisma, vendor.id)));
    }

    if (Math.abs(apBalance - vendorOperational) > 0.01) {
      apMismatch = true;
      issues.push({
        type: "AP_OPERATIONAL_MISMATCH",
        message: `GL AP (${apBalance}) does not match supplier outstanding (${vendorOperational})`,
        recordId: 0,
      });
    }
  } catch (error) {
    issues.push({
      type: "AP_CHECK_FAILED",
      message: error.message || "Failed to compare AP balances",
      recordId: 0,
    });
  }

  return success({
    summary: {
      journalCount: entries.length,
      unbalancedJournalCount: unbalancedCount,
      orphanJournalLineCount: orphans.length,
      invalidMappingCount,
      missingMappingCount: missingRoles.length,
      negativeStockCount: negativeStock.length,
      arMismatch,
      apMismatch,
      issueCount: issues.length,
    },
    issues,
    healthy:
      unbalancedCount === 0 &&
      orphans.length === 0 &&
      missingRoles.length === 0 &&
      !arMismatch &&
      !apMismatch,
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

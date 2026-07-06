import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";
import { buildCustomerLedgerRows } from "../domain/customer-ledger";
import { buildVendorLedgerRows } from "../domain/vendor-ledger";
import { sliceLedgerForPeriod } from "../domain/ledger-shared";
import { getCustomerOutstanding } from "../domain/customer-outstanding";
import { getVendorOutstanding } from "../domain/vendor-outstanding";
import { resolveAccountIdByRole } from "./account-mapping-service";
import { ACCOUNT_ROLES } from "../core/account-roles";
import { findJournalLinesCumulative } from "../repositories/journal-repository";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

async function getGlBalance(role) {
  const prisma = getCompanyPrisma();
  const accountId = await resolveAccountIdByRole(prisma, role);
  const lines = await findJournalLinesCumulative(prisma, {
    end: new Date("2099-12-31"),
    accountId,
  });
  return roundMoney(lines.reduce((sum, line) => sum + line.debit - line.credit, 0));
}

async function getApBalance() {
  const prisma = getCompanyPrisma();
  const accountId = await resolveAccountIdByRole(prisma, ACCOUNT_ROLES.ACCOUNTS_PAYABLE);
  const lines = await findJournalLinesCumulative(prisma, {
    end: new Date("2099-12-31"),
    accountId,
  });
  return roundMoney(lines.reduce((sum, line) => sum + line.credit - line.debit, 0));
}

export async function getCustomerLedger(payload = {}) {
  const prisma = getCompanyPrisma();
  const customerId = Number(payload.customerId);
  if (!customerId) return failure("Customer is required");

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return failure("Customer not found");

  const allRows = await buildCustomerLedgerRows(prisma, customerId);
  const period = sliceLedgerForPeriod(allRows, payload, { liability: false });
  const operationalOutstanding = await getCustomerOutstanding(prisma, customerId);

  return success({
    party: customer,
    partyType: "customer",
    ...period,
    operationalOutstanding,
    glBalance: await getGlBalance(ACCOUNT_ROLES.ACCOUNTS_RECEIVABLE),
    matchesOutstanding: Math.abs(period.closingBalance - operationalOutstanding) < 0.01,
  });
}

export async function getSupplierLedger(payload = {}) {
  const prisma = getCompanyPrisma();
  const vendorId = Number(payload.vendorId);
  if (!vendorId) return failure("Vendor is required");

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return failure("Vendor not found");

  const allRows = await buildVendorLedgerRows(prisma, vendorId);
  const period = sliceLedgerForPeriod(allRows, payload, { liability: true });
  const operationalOutstanding = await getVendorOutstanding(prisma, vendorId);

  return success({
    party: vendor,
    partyType: "supplier",
    ...period,
    operationalOutstanding,
    glBalance: await getApBalance(),
    matchesOutstanding: Math.abs(period.closingBalance - operationalOutstanding) < 0.01,
  });
}

export async function getCustomerStatement(payload = {}) {
  const result = await getCustomerLedger(payload);
  if (!result.success) return result;
  return success({
    ...result.data,
    statementType: "CUSTOMER_STATEMENT",
  });
}

export async function getSupplierStatement(payload = {}) {
  const result = await getSupplierLedger(payload);
  if (!result.success) return result;
  return success({
    ...result.data,
    statementType: "SUPPLIER_STATEMENT",
  });
}

export async function getOutstandingStatement(payload = {}) {
  const prisma = getCompanyPrisma();
  const partyType = payload.partyType || "customer";

  if (partyType === "supplier") {
    const vendors = await prisma.vendor.findMany({ orderBy: { name: "asc" } });
    const rows = [];
    for (const vendor of vendors) {
      const outstanding = await getVendorOutstanding(prisma, vendor.id);
      if (outstanding > 0) {
        rows.push({
          code: vendor.code,
          name: vendor.name,
          outstanding,
        });
      }
    }
    rows.sort((a, b) => b.outstanding - a.outstanding);
    return success({
      partyType: "supplier",
      rows,
      totalOutstanding: roundMoney(rows.reduce((sum, row) => sum + row.outstanding, 0)),
    });
  }

  const customers = await prisma.customer.findMany({
    include: { salesman: true },
    orderBy: { name: "asc" },
  });
  const rows = [];
  for (const customer of customers) {
    const outstanding = await getCustomerOutstanding(prisma, customer.id);
    if (outstanding > 0) {
      rows.push({
        code: customer.code,
        name: customer.name,
        salesman: customer.salesman?.name ?? "-",
        creditLimit: customer.creditLimit,
        outstanding,
        available: roundMoney(customer.creditLimit - outstanding),
      });
    }
  }
  rows.sort((a, b) => b.outstanding - a.outstanding);
  return success({
    partyType: "customer",
    rows,
    totalOutstanding: roundMoney(rows.reduce((sum, row) => sum + row.outstanding, 0)),
  });
}

export async function getSubLedgerLookups() {
  const prisma = getCompanyPrisma();
  const [customers, vendors] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
  ]);
  return success({ customers, vendors });
}

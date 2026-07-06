import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";
import { ACCOUNT_ROLES } from "../core/account-roles";
import { resolveAccountIdByRole } from "./account-mapping-service";
import { listAccounts } from "../repositories/account-repository";
import {
  findJournalLinesInRange,
  findJournalLinesCumulative,
} from "../repositories/journal-repository";

function success(data) {
  return { success: true, data };
}

function parseDateRange(payload = {}) {
  const start = payload.startDate ? new Date(payload.startDate) : new Date("2000-01-01");
  const end = payload.endDate ? new Date(payload.endDate) : new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function parseAsOfDate(payload = {}) {
  const asOf = payload.asOfDate ? new Date(payload.asOfDate) : new Date();
  asOf.setHours(23, 59, 59, 999);
  return asOf;
}

async function getLedgerBalances(prisma, { start, end, cumulative = false }) {
  const accounts = await listAccounts(prisma);
  const lines = cumulative
    ? await findJournalLinesCumulative(prisma, { end })
    : await findJournalLinesInRange(prisma, { start, end });

  return accounts.map((account) => {
    const accountLines = lines.filter((line) => line.accountId === account.id);
    const debit = roundMoney(accountLines.reduce((sum, line) => sum + line.debit, 0));
    const credit = roundMoney(accountLines.reduce((sum, line) => sum + line.credit, 0));
    return {
      accountId: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      debit,
      credit,
      balance: roundMoney(debit - credit),
    };
  });
}

function bucketOverdueDays(days) {
  if (days <= 30) return "current";
  if (days <= 60) return "days31_60";
  if (days <= 90) return "days61_90";
  if (days <= 120) return "days91_120";
  return "days120Plus";
}

function resolveDueDate(invoice, customer) {
  if (invoice.dueDate) return new Date(invoice.dueDate);
  const due = new Date(invoice.date);
  due.setDate(due.getDate() + (customer?.creditDays || 0));
  return due;
}

export async function getAgingReport(payload = {}) {
  const prisma = getCompanyPrisma();
  const asOf = parseAsOfDate(payload);

  const invoices = await prisma.salesInvoice.findMany({
    where: { isCredit: true },
    include: { customer: { include: { salesman: true } } },
    orderBy: { date: "asc" },
  });

  const customerMap = new Map();

  for (const invoice of invoices) {
    const outstanding = roundMoney(invoice.total - invoice.paidAmount);
    if (outstanding <= 0) continue;

    const dueDate = resolveDueDate(invoice, invoice.customer);
    const daysOverdue = Math.max(
      0,
      Math.floor((asOf.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    const bucket = bucketOverdueDays(daysOverdue);

    const key = invoice.customerId;
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        customerId: invoice.customerId,
        customerCode: invoice.customer.code,
        customerName: invoice.customer.name,
        salesman: invoice.customer.salesman?.name ?? "-",
        current: 0,
        days31_60: 0,
        days61_90: 0,
        days91_120: 0,
        days120Plus: 0,
        total: 0,
        invoices: [],
      });
    }

    const row = customerMap.get(key);
    row[bucket] = roundMoney(row[bucket] + outstanding);
    row.total = roundMoney(row.total + outstanding);
    row.invoices.push({
      number: invoice.number,
      date: invoice.date,
      dueDate,
      daysOverdue,
      bucket,
      outstanding,
    });
  }

  const customers = await prisma.customer.findMany({
    where: { openingBalance: { gt: 0 } },
  });

  for (const customer of customers) {
    const key = customer.id;
    if (!customerMap.has(key)) {
      const salesman = customer.salesmanId
        ? await prisma.salesman.findUnique({ where: { id: customer.salesmanId } })
        : null;
      customerMap.set(key, {
        customerId: customer.id,
        customerCode: customer.code,
        customerName: customer.name,
        salesman: salesman?.name ?? "-",
        current: 0,
        days31_60: 0,
        days61_90: 0,
        days91_120: 0,
        days120Plus: 0,
        total: 0,
        invoices: [],
      });
    }
    const row = customerMap.get(key);
    row.days120Plus = roundMoney(row.days120Plus + customer.openingBalance);
    row.total = roundMoney(row.total + customer.openingBalance);
  }

  const rows = Array.from(customerMap.values())
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);

  const totals = {
    current: roundMoney(rows.reduce((sum, row) => sum + row.current, 0)),
    days31_60: roundMoney(rows.reduce((sum, row) => sum + row.days31_60, 0)),
    days61_90: roundMoney(rows.reduce((sum, row) => sum + row.days61_90, 0)),
    days91_120: roundMoney(rows.reduce((sum, row) => sum + row.days91_120, 0)),
    days120Plus: roundMoney(rows.reduce((sum, row) => sum + row.days120Plus, 0)),
    total: roundMoney(rows.reduce((sum, row) => sum + row.total, 0)),
  };

  return success({ asOf, rows, totals });
}

export async function getBalanceSheet(payload = {}) {
  const prisma = getCompanyPrisma();
  const asOf = parseAsOfDate(payload);
  const balances = await getLedgerBalances(prisma, {
    start: new Date("2000-01-01"),
    end: asOf,
    cumulative: true,
  });

  const leafAccounts = balances.filter((row) => !["1000", "2000"].includes(row.code));

  const assets = leafAccounts
    .filter((row) => row.type === "Asset" && row.balance !== 0)
    .map((row) => ({ ...row, amount: row.balance }));

  const liabilities = leafAccounts
    .filter((row) => row.type === "Liability" && row.balance !== 0)
    .map((row) => ({ ...row, amount: roundMoney(-row.balance) }));

  const equityAccounts = leafAccounts
    .filter((row) => row.type === "Equity" && row.balance !== 0)
    .map((row) => ({ ...row, amount: roundMoney(-row.balance) }));

  const incomeLines = await findJournalLinesCumulative(prisma, {
    end: asOf,
    accountType: "Income",
  });
  const expenseLines = await findJournalLinesCumulative(prisma, {
    end: asOf,
    accountType: "Expense",
  });

  const retainedEarnings = roundMoney(
    incomeLines.reduce((sum, line) => sum + line.credit - line.debit, 0) -
      expenseLines.reduce((sum, line) => sum + line.debit - line.credit, 0)
  );

  const totalAssets = roundMoney(assets.reduce((sum, row) => sum + row.amount, 0));
  const totalLiabilities = roundMoney(liabilities.reduce((sum, row) => sum + row.amount, 0));
  const totalEquity = roundMoney(
    equityAccounts.reduce((sum, row) => sum + row.amount, 0) + retainedEarnings
  );

  return success({
    asOf,
    assets,
    liabilities,
    equity: equityAccounts,
    retainedEarnings,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity: roundMoney(totalLiabilities + totalEquity),
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  });
}

export async function getIncomeStatement(payload = {}) {
  const prisma = getCompanyPrisma();
  const { start, end } = parseDateRange(payload);
  const balances = await getLedgerBalances(prisma, { start, end });

  const incomeRows = balances
    .filter((row) => row.type === "Income" && (row.credit > 0 || row.debit > 0))
    .map((row) => ({
      code: row.code,
      name: row.name,
      amount: roundMoney(row.credit - row.debit),
    }))
    .filter((row) => row.amount !== 0);

  const expenseRows = balances
    .filter((row) => row.type === "Expense" && (row.credit > 0 || row.debit > 0))
    .map((row) => ({
      code: row.code,
      name: row.name,
      amount: roundMoney(row.debit - row.credit),
    }))
    .filter((row) => row.amount !== 0);

  const cogsAccountId = await resolveAccountIdByRole(prisma, ACCOUNT_ROLES.COGS);
  const cogsAccount = await prisma.account.findUnique({ where: { id: cogsAccountId } });
  const cogsCode = cogsAccount?.code;

  const cogsRows = expenseRows.filter((row) => row.code === cogsCode);
  const otherExpenses = expenseRows.filter((row) => row.code !== cogsCode);

  const totalIncome = roundMoney(incomeRows.reduce((sum, row) => sum + row.amount, 0));
  const totalCogs = roundMoney(cogsRows.reduce((sum, row) => sum + row.amount, 0));
  const grossProfit = roundMoney(totalIncome - totalCogs);
  const totalExpenses = roundMoney(otherExpenses.reduce((sum, row) => sum + row.amount, 0));
  const netProfit = roundMoney(grossProfit - totalExpenses);

  return success({
    start,
    end,
    incomeRows,
    cogsRows,
    otherExpenses,
    totalIncome,
    totalCogs,
    grossProfit,
    totalExpenses,
    netProfit,
  });
}

export async function getCustomerOutstandingReport() {
  const prisma = getCompanyPrisma();
  const customers = await prisma.customer.findMany({
    include: { salesman: true },
    orderBy: { name: "asc" },
  });

  const invoices = await prisma.salesInvoice.findMany({
    where: { isCredit: true },
    select: { customerId: true, total: true, paidAmount: true },
  });

  const rows = customers
    .map((customer) => {
      const invoiceOutstanding = invoices
        .filter((inv) => inv.customerId === customer.id)
        .reduce((sum, inv) => sum + (inv.total - inv.paidAmount), 0);
      const outstanding = roundMoney(customer.openingBalance + invoiceOutstanding);
      return {
        customerId: customer.id,
        code: customer.code,
        name: customer.name,
        salesman: customer.salesman?.name ?? "-",
        creditLimit: customer.creditLimit,
        openingBalance: customer.openingBalance,
        outstanding,
        available: roundMoney(customer.creditLimit - outstanding),
      };
    })
    .filter((row) => row.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  return success({
    rows,
    totalOutstanding: roundMoney(rows.reduce((sum, row) => sum + row.outstanding, 0)),
  });
}

export async function getCustomerSalesReport(payload = {}) {
  const prisma = getCompanyPrisma();
  const { start, end } = parseDateRange(payload);

  const invoices = await prisma.salesInvoice.findMany({
    where: { date: { gte: start, lte: end } },
    include: { customer: true },
  });

  const map = new Map();
  for (const invoice of invoices) {
    const key = invoice.customerId;
    if (!map.has(key)) {
      map.set(key, {
        customerId: invoice.customerId,
        code: invoice.customer.code,
        name: invoice.customer.name,
        invoiceCount: 0,
        salesTotal: 0,
        paidAmount: 0,
      });
    }
    const row = map.get(key);
    row.invoiceCount += 1;
    row.salesTotal = roundMoney(row.salesTotal + invoice.total);
    row.paidAmount = roundMoney(row.paidAmount + invoice.paidAmount);
  }

  const rows = Array.from(map.values()).sort((a, b) => b.salesTotal - a.salesTotal);
  return success({
    rows,
    totalSales: roundMoney(rows.reduce((sum, row) => sum + row.salesTotal, 0)),
  });
}

export async function getRecoveryReport(payload = {}) {
  const prisma = getCompanyPrisma();
  const { start, end } = parseDateRange(payload);

  const recoveries = await prisma.recoveryVoucher.findMany({
    where: { date: { gte: start, lte: end } },
    include: { customer: true, salesman: true },
    orderBy: { date: "desc" },
  });

  const rows = recoveries.map((recovery) => ({
    number: recovery.number,
    date: recovery.date,
    customer: recovery.customer.name,
    salesman: recovery.salesman?.name ?? "-",
    paymentMode: recovery.paymentMode,
    amount: recovery.amount,
  }));

  return success({
    rows,
    totalRecovered: roundMoney(rows.reduce((sum, row) => sum + row.amount, 0)),
  });
}

export async function getSalesmanReport(payload = {}) {
  const prisma = getCompanyPrisma();
  const { start, end } = parseDateRange(payload);

  const salesmen = await prisma.salesman.findMany({ orderBy: { name: "asc" } });
  const invoices = await prisma.salesInvoice.findMany({
    where: { date: { gte: start, lte: end }, salesmanId: { not: null } },
  });
  const recoveries = await prisma.recoveryVoucher.findMany({
    where: { date: { gte: start, lte: end }, salesmanId: { not: null } },
  });

  const rows = salesmen.map((salesman) => {
    const salesTotal = roundMoney(
      invoices
        .filter((inv) => inv.salesmanId === salesman.id)
        .reduce((sum, inv) => sum + inv.total, 0)
    );
    const recoveryTotal = roundMoney(
      recoveries
        .filter((rec) => rec.salesmanId === salesman.id)
        .reduce((sum, rec) => sum + rec.amount, 0)
    );
    const commissionRate = salesman.commissionRate || 0;
    const salesCommission = roundMoney(salesTotal * (commissionRate / 100));
    const recoveryCommission = roundMoney(recoveryTotal * (commissionRate / 100));

    return {
      salesmanId: salesman.id,
      name: salesman.name,
      commissionRate,
      salesTotal,
      recoveryTotal,
      salesCommission,
      recoveryCommission,
      totalCommission: roundMoney(salesCommission + recoveryCommission),
    };
  }).filter((row) => row.salesTotal > 0 || row.recoveryTotal > 0);

  return success({ rows });
}

export async function getProductSalesReport(payload = {}) {
  const prisma = getCompanyPrisma();
  const { start, end } = parseDateRange(payload);

  const items = await prisma.salesItem.findMany({
    where: { salesInvoice: { date: { gte: start, lte: end } } },
    include: { product: true, salesInvoice: true },
  });

  const map = new Map();
  for (const item of items) {
    const key = item.productId;
    if (!map.has(key)) {
      map.set(key, {
        productId: item.productId,
        code: item.product.code,
        name: item.product.name,
        quantity: 0,
        salesValue: 0,
        cogs: 0,
      });
    }
    const row = map.get(key);
    row.quantity = roundMoney(row.quantity + item.quantity);
    row.salesValue = roundMoney(row.salesValue + item.lineTotal);
    row.cogs = roundMoney(row.cogs + (item.costAmount || 0));
  }

  const rows = Array.from(map.values())
    .map((row) => ({
      ...row,
      profit: roundMoney(row.salesValue - row.cogs),
    }))
    .sort((a, b) => b.salesValue - a.salesValue);

  return success({
    rows,
    totalSales: roundMoney(rows.reduce((sum, row) => sum + row.salesValue, 0)),
    totalProfit: roundMoney(rows.reduce((sum, row) => sum + row.profit, 0)),
  });
}

export async function getPurchaseReport(payload = {}) {
  const prisma = getCompanyPrisma();
  const { start, end } = parseDateRange(payload);

  const invoices = await prisma.purchaseInvoice.findMany({
    where: { date: { gte: start, lte: end } },
    include: { vendor: true },
    orderBy: { date: "desc" },
  });

  const rows = invoices.map((invoice) => ({
    number: invoice.number,
    date: invoice.date,
    vendor: invoice.vendor.name,
    subtotal: invoice.subtotal,
    taxTotal: invoice.taxTotal,
    total: invoice.total,
    paidAmount: invoice.paidAmount,
    outstanding: roundMoney(invoice.total - invoice.paidAmount),
    isCredit: invoice.isCredit,
  }));

  const vendorMap = new Map();
  for (const invoice of invoices) {
    const key = invoice.vendorId;
    if (!vendorMap.has(key)) {
      vendorMap.set(key, {
        vendorId: invoice.vendorId,
        vendor: invoice.vendor.name,
        invoiceCount: 0,
        purchaseTotal: 0,
      });
    }
    const row = vendorMap.get(key);
    row.invoiceCount += 1;
    row.purchaseTotal = roundMoney(row.purchaseTotal + invoice.total);
  }

  return success({
    rows,
    byVendor: Array.from(vendorMap.values()).sort((a, b) => b.purchaseTotal - a.purchaseTotal),
    totalPurchases: roundMoney(rows.reduce((sum, row) => sum + row.total, 0)),
  });
}

export async function getStockValuationReport() {
  const prisma = getCompanyPrisma();
  const stock = await prisma.stock.findMany({
    include: {
      product: { include: { baseUnit: true } },
      warehouse: true,
    },
    orderBy: [{ warehouseId: "asc" }, { productId: "asc" }],
  });

  const rows = stock.map((row) => ({
    productCode: row.product.code,
    productName: row.product.name,
    warehouse: row.warehouse.name,
    batchNo: row.batchNo ?? "-",
    quantity: row.quantity,
    costPerUnit: row.costPerUnit,
    value: roundMoney(row.quantity * row.costPerUnit),
    expiryDate: row.expiryDate,
  }));

  return success({
    rows,
    totalValue: roundMoney(rows.reduce((sum, row) => sum + row.value, 0)),
    totalQuantity: roundMoney(rows.reduce((sum, row) => sum + row.quantity, 0)),
  });
}

export async function getCommissionReport(payload = {}) {
  return getSalesmanReport(payload);
}

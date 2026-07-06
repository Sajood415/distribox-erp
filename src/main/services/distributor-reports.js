import { getCompanyPrisma } from "../db/init";
import { roundMoney } from "../utils/money";
import { getCustomerOutstanding } from "../domain/customer-outstanding";
import { getStockValuation } from "../domain/stock-quantity";
import { getDailyCashPosition } from "./financial-reports";
import { getIncomeStatement } from "./reports";

function success(data) {
  return { success: true, data };
}

function dayRange(dateInput) {
  const date = dateInput ? new Date(dateInput) : new Date();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end, date };
}

export async function getDailyRecoverySheet(payload = {}) {
  const prisma = getCompanyPrisma();
  const { start, end } = dayRange(payload.date);

  const recoveries = await prisma.recoveryVoucher.findMany({
    where: { date: { gte: start, lte: end } },
    include: { customer: true, salesman: true, items: true },
    orderBy: { date: "asc" },
  });

  const rows = recoveries.map((row) => ({
    number: row.number,
    date: row.date,
    customer: row.customer.name,
    salesman: row.salesman?.name ?? "-",
    amount: row.amount,
    paymentMode: row.paymentMode,
  }));

  return success({
    rows,
    totalRecovery: roundMoney(rows.reduce((sum, row) => sum + row.amount, 0)),
  });
}

export async function getRecoveryBySalesman(payload = {}) {
  const prisma = getCompanyPrisma();
  const { start, end } = dayRange(payload.date);

  const recoveries = await prisma.recoveryVoucher.findMany({
    where: { date: { gte: start, lte: end } },
    include: { salesman: true },
  });

  const map = new Map();
  for (const row of recoveries) {
    const key = row.salesmanId || 0;
    if (!map.has(key)) {
      map.set(key, { salesman: row.salesman?.name ?? "Unassigned", amount: 0, count: 0 });
    }
    const entry = map.get(key);
    entry.amount = roundMoney(entry.amount + row.amount);
    entry.count += 1;
  }

  return success({ rows: Array.from(map.values()).sort((a, b) => b.amount - a.amount) });
}

export async function getRecoveryByCustomer(payload = {}) {
  const prisma = getCompanyPrisma();
  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
  const rows = [];
  for (const customer of customers) {
    const outstanding = await getCustomerOutstanding(prisma, customer.id);
    if (outstanding > 0) {
      rows.push({
        code: customer.code,
        name: customer.name,
        outstanding,
      });
    }
  }
  return success({ rows: rows.sort((a, b) => b.outstanding - a.outstanding) });
}

export async function getPendingRecoveryReport() {
  return getRecoveryByCustomer();
}

export async function getRecoveryPerformance(payload = {}) {
  const prisma = getCompanyPrisma();
  const { start, end } = dayRange(payload.date);

  const [recoveries, sales] = await Promise.all([
    prisma.recoveryVoucher.findMany({
      where: { date: { gte: start, lte: end } },
      include: { salesman: true },
    }),
    prisma.salesInvoice.findMany({
      where: { date: { gte: start, lte: end }, isCredit: true },
      include: { salesman: true },
    }),
  ]);

  const map = new Map();
  for (const invoice of sales) {
    const key = invoice.salesmanId || 0;
    if (!map.has(key)) map.set(key, { salesman: invoice.salesman?.name ?? "Unassigned", sales: 0, recovery: 0 });
    map.get(key).sales = roundMoney(map.get(key).sales + invoice.total);
  }
  for (const recovery of recoveries) {
    const key = recovery.salesmanId || 0;
    if (!map.has(key)) map.set(key, { salesman: recovery.salesman?.name ?? "Unassigned", sales: 0, recovery: 0 });
    map.get(key).recovery = roundMoney(map.get(key).recovery + recovery.amount);
  }

  const rows = Array.from(map.values()).map((row) => ({
    ...row,
    achievement: row.sales > 0 ? roundMoney((row.recovery / row.sales) * 100) : 0,
  }));

  return success({ rows });
}

export async function getRecoveryAgingReport(payload = {}) {
  const prisma = getCompanyPrisma();
  const asOf = payload.asOfDate ? new Date(payload.asOfDate) : new Date();
  const customers = await prisma.customer.findMany({ include: { salesman: true } });
  const rows = [];
  for (const customer of customers) {
    const outstanding = await getCustomerOutstanding(prisma, customer.id);
    if (outstanding <= 0) continue;
    const oldest = await prisma.salesInvoice.findFirst({
      where: { customerId: customer.id, isCredit: true },
      orderBy: { date: "asc" },
    });
    const days = oldest ? Math.floor((asOf - new Date(oldest.date)) / 86400000) : 0;
    rows.push({
      customer: customer.name,
      salesman: customer.salesman?.name ?? "-",
      outstanding,
      days,
      bucket: days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+",
    });
  }
  return success({ rows });
}

export async function getRouteReport(payload = {}) {
  const prisma = getCompanyPrisma();
  const { start, end } = dayRange(payload.date);

  const routes = await prisma.route.findMany({
    include: { salesman: true, customers: true },
    orderBy: { name: "asc" },
  });

  const rows = [];
  for (const route of routes) {
    const customerIds = route.customers.map((c) => c.id);
    const sales = await prisma.salesInvoice.findMany({
      where: { customerId: { in: customerIds }, date: { gte: start, lte: end } },
    });
    const recoveries = await prisma.recoveryVoucher.findMany({
      where: { customerId: { in: customerIds }, date: { gte: start, lte: end } },
    });
    let outstanding = 0;
    for (const customer of route.customers) {
      outstanding = roundMoney(outstanding + (await getCustomerOutstanding(prisma, customer.id)));
    }
    rows.push({
      route: route.name,
      salesman: route.salesman?.name ?? "-",
      customers: route.customers.length,
      sales: roundMoney(sales.reduce((sum, row) => sum + row.total, 0)),
      recovery: roundMoney(recoveries.reduce((sum, row) => sum + row.amount, 0)),
      outstanding,
    });
  }

  return success({ rows });
}

export async function getDailyRouteSummary(payload = {}) {
  return getRouteReport(payload);
}

export async function getDailyCashSummary(payload = {}) {
  const prisma = getCompanyPrisma();
  const { start, end, date } = dayRange(payload.date);

  const cashPosition = await getDailyCashPosition({ date: date.toISOString() });
  const cashSales = await prisma.salesInvoice.findMany({
    where: { date: { gte: start, lte: end }, isCredit: false },
  });
  const cashRecoveries = await prisma.recoveryVoucher.findMany({
    where: { date: { gte: start, lte: end }, paymentMode: "Cash" },
  });
  const expenses = await prisma.expenseVoucher.findMany({
    where: { date: { gte: start, lte: end } },
  });
  const cashPayments = await prisma.vendorPaymentVoucher.findMany({
    where: { date: { gte: start, lte: end }, paymentMode: "Cash" },
  });

  const cashSalesTotal = roundMoney(cashSales.reduce((sum, row) => sum + row.total, 0));
  const cashRecoveryTotal = roundMoney(cashRecoveries.reduce((sum, row) => sum + row.amount, 0));
  const expenseTotal = roundMoney(expenses.reduce((sum, row) => sum + row.amount, 0));
  const paymentTotal = roundMoney(cashPayments.reduce((sum, row) => sum + row.amount, 0));

  return success({
    date,
    openingCash: cashPosition.success ? cashPosition.data.opening : 0,
    cashSales: cashSalesTotal,
    cashRecovery: cashRecoveryTotal,
    cashPayments: paymentTotal,
    expenses: expenseTotal,
    closingCash: cashPosition.success ? cashPosition.data.closing : 0,
    rows: expenses.map((row) => ({
      type: "Expense",
      reference: row.number,
      amount: row.amount,
      description: row.description,
    })),
  });
}

export async function getDailyFinalSheet(payload = {}) {
  const prisma = getCompanyPrisma();
  const { start, end, date } = dayRange(payload.date);

  const [sales, recoverySheet, cashSummary, claims, stock, salesmanPerf, profit] = await Promise.all([
    prisma.salesInvoice.findMany({
      where: { date: { gte: start, lte: end } },
      include: { customer: true, salesman: true },
    }),
    getDailyRecoverySheet({ date: date.toISOString() }),
    getDailyCashSummary({ date: date.toISOString() }),
    prisma.claim.findMany({ where: { date: { gte: start, lte: end } } }),
    getStockValuation(prisma),
    getRecoveryPerformance({ date: date.toISOString() }),
    getIncomeStatement({ startDate: start.toISOString(), endDate: end.toISOString() }),
  ]);

  return success({
    date,
    sales: {
      count: sales.length,
      total: roundMoney(sales.reduce((sum, row) => sum + row.total, 0)),
      rows: sales.map((row) => ({
        number: row.number,
        customer: row.customer.name,
        salesman: row.salesman?.name ?? "-",
        total: row.total,
      })),
    },
    recovery: recoverySheet.success ? recoverySheet.data : { rows: [], totalRecovery: 0 },
    cash: cashSummary.success ? cashSummary.data : null,
    claims: {
      count: claims.length,
      total: roundMoney(claims.reduce((sum, row) => sum + row.total, 0)),
    },
    stock: stock,
    salesman: salesmanPerf.success ? salesmanPerf.data.rows : [],
    profit: profit.success ? profit.data.netProfit : 0,
  });
}

export async function globalSearch(payload = {}) {
  const prisma = getCompanyPrisma();
  const q = String(payload.query || "").trim();
  if (!q) return success({ results: [] });

  const [customers, products, vendors, sales, purchases, recoveries, claims, purchaseOrders, loadSlips] =
    await Promise.all([
    prisma.customer.findMany({
      where: { OR: [{ code: { contains: q } }, { name: { contains: q } }] },
      take: 10,
    }),
    prisma.product.findMany({
      where: { OR: [{ code: { contains: q } }, { name: { contains: q } }] },
      take: 10,
    }),
    prisma.vendor.findMany({
      where: { OR: [{ code: { contains: q } }, { name: { contains: q } }] },
      take: 10,
    }),
    prisma.salesInvoice.findMany({ where: { number: { contains: q } }, take: 10 }),
    prisma.purchaseInvoice.findMany({ where: { number: { contains: q } }, take: 10 }),
    prisma.recoveryVoucher.findMany({ where: { number: { contains: q } }, take: 10 }),
    prisma.claim.findMany({ where: { number: { contains: q } }, take: 10 }),
    prisma.purchaseOrder.findMany({ where: { number: { contains: q } }, take: 10 }),
    prisma.loadSlip.findMany({ where: { number: { contains: q } }, take: 10 }),
  ]);

  const results = [
    ...customers.map((row) => ({ type: "Customer", label: `${row.code} — ${row.name}`, route: `/masters/customers?docId=${row.id}` })),
    ...vendors.map((row) => ({ type: "Supplier", label: `${row.code} — ${row.name}`, route: `/masters/vendors?docId=${row.id}` })),
    ...products.map((row) => ({ type: "Product", label: `${row.code} — ${row.name}`, route: `/masters/products?docId=${row.id}` })),
    ...sales.map((row) => ({ type: "Sales Invoice", label: row.number, route: `/sales/invoices?docId=${row.id}` })),
    ...purchases.map((row) => ({ type: "Purchase Invoice", label: row.number, route: `/purchase/invoices?docId=${row.id}` })),
    ...purchaseOrders.map((row) => ({ type: "Purchase Order", label: row.number, route: `/purchase/orders?docId=${row.id}` })),
    ...loadSlips.map((row) => ({ type: "Load Slip", label: row.number, route: `/sales/load-slips?docId=${row.id}` })),
    ...recoveries.map((row) => ({ type: "Recovery", label: row.number, route: `/sales/recovery?docId=${row.id}` })),
    ...claims.map((row) => ({ type: "Claim", label: row.number, route: `/claims?docId=${row.id}` })),
  ];

  return success({ results });
}

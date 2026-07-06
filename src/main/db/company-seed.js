import { seedCompanySettings, applyRuntimeSettings } from "../services/settings-service";
import { seedAccountMappings } from "../services/account-mapping-service";

const DEFAULT_UNITS = [
  { code: "PC", name: "Piece" },
  { code: "PK", name: "Pack" },
  { code: "CTN", name: "Carton" },
];

const DEFAULT_ACCOUNTS = [
  { code: "1000", name: "Assets", type: "Asset" },
  { code: "1100", name: "Cash", type: "Asset" },
  { code: "1200", name: "Bank", type: "Asset" },
  { code: "1300", name: "Inventory", type: "Asset" },
  { code: "1400", name: "Accounts Receivable", type: "Asset" },
  { code: "2000", name: "Liabilities", type: "Liability" },
  { code: "2100", name: "Accounts Payable", type: "Liability" },
  { code: "2200", name: "Tax Payable", type: "Liability" },
  { code: "3000", name: "Equity", type: "Equity" },
  { code: "4000", name: "Sales Revenue", type: "Income" },
  { code: "4100", name: "Freight Income", type: "Income" },
  { code: "5000", name: "Cost of Goods Sold", type: "Expense" },
  { code: "5100", name: "Operating Expenses", type: "Expense" },
  { code: "5200", name: "Inventory Adjustment Gain", type: "Income" },
  { code: "5210", name: "Inventory Adjustment Loss", type: "Expense" },
];

const DEFAULT_DELIVERY_MEN = [{ name: "Default Delivery" }];

async function ensureDefaultAccounts(prisma) {
  for (const account of DEFAULT_ACCOUNTS) {
    const existing = await prisma.account.findUnique({ where: { code: account.code } });
    if (!existing) {
      await prisma.account.create({ data: account });
    }
  }
}

export async function seedCompanyDatabase(prisma) {
  const unitCount = await prisma.unit.count();
  if (unitCount === 0) {
    await prisma.unit.createMany({ data: DEFAULT_UNITS });
  }

  const accountCount = await prisma.account.count();
  if (accountCount === 0) {
    await prisma.account.createMany({ data: DEFAULT_ACCOUNTS });
  } else {
    await ensureDefaultAccounts(prisma);
  }

  const deliveryCount = await prisma.deliveryMan.count();
  if (deliveryCount === 0) {
    await prisma.deliveryMan.createMany({ data: DEFAULT_DELIVERY_MEN });
  }

  await seedCompanySettings(prisma);
  await seedAccountMappings(prisma);
  await applyRuntimeSettings();
}

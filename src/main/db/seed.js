import bcrypt from "bcryptjs";

const DEFAULT_PERMISSIONS = {
  admin: [
    "dashboard.view",
    "masters.view",
    "masters.edit",
    "inventory.view",
    "inventory.edit",
    "sales.view",
    "sales.edit",
    "purchase.view",
    "purchase.edit",
    "accounting.view",
    "accounting.edit",
    "reports.view",
    "settings.view",
    "settings.edit",
    "users.manage",
  ],
  salesman: [
    "dashboard.view",
    "masters.view",
    "sales.view",
    "sales.edit",
    "reports.view",
  ],
  accountant: [
    "dashboard.view",
    "masters.view",
    "purchase.view",
    "purchase.edit",
    "accounting.view",
    "accounting.edit",
    "reports.view",
  ],
};

export async function seedMasterDatabase(prisma) {
  const roleCount = await prisma.role.count();
  if (roleCount > 0) {
    return;
  }

  const adminRole = await prisma.role.create({
    data: {
      name: "Admin",
      permissions: JSON.stringify(DEFAULT_PERMISSIONS.admin),
    },
  });

  await prisma.role.createMany({
    data: [
      {
        name: "Salesman",
        permissions: JSON.stringify(DEFAULT_PERMISSIONS.salesman),
      },
      {
        name: "Accountant",
        permissions: JSON.stringify(DEFAULT_PERMISSIONS.accountant),
      },
    ],
  });

  const defaultCompany = await prisma.company.create({
    data: {
      name: "Distribox Demo",
      code: "DEMO",
      dbFile: "demo.db",
    },
  });

  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.user.create({
    data: {
      username: "admin",
      passwordHash,
      roleId: adminRole.id,
      companyId: defaultCompany.id,
    },
  });
}

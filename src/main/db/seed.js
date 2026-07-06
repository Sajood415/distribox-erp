import bcrypt from "bcryptjs";

const ADMIN_ROLE_NAME = "Admin";

export async function seedMasterDatabase(prisma) {
  let adminRole = await prisma.role.findUnique({ where: { name: ADMIN_ROLE_NAME } });

  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: {
        name: ADMIN_ROLE_NAME,
        permissions: "[]",
      },
    });
  }

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return;
  }

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

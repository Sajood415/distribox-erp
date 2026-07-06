import { getCompanyPrisma } from "../db/init";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

async function handleUniqueError(error) {
  if (error.code === "P2002") {
    return failure("A record with this code already exists");
  }
  throw error;
}

export async function listUnits() {
  const prisma = getCompanyPrisma();
  const data = await prisma.unit.findMany({ orderBy: { name: "asc" } });
  return success(data);
}

export async function saveUnit(payload) {
  const prisma = getCompanyPrisma();
  const data = {
    name: payload.name?.trim(),
    code: payload.code?.trim().toUpperCase(),
  };

  try {
    if (payload.id) {
      const updated = await prisma.unit.update({ where: { id: payload.id }, data });
      return success(updated);
    }
    const created = await prisma.unit.create({ data });
    return success(created);
  } catch (error) {
    return handleUniqueError(error);
  }
}

export async function deleteUnit(id) {
  const prisma = getCompanyPrisma();
  try {
    await prisma.unit.delete({ where: { id } });
    return success(true);
  } catch (error) {
    if (error.code === "P2003") {
      return failure("Cannot delete unit linked to products");
    }
    throw error;
  }
}

export async function listWarehouses() {
  const prisma = getCompanyPrisma();
  const data = await prisma.warehouse.findMany({ orderBy: { name: "asc" } });
  return success(data);
}

export async function saveWarehouse(payload) {
  const prisma = getCompanyPrisma();
  const data = {
    name: payload.name?.trim(),
    address: payload.address?.trim() || null,
  };

  if (payload.id) {
    const updated = await prisma.warehouse.update({ where: { id: payload.id }, data });
    return success(updated);
  }
  const created = await prisma.warehouse.create({ data });
  return success(created);
}

export async function deleteWarehouse(id) {
  const prisma = getCompanyPrisma();
  await prisma.warehouse.delete({ where: { id } });
  return success(true);
}

export async function listAccounts() {
  const prisma = getCompanyPrisma();
  const data = await prisma.account.findMany({ orderBy: { code: "asc" } });
  return success(data);
}

export async function saveAccount(payload) {
  const prisma = getCompanyPrisma();
  const data = {
    code: payload.code?.trim(),
    name: payload.name?.trim(),
    type: payload.type,
    parentId: payload.parentId ? Number(payload.parentId) : null,
  };

  try {
    if (payload.id) {
      const updated = await prisma.account.update({ where: { id: payload.id }, data });
      return success(updated);
    }
    const created = await prisma.account.create({ data });
    return success(created);
  } catch (error) {
    return handleUniqueError(error);
  }
}

export async function deleteAccount(id) {
  const prisma = getCompanyPrisma();
  try {
    await prisma.account.delete({ where: { id } });
    return success(true);
  } catch (error) {
    if (error.code === "P2003") {
      return failure("Cannot delete account linked to customers or vendors");
    }
    throw error;
  }
}

export async function listRoutes() {
  const prisma = getCompanyPrisma();
  const data = await prisma.route.findMany({ orderBy: { name: "asc" } });
  return success(data);
}

export async function saveRoute(payload) {
  const prisma = getCompanyPrisma();
  const data = { name: payload.name?.trim() };

  if (payload.id) {
    const updated = await prisma.route.update({ where: { id: payload.id }, data });
    return success(updated);
  }
  const created = await prisma.route.create({ data });
  return success(created);
}

export async function deleteRoute(id) {
  const prisma = getCompanyPrisma();
  try {
    await prisma.route.delete({ where: { id } });
    return success(true);
  } catch (error) {
    if (error.code === "P2003") {
      return failure("Cannot delete route linked to customers");
    }
    throw error;
  }
}

export async function listSalesmen() {
  const prisma = getCompanyPrisma();
  const data = await prisma.salesman.findMany({ orderBy: { name: "asc" } });
  return success(data);
}

export async function saveSalesman(payload) {
  const prisma = getCompanyPrisma();
  const data = {
    name: payload.name?.trim(),
    commissionRate: Number(payload.commissionRate) || 0,
  };

  if (payload.id) {
    const updated = await prisma.salesman.update({ where: { id: payload.id }, data });
    return success(updated);
  }
  const created = await prisma.salesman.create({ data });
  return success(created);
}

export async function deleteSalesman(id) {
  const prisma = getCompanyPrisma();
  try {
    await prisma.salesman.delete({ where: { id } });
    return success(true);
  } catch (error) {
    if (error.code === "P2003") {
      return failure("Cannot delete salesman linked to customers");
    }
    throw error;
  }
}

export async function listProducts() {
  const prisma = getCompanyPrisma();
  const data = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: { baseUnit: true },
  });
  return success(data);
}

export async function saveProduct(payload) {
  const prisma = getCompanyPrisma();
  const data = {
    code: payload.code?.trim().toUpperCase(),
    name: payload.name?.trim(),
    brand: payload.brand?.trim() || null,
    category: payload.category?.trim() || null,
    baseUnitId: Number(payload.baseUnitId),
    packSize: Number(payload.packSize) || 1,
    price1: Number(payload.price1) || 0,
    price2: payload.price2 !== "" && payload.price2 != null ? Number(payload.price2) : null,
    price3: payload.price3 !== "" && payload.price3 != null ? Number(payload.price3) : null,
    costPrice: Number(payload.costPrice) || 0,
    vatPercent: Number(payload.vatPercent) || 0,
    reorderLevel: Number(payload.reorderLevel) || 0,
    expireDays: payload.expireDays !== "" && payload.expireDays != null ? Number(payload.expireDays) : null,
    haltOnExpiry: Boolean(payload.haltOnExpiry),
    active: payload.active !== false,
    barCode: payload.barCode?.trim() || null,
  };

  try {
    if (payload.id) {
      const updated = await prisma.product.update({ where: { id: payload.id }, data });
      return success(updated);
    }
    const created = await prisma.product.create({ data });
    return success(created);
  } catch (error) {
    return handleUniqueError(error);
  }
}

export async function deleteProduct(id) {
  const prisma = getCompanyPrisma();
  await prisma.product.delete({ where: { id } });
  return success(true);
}

export async function listCustomers() {
  const prisma = getCompanyPrisma();
  const data = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    include: { salesman: true, route: true },
  });
  return success(data);
}

export async function saveCustomer(payload) {
  const prisma = getCompanyPrisma();
  const data = {
    code: payload.code?.trim().toUpperCase(),
    name: payload.name?.trim(),
    address: payload.address?.trim() || null,
    city: payload.city?.trim() || null,
    area: payload.area?.trim() || null,
    salesmanId: payload.salesmanId ? Number(payload.salesmanId) : null,
    routeId: payload.routeId ? Number(payload.routeId) : null,
    creditDays: Number(payload.creditDays) || 0,
    creditLimit: Number(payload.creditLimit) || 0,
    ntn: payload.ntn?.trim() || null,
    strn: payload.strn?.trim() || null,
    openingBalance: Number(payload.openingBalance) || 0,
    accountId: payload.accountId ? Number(payload.accountId) : null,
  };

  try {
    if (payload.id) {
      const updated = await prisma.customer.update({ where: { id: payload.id }, data });
      return success(updated);
    }
    const created = await prisma.customer.create({ data });
    return success(created);
  } catch (error) {
    return handleUniqueError(error);
  }
}

export async function deleteCustomer(id) {
  const prisma = getCompanyPrisma();
  await prisma.customer.delete({ where: { id } });
  return success(true);
}

export async function listVendors() {
  const prisma = getCompanyPrisma();
  const data = await prisma.vendor.findMany({ orderBy: { name: "asc" } });
  return success(data);
}

export async function saveVendor(payload) {
  const prisma = getCompanyPrisma();
  const data = {
    code: payload.code?.trim().toUpperCase(),
    name: payload.name?.trim(),
    address: payload.address?.trim() || null,
    city: payload.city?.trim() || null,
    paymentTerms: Number(payload.paymentTerms) || 30,
    creditLimit: Number(payload.creditLimit) || 0,
    strn: payload.strn?.trim() || null,
    openingBalance: Number(payload.openingBalance) || 0,
    accountId: payload.accountId ? Number(payload.accountId) : null,
  };

  try {
    if (payload.id) {
      const updated = await prisma.vendor.update({ where: { id: payload.id }, data });
      return success(updated);
    }
    const created = await prisma.vendor.create({ data });
    return success(created);
  } catch (error) {
    return handleUniqueError(error);
  }
}

export async function deleteVendor(id) {
  const prisma = getCompanyPrisma();
  await prisma.vendor.delete({ where: { id } });
  return success(true);
}

export async function getMasterLookups() {
  const prisma = getCompanyPrisma();
  const [units, salesmen, routes, accounts] = await Promise.all([
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
    prisma.salesman.findMany({ orderBy: { name: "asc" } }),
    prisma.route.findMany({ orderBy: { name: "asc" } }),
    prisma.account.findMany({ orderBy: { code: "asc" } }),
  ]);
  return success({ units, salesmen, routes, accounts });
}

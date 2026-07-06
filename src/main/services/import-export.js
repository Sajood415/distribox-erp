import { readFileSync, writeFileSync } from "fs";
import { dialog } from "electron";
import { getCompanyPrisma } from "../db/init";
import { saveProduct, saveCustomer, saveVendor } from "./masters";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

function escapeCsv(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows, columns) {
  const header = columns.map((col) => escapeCsv(col.header)).join(",");
  const lines = rows.map((row) => columns.map((col) => escapeCsv(row[col.key])).join(","));
  return [header, ...lines].join("\n");
}

function parseCsv(content) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.toLowerCase());
  return rows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });
    return record;
  });
}

const EXPORT_CONFIG = {
  products: {
    filename: "products.csv",
    columns: [
      { key: "code", header: "code" },
      { key: "name", header: "name" },
      { key: "brand", header: "brand" },
      { key: "category", header: "category" },
      { key: "unitCode", header: "unitCode" },
      { key: "price1", header: "price1" },
      { key: "costPrice", header: "costPrice" },
      { key: "vatPercent", header: "vatPercent" },
      { key: "reorderLevel", header: "reorderLevel" },
      { key: "barCode", header: "barCode" },
      { key: "active", header: "active" },
    ],
    async fetchRows() {
      const prisma = getCompanyPrisma();
      const products = await prisma.product.findMany({
        include: { baseUnit: true },
        orderBy: { code: "asc" },
      });
      return products.map((product) => ({
        code: product.code,
        name: product.name,
        brand: product.brand ?? "",
        category: product.category ?? "",
        unitCode: product.baseUnit.code,
        price1: product.price1,
        costPrice: product.costPrice,
        vatPercent: product.vatPercent,
        reorderLevel: product.reorderLevel,
        barCode: product.barCode ?? "",
        active: product.active ? "true" : "false",
      }));
    },
  },
  customers: {
    filename: "customers.csv",
    columns: [
      { key: "code", header: "code" },
      { key: "name", header: "name" },
      { key: "address", header: "address" },
      { key: "city", header: "city" },
      { key: "area", header: "area" },
      { key: "creditDays", header: "creditDays" },
      { key: "creditLimit", header: "creditLimit" },
      { key: "openingBalance", header: "openingBalance" },
    ],
    async fetchRows() {
      const prisma = getCompanyPrisma();
      const customers = await prisma.customer.findMany({ orderBy: { code: "asc" } });
      return customers.map((customer) => ({
        code: customer.code,
        name: customer.name,
        address: customer.address ?? "",
        city: customer.city ?? "",
        area: customer.area ?? "",
        creditDays: customer.creditDays,
        creditLimit: customer.creditLimit,
        openingBalance: customer.openingBalance,
      }));
    },
  },
  vendors: {
    filename: "vendors.csv",
    columns: [
      { key: "code", header: "code" },
      { key: "name", header: "name" },
      { key: "address", header: "address" },
      { key: "city", header: "city" },
      { key: "paymentTerms", header: "paymentTerms" },
      { key: "creditLimit", header: "creditLimit" },
      { key: "openingBalance", header: "openingBalance" },
    ],
    async fetchRows() {
      const prisma = getCompanyPrisma();
      const vendors = await prisma.vendor.findMany({ orderBy: { code: "asc" } });
      return vendors.map((vendor) => ({
        code: vendor.code,
        name: vendor.name,
        address: vendor.address ?? "",
        city: vendor.city ?? "",
        paymentTerms: vendor.paymentTerms,
        creditLimit: vendor.creditLimit,
        openingBalance: vendor.openingBalance,
      }));
    },
  },
};

async function resolveUnitId(unitCode) {
  const prisma = getCompanyPrisma();
  const unit = await prisma.unit.findFirst({
    where: { code: unitCode?.trim().toUpperCase() },
  });
  return unit?.id ?? null;
}

async function importProducts(records) {
  let imported = 0;
  const errors = [];

  for (const [index, record] of records.entries()) {
    const unitId = await resolveUnitId(record.unitcode || record.unitCode || "PC");
    if (!unitId) {
      errors.push(`Row ${index + 2}: unit not found (${record.unitcode || record.unitCode})`);
      continue;
    }

    const result = await saveProduct({
      code: record.code,
      name: record.name,
      brand: record.brand || null,
      category: record.category || null,
      baseUnitId: unitId,
      price1: Number(record.price1) || 0,
      costPrice: Number(record.costprice || record.costPrice) || 0,
      vatPercent: Number(record.vatpercent || record.vatPercent) || 0,
      reorderLevel: Number(record.reorderlevel || record.reorderLevel) || 0,
      barCode: record.barcode || record.barCode || null,
      active: String(record.active ?? "true").toLowerCase() !== "false",
    });

    if (result.success) {
      imported += 1;
    } else {
      errors.push(`Row ${index + 2}: ${result.error}`);
    }
  }

  return { imported, errors };
}

async function importCustomers(records) {
  let imported = 0;
  const errors = [];

  for (const [index, record] of records.entries()) {
    const result = await saveCustomer({
      code: record.code,
      name: record.name,
      address: record.address || null,
      city: record.city || null,
      area: record.area || null,
      creditDays: Number(record.creditdays || record.creditDays) || 0,
      creditLimit: Number(record.creditlimit || record.creditLimit) || 0,
      openingBalance: Number(record.openingbalance || record.openingBalance) || 0,
    });

    if (result.success) {
      imported += 1;
    } else {
      errors.push(`Row ${index + 2}: ${result.error}`);
    }
  }

  return { imported, errors };
}

async function importVendors(records) {
  let imported = 0;
  const errors = [];

  for (const [index, record] of records.entries()) {
    const result = await saveVendor({
      code: record.code,
      name: record.name,
      address: record.address || null,
      city: record.city || null,
      paymentTerms: Number(record.paymentterms || record.paymentTerms) || 30,
      creditLimit: Number(record.creditlimit || record.creditLimit) || 0,
      openingBalance: Number(record.openingbalance || record.openingBalance) || 0,
    });

    if (result.success) {
      imported += 1;
    } else {
      errors.push(`Row ${index + 2}: ${result.error}`);
    }
  }

  return { imported, errors };
}

const IMPORT_HANDLERS = {
  products: importProducts,
  customers: importCustomers,
  vendors: importVendors,
};

export function getExportEntities() {
  return success(Object.keys(EXPORT_CONFIG));
}

export async function exportEntityCsv(browserWindow, entity) {
  const config = EXPORT_CONFIG[entity];
  if (!config) {
    return failure("Unknown export entity");
  }

  const save = await dialog.showSaveDialog(browserWindow, {
    title: `Export ${entity}`,
    defaultPath: config.filename,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });

  if (save.canceled || !save.filePath) {
    return failure("Export cancelled");
  }

  try {
    const rows = await config.fetchRows();
    const csv = toCsv(rows, config.columns);
    writeFileSync(save.filePath, csv, "utf-8");
    return success({ filePath: save.filePath, rowCount: rows.length });
  } catch (error) {
    return failure(error.message || "Export failed");
  }
}

export async function importEntityCsv(browserWindow, entity) {
  const handler = IMPORT_HANDLERS[entity];
  if (!handler) {
    return failure("Unknown import entity");
  }

  const pick = await dialog.showOpenDialog(browserWindow, {
    title: `Import ${entity}`,
    filters: [{ name: "CSV", extensions: ["csv"] }],
    properties: ["openFile"],
  });

  if (pick.canceled || !pick.filePaths[0]) {
    return failure("Import cancelled");
  }

  try {
    const content = readFileSync(pick.filePaths[0], "utf-8");
    const records = parseCsv(content);
    if (records.length === 0) {
      return failure("CSV file is empty");
    }

    const result = await handler(records);
    return success({
      filePath: pick.filePaths[0],
      imported: result.imported,
      errors: result.errors,
      total: records.length,
    });
  } catch (error) {
    return failure(error.message || "Import failed");
  }
}

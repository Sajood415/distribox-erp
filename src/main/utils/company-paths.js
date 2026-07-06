import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { getDataDir, getActiveCompanyDb } from "../db/init";

export function getCompanyFolderName() {
  const dbFile = getActiveCompanyDb();
  if (!dbFile) return null;
  return dbFile.replace(/\.db$/i, "");
}

export function getCompanyRootPath() {
  const folder = getCompanyFolderName();
  if (!folder) return null;
  const root = join(getDataDir(), "companies", folder);
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }
  return root;
}

export function getCompanyDocumentsPath(subfolder = "") {
  const root = getCompanyRootPath();
  if (!root) return null;
  const documentsRoot = join(root, "documents", subfolder);
  if (!existsSync(documentsRoot)) {
    mkdirSync(documentsRoot, { recursive: true });
  }
  return documentsRoot;
}

export function getStoredDocumentRelativePath(documentType, documentNumber, extension = "pdf") {
  const safeNumber = documentNumber.replace(/[^a-zA-Z0-9-_]/g, "_");
  const folderMap = {
    SALES_INVOICE: "invoices",
    PURCHASE_INVOICE: "purchase-invoices",
    QUOTATION: "quotations",
    RECOVERY: "recoveries",
    REPORT: "reports",
  };
  const folder = folderMap[documentType] || "other";
  const filename = `${safeNumber}.${extension}`;
  return join("documents", folder, filename);
}

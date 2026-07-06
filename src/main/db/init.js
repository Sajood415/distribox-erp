import { app } from "electron";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { spawnSync } from "child_process";
import { PrismaClient as MasterPrismaClient } from "@prisma/master-client";
import { PrismaClient as CompanyPrismaClient } from "@prisma/company-client";
import { seedMasterDatabase } from "./seed";
import { seedCompanyDatabase } from "./company-seed";

let masterPrisma = null;
let companyPrisma = null;
let activeCompanyDb = null;

const MASTER_SCHEMA = "prisma/master/schema.prisma";
const COMPANY_SCHEMA = "prisma/company/schema.prisma";
const LEGACY_BASELINE = "20250706210000_baseline";

export function getDataDir() {
  const dataDir = join(app.getPath("userData"), "data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

export function getMasterPrisma() {
  if (!masterPrisma) {
    throw new Error("Master database not initialized");
  }
  return masterPrisma;
}

export function getCompanyPrisma() {
  if (!companyPrisma) {
    throw new Error("No company database connected. Select a company first.");
  }
  return companyPrisma;
}

export function getActiveCompanyDb() {
  return activeCompanyDb;
}

export async function disconnectDatabases() {
  if (companyPrisma) {
    await companyPrisma.$disconnect();
    companyPrisma = null;
  }
  if (masterPrisma) {
    await masterPrisma.$disconnect();
    masterPrisma = null;
  }
  activeCompanyDb = null;
}

export async function reconnectDatabases(companyDbFile = null) {
  await initDatabase();
  if (companyDbFile) {
    await connectCompanyDatabase(companyDbFile);
  }
  return { success: true };
}

function getProjectRoot() {
  return join(app.getAppPath());
}

function pauseSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* spin */
  }
}

function runPrismaCommand(args, databaseUrl, { retries = 5 } = {}) {
  const projectRoot = getProjectRoot();
  const prismaCli = join(projectRoot, "node_modules", "prisma", "build", "index.js");

  for (let attempt = 0; attempt < retries; attempt += 1) {
    const result = spawnSync(process.execPath, [prismaCli, ...args], {
      cwd: projectRoot,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        MASTER_DATABASE_URL: databaseUrl,
        COMPANY_DATABASE_URL: databaseUrl,
      },
      stdio: "pipe",
      encoding: "utf-8",
    });

    if (result.status === 0) {
      return result.stdout;
    }

    const message = [result.stderr, result.stdout].filter(Boolean).join("\n") || "Prisma command failed";
    const locked = /database is locked/i.test(message);
    if (locked && attempt < retries - 1) {
      pauseSync(250 * (attempt + 1));
      continue;
    }

    throw new Error(message);
  }

  throw new Error("Prisma command failed after retries");
}

function runMigrateDeploy(schemaFile, databaseUrl) {
  return runPrismaCommand(["migrate", "deploy", "--schema", schemaFile], databaseUrl);
}

function runMigrateResolve(schemaFile, databaseUrl, migrationName) {
  return runPrismaCommand(
    ["migrate", "resolve", "--applied", migrationName, "--schema", schemaFile],
    databaseUrl
  );
}

async function databaseHasTable(dbUrl, tableName) {
  const client = new MasterPrismaClient({ datasources: { db: { url: dbUrl } } });
  try {
    const rows = await client.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      tableName
    );
    return Array.isArray(rows) && rows.length > 0;
  } finally {
    await client.$disconnect();
  }
}

async function databaseHasMigrationsTable(dbUrl) {
  return databaseHasTable(dbUrl, "_prisma_migrations");
}

async function bootstrapLegacyMigrations(schemaFile, dbUrl, sentinelTable) {
  const dbPath = dbUrl.replace(/^file:/, "");
  if (!existsSync(dbPath)) {
    return;
  }

  const hasBusinessTables = await databaseHasTable(dbUrl, sentinelTable);
  const hasMigrations = await databaseHasMigrationsTable(dbUrl);

  if (hasBusinessTables && !hasMigrations) {
    runMigrateResolve(schemaFile, dbUrl, LEGACY_BASELINE);
  }
}

async function applyPragmas(client) {
  await client.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  await client.$executeRawUnsafe("PRAGMA synchronous = NORMAL;");
}

export async function initDatabase() {
  const dataDir = getDataDir();
  const dbPath = join(dataDir, "master.db");
  const dbUrl = `file:${dbPath.replace(/\\/g, "/")}`;

  process.env.MASTER_DATABASE_URL = dbUrl;

  await bootstrapLegacyMigrations(MASTER_SCHEMA, dbUrl, "User");
  runMigrateDeploy(MASTER_SCHEMA, dbUrl);

  masterPrisma = new MasterPrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  await applyPragmas(masterPrisma);
  await seedMasterDatabase(masterPrisma);
}

export async function connectCompanyDatabase(dbFile) {
  if (companyPrisma) {
    await companyPrisma.$disconnect();
    companyPrisma = null;
  }

  const dataDir = getDataDir();
  const dbPath = join(dataDir, dbFile);
  const dbUrl = `file:${dbPath.replace(/\\/g, "/")}`;

  process.env.COMPANY_DATABASE_URL = dbUrl;

  await bootstrapLegacyMigrations(COMPANY_SCHEMA, dbUrl, "Product");
  runMigrateDeploy(COMPANY_SCHEMA, dbUrl);

  companyPrisma = new CompanyPrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  await applyPragmas(companyPrisma);
  await seedCompanyDatabase(companyPrisma);

  activeCompanyDb = dbFile;
  return { success: true, dbFile };
}

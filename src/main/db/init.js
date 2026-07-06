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

function runDbPush(schemaFile, databaseUrl) {
  const projectRoot = getProjectRoot();
  const prismaCli = join(projectRoot, "node_modules", "prisma", "build", "index.js");
  const result = spawnSync(
    process.execPath,
    [prismaCli, "db", "push", "--skip-generate", "--schema", join(projectRoot, schemaFile)],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        MASTER_DATABASE_URL: databaseUrl,
        COMPANY_DATABASE_URL: databaseUrl,
      },
      stdio: "pipe",
      encoding: "utf-8",
    }
  );

  if (result.status !== 0) {
    const message = [result.stderr, result.stdout].filter(Boolean).join("\n") || "Database push failed";
    throw new Error(message);
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
  runDbPush("prisma/master.prisma", dbUrl);

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
  runDbPush("prisma/company.prisma", dbUrl);

  companyPrisma = new CompanyPrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  await applyPragmas(companyPrisma);
  await seedCompanyDatabase(companyPrisma);

  activeCompanyDb = dbFile;
  return { success: true, dbFile };
}

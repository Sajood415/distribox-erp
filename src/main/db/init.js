import { app } from "electron";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { spawnSync } from "child_process";
import { createRequire } from "module";
import { seedMasterDatabase } from "./seed";
import { seedCompanyDatabase } from "./company-seed";
import { startupLog } from "../startup-log.js";

let masterPrisma = null;
let companyPrisma = null;
let activeCompanyDb = null;
let MasterPrismaClient = null;
let CompanyPrismaClient = null;

const req = createRequire(import.meta.url);

async function loadPrismaClientClasses() {
  if (MasterPrismaClient && CompanyPrismaClient) {
    return { MasterPrismaClient, CompanyPrismaClient };
  }

  startupLog("Loading Prisma...");

  if (app.isPackaged) {
    const base = join(process.resourcesPath, "prisma-clients");
    startupLog(`Loading Master Client from: ${join(base, "master-client")}`);
    MasterPrismaClient = req(join(base, "master-client")).PrismaClient;
    startupLog("Loading Company Client...");
    startupLog(`Loading Company Client from: ${join(base, "company-client")}`);
    CompanyPrismaClient = req(join(base, "company-client")).PrismaClient;
  } else {
    startupLog("Loading Master Client (dev import)...");
    ({ PrismaClient: MasterPrismaClient } = await import("@prisma/master-client"));
    startupLog("Loading Company Client (dev import)...");
    ({ PrismaClient: CompanyPrismaClient } = await import("@prisma/company-client"));
  }

  startupLog("Prisma client classes loaded");
  return { MasterPrismaClient, CompanyPrismaClient };
}

function getProjectRoot() {
  return join(app.getAppPath());
}

function getUnpackedPath(...segments) {
  const root = getProjectRoot();
  const unpackedRoot = root.includes("app.asar")
    ? root.replace("app.asar", "app.asar.unpacked")
    : root;
  return join(unpackedRoot, ...segments);
}

function getPrismaCliPath() {
  const candidates = [
    join(process.resourcesPath, "node_modules", "prisma", "build", "index.js"),
    getUnpackedPath("node_modules", "prisma", "build", "index.js"),
    join(getProjectRoot(), "node_modules", "prisma", "build", "index.js"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return "(not found)";
}

function resolveSchemaPath(schemaRel) {
  if (app.isPackaged) {
    return join(process.resourcesPath, "prisma", schemaRel.replace(/^prisma\//, ""));
  }
  return join(getProjectRoot(), schemaRel);
}

function getMasterSchemaPath() {
  return resolveSchemaPath("prisma/master/schema.prisma");
}

function getCompanySchemaPath() {
  return resolveSchemaPath("prisma/company/schema.prisma");
}

function getQueryEnginePath() {
  if (app.isPackaged) {
    return join(process.resourcesPath, "prisma-clients", "master-client", "query_engine-windows.dll.node");
  }
  return join(getProjectRoot(), "node_modules", "@prisma", "master-client", "query_engine-windows.dll.node");
}

export function getInitDiagnostics() {
  const dataDir = getDataDir();
  const dbPath = join(dataDir, "master.db");
  const dbUrl = `file:${dbPath.replace(/\\/g, "/")}`;

  return {
    cwd: process.cwd(),
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
    dirname: typeof __dirname !== "undefined" ? __dirname : "(undefined)",
    schemaPath: getMasterSchemaPath(),
    prismaCliPath: getPrismaCliPath(),
    queryEnginePath: getQueryEnginePath(),
    masterClientPath: app.isPackaged
      ? join(process.resourcesPath, "prisma-clients", "master-client")
      : join(getProjectRoot(), "node_modules", "@prisma", "master-client"),
    dbUrl,
  };
}

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

function pauseSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* spin */
  }
}

function getMigrationFolderPath(schemaFile) {
  return join(schemaFile.replace(/[\\/]schema\.prisma$/, ""), "migrations");
}

function logMigrationFailure({ command, cwd, schemaFile, exitCode, stdout, stderr, attempt }) {
  startupLog("MIGRATION FAILED");
  startupLog(`attempt: ${attempt + 1}`);
  startupLog(`command: ${command}`);
  startupLog(`cwd: ${cwd}`);
  startupLog(`process.resourcesPath: ${process.resourcesPath}`);
  startupLog(`schema path: ${schemaFile}`);
  startupLog(`migration folder path: ${getMigrationFolderPath(schemaFile)}`);
  startupLog(`exit code: ${exitCode}`);
  startupLog(`stderr:\n${stderr || "(empty)"}`);
  startupLog(`stdout:\n${stdout || "(empty)"}`);
}

function runPrismaCommand(args, databaseUrl, { retries = 5, label = "prisma" } = {}) {
  const projectRoot = getProjectRoot();
  const prismaCli = getPrismaCliPath();
  const cwd = app.isPackaged ? process.resourcesPath : projectRoot;
  const schemaArgIndex = args.indexOf("--schema");
  const schemaFile = schemaArgIndex >= 0 ? args[schemaArgIndex + 1] : "(unknown)";
  const command = `${process.execPath} ${prismaCli} ${args.join(" ")}`;

  startupLog(`Running ${label}...`);
  startupLog(`command: ${command}`);
  startupLog(`cwd: ${cwd}`);
  startupLog(`process.resourcesPath: ${process.resourcesPath}`);
  startupLog(`schema path: ${schemaFile}`);
  startupLog(`migration folder path: ${getMigrationFolderPath(schemaFile)}`);

  for (let attempt = 0; attempt < retries; attempt += 1) {
    const result = spawnSync(process.execPath, [prismaCli, ...args], {
      cwd,
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
      startupLog(`${label} succeeded`);
      if (result.stdout?.trim()) {
        startupLog(`stdout:\n${result.stdout.trim()}`);
      }
      return result.stdout;
    }

    const stdout = result.stdout || "";
    const stderr = result.stderr || "";
    const message = [stderr, stdout].filter(Boolean).join("\n") || "Prisma command failed";
    const locked = /database is locked/i.test(message);
    if (locked && attempt < retries - 1) {
      startupLog(`database locked, retrying (attempt ${attempt + 2}/${retries})...`);
      pauseSync(250 * (attempt + 1));
      continue;
    }

    logMigrationFailure({
      command,
      cwd,
      schemaFile,
      exitCode: result.status,
      stdout,
      stderr,
      attempt,
    });

    const error = new Error(message);
    error.migrationDiagnostics = { command, cwd, schemaFile, exitCode: result.status, stdout, stderr };
    throw error;
  }

  throw new Error("Prisma command failed after retries");
}

function runMigrateDeploy(schemaFile, databaseUrl, label) {
  return runPrismaCommand(["migrate", "deploy", "--schema", schemaFile], databaseUrl, { label });
}

function runMigrateResolve(schemaFile, databaseUrl, migrationName) {
  return runPrismaCommand(
    ["migrate", "resolve", "--applied", migrationName, "--schema", schemaFile],
    databaseUrl
  );
}

async function databaseHasTable(dbUrl, tableName, PrismaClientCtor) {
  const client = new PrismaClientCtor({ datasources: { db: { url: dbUrl } } });
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

async function databaseHasMigrationsTable(dbUrl, PrismaClientCtor) {
  return databaseHasTable(dbUrl, "_prisma_migrations", PrismaClientCtor);
}

async function repairMigrationHistory(dbUrl, PrismaClientCtor) {
  try {
    const client = new PrismaClientCtor({ datasources: { db: { url: dbUrl } } });
    const hasMigrations = await databaseHasMigrationsTable(dbUrl, PrismaClientCtor);
    if (!hasMigrations) {
      await client.$disconnect();
      return;
    }

    await client.$executeRawUnsafe(
      `DELETE FROM _prisma_migrations
       WHERE finished_at IS NULL
         AND migration_name IN (
           SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL
         )`
    );
    await client.$disconnect();
  } catch {
    /* best-effort repair */
  }
}

async function bootstrapLegacyMigrations(schemaFile, dbUrl, sentinelTable, PrismaClientCtor) {
  const dbPath = dbUrl.replace(/^file:/, "");
  if (!existsSync(dbPath)) {
    return;
  }

  const hasBusinessTables = await databaseHasTable(dbUrl, sentinelTable, PrismaClientCtor);
  const hasMigrations = await databaseHasMigrationsTable(dbUrl, PrismaClientCtor);

  if (hasBusinessTables && !hasMigrations) {
    runMigrateResolve(schemaFile, dbUrl, LEGACY_BASELINE);
  }
}

async function applyPragmas(client) {
  await client.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  await client.$executeRawUnsafe("PRAGMA synchronous = NORMAL;");
}

export async function initDatabase() {
  const { MasterPrismaClient: MasterClient } = await loadPrismaClientClasses();
  const dataDir = getDataDir();
  const dbPath = join(dataDir, "master.db");
  const dbUrl = `file:${dbPath.replace(/\\/g, "/")}`;

  process.env.MASTER_DATABASE_URL = dbUrl;
  startupLog(`DB path: ${dbPath}`);

  runMigrateDeploy(getMasterSchemaPath(), dbUrl, "master migrate deploy");

  startupLog("Creating MasterPrismaClient instance...");
  masterPrisma = new MasterClient({
    datasources: { db: { url: dbUrl } },
  });

  startupLog("Connecting to database ($connect)...");
  await masterPrisma.$connect();
  startupLog("Database connected");

  startupLog("Applying pragmas...");
  await applyPragmas(masterPrisma);
  startupLog("Running master seed...");
  await seedMasterDatabase(masterPrisma);
  startupLog("Master seed complete");
}

export async function connectCompanyDatabase(dbFile) {
  const { CompanyPrismaClient: CompanyClient } = await loadPrismaClientClasses();

  if (companyPrisma) {
    await companyPrisma.$disconnect();
    companyPrisma = null;
  }

  const dataDir = getDataDir();
  const dbPath = join(dataDir, dbFile);
  const dbUrl = `file:${dbPath.replace(/\\/g, "/")}`;

  process.env.COMPANY_DATABASE_URL = dbUrl;

  runMigrateDeploy(getCompanySchemaPath(), dbUrl, "company migrate deploy");

  companyPrisma = new CompanyClient({
    datasources: { db: { url: dbUrl } },
  });

  await companyPrisma.$connect();

  startupLog("Applying company pragmas...");
  await applyPragmas(companyPrisma);
  startupLog("Running company seed...");
  await seedCompanyDatabase(companyPrisma);
  startupLog("Company seed complete");

  activeCompanyDb = dbFile;
  return { success: true, dbFile };
}

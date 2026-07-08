import { createHash } from "crypto";
import { readFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SCHEMAS = [
  {
    name: "master",
    schema: "prisma/master/schema.prisma",
    envKey: "MASTER_DATABASE_URL",
    url: "file:./data/master.db",
    dataDir: join(ROOT, "prisma", "master", "data"),
    dbFile: "master.db",
    clientPkg: "@prisma/master-client",
  },
  {
    name: "company",
    schema: "prisma/company/schema.prisma",
    envKey: "COMPANY_DATABASE_URL",
    url: "file:./data/demo.db",
    dataDir: join(ROOT, "prisma", "company", "data"),
    dbFile: "demo.db",
    clientPkg: "@prisma/company-client",
  },
];

function checksumFor(filePath) {
  const sql = readFileSync(filePath, "utf8");
  return createHash("sha256").update(sql).digest("hex");
}

function runPrisma(args, env) {
  const prismaCli = join(ROOT, "node_modules", "prisma", "build", "index.js");
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf-8",
  });

  if (result.status !== 0) {
    const message = [result.stderr, result.stdout].filter(Boolean).join("\n");
    throw new Error(message || "Prisma command failed");
  }

  return result.stdout;
}

async function repairMigrationHistory(schema, dbUrl) {
  const { PrismaClient } = await import(schema.clientPkg);
  const client = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  try {
    const hasMigrations = await client.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='_prisma_migrations'`
    );
    if (!Array.isArray(hasMigrations) || hasMigrations.length === 0) return;

    await client.$executeRawUnsafe(
      `DELETE FROM _prisma_migrations
       WHERE finished_at IS NULL
         AND migration_name IN (
           SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL
         )`
    );

    const migrationsDir = join(ROOT, "prisma", schema.name, "migrations");
    const migrationFolders = existsSync(migrationsDir)
      ? readdirSync(migrationsDir).filter((name) => !name.includes("."))
      : [];

    for (const folder of migrationFolders) {
      const file = join(migrationsDir, folder, "migration.sql");
      if (!existsSync(file)) continue;
      const checksum = checksumFor(file);
      await client.$executeRawUnsafe(
        `UPDATE _prisma_migrations SET checksum = ? WHERE migration_name = ?`,
        checksum,
        folder
      );
    }
  } finally {
    await client.$disconnect();
  }
}

async function main() {
  for (const schema of SCHEMAS) {
    if (!existsSync(schema.dataDir)) {
      mkdirSync(schema.dataDir, { recursive: true });
    }

    const env = { [schema.envKey]: schema.url };
    const dbPath = join(schema.dataDir, schema.dbFile);

    if (existsSync(dbPath)) {
      const dbUrl = `file:${dbPath.replace(/\\/g, "/")}`;
      await repairMigrationHistory(schema, dbUrl);
    }

    console.log(`[${schema.name}] Running migrate deploy...`);
    runPrisma(["migrate", "deploy", "--schema", schema.schema], env);
    console.log(`[${schema.name}] Migrations up to date`);
  }

  console.log("All migrations applied successfully.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

import { spawnSync } from "child_process";
import { existsSync, unlinkSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/company-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DB_PATH = join(ROOT, "prisma", "verify-e2e.db");

let prisma = null;

export function getTestPrisma() {
  return prisma;
}

export async function setupVerificationDatabase(onPrismaReady) {
  const dataDir = dirname(DB_PATH);
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (existsSync(DB_PATH)) unlinkSync(DB_PATH);

  const url = `file:${DB_PATH.replace(/\\/g, "/")}`;
  process.env.COMPANY_DATABASE_URL = url;

  const push = spawnSync(
    process.execPath,
    [
      join(ROOT, "node_modules", "prisma", "build", "index.js"),
      "db",
      "push",
      "--accept-data-loss",
      "--schema",
      join(ROOT, "prisma", "company", "schema.prisma"),
    ],
    {
      cwd: ROOT,
      env: { ...process.env, COMPANY_DATABASE_URL: url },
      encoding: "utf-8",
    }
  );

  if (push.status !== 0) {
    throw new Error(`Schema push failed: ${push.stderr || push.stdout}`);
  }

  prisma = new PrismaClient({ datasources: { db: { url } } });
  await prisma.$connect();

  if (onPrismaReady) onPrismaReady(prisma);

  const { seedCompanyDatabase } = await import("../../src/main/db/company-seed.js");
  await seedCompanyDatabase(prisma);

  return prisma;
}

export async function teardownVerificationDatabase() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

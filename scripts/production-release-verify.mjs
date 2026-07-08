/**
 * Production Release Candidate verification orchestrator.
 * 1. Launches portable exe on clean userData
 * 2. Verifies startup.log
 * 3. Runs business verification against databases created by packaged startup
 */
import { spawn, spawnSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RELEASE_DIR = join(ROOT, "release5");
const PORTABLE_EXE = join(RELEASE_DIR, "Distribox ERP 1.0.0.exe");
const UNPACKED_EXE = join(RELEASE_DIR, "win-unpacked", "Distribox ERP.exe");
const RESOURCES = join(RELEASE_DIR, "win-unpacked", "resources");

const CHECKLIST = [];

function record(section, item, pass, detail = "") {
  CHECKLIST.push({ section, item, status: pass ? "PASS" : "FAIL", detail });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`[${mark}] ${section} — ${item}${detail ? `: ${detail}` : ""}`);
  return pass;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForStartupLog(logPath, timeoutMs = 240000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(logPath)) {
      const content = readFileSync(logPath, "utf8");
      if (content.includes("Window Created")) {
        return { ok: true, content };
      }
      if (content.includes("STARTUP FAILED") || content.includes("MIGRATION FAILED")) {
        return { ok: false, content };
      }
      if (content.includes("UNCAUGHT EXCEPTION") || content.includes("UNHANDLED REJECTION")) {
        return { ok: false, content };
      }
    }
    await sleep(2000);
  }
  const content = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
  return { ok: false, content, timeout: true };
}

async function main() {
  console.log("=== Distribox ERP RC v1.0 Production Verification ===\n");

  // Infrastructure checks
  record(
    "Build",
    "Portable executable exists",
    existsSync(PORTABLE_EXE),
    PORTABLE_EXE
  );
  record(
    "Build",
    "Packaged Prisma CLI (resources/node_modules/prisma)",
    existsSync(join(RESOURCES, "node_modules", "prisma", "build", "index.js"))
  );
  record(
    "Build",
    "Packaged @prisma/engines with schema-engine",
    existsSync(join(RESOURCES, "node_modules", "@prisma", "engines", "schema-engine-windows.exe"))
  );
  record(
    "Build",
    "Packaged master-client",
    existsSync(join(RESOURCES, "prisma-clients", "master-client", "index.js"))
  );
  record(
    "Build",
    "Packaged company-client",
    existsSync(join(RESOURCES, "prisma-clients", "company-client", "index.js"))
  );
  record(
    "Build",
    "Packaged migration schemas",
    existsSync(join(RESOURCES, "prisma", "master", "migrations")) &&
      existsSync(join(RESOURCES, "prisma", "company", "migrations"))
  );

  if (!existsSync(PORTABLE_EXE)) {
    printChecklist();
    process.exit(1);
  }

  // Clean environment
  const cleanUserData = join(ROOT, "build-resources", "rc-clean-userdata");
  if (existsSync(cleanUserData)) {
    rmSync(cleanUserData, { recursive: true, force: true });
  }
  mkdirSync(cleanUserData, { recursive: true });

  record("Environment", "Clean userData directory created", true, cleanUserData);

  // Kill any running instances
  spawnSync("taskkill", ["/F", "/IM", "Distribox ERP.exe"], { stdio: "ignore" });
  await sleep(2000);

  // Launch portable on clean environment
  const logPath = join(cleanUserData, "startup.log");
  const portable = spawn(PORTABLE_EXE, [`--user-data-dir=${cleanUserData}`], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  portable.unref();

  console.log("\nWaiting for portable startup (up to 240s)...");
  const startup = await waitForStartupLog(logPath);

  record(
    "Startup",
    "No startup exceptions",
    startup.ok && !startup.content.includes("STARTUP FAILED"),
    startup.timeout ? "timeout" : ""
  );
  record(
    "Startup",
    "Master migrate deploy succeeds",
    startup.content.includes("master migrate deploy succeeded")
  );
  record(
    "Startup",
    "Master seed executes",
    startup.content.includes("Master seed complete")
  );
  record(
    "Startup",
    "Window Created (login screen reachable)",
    startup.content.includes("Window Created")
  );
  record(
    "Startup",
    "No missing modules in startup.log",
    !/Cannot find module/i.test(startup.content)
  );
  record(
    "Startup",
    "No migration errors in startup.log",
    !/MIGRATION FAILED/i.test(startup.content)
  );

  if (!startup.ok) {
    writeFileSync(join(ROOT, "build-resources", "rc-startup.log"), startup.content || "(empty)");
    printChecklist();
    process.exit(1);
  }

  // Business verification against databases created by portable startup
  console.log("\nRunning business verification against packaged databases...\n");
  const bizResult = spawnSync(
    process.execPath,
    [
      join(ROOT, "node_modules", "vitest", "vitest.mjs"),
      "run",
      "tests/production-rc-verify.test.js",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 300000,
      env: {
        ...process.env,
        RC_USER_DATA_DIR: cleanUserData,
        RC_RESOURCES_PATH: RESOURCES,
      },
    }
  );

  if (bizResult.stdout) console.log(bizResult.stdout);
  if (bizResult.stderr) console.error(bizResult.stderr);

  let bizChecks = [];
  try {
    const match = (bizResult.stdout || "").match(/---BIZ_RESULTS---([\s\S]*?)---END_BIZ_RESULTS---/);
    if (match) bizChecks = JSON.parse(match[1]);
  } catch {
    record("Business", "Business verification script output", false, "parse error");
  }

  for (const c of bizChecks) {
    record(c.section, c.item, c.pass, c.detail || "");
  }

  if (bizChecks.length === 0) {
    record(
      "Business",
      "Business verification completed",
      bizResult.status === 0,
      bizResult.status !== 0 ? bizResult.stderr?.slice(0, 200) : ""
    );
  }

  // Kill portable after verification
  spawnSync("taskkill", ["/F", "/IM", "Distribox ERP.exe"], { stdio: "ignore" });

  printChecklist();
  const allPass = CHECKLIST.every((c) => c.status === "PASS");
  process.exit(allPass ? 0 : 1);
}

function printChecklist() {
  const reportPath = join(ROOT, "build-resources", "RC-v1.0-RELEASE-CHECKLIST.md");
  const lines = [
    "# Distribox ERP RC v1.0 — FINAL RELEASE CHECKLIST",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "| Section | Item | Status | Detail |",
    "|---------|------|--------|--------|",
  ];

  for (const c of CHECKLIST) {
    const detail = (c.detail || "").replace(/\|/g, "/").replace(/\n/g, " ");
    lines.push(`| ${c.section} | ${c.item} | **${c.status}** | ${detail} |`);
  }

  const passCount = CHECKLIST.filter((c) => c.status === "PASS").length;
  const failCount = CHECKLIST.filter((c) => c.status === "FAIL").length;
  lines.push("");
  lines.push(`**Summary: ${passCount} PASS / ${failCount} FAIL / ${CHECKLIST.length} total**`);
  lines.push("");
  if (failCount === 0) {
    lines.push("**VERDICT: Release Candidate v1.0 — READY for external testing**");
  } else {
    lines.push("**VERDICT: NOT READY — failures must be resolved before external testing**");
  }

  const report = lines.join("\n");
  writeFileSync(reportPath, report);
  console.log(`\n${report}`);
  console.log(`\nChecklist written to: ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

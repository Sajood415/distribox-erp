/**
 * Stages the exact npm dependency closure required by the Prisma CLI
 * (prisma migrate deploy) into build-resources/node_modules/.
 *
 * Node resolves @prisma/engines as a sibling of prisma under node_modules/.
 * Copying prisma alone to extraResources breaks that layout; this script
 * preserves the standard node_modules structure for packaged migrate runs.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_ROOT = path.join(ROOT, "build-resources", "node_modules");

function resolvePkgDir(pkgName) {
  if (pkgName.startsWith("@")) {
    const [scope, name] = pkgName.split("/");
    return path.join(ROOT, "node_modules", scope, name);
  }
  return path.join(ROOT, "node_modules", pkgName);
}

function readPkgDependencies(pkgName) {
  const pkgDir = resolvePkgDir(pkgName);
  const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
  return pkg.dependencies || {};
}

function collectDeps(pkgName, seen = new Set()) {
  if (seen.has(pkgName)) {
    return seen;
  }
  seen.add(pkgName);

  try {
    for (const dep of Object.keys(readPkgDependencies(pkgName))) {
      collectDeps(dep, seen);
    }
  } catch {
    /* skip unresolved packages */
  }

  return seen;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function destForPackage(pkgName) {
  if (pkgName.startsWith("@")) {
    const [scope, name] = pkgName.split("/");
    return path.join(OUT_ROOT, scope, name);
  }
  return path.join(OUT_ROOT, pkgName);
}

function stage() {
  const outDir = path.join(ROOT, "build-resources");
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  const packages = [...collectDeps("prisma")].sort();
  for (const pkg of packages) {
    const srcDir = resolvePkgDir(pkg);
    const destDir = destForPackage(pkg);
    console.log(`Staging ${pkg}`);
    copyDir(srcDir, destDir);
  }

  console.log(`Staged ${packages.length} packages for Prisma CLI migrate deploy.`);
  console.log(packages.join("\n"));
}

stage();

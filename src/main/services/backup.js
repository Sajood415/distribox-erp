import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { dialog } from "electron";
import { getDataDir, disconnectDatabases, reconnectDatabases, getActiveCompanyDb, getMasterPrisma } from "../db/init";

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return { success: false, error };
}

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function listDatabaseFiles(dataDir) {
  return readdirSync(dataDir).filter(
    (file) => file.endsWith(".db") || file.endsWith(".db-wal") || file.endsWith(".db-shm")
  );
}

function copyDatabaseSet(sourceDir, targetDir, files) {
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }
  for (const file of files) {
    const source = join(sourceDir, file);
    if (existsSync(source)) {
      copyFileSync(source, join(targetDir, file));
    }
  }
}

export async function createBackup(browserWindow) {
  const dataDir = getDataDir();
  const activeCompanyDb = getActiveCompanyDb();

  const pick = await dialog.showOpenDialog(browserWindow, {
    title: "Select backup destination folder",
    properties: ["openDirectory", "createDirectory"],
  });

  if (pick.canceled || !pick.filePaths[0]) {
    return failure("Backup cancelled");
  }

  try {
    const prisma = getMasterPrisma();
    const companies = await prisma.company.findMany({
      select: { id: true, name: true, code: true, dbFile: true },
    });

    const backupDir = join(pick.filePaths[0], `distribox-backup-${formatTimestamp()}`);
    const files = listDatabaseFiles(dataDir);

    copyDatabaseSet(dataDir, backupDir, files);

    const manifest = {
      createdAt: new Date().toISOString(),
      app: "Distribox ERP",
      version: "1.0.0",
      activeCompanyDb,
      companies,
      files,
    };

    writeFileSync(join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

    return success({
      backupDir,
      fileCount: files.length,
      companies: companies.length,
    });
  } catch (error) {
    return failure(error.message || "Backup failed");
  }
}

export async function restoreBackup(browserWindow) {
  const pick = await dialog.showOpenDialog(browserWindow, {
    title: "Select backup folder",
    properties: ["openDirectory"],
  });

  if (pick.canceled || !pick.filePaths[0]) {
    return failure("Restore cancelled");
  }

  const backupDir = pick.filePaths[0];
  const manifestPath = join(backupDir, "manifest.json");

  if (!existsSync(manifestPath)) {
    return failure("Invalid backup folder — manifest.json not found");
  }

  const confirm = await dialog.showMessageBox(browserWindow, {
    type: "warning",
    buttons: ["Cancel", "Restore"],
    defaultId: 0,
    cancelId: 0,
    title: "Confirm Restore",
    message: "Restore database from backup?",
    detail: "This will replace all current data with the backup copy. The application will reload databases after restore.",
  });

  if (confirm.response !== 1) {
    return failure("Restore cancelled");
  }

  let previousCompanyDb = getActiveCompanyDb();

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    const dataDir = getDataDir();
    const files = manifest.files?.length ? manifest.files : listDatabaseFiles(backupDir);

    previousCompanyDb = previousCompanyDb || manifest.activeCompanyDb || null;

    await disconnectDatabases();
    copyDatabaseSet(backupDir, dataDir, files);
    await reconnectDatabases(previousCompanyDb);

    return success({
      restoredAt: new Date().toISOString(),
      backupDir,
      companyDb: previousCompanyDb,
      companies: manifest.companies?.length ?? 0,
    });
  } catch (error) {
    try {
      await reconnectDatabases(previousCompanyDb);
    } catch {
      // ignore reconnect failure after restore error
    }
    return failure(error.message || "Restore failed");
  }
}

export async function listLocalBackups() {
  const dataDir = getDataDir();
  const backupsRoot = join(dataDir, "backups");

  if (!existsSync(backupsRoot)) {
    return success({ rows: [] });
  }

  const rows = readdirSync(backupsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = join(backupsRoot, entry.name);
      const manifestPath = join(dir, "manifest.json");
      let manifest = null;
      if (existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
        } catch {
          manifest = null;
        }
      }
      return {
        name: entry.name,
        path: dir,
        createdAt: manifest?.createdAt ?? null,
        companies: manifest?.companies?.length ?? 0,
      };
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return success({ rows });
}

export async function createLocalBackup() {
  const dataDir = getDataDir();
  const backupsRoot = join(dataDir, "backups");
  const backupDir = join(backupsRoot, `distribox-backup-${formatTimestamp()}`);

  try {
    const prisma = getMasterPrisma();
    const companies = await prisma.company.findMany({
      select: { id: true, name: true, code: true, dbFile: true },
    });
    const files = listDatabaseFiles(dataDir);
    copyDatabaseSet(dataDir, backupDir, files);

    const manifest = {
      createdAt: new Date().toISOString(),
      app: "Distribox ERP",
      version: "1.0.0",
      activeCompanyDb: getActiveCompanyDb(),
      companies,
      files,
    };
    writeFileSync(join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

    return success({ backupDir, fileCount: files.length });
  } catch (error) {
    return failure(error.message || "Local backup failed");
  }
}

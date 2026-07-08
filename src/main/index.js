import { app, shell, BrowserWindow, dialog } from "electron";
import { join } from "path";
import { createRequire } from "module";
import { registerIpcHandlers } from "./ipc/handlers";
import { initDatabase, getInitDiagnostics } from "./db/init";
import { startScheduler, stopScheduler } from "./scheduler/scheduler";
import { installStartupHandlers, startupLog } from "./startup-log.js";

installStartupHandlers();
startupLog("START");

if (app.isPackaged) {
  startupLog("Packaged app detected");
  const clientsRoot = join(process.resourcesPath, "prisma-clients");
  process.env.NODE_PATH = [clientsRoot, process.env.NODE_PATH].filter(Boolean).join(";");
  createRequire(import.meta.url)("module").Module._initPaths();
  startupLog(`NODE_PATH set: ${process.env.NODE_PATH}`);
}

const isDev = !app.isPackaged;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  startupLog("Single instance lock NOT acquired — quitting");
  app.quit();
} else {
  startupLog("Single instance lock acquired");
}

function createWindow() {
  startupLog("Creating Window...");
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    startupLog("Window Created...");
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  startupLog("app.whenReady fired");

  if (!gotSingleInstanceLock) {
    startupLog("Skipping startup — no single instance lock");
    return;
  }

  try {
    startupLog("Calling initDatabase()...");
    await initDatabase();
    startupLog("initDatabase() complete");

    startupLog("Registering IPC handlers...");
    registerIpcHandlers();
    startupLog("IPC handlers registered");

    startupLog("Starting scheduler...");
    startScheduler();
    startupLog("Scheduler started");

    createWindow();
    startupLog("Ready...");
  } catch (error) {
    const diagnostics = getInitDiagnostics();
    startupLog("STARTUP FAILED");
    startupLog(`error.message: ${error?.message || String(error)}`);
    startupLog(`error.stack:\n${error?.stack || "(no stack)"}`);
    startupLog(`cwd: ${diagnostics.cwd}`);
    startupLog(`process.resourcesPath: ${diagnostics.resourcesPath}`);
    startupLog(`app.getAppPath(): ${diagnostics.appPath}`);
    startupLog(`__dirname: ${diagnostics.dirname}`);
    startupLog(`schema path: ${diagnostics.schemaPath}`);
    startupLog(`prisma executable path: ${diagnostics.prismaCliPath}`);
    startupLog(`query engine path: ${diagnostics.queryEnginePath}`);
    startupLog(`master client path: ${diagnostics.masterClientPath}`);
    startupLog(`db url: ${diagnostics.dbUrl}`);

    dialog.showErrorBox(
      "Distribox ERP — Startup Failed",
      `${error?.message || String(error)}\n\nSee startup.log in userData folder.`
    );
    app.quit();
    return;
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  stopScheduler();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

import { app } from "electron";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

export function getStartupLogPath() {
  return join(app.getPath("userData"), "startup.log");
}

export function startupLog(message) {
  try {
    const logPath = getStartupLogPath();
    const dir = dirname(logPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    appendFileSync(logPath, `${message}\n`);
  } catch {
    /* ignore logging failures */
  }
}

export function installStartupHandlers() {
  const write = (label, detail) => {
    try {
      appendFileSync(getStartupLogPath(), `\n\n${label}\n${detail}\n`);
    } catch {
      /* ignore */
    }
  };

  process.on("uncaughtException", (err) => {
    write("UNCAUGHT EXCEPTION", err?.stack || String(err));
  });

  process.on("unhandledRejection", (err) => {
    write("UNHANDLED REJECTION", err?.stack || String(err));
  });
}

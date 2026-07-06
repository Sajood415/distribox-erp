import { BrowserWindow } from "electron";

export function printHtml(browserWindow, html) {
  return new Promise((resolve) => {
    const printWindow = new BrowserWindow({
      show: false,
      width: 900,
      height: 700,
      parent: browserWindow ?? undefined,
      modal: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    printWindow.loadURL(dataUrl);

    printWindow.webContents.on("did-finish-load", () => {
      printWindow.webContents.print({ silent: false, printBackground: true }, (success, errorType) => {
        printWindow.close();
        if (!success) {
          resolve({ success: false, error: errorType || "Print failed" });
          return;
        }
        resolve({ success: true });
      });
    });
  });
}

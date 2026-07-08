const userDataDir = global.__RC_USER_DATA_DIR__;
const resourcesPath = global.__RC_RESOURCES_PATH__;
const appPath = global.__RC_APP_PATH__;

export const app = {
  isPackaged: true,
  getPath(name) {
    if (name === "userData") return userDataDir;
    if (name === "home") return userDataDir;
    return userDataDir;
  },
  getAppPath() {
    return appPath;
  },
  requestSingleInstanceLock() {
    return true;
  },
  whenReady() {
    return Promise.resolve();
  },
  on() {},
  quit() {},
};

export const shell = {};
export const BrowserWindow = class {};
export const dialog = { showErrorBox() {} };
export const ipcMain = { handle() {} };

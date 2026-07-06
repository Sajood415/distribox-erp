import { authorizeChannel, wrapHandler, normalizeServicePayload } from "./ipc-auth";

export function registerHandler(ipcMain, channel, handler, options = {}) {
  const { needsWindow = false } = options;

  ipcMain.handle(channel, async (event, payload) => {
    const auth = await authorizeChannel(channel, payload);
    if (!auth.authorized) {
      return auth.response;
    }

    const servicePayload = normalizeServicePayload(channel, payload);
    const wrapped = wrapHandler(handler);

    if (needsWindow) {
      return wrapped(servicePayload, auth.ctx, event);
    }

    return wrapped(servicePayload, auth.ctx);
  });
}

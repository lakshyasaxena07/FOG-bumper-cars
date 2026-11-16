import { app, BrowserWindow, dialog } from 'electron';
import started from 'electron-squirrel-startup';
import { startBackend, type Backend } from './backend';
import { createMainWindow } from './desktop/windowManager';

let win: BrowserWindow | null = null;
let backend: Backend | undefined;

function run() {
  const appRoot = app.getAppPath();
  const dataRoot = app.isPackaged ? app.getPath('userData') : appRoot;

  app.whenReady().then(() => {
    try {
      backend = startBackend({
        appRoot,
        dataRoot,
        configPath: process.env.BUMPER_CONFIG,
        send: (channel, payload) => win && !win.isDestroyed() && win.webContents.send(channel, payload),
        quit: () => app.quit(),
      });
    } catch (err) {
      dialog.showErrorBox('Bumper Car Moments - startup error', (err as Error).message);
      app.exit(1);
      return;
    }
    win = createMainWindow();
    win.on('closed', () => (win = null));
  });

  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  // Safe shutdown: stop any active ride and release the cameras before the app really exits.
  let closing = false;
  app.on('before-quit', (event) => {
    if (!backend || closing) return;
    event.preventDefault();
    closing = true;
    void backend.shutdown().finally(() => app.quit());
  });
  app.on('window-all-closed', () => app.quit());
  process.on('exit', () => backend?.killAll()); // last resort: never leave ffmpeg processes behind
}

// One instance only: two instances would compete for the same cameras.
if (started) app.quit(); // Squirrel install/uninstall shortcut handling
else if (app.requestSingleInstanceLock()) run();
else app.quit();

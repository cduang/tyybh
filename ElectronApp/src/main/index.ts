import {
  app,
  shell,
  BrowserWindow,
  Menu,
  powerSaveBlocker,
  Tray,
} from "electron";
import { join } from "path";
import icon from "../../resources/icon.ico?asset";

let powerSaveBlockerId: number | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let mainWindow: BrowserWindow | null = null;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function showWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function updateTrayMenu(): void {
  if (!tray) return;
  const startupEnabled = app.getLoginItemSettings().openAtLogin;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open CTYun Cloud PC", click: showWindow },
      { type: "separator" },
      {
        label: "Start at login",
        type: "checkbox",
        checked: startupEnabled,
        click: (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked });
          updateTrayMenu();
        },
      },
      { type: "separator" },
      { label: "Exit", click: () => { isQuitting = true; app.quit(); } },
    ]),
  );
}

function createTray(): void {
  if (tray) return;
  tray = new Tray(icon);
  tray.setToolTip("CTYun Cloud PC Keep Alive");
  tray.on("click", showWindow);
  tray.on("double-click", showWindow);
  updateTrayMenu();
}

function createWindow(): void {
  const window = new BrowserWindow({
    minWidth: 375,
    width: 900,
    minHeight: 250,
    height: 750,
    show: false,
    resizable: true,
    maximizable: true,
    autoHideMenuBar: true,
    ...(process.platform === "win32" ? { icon } : {}),
    webPreferences: {
      backgroundThrottling: false,
      preload: join(__dirname, "../preload/index.js"),
      webSecurity: false,
      sandbox: false,
    },
  });
  mainWindow = window;
  if (process.platform === "win32") {
    window.setIcon(icon);
  }

  window.on("ready-to-show", () => {
    window.show();
  });

  window.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      window.hide();
    }
  });

  window.on("minimize", () => {
    window.hide();
  });

  window.on("closed", () => {
    mainWindow = null;
  });

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  window.loadURL("https://pc.ctyun.cn/");
}

app.on("second-instance", showWindow);

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return;
  createWindow();
  createTray();

  powerSaveBlockerId = powerSaveBlocker.start("prevent-app-suspension");

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
    powerSaveBlocker.stop(powerSaveBlockerId);
  }

  if (isQuitting && process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  tray?.destroy();
  tray = null;
});

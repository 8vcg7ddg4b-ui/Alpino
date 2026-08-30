import { app, BrowserWindow, Menu, shell } from 'electron';

// Im eigenen Programm gibt es keinen fremden Reiter, den eine Tonspur
// überraschen könnte: die Titelmusik darf deshalb mit dem Fenster anfangen und
// muss nicht auf den ersten Klick warten.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGameServer } from '../server.js';

const desktopDir = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.join(desktopDir, '..');

let server = null;

// The game is served over a loopback HTTP server rather than loaded from a
// file:// URL: Chromium treats file:// as an opaque origin and blocks the ES
// module imports the game is built from, which would leave a blank window.
function startServer() {
  return new Promise((resolve, reject) => {
    server = createGameServer(gameRoot);
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'Pax Aeterna',
    backgroundColor: '#1c1712',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  // Nothing in the game links outward; if that ever changes, open it in the
  // user's real browser instead of a chrome-less Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL(`http://127.0.0.1:${port}/`);
  return win;
}

function buildMenu(getWindow) {
  const template = [
    {
      label: 'Spiel',
      submenu: [
        {
          label: 'Neu starten',
          accelerator: 'CmdOrCtrl+N',
          click: () => getWindow()?.reload(),
        },
        { type: 'separator' },
        { role: 'quit', label: 'Beenden' },
      ],
    },
    {
      label: 'Ansicht',
      submenu: [
        {
          label: 'Vollbild',
          accelerator: 'F11',
          click: () => {
            const win = getWindow();
            if (win) win.setFullScreen(!win.isFullScreen());
          },
        },
        { role: 'zoomIn', label: 'Vergrößern' },
        { role: 'zoomOut', label: 'Verkleinern' },
        { role: 'resetZoom', label: 'Zoom zurücksetzen' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Entwicklerwerkzeuge' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  const port = await startServer();
  let win = createWindow(port);
  buildMenu(() => win);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      win = createWindow(port);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  if (server) server.close();
});

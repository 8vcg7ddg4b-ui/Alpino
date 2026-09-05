// Das Desktop-Programm: ein eigenes Fenster ohne Browserleiste. Es startet
// den kleinen Server aus `server.js` auf einem freien Port und lädt das
// Spiel von dort.
import { app, BrowserWindow, Menu, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGameServer } from '../server.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

let server = null;
let win = null;

function startServer() {
  return new Promise((resolve, reject) => {
    server = createGameServer(root);
    server.on('error', reject);
    // Port 0: das Betriebssystem sucht einen freien aus.
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function createWindow() {
  const port = await startServer();
  win = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#04070e',
    title: 'Black Univers',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  await win.loadURL(`http://127.0.0.1:${port}/index.html`);
}

const template = [
  {
    label: 'Feldzug',
    submenu: [
      { role: 'reload', label: 'Neu laden' },
      { role: 'togglefullscreen', label: 'Vollbild' },
      { type: 'separator' },
      { role: 'quit', label: 'Beenden' },
    ],
  },
  {
    label: 'Ansicht',
    submenu: [
      { role: 'zoomIn', label: 'Größer' },
      { role: 'zoomOut', label: 'Kleiner' },
      { role: 'resetZoom', label: 'Zurücksetzen' },
      { type: 'separator' },
      { role: 'toggleDevTools', label: 'Entwicklerwerkzeuge' },
    ],
  },
];

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});

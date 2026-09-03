// Ein kleiner Server für das Spielverzeichnis. Er wird gebraucht, weil
// Chromium ES-Module nicht von einer file://-Adresse lädt - im
// Desktop-Programm wäre das Fenster sonst leer.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  // Ohne den richtigen Typ weigert sich das Videoelement, den Vorspann
  // abzuspielen - der Browser bekäme sonst nur einen Bytestrom.
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

export function createGameServer(root) {
  const rootDir = path.resolve(root);
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const filePath = path.join(rootDir, urlPath === '/' ? 'index.html' : urlPath);
    if (filePath !== rootDir && !filePath.startsWith(rootDir + path.sep)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

const thisFile = fileURLToPath(import.meta.url);
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === thisFile;

if (invokedDirectly) {
  const port = process.env.PORT || 8090;
  createGameServer(path.dirname(thisFile)).listen(port, () => {
    console.log(`Black Univers läuft auf http://localhost:${port}`);
  });
}

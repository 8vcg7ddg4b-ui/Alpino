// Treiber für Pax Aeterna: startet das Spiel in einem headless Chromium und
// klickt auf der 3D-Karte feldgenau.
//
// Das eigentliche Problem ist das Klicken. Die Karte ist ein Three.js-Canvas
// aus isometrischer Perspektive über einem Gelände mit Höhen - es gibt keine
// DOM-Knoten für Felder und keine feste Umrechnung Feld -> Bildpunkt. Gelöst
// wird das über die Rückmeldung des Spiels selbst: ein Rechtsklick öffnet die
// Feldinfo, und die nennt Längen- und Breitengrad. geodata.js rechnet die in
// ein Feld zurück. Daraus wird erst eine Homographie geschätzt (die Ebene
// unter Perspektive) und der Restfehler aus der Geländehöhe anschließend je
// Ziel weggeregelt. Damit trifft jeder Klick das gemeinte Feld.
import { readdirSync } from 'node:fs';
import path from 'node:path';

// Playwright und Chromium liegen je nach Rechner woanders; beides wird
// gesucht, statt einen Pfad festzuschreiben, der beim nächsten Abbild bricht.
// Global installierte Pakete liegen neben der laufenden node-Binärdatei, und
// ein Verzeichnis lässt sich nicht als ES-Modul laden - deshalb `index.mjs`.
function moduleRoots() {
  const nearNode = path.resolve(path.dirname(process.execPath), '..', 'lib', 'node_modules');
  return [
    process.env.PLAYWRIGHT_MODULE_ROOT, nearNode,
    '/usr/local/lib/node_modules', '/usr/lib/node_modules', '/opt/node22/lib/node_modules',
  ].filter(Boolean);
}

async function playwright() {
  const candidates = ['playwright'];
  for (const root of moduleRoots()) {
    candidates.push(path.join(root, 'playwright', 'index.mjs'));
    candidates.push(path.join(root, 'playwright', 'index.js'));
  }
  for (const id of candidates) {
    try {
      const mod = await import(id);
      if (mod && (mod.chromium || mod.default?.chromium)) return mod.chromium ? mod : mod.default;
    } catch (err) { /* nächster Versuch */ }
  }
  throw new Error(
    `playwright nicht gefunden. Gesucht in: ${candidates.join(', ')}. `
    + 'Abhilfe: "npm i -D playwright", global installieren, oder PLAYWRIGHT_MODULE_ROOT setzen.'
  );
}

function chromiumPath() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    const dir = readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
    if (dir) return path.join(root, dir, 'chrome-linux', 'chrome');
  } catch (err) { /* dann eben Playwrights eigene Auflösung */ }
  return undefined;
}

export const GAME_URL = process.env.GAME_URL || 'http://localhost:8080';

// Öffnet das Spiel. `settings` wird vor dem Laden in den localStorage gelegt -
// so lässt sich vor allem die Marschanimation abschalten, sonst wartet der
// Treiber mehr, als er spielt.
export async function openGame({ settings = { marchSpeed: 'off', music: false, chronicle: false },
  viewport = { width: 1400, height: 900 }, slowMo = 0 } = {}) {
  const { chromium } = await playwright();
  const browser = await chromium.launch({
    executablePath: chromiumPath(),
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
    slowMo,
  });
  const context = await browser.newContext({ viewport });
  if (settings) {
    await context.addInitScript((s) => {
      try { localStorage.setItem('spqr.settings', JSON.stringify(s)); } catch (err) { /* egal */ }
    }, { battlePreview: true, ...settings });
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__spqrReady === true, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  return { browser, page, errors };
}

// Neues Spiel bis auf die Karte. Die Ansprache des Ersten Offiziers geht mit
// Escape weg; sie kommt erst, wenn die Kamera im Zelt steht.
export async function startNewGame(page, faction = 'Rom') {
  await page.getByText('Neues Spiel starten').click();
  await page.waitForTimeout(1800);
  await page.getByText(`Als ${faction} beginnen`).click();
  await page.waitForTimeout(4000);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(600); }
  await page.waitForTimeout(1200);
}

// --- Feld unter dem Zeiger ------------------------------------------------
export async function tileUnder(page, x, y, geo) {
  await page.mouse.click(x, y, { button: 'right' });
  await page.waitForTimeout(220);
  const box = page.locator('#tileInfo');
  const text = await box.isVisible() ? await box.innerText() : '';
  await page.keyboard.press('Escape');
  const m = text.match(/([\d.]+)°\s*([NS]),\s*([\d.]+)°\s*([OWE])/);
  if (!m) return null;
  const lat = parseFloat(m[1]) * (m[2] === 'S' ? -1 : 1);
  const lon = parseFloat(m[3]) * (m[4] === 'W' ? -1 : 1);
  return { col: geo.colOfLon(lon), row: geo.rowOfLat(lat), text: text.replace(/\n+/g, ' | ') };
}

// --- Homographie ----------------------------------------------------------
function solve(M, v) {
  const n = v.length;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    [M[i], M[p]] = [M[p], M[i]]; [v[i], v[p]] = [v[p], v[i]];
    for (let k = i + 1; k < n; k++) {
      const f = M[k][i] / M[i][i];
      if (!f) continue;
      for (let j = i; j < n; j++) M[k][j] -= f * M[i][j];
      v[k] -= f * v[i];
    }
  }
  const out = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = v[i];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * out[j];
    out[i] = s / M[i][i];
  }
  return out;
}

function fitHomography(samples) {
  const rows = [], rhs = [];
  for (const s of samples) {
    rows.push([s.col, s.row, 1, 0, 0, 0, -s.col * s.x, -s.row * s.x]); rhs.push(s.x);
    rows.push([0, 0, 0, s.col, s.row, 1, -s.col * s.y, -s.row * s.y]); rhs.push(s.y);
  }
  const M = Array.from({ length: 8 }, () => new Array(8).fill(0));
  const v = new Array(8).fill(0);
  for (let k = 0; k < rows.length; k++) {
    for (let i = 0; i < 8; i++) {
      v[i] += rows[k][i] * rhs[k];
      for (let j = 0; j < 8; j++) M[i][j] += rows[k][i] * rows[k][j];
    }
  }
  const h = solve(M, v);
  return (col, row) => {
    const w = h[6] * col + h[7] * row + 1;
    return { x: (h[0] * col + h[1] * row + h[2]) / w, y: (h[3] * col + h[4] * row + h[5]) / w };
  };
}

// Tastet ein Raster ab und schätzt daraus die Abbildung Feld -> Bildpunkt.
// Einmal je Sitzung nötig; die Kamera folgt keinem Marsch, die Schätzung
// bleibt also gültig, solange nicht geschwenkt oder gezoomt wird.
export async function calibrate(page, geo, { step = 150 } = {}) {
  const samples = [];
  for (let x = 300; x <= 900; x += step) {
    for (let y = 300; y <= 750; y += step) {
      const t = await tileUnder(page, x, y, geo);
      if (t) samples.push({ x, y, col: t.col, row: t.row });
    }
  }
  if (samples.length < 8) throw new Error(`zu wenige Stützpunkte (${samples.length}) - liegt die Karte im Bild?`);
  return fitHomography(samples);
}

// Zielt auf ein Feld und korrigiert nach, bis der Rechtsklick wirklich dort
// landet: Höhenunterschiede verschieben den Bildpunkt, und wie weit, verrät
// nur das Spiel selbst. Gibt null zurück, wenn das Feld nicht im Bild liegt.
export async function aimAt(page, project, geo, col, row, tries = 5) {
  let p = project(col, row);
  for (let i = 0; i < tries; i++) {
    const t = await tileUnder(page, p.x, p.y, geo);
    if (!t) { p = { x: p.x, y: p.y - 12 }; continue; }
    if (t.col === col && t.row === row) return { ...p, text: t.text };
    const off = project(t.col, t.row), want = project(col, row);
    p = { x: p.x + (want.x - off.x), y: p.y + (want.y - off.y) };
  }
  const t = await tileUnder(page, p.x, p.y, geo);
  return t && t.col === col && t.row === row ? { ...p, text: t.text } : null;
}

export async function clickTile(page, project, geo, col, row) {
  const p = await aimAt(page, project, geo, col, row);
  if (!p) return null;
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(700);
  return p;
}

// Was steht auf dem Feld? Der Text der Feldinfo, ungefiltert.
export async function tileText(page, project, geo, col, row) {
  const p = await aimAt(page, project, geo, col, row);
  return p ? p.text : '';
}

// --- Überlagerungen -------------------------------------------------------
export async function isOpen(page, selector) {
  const el = page.locator(selector);
  if (!await el.count()) return false;
  return !((await el.first().getAttribute('class')) || '').includes('hidden');
}

export async function closeOverlays(page) {
  for (const sel of ['#reportClose', '#previewCancel', '#eventClose']) {
    const b = page.locator(sel);
    if (await b.count() && await b.first().isVisible()) { await b.first().click(); await page.waitForTimeout(400); }
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
}

export async function endTurn(page) {
  await closeOverlays(page);
  await page.getByRole('button', { name: /Runde beenden/ }).click();
  await page.waitForTimeout(3500);
  await closeOverlays(page);
}

// Steht die Kampfvorschau offen, wird sie ausgelesen, bebildert und - wenn
// `attack` gesetzt ist - der Angriff geführt und der Schlachtbericht ebenso
// festgehalten. Gibt { preview, report } als Text zurück.
export async function resolvePreview(page, { attack = true, label = 'kampf', shots = null } = {}) {
  if (!await isOpen(page, '#battlePreview')) return null;
  const preview = await page.locator('#previewBody').innerText();
  if (shots) await page.screenshot({ path: `${shots}/vorschau-${label}.png` });
  let report = '';
  if (attack) {
    await page.locator('#previewAttack').click();
    try {
      await page.waitForFunction(
        () => !document.getElementById('battleReport').classList.contains('hidden'), null, { timeout: 20000 }
      );
    } catch (err) { /* manche Angriffe enden ohne Bericht */ }
    if (await isOpen(page, '#battleReport')) {
      report = await page.locator('#reportBody').innerText();
      if (shots) await page.screenshot({ path: `${shots}/bericht-${label}.png` });
    }
  }
  await closeOverlays(page);
  return { preview, report };
}

// Die Startaufstellung, ohne das Spiel zu starten: Felder von Städten und
// Heeren, Mauerstufen, Garnisonen. Damit werden Ziele und Wege im Voraus
// bestimmt, statt auf der Karte zu suchen.
export async function initialState(gameDir, factionId = 'rom') {
  const { createInitialState } = await import(path.join(gameDir, 'js/state.js'));
  return createInitialState(factionId);
}

export async function geodataOf(gameDir) {
  return import(path.join(gameDir, 'js/geodata.js'));
}

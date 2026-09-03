// Der Blick von außen: das Spiel wird in einem echten Chromium gestartet,
// durchgeklickt und fotografiert. Findet, was der Regeltest nicht sieht -
// kaputte Verdrahtung, fehlende Elemente, Fehler im Zeichnen.
import { chromium } from 'playwright';
import { createGameServer } from '../server.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const shots = process.env.SHOT_DIR || path.join(root, '..', 'shots');
const EXEC = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const server = createGameServer(root);
await new Promise((r) => server.listen(8123, '127.0.0.1', r));

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const problems = [];
page.on('console', (msg) => {
  if (msg.type() !== 'error') return;
  // Ohne Netz laden die Schriften von Google nicht. Das ist kein Fehler des
  // Spiels - es fällt auf die Systemschrift zurück.
  if (/net::ERR_/.test(msg.text())) return;
  problems.push(`Konsole: ${msg.text()}`);
});
page.on('pageerror', (err) => problems.push(`Seitenfehler: ${err.message}`));

async function shot(name) {
  await page.screenshot({ path: path.join(shots, `${name}.png`) });
  console.log(`  Bild: ${name}.png`);
}

console.log('Startbild …');
await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await shot('01-startbild');

console.log('Fraktionswahl …');
await page.click('#startGameBtn');
await page.waitForSelector('#setupScreen:not(.hidden)');
await page.waitForTimeout(400);
await page.click('[data-faction="kilrathi"]');
await page.waitForTimeout(300);
await page.click('[data-scenario="enigma"]');
await page.waitForTimeout(300);
await shot('02-fraktionswahl');
await page.click('[data-faction="confed"]');
await page.click('[data-scenario="vega"]');

console.log('Feldzug beginnt …');
await page.click('#setupStart');
await page.waitForSelector('#confirmModal:not(.hidden)', { timeout: 8000 });
await page.waitForTimeout(600);
await shot('03-lagebericht');
await page.click('#confirmOk');
await page.waitForTimeout(2200);
await shot('04-karte');

console.log('Flotte wählen und fliegen …');
const box = await page.locator('#gameCanvas').boundingBox();
// Die eigene Heimatflotte steht über der Hauptwelt: sie wird über die
// Spielinnereien gesucht und angeklickt.
const target = await page.evaluate(() => {
  const s = window.__blackUniversState;
  const fleet = s.fleets.find((f) => f.factionId === s.playerFactionId);
  return fleet ? { col: fleet.col, row: fleet.row, name: fleet.name } : null;
});
console.log('  Flotte:', target && target.name);
await page.evaluate(() => {
  const s = window.__blackUniversState;
  const fleet = s.fleets.find((f) => f.factionId === s.playerFactionId);
  window.__test = { fleetId: fleet.id };
});
// Über die Mitte des Bildes klicken - die Kamera steht auf der Hauptwelt.
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(700);
await shot('05-auswahl');

console.log('Flug über die Karte …');
// Das Ziel: zwei Felder westlich der Flotte - fast immer offener Raum.
const before = await page.evaluate(() => {
  const s = window.__blackUniversState;
  const f = s.fleets.find((x) => x.factionId === s.playerFactionId);
  window.__bu.centerOn(f.col, f.row);
  window.__bu.draw();
  return { col: f.col, row: f.row, id: f.id };
});
const point = await page.evaluate(([col, row]) => window.__bu.tileToScreen(col, row),
  [before.col, before.row + 3]);
await page.mouse.click(box.x + point.x, box.y + point.y);
// Der Flug wird gezeigt, bevor er im Spielstand steht: also warten, bis die
// Flotte wirklich woanders ist - auf einer langsamen Maschine dauert das.
await page.waitForFunction(([id, col, row]) => {
  const f = window.__blackUniversState.fleets.find((x) => x.id === id);
  return !f || f.col !== col || f.row !== row;
}, [before.id, before.col, before.row], { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(300);
const after = await page.evaluate((id) => {
  const f = window.__blackUniversState.fleets.find((x) => x.id === id);
  return f ? { col: f.col, row: f.row, movement: f.movement } : null;
}, before.id);
console.log(`  vorher ${before.col}/${before.row} · nachher ${after.col}/${after.row}, Bewegung ${after.movement}`);
if (after.col === before.col && after.row === before.row) {
  problems.push('Die Flotte ist nicht geflogen.');
}
await shot('05b-geflogen');

console.log('Gefecht …');
await page.evaluate((id) => {
  const s = window.__blackUniversState;
  const me = s.fleets.find((x) => x.id === id);
  const foe = s.fleets.find((x) => x.factionId === 'kilrathi');
  foe.col = me.col + 1;
  foe.row = me.row;
  window.__bu.refresh();
}, before.id);
// Die Flotte neu anklicken: sie steht jetzt woanders, und erst mit der
// Auswahl rechnet das Spiel Reichweite und Ziele neu.
const mePoint = await page.evaluate((id) => {
  const s = window.__blackUniversState;
  const me = s.fleets.find((x) => x.id === id);
  window.__bu.centerOn(me.col, me.row);
  window.__bu.draw();
  return window.__bu.tileToScreen(me.col, me.row);
}, before.id);
await page.mouse.click(box.x + mePoint.x, box.y + mePoint.y);
await page.waitForTimeout(500);
const foePoint = await page.evaluate((id) => {
  const s = window.__blackUniversState;
  const me = s.fleets.find((x) => x.id === id);
  return window.__bu.tileToScreen(me.col + 1, me.row);
}, before.id);
await page.mouse.click(box.x + foePoint.x, box.y + foePoint.y);
await page.waitForTimeout(700);
const hasConfirm = await page.locator('#confirmModal:not(.hidden)').count();
if (hasConfirm) {
  await shot('05c-angriffsvorschau');
  await page.click('#confirmOk');
  await page.waitForTimeout(2200);
  await shot('05d-gefecht');
  try {
    await page.waitForSelector('#battleModal:not(.hidden)', { timeout: 90000 });
    await page.waitForTimeout(400);
    await shot('05e-gefechtsbericht');
    await page.click('#battleClose');
    await page.waitForSelector('#battleModal.hidden', { state: 'attached', timeout: 5000 });
  } catch (err) {
    problems.push(`Nach dem Gefecht kam kein Bericht: ${err.message}`);
  }
} else {
  problems.push('Der Angriff wurde nicht angeboten.');
}

console.log('Tafeln öffnen …');
for (const [btn, name] of [['#btnEmpire', '06-reich'], ['#btnDiplo', '07-diplomatie'],
  ['#btnTech', '08-technik'], ['#btnChron', '09-chronik'], ['#btnSettings', '10-einstellungen']]) {
  await page.click(btn);
  await page.waitForTimeout(400);
  await shot(name);
  await page.click('#sheetClose');
  await page.waitForTimeout(150);
}

console.log('Fünf Züge …');
for (let i = 0; i < 5; i++) {
  await page.click('#endTurnBtn');
  await page.waitForTimeout(900);
}
await shot('11-nach-fuenf-zuegen');

const turn = await page.evaluate(() => window.__blackUniversState.turn);
const credits = await page.evaluate(() => {
  const s = window.__blackUniversState;
  return s.factions.find((f) => f.isPlayer).credits;
});
console.log(`  Zug ${turn}, Kredits ${credits}`);

console.log('Ganze Karte …');
await page.keyboard.press('r');
for (let i = 0; i < 6; i++) await page.keyboard.press('-');
await page.waitForTimeout(400);
await shot('11b-uebersicht');
for (let i = 0; i < 3; i++) await page.keyboard.press('+');
await page.waitForTimeout(300);
await shot('11c-mittlere-hoehe');

console.log('Kamera flach: die Brücke …');
await page.keyboard.press('r');
for (let i = 0; i < 4; i++) await page.keyboard.press('-');
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down({ button: 'right' });
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 170, { steps: 14 });
await page.mouse.up({ button: 'right' });
await page.waitForTimeout(500);
await shot('12-bruecke');

console.log('Fortsetzen nach Neuladen …');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const canContinue = await page.locator('#continueGameBtn:not(.hidden)').count();
if (!canContinue) {
  problems.push('Nach dem Neuladen wird kein gespeicherter Feldzug angeboten.');
} else {
  await page.click('#continueGameBtn');
  await page.waitForTimeout(2200);
  const loadedTurn = await page.evaluate(() => window.__blackUniversState.turn);
  console.log(`  geladener Feldzug steht in Zug ${loadedTurn}`);
  if (loadedTurn !== turn) problems.push(`Geladener Zug ${loadedTurn} statt ${turn}.`);
  await shot('13-fortgesetzt');
}

await browser.close();
server.close();

if (problems.length) {
  console.error(`\n${problems.length} Fehler im Browser:`);
  for (const p of [...new Set(problems)].slice(0, 20)) console.error(' -', p);
  process.exit(1);
}
console.log(`\nKein Fehler im Browser. Zug ${turn} erreicht.`);

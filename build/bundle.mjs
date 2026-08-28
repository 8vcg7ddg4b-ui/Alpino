// Baut aus dem Spiel eine einzige HTML-Datei - das, was ein Artefakt braucht:
// keine Nachbardateien, keine Module über das Netz, alles in einem Stück.
//
// Die Umformung ist eine Verflachung: die ES-Module werden in
// Abhängigkeitsreihenfolge aneinandergehängt, `import`-Zeilen fallen weg und
// `export` wird gestrichen. Das geht nur, weil kein Name zweimal auf oberster
// Ebene vergeben ist und der Abhängigkeitsgraph kreisfrei ist - beides wird
// hier geprüft und bricht den Bau ab, statt ein stummes, kaputtes Spiel zu
// erzeugen. three.min.js ist ein UMD-Bündel und setzt `THREE` global; es wird
// unverändert davorgelegt.
//
// Aufruf:  node build/bundle.mjs [ziel.html]     (Vorgabe: dist/pax-aeterna.html)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(ROOT, 'js');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

// --- Module einlesen ------------------------------------------------------
const modules = new Map();
for (const file of readdirSync(JS).filter((f) => f.endsWith('.js'))) {
  modules.set(file, read(path.join('js', file)));
}

// Beides zieht ein Modul herein und muss verschwinden: der gewöhnliche Import
// und der Weiterexport (`export { X } from './y.js'`), mit dem data.js zwei
// Karten-Maße durchreicht.
//
// Beide Ausdrücke laufen über mehrere Zeilen, weil eine Importliste umbrechen
// darf - aber sie dürfen kein Semikolon und keine schließende Klammer
// überspringen. Ohne diese Schranke verschluckt `export` in
// `export const GAME_VERSION = '1.1.0';` alles bis zum nächsten `from` weiter
// unten in der Datei. Genau das ist einmal passiert und hat ein Bündel
// erzeugt, das erst im Browser stumm blieb.
const IMPORT_RE = /^import\s[^;]*?from\s*['"](\.[^'"]+)['"];?[ \t]*$/gm;
const REEXPORT_RE = /^export\s*\{[^}]*\}\s*from\s*['"](\.[^'"]+)['"];?[ \t]*$/gm;

function dependenciesOf(source) {
  const deps = [];
  for (const re of [IMPORT_RE, REEXPORT_RE]) {
    for (const m of source.matchAll(re)) {
      const spec = m[1];
      if (!spec.startsWith('./')) throw new Error(`nur relative Importe: ${spec}`);
      const file = spec.slice(2);
      if (!modules.has(file)) throw new Error(`unbekanntes Modul: ${spec}`);
      deps.push(file);
    }
  }
  return deps;
}

// --- Reihenfolge ----------------------------------------------------------
// Tiefensuche ab main.js: ein Modul steht hinter allem, was es braucht.
const order = [];
const state = new Map();
(function visit(file, trail) {
  if (state.get(file) === 'fertig') return;
  if (state.get(file) === 'offen') {
    throw new Error(`Kreis im Abhängigkeitsgraph: ${[...trail, file].join(' -> ')}`);
  }
  state.set(file, 'offen');
  for (const dep of dependenciesOf(modules.get(file))) visit(dep, [...trail, file]);
  state.set(file, 'fertig');
  order.push(file);
}('main.js', []));

const unused = [...modules.keys()].filter((f) => !order.includes(f));
if (unused.length) console.warn(`Hinweis: nicht eingebunden: ${unused.join(', ')}`);

// --- Was ein Modul nach außen gibt ---------------------------------------
// Drei Formen kommen vor: die Deklaration mit `export` davor, die Liste
// `export { a, b };` und die Umbenennung `export { key as tileKey };`. Die
// letzte ist die heikle: der Name, unter dem andere Module die Funktion
// aufrufen, steht nirgends als Deklaration. Wird die Zeile beim Verflachen
// einfach gestrichen, ruft das Bündel einen Namen auf, den es nicht gibt.
const EXPORT_LIST_RE = /^export\s*\{([^}]*)\}\s*(?:from\s*['"][^'"]+['"])?\s*;?[ \t]*$/gm;

function exportedNamesOf(source) {
  const names = new Set();
  for (const m of source.matchAll(DECL_RE)) {
    if (m[0].startsWith('export')) names.add(m[1]);
  }
  for (const m of source.matchAll(EXPORT_LIST_RE)) {
    for (const entry of m[1].split(',')) {
      const parts = entry.trim().split(/\s+as\s+/);
      if (parts[0]) names.add((parts[1] || parts[0]).trim());
    }
  }
  return names;
}

// Aus `export { key as tileKey };` wird im gemeinsamen Geltungsbereich eine
// schlichte Zuweisung - der zweite Name muss weiter zeigen, wohin er zeigte.
function aliasesOf(source) {
  const lines = [];
  for (const m of source.matchAll(EXPORT_LIST_RE)) {
    for (const entry of m[1].split(',')) {
      const [from, to] = entry.trim().split(/\s+as\s+/).map((x) => x && x.trim());
      if (to && from && to !== from) lines.push(`const ${to} = ${from};`);
    }
  }
  return lines;
}

// --- Namen prüfen ---------------------------------------------------------
// In einem gemeinsamen Geltungsbereich ist ein doppelter Name ein stiller
// Fehler, der erst im Spiel auffällt. Lieber hier abbrechen.
const DECL_RE = /^(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;
const seen = new Map();
for (const file of order) {
  const declared = [...modules.get(file).matchAll(DECL_RE)].map((m) => m[1]);
  const aliased = aliasesOf(modules.get(file)).map((line) => line.split(' ')[1]);
  for (const name of [...declared, ...aliased]) {
    const prev = seen.get(name);
    if (prev) throw new Error(`Name doppelt vergeben: "${name}" in ${prev} und ${file}`);
    seen.set(name, file);
  }
}

// --- Verflachen -----------------------------------------------------------
function flatten(source) {
  return source
    .replace(IMPORT_RE, '')
    .replace(REEXPORT_RE, '')
    // `export { a, b };` beschreibt nur die Modulgrenze - die gibt es hier nicht mehr.
    .replace(/^export\s*\{[^}]*\}\s*;?[ \t]*$/gm, '')
    .replace(/^export\s+(?=(?:async\s+)?(?:function|const|let|var|class)\b)/gm, '');
}

// Nichts darf beim Verflachen verlorengehen. Ein zu gieriger Ausdruck löscht
// stillschweigend halbe Dateien, und das Ergebnis fällt erst im Browser auf -
// deshalb wird jede Deklaration einzeln nachgezählt.
function declarationsOf(source) {
  return new Set([...source.matchAll(DECL_RE)].map((m) => m[1]));
}

const parts = [];
const exported = new Map();
for (const file of order) {
  const source = modules.get(file);
  const flat = flatten(source);
  for (const name of declarationsOf(source)) {
    if (!declarationsOf(flat).has(name)) {
      throw new Error(`beim Verflachen von ${file} ging "${name}" verloren`);
    }
  }
  for (const name of exportedNamesOf(source)) exported.set(name, file);
  const alias = aliasesOf(source);
  parts.push(`\n// ---- ${file} ----\n${flat.trim()}\n${alias.length ? `${alias.join('\n')}\n` : ''}`);
}
const bundle = parts.join('');

// Jeder Name, unter dem ein Modul etwas nach außen gab, muss im Bündel als
// Bindung ankommen. Das ist die Prüfung, die `export { key as tileKey }`
// gefunden hätte: der Aufrufer nennt tileKey, deklariert war nur key.
const bound = new Set([
  ...[...bundle.matchAll(DECL_RE)].map((m) => m[1]),
]);
for (const [name, file] of exported) {
  if (!bound.has(name)) throw new Error(`${file} gibt "${name}" nach außen, im Bündel fehlt der Name`);
}

if (/^\s*(import|export)\s/m.test(bundle)) {
  throw new Error('im Bündel steht noch ein import/export - die Verflachung hat etwas übersehen');
}

// --- HTML zusammensetzen --------------------------------------------------
// Das Artefakt bringt <html>, <head> und <body> selbst mit; hier steht nur der
// Inhalt, in derselben Reihenfolge wie in index.html.
const inline = (code) => `<script>\n${code}\n</script>`;
let html = read('index.html')
  .replace(/<link rel="stylesheet" href="css\/style\.css"[^>]*>/, `<style>\n${read('css/style.css')}\n</style>`)
  .replace(/<script src="js\/vendor\/three\.min\.js"><\/script>/, inline(read('js/vendor/three.min.js')))
  .replace(/<script type="module" src="js\/main\.js"><\/script>/, inline(bundle))
  .replace(/<!DOCTYPE html>\s*/i, '')
  .replace(/<\/?(?:html|head|body)(?:\s[^>]*)?>\s*/gi, '\n');

// Der Rahmen setzt Zeichensatz und Viewport selbst; ein zweites Mal schadet
// nicht, aber das Titel-Element wird gebraucht - es benennt das Artefakt.
if (!/<title>/.test(html)) throw new Error('kein <title> im Ergebnis');

const target = process.argv[2] || path.join(ROOT, 'dist', 'pax-aeterna.html');
mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, html.trim() + '\n', 'utf8');

const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
console.log(`${order.length} Module verflacht -> ${target}`);
console.log(`  Spielcode ${kb(bundle.length)} · three.js ${kb(read('js/vendor/three.min.js').length)} `
  + `· Stil ${kb(read('css/style.css').length)} · gesamt ${kb(html.length)}`);
console.log(`  Reihenfolge: ${order.join(' ')}`);

// --- Das Artefakt bauen ---------------------------------------------------
// Das Spiel besteht aus zwanzig Moduldateien, einer Formatvorlage und
// Three.js. Ein Artefakt ist eine einzige Seite. Also wird alles
// zusammengelegt: die Module zu einem Bündel, die Vorlage in ein <style>,
// Three.js in ein <script> davor - und der Rumpf des Startbilds dazwischen.
//
//   node build-artifact.mjs            -> dist/black-univers.html
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'dist');
fs.mkdirSync(out, { recursive: true });

const result = await esbuild.build({
  entryPoints: [path.join(here, 'js', 'main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  legalComments: 'none',
  charset: 'utf8',
});
const bundle = result.outputFiles[0].text;

const html = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
// Die Musik: ein Artefakt ist eine Datei, also muss die Aufnahme mit hinein.
const musicPath = path.join(here, 'audio', 'black-hull-directive.mp3');
const music = fs.existsSync(musicPath)
  ? `data:audio/mpeg;base64,${fs.readFileSync(musicPath).toString('base64')}`
  : null;
const css = fs.readFileSync(path.join(here, 'css', 'style.css'), 'utf8');
const three = fs.readFileSync(path.join(here, 'js', 'vendor', 'three.min.js'), 'utf8');

// Aus dem Dokument wird der Rumpf; die beiden <script src>-Zeilen am Ende
// fallen weg, weil beides gleich eingebettet folgt.
const body = html
  .slice(html.indexOf('<body>') + '<body>'.length, html.lastIndexOf('</body>'))
  .replace(/\n\s*<script src="[^"]*"><\/script>/g, '')
  .replace(/\n\s*<script type="module"[^>]*><\/script>/g, '')
  .replace(/\n\s*<link[^>]*>/g, '')
  .replace('src="audio/black-hull-directive.mp3"', music ? `src="${music}"` : '')
  .trim();

const page = `<title>Black Univers</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Barlow:wght@400;500;600&display=swap">
<style>
${css}
</style>

${body}

<script>
${three}
</script>
<script>
${bundle}
</script>
`;

const file = path.join(out, 'black-univers.html');
fs.writeFileSync(file, page, 'utf8');
const kb = (Buffer.byteLength(page) / 1024).toFixed(0);
console.log(`${file} geschrieben (${kb} KB${music ? ', mit Musik' : ', ohne Musik'})`);

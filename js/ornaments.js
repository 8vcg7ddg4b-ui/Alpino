// Gezeichnetes Beiwerk für den Startbildschirm: der Lorbeerkranz über dem
// Titel und die sechs Zeichen auf den Menütafeln.
//
// Beides stand zuvor als Emoji da (🌿🦅 und 🏛️📜⚱️📖⚙️⛶) - praktisch, aber
// nicht im Bild: ein Emoji sieht auf jedem Betriebssystem anders aus, in
// eigenen Farben, mit eigenem Strichgewicht, und genau dort, wo der
// Titelbildschirm am ehesten wie aus einem Guss wirken soll, wechselte der
// Stil mittendrin. Hier wird stattdessen wie überall sonst im Spiel reines
// SVG gezeichnet - keine Bilddatei, überall gleich, in der Farbe des Golds,
// das schon den Titel und die Tafeln umrandet.

import { emblemPaths } from './emblems.js';

// --- Der Lorbeerkranz ------------------------------------------------------
// Zwei Zweige, die von unten außen nach oben innen schwingen, mit Blattpaaren
// im Wechsel - der klassische Kranz, wie er auf Münzen um einen Kopf oder ein
// Zeichen läuft. Hier ist er offen: die Zweige laufen auf den Adler zu, statt
// sich hinter ihm zu schließen, so bleibt die Form in einer Kopfzeile lesbar.
const WREATH_W = 220;
const WREATH_H = 66;

// Ein Blatt: zwei Bögen von der Basis zur Spitze, spiegelbildlich zueinander.
function leafPath(cx, cy, angleDeg, len, wid) {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const nx = -dy;
  const ny = dx;
  const bx = cx - dx * len * 0.5;
  const by = cy - dy * len * 0.5;
  const tx = cx + dx * len * 0.5;
  const ty = cy + dy * len * 0.5;
  const c1x = cx + nx * wid;
  const c1y = cy + ny * wid;
  const c2x = cx - nx * wid;
  const c2y = cy - ny * wid;
  const f = (v) => v.toFixed(1);
  return `M ${f(bx)} ${f(by)} Q ${f(c1x)} ${f(c1y)} ${f(tx)} ${f(ty)} `
    + `Q ${f(c2x)} ${f(c2y)} ${f(bx)} ${f(by)} Z`;
}

// Ein Punkt und die Tangentenrichtung (in Grad) auf einer quadratischen
// Bézierkurve an der Stelle t - daraus ergibt sich, wie ein Blatt an dieser
// Stelle des Stängels steht.
function bezierPoint(p0, p1, p2, t) {
  const u = 1 - t;
  const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
  const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
  const dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
  const dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
  return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}

// Ein Zweig: der Stängel als Kurve, darauf sechs Blätter im Wechsel links und
// rechts, fast am Stängel entlang statt quer dazu - so liegen Lorbeerblätter
// wirklich, dachziegelartig übereinander, nicht wie Speichen an einem Rad.
// Frühere Fassungen machten die Blätter zu schmal: lang und dünn liest sich
// aus der Ferne - und diese Zeile steht nur klein über dem Titel - als
// Zickzack aus Zacken, nicht als Laub. Breiter und kürzer, wie ein echtes
// Lorbeerblatt, bleibt es auch klein noch ein Blatt.
function branch(p0, p1, p2, mirror) {
  const f = (v) => v.toFixed(1);
  const stem = `M ${f(p0[0])} ${f(p0[1])} Q ${f(p1[0])} ${f(p1[1])} ${f(p2[0])} ${f(p2[1])}`;
  let leaves = '';
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const t = 0.12 + (i / (steps - 1)) * 0.76;
    const { x, y, angle } = bezierPoint(p0, p1, p2, t);
    // Zur Spitze hin kleiner - am Ansatz ein kräftiges Blatt, an der Spitze
    // ein junger Trieb.
    const grow = 1 - t * 0.38;
    const len = 20 * grow;
    const wid = 8.5 * grow;
    // Quer zum Stängel versetzt, damit die Blätter nicht auf der Mittellinie
    // aufeinanderliegen - abwechselnd links und rechts davon.
    const rad = (angle * Math.PI) / 180;
    const nx = -Math.sin(rad);
    const ny = Math.cos(rad);
    const seite = (i % 2 === 0 ? 1 : -1) * (mirror ? -1 : 1);
    const off = 2.6 * grow;
    const lx = x + nx * off * seite;
    const ly = y + ny * off * seite;
    leaves += `<path d="${leafPath(lx, ly, angle + 9 * seite, len, wid)}"/>`;
  }
  return `<path d="${stem}" fill="none" stroke-width="1.8"/>${leaves}`;
}

// Der Adler in der Mitte: dasselbe Zeichen, das Rom auf seinen Feldzeichen
// führte (`emblems.js`) - es steht ohnehin schon auf der Fahne im Zelt und im
// Symbol der Kopfzeile, und ein Kranz um einen Legionsadler ist genau das
// Bild, das ein Feldherr vor seinem Zelt aufstellen ließ. Er bekommt sein
// eigenes `fill`, statt es vom Kranz zu erben - sonst bleibt er beim
// SVG-eigenen Schwarz stehen, während der Kranz längst golden ist.
function eagleBadge(cx, cy, scale) {
  return `<g fill="currentColor" transform="translate(${cx} ${cy}) scale(${scale}) translate(-50 -50)">
    ${emblemPaths('rom')}
  </g>`;
}

export function wreathSVG() {
  const cx = WREATH_W / 2;
  // Linker Zweig: von unten außen nach oben, dicht an den Adler heran. Der
  // mittlere Punkt liegt auf einer glatten Linie zwischen Fuß und Spitze,
  // nur nach außen gerückt - ein Kontrollpunkt außerhalb dieser Spanne biegt
  // die Kurve zurück auf sich selbst, und genau das ergab den kleinen Haken,
  // der wie ein Widerhaken am unteren Ende jedes Zweigs stand.
  const left = branch([26, WREATH_H - 6], [46, 32], [cx - 14, 16], false);
  const right = branch([WREATH_W - 26, WREATH_H - 6], [WREATH_W - 46, 32],
    [cx + 14, 16], true);
  return `<svg viewBox="0 0 ${WREATH_W} ${WREATH_H}" width="100%" height="100%"
    xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g fill="currentColor" stroke="currentColor" stroke-linecap="round">
      ${left}
      ${right}
    </g>
    ${eagleBadge(cx, 17, 0.46)}
  </svg>`;
}

// --- Die Zeichen auf den Menütafeln -----------------------------------------
// Sechs Linienzeichnungen, alle im selben Strichgewicht, alle in derselben
// Fläche (24 x 24) - damit keines der sechs zufällig größer oder fetter wirkt
// als die anderen, wie es bei sechs verschiedenen Emoji-Schriftzeichen der
// Fall war.
const STROKE = 'fill="none" stroke="currentColor" stroke-width="1.6" '
  + 'stroke-linecap="round" stroke-linejoin="round"';

const MENU_ICONS = {
  // Fortsetzen: das Feldherrnzelt, in dem jeder Feldzug beginnt - offen für
  // den, der nur unterbrochen hat und zurückkehrt.
  camp: `<path ${STROKE} d="M12 4 L3 20 M12 4 L21 20 M3 20 H21 M9 20 L12 11 L15 20"/>`,
  // Neues Spiel: ein Tempel, Giebel und Säulen - derselbe Bauplan, der auf
  // der Karte jede Stadt krönt.
  temple: `<path ${STROKE} d="M3 9 L12 3.5 L21 9 M4 9 H20 M4 9 V19 M20 9 V19
    M4 20 H20 M6.4 9 V17.6 M9.6 9 V17.6 M14.4 9 V17.6 M17.6 9 V17.6"/>`,
  // Chronik: eine Schriftrolle, an beiden Enden aufgerollt, mit zwei Zeilen
  // Text dazwischen.
  scroll: `<path ${STROKE} d="M6 5 a2 2 0 0 0 0 4 H16 M6 5 H16 a2 2 0 0 1 0 4
    M18 15 a2 2 0 0 1 0 4 H8 M18 15 H8 a2 2 0 0 0 0 4
    M8 9 V15 M16 9 V15 M9.5 11 H14 M9.5 13 H14"/>`,
  // Letzter Feldzug: eine Amphore - das Gefäß, in dem eine Asche oder eine
  // Erinnerung aufgehoben wird.
  urn: `<path ${STROKE} d="M9 4 H15 M10 4 V6.4 C10 7.6 8 7.4 8 9.4
    C8 11.5 16 11.5 16 9.4 C16 7.4 14 7.6 14 6.4 V4
    M8.6 11.2 C6.8 12.6 6 15 6 17 C6 19.5 8.5 21 12 21 C15.5 21 18 19.5 18 17
    C18 15 17.2 12.6 15.4 11.2"/>`,
  // Spielregeln: ein aufgeschlagenes Buch mit sichtbarem Falz.
  book: `<path ${STROKE} d="M12 6.5 C10.5 5 7.5 4.5 4 5 V18 C7.5 17.5 10.5 18 12 19.5
    C13.5 18 16.5 17.5 20 18 V5 C16.5 4.5 13.5 5 12 6.5 V19.5"/>`,
  // Einstellungen: ein Zahnrad um eine Nabe - schlicht, wie es überall steht.
  gear: `<path ${STROKE} d="M12 8.6 A3.4 3.4 0 1 1 12 15.4 A3.4 3.4 0 1 1 12 8.6 Z
    M12 3.4 V5.6 M12 18.4 V20.6 M20.6 12 H18.4 M5.6 12 H3.4
    M17.9 6.1 L16.3 7.7 M7.7 16.3 L6.1 17.9 M17.9 17.9 L16.3 16.3
    M7.7 7.7 L6.1 6.1"/>`,
  // Vollbild: vier Winkel, die auseinanderstreben - dieselbe Geste wie beim
  // Weiten des eigenen Blicks.
  expand: `<path ${STROKE} d="M8 4 H4 V8 M16 4 H20 V8 M8 20 H4 V16
    M16 20 H20 V16"/>`,
};

export function menuIconSVG(key) {
  const path = MENU_ICONS[key] || '';
  return `<svg viewBox="0 0 24 24" width="100%" height="100%"
    xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${path}</svg>`;
}

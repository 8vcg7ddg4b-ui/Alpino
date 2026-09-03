// --- Das Titelbild --------------------------------------------------------
// Kein Bild von der Platte, sondern gezeichneter Raum: ein Nebel, ein
// Planet, der Träger im Anflug, eine Staffel, die gerade startet. Die Farben
// kommen aus der gewählten Fraktion, das Bild bleibt dasselbe - so sieht das
// Startbild nach dem aus, was man führt.
import { factionProfile } from './data.js';
import { emblemSVG } from './emblems.js';

function stars(count, seed, w = 1600, h = 900) {
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = Math.round(rnd() * w);
    const y = Math.round(rnd() * h);
    const r = (rnd() * 1.6 + 0.3).toFixed(2);
    const o = (0.25 + rnd() * 0.7).toFixed(2);
    out += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}"/>`;
  }
  return out;
}

// Der Träger: eine lange Kiellinie, Flugdeck, Türme, Triebwerke. Terranische
// Träger sind Kästen mit Deck, kilrathische sind Klingen.
function carrier(kind, color, accent) {
  if (kind === 'kilrathi') {
    return `
      <g>
        <path d="M180 470 L760 430 L980 470 L760 520 Z" fill="#1a0f0c" stroke="${color}" stroke-width="2"/>
        <path d="M300 452 L820 440 L900 470 L820 498 L300 486 Z" fill="#2a1611"/>
        <path d="M420 440 L640 432 L660 446 L430 452 Z" fill="${accent}" opacity="0.35"/>
        <path d="M700 436 L760 400 L790 440 Z" fill="#2a1611" stroke="${color}" stroke-width="1.5"/>
        <path d="M700 504 L760 540 L790 500 Z" fill="#2a1611" stroke="${color}" stroke-width="1.5"/>
        <circle cx="192" cy="470" r="13" fill="${accent}" opacity="0.85"/>
        <circle cx="210" cy="452" r="8" fill="${accent}" opacity="0.6"/>
        <circle cx="210" cy="488" r="8" fill="${accent}" opacity="0.6"/>
        <path d="M120 470 L186 470" stroke="${accent}" stroke-width="10" opacity="0.35" stroke-linecap="round"/>
      </g>`;
  }
  if (kind === 'firekkan') {
    return `
      <g>
        <path d="M260 480 C420 380 700 380 900 460 C740 500 420 520 260 480 Z"
          fill="#1b1226" stroke="${color}" stroke-width="2"/>
        <path d="M340 462 C480 412 680 412 820 456" fill="none" stroke="${accent}" stroke-width="2" opacity="0.5"/>
        <path d="M520 400 L540 330 L570 402" fill="#241a34" stroke="${color}" stroke-width="1.5"/>
        <circle cx="272" cy="482" r="11" fill="${accent}" opacity="0.8"/>
      </g>`;
  }
  return `
    <g>
      <!-- Rumpf -->
      <path d="M210 500 L300 452 L880 442 L980 476 L880 516 L300 512 Z"
        fill="#141c28" stroke="${color}" stroke-width="2"/>
      <!-- Flugdeck -->
      <path d="M320 456 L860 448 L880 462 L330 470 Z" fill="#1e2a3c"/>
      <path d="M360 458 L820 452" stroke="${accent}" stroke-width="2" opacity="0.55" stroke-dasharray="14 10"/>
      <!-- Insel mit Brücke -->
      <path d="M640 448 L700 408 L742 412 L748 448 Z" fill="#1a2536" stroke="${color}" stroke-width="1.6"/>
      <rect x="704" y="418" width="30" height="10" fill="${accent}" opacity="0.65"/>
      <!-- Hangartor, aus dem die Staffel kommt -->
      <path d="M300 476 L360 476 L360 500 L300 498 Z" fill="${accent}" opacity="0.35"/>
      <!-- Triebwerke -->
      <circle cx="222" cy="498" r="12" fill="${accent}" opacity="0.85"/>
      <circle cx="238" cy="478" r="9" fill="${accent}" opacity="0.7"/>
      <path d="M140 498 L216 498" stroke="${accent}" stroke-width="12" opacity="0.3" stroke-linecap="round"/>
      <path d="M160 478 L232 478" stroke="${accent}" stroke-width="8" opacity="0.22" stroke-linecap="round"/>
      <!-- Geschütztürme -->
      <g fill="#1a2536" stroke="${color}" stroke-width="1.2">
        <rect x="430" y="432" width="22" height="12" rx="3"/>
        <rect x="520" y="430" width="22" height="12" rx="3"/>
        <rect x="470" y="512" width="22" height="12" rx="3"/>
      </g>
    </g>`;
}

// Die Staffel im Anflug: drei Maschinen als Dreiecke mit Schubfahne.
function squadron(color, accent) {
  const one = (x, y, s, o) => `
    <g transform="translate(${x} ${y}) scale(${s})" opacity="${o}">
      <path d="M0 0 L26 8 L0 16 L6 8 Z" fill="#0e1622" stroke="${color}" stroke-width="1.4"/>
      <path d="M6 8 L-16 8" stroke="${accent}" stroke-width="3" opacity="0.6" stroke-linecap="round"/>
      <circle cx="18" cy="8" r="1.8" fill="${accent}"/>
    </g>`;
  return one(1080, 300, 1.5, 0.95) + one(1010, 350, 1.2, 0.8) + one(1130, 372, 1, 0.65)
    + one(430, 640, 1.1, 0.55) + one(500, 668, 0.9, 0.4);
}

export function titleSceneSVG(factionId = 'confed') {
  const f = factionProfile(factionId);
  const color = f.color;
  const accent = f.accent;
  const dark = f.colorDark;
  return `
<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="tsNebula" cx="62%" cy="38%" r="70%">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.55"/>
      <stop offset="38%" stop-color="${dark}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#04060c" stop-opacity="1"/>
    </radialGradient>
    <radialGradient id="tsPlanet" cx="34%" cy="30%" r="80%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.9"/>
      <stop offset="45%" stop-color="${color}" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="#05070d" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="tsFloor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#04060c" stop-opacity="0"/>
      <stop offset="100%" stop-color="#04060c" stop-opacity="0.95"/>
    </linearGradient>
    <filter id="tsGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="18" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="1600" height="900" fill="#04060c"/>
  <rect width="1600" height="900" fill="url(#tsNebula)"/>
  ${stars(260, 90210)}

  <!-- Der Nebel in Schwaden: drei weiche Bänder über dem Sternfeld -->
  <g opacity="0.5" filter="url(#tsGlow)">
    <path d="M-60 240 C220 160 520 300 820 220 C1100 150 1380 260 1660 200 L1660 420 C1320 470 980 360 700 420 C420 480 160 400 -60 440 Z"
      fill="${color}" opacity="0.18"/>
    <path d="M-60 520 C260 470 460 580 760 540 C1060 500 1300 590 1660 540 L1660 700 C1280 740 980 660 680 700 C380 740 120 680 -60 710 Z"
      fill="${dark}" opacity="0.35"/>
  </g>

  <!-- Der Planet am Rand, mit Ring und Terminator -->
  <g transform="translate(1240 620)">
    <circle r="300" fill="url(#tsPlanet)"/>
    <ellipse rx="430" ry="72" fill="none" stroke="${accent}" stroke-width="6" opacity="0.28"
      transform="rotate(-16)"/>
    <ellipse rx="380" ry="58" fill="none" stroke="${color}" stroke-width="3" opacity="0.35"
      transform="rotate(-16)"/>
    <path d="M-300 0 A300 300 0 0 0 300 0 A300 300 0 0 0 -300 0" fill="#04060c" opacity="0.45"/>
  </g>

  <!-- Der Träger im Anflug -->
  <g filter="url(#tsGlow)" opacity="0.98">
    ${carrier(f.kind, color, accent)}
  </g>
  ${squadron(color, accent)}

  <!-- Ein zweiter Verband weit hinten: der Krieg ist größer als dieses Bild -->
  <g opacity="0.35">
    <path d="M1320 210 L1352 220 L1320 230 L1328 220 Z" fill="#0e1622" stroke="${color}" stroke-width="1"/>
    <path d="M1372 250 L1396 258 L1372 266 L1378 258 Z" fill="#0e1622" stroke="${color}" stroke-width="1"/>
  </g>

  <rect y="600" width="1600" height="300" fill="url(#tsFloor)"/>
</svg>`;
}

// --- Der Auswahlbildschirm ----------------------------------------------
// Für jede Fraktion ein Bild: ihr Schiff, ihre Fahne, ihr Himmel. Es steht
// neben dem Namen, wenn man wählt, wen man führt.
export function factionArtSVG(factionId, { width = 420, height = 240 } = {}) {
  const f = factionProfile(factionId);
  return `
<svg viewBox="0 0 420 240" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fa${factionId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${f.colorDark}"/>
      <stop offset="100%" stop-color="#05070d"/>
    </linearGradient>
  </defs>
  <rect width="420" height="240" fill="url(#fa${factionId})"/>
  ${stars(70, factionId.length * 7717, 420, 240)}
  <g transform="translate(-40 -70) scale(0.45)">${carrier(f.kind, f.color, f.accent)}</g>
  <!-- Die Fahne rechts, wie sie an der Brückenwand hängt - mit dem Wappen -->
  <g transform="translate(300 24)">
    <rect x="0" y="0" width="88" height="132" fill="${f.color}" opacity="0.14"/>
    <rect x="0" y="0" width="88" height="132" fill="none" stroke="${f.color}" stroke-width="1.5" opacity="0.6"/>
    <path d="M0 132 L44 148 L88 132" fill="${f.color}" opacity="0.14"/>
    <g transform="translate(14 26) scale(0.6)">${emblemSVG(f.emblem, { size: 100, color: f.accent }).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>
  </g>
  <rect y="196" width="420" height="44" fill="#04060c" opacity="0.72"/>
</svg>`;
}

// Das Bild im Brückenfenster: das Umland der eigenen Hauptwelt. Es richtet
// sich nach dem, was um das System herum auf der Karte liegt.
export function viewportSVG(kind, color, accent) {
  const bg = {
    nebel: `<rect width="400" height="200" fill="#0a1a26"/>
      <ellipse cx="200" cy="120" rx="220" ry="90" fill="${color}" opacity="0.35"/>
      <ellipse cx="120" cy="90" rx="140" ry="60" fill="${accent}" opacity="0.18"/>`,
    trümmer: `<rect width="400" height="200" fill="#06080e"/>
      ${Array.from({ length: 40 }, (_, i) => {
    const x = (i * 97) % 400;
    const y = (i * 53) % 200;
    const r = 1 + (i % 4);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#4a5568" opacity="0.7"/>`;
  }).join('')}`,
    gasriese: `<rect width="400" height="200" fill="#05070d"/>
      <circle cx="290" cy="150" r="140" fill="${color}" opacity="0.55"/>
      <ellipse cx="290" cy="150" rx="200" ry="26" fill="none" stroke="${accent}" stroke-width="4" opacity="0.35"/>`,
    doppelsonne: `<rect width="400" height="200" fill="#0d0a06"/>
      <circle cx="150" cy="80" r="34" fill="#ffd79a"/>
      <circle cx="230" cy="110" r="18" fill="#ff9a6a"/>
      <circle cx="150" cy="80" r="70" fill="#ffd79a" opacity="0.14"/>`,
    flugdeck: `<rect width="400" height="200" fill="#0a0f18"/>
      <path d="M0 150 L400 130 L400 200 L0 200 Z" fill="#141c28"/>
      <path d="M20 168 L380 150" stroke="${accent}" stroke-width="3" stroke-dasharray="16 12" opacity="0.6"/>
      <circle cx="90" cy="140" r="6" fill="${accent}" opacity="0.8"/>
      <circle cx="300" cy="132" r="6" fill="${accent}" opacity="0.8"/>`,
  }[kind] || '';
  return `<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">${bg}
    ${stars(50, kind.length * 331, 400, 200)}</svg>`;
}

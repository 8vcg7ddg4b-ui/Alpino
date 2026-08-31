// Ein Bild für jede Fraktion, für den Auswahlbildschirm.
//
// Dieselbe Bildsprache wie die Chronik: geschichtete Silhouetten vor einem
// Himmelsverlauf, alles als SVG zur Laufzeit gebaut, damit das Spiel eine
// einzelne Datei bleiben kann. Die Zeichenhelfer kommen aus chronicle.js;
// hier stehen nur die, die es dort noch nicht gab.

import {
  SCENE_W, SCENE_H, seeded, sky, sun, hills, peaks, temple, spears, warship,
  palisadeLine, elephant, horseman, figures,
} from './chronicle.js';

// --- Zusätzliche Bausteine ----------------------------------------------

// Nadelwald als gestaffelte Reihe: Germanien und Gallien leben davon.
function pines(baseY, count, height, rng, color, x0 = -40, x1 = SCENE_W + 40) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = x0 + ((x1 - x0) / count) * (i + rng() * 0.7);
    const h = height * (0.6 + rng() * 0.7);
    const w = h * 0.34;
    out += `<path d="M ${x} ${baseY - h} L ${x + w} ${baseY - h * 0.42}
      L ${x + w * 0.55} ${baseY - h * 0.42} L ${x + w * 0.95} ${baseY}
      L ${x - w * 0.95} ${baseY} L ${x - w * 0.55} ${baseY - h * 0.42}
      L ${x - w} ${baseY - h * 0.42} Z" fill="${color}"/>`;
  }
  return out;
}

// Pyramiden von Gizeh: drei Dreiecke, das mittlere das größte.
function pyramids(baseY, x, scale, color, opacity = 1) {
  const one = (cx, s) => `<path d="M ${cx - 150 * s} ${baseY} L ${cx} ${baseY - 130 * s}
    L ${cx + 150 * s} ${baseY} Z" fill="${color}" opacity="${opacity}"/>`;
  return one(x - 250 * scale, scale * 0.72) + one(x, scale)
    + one(x + 235 * scale, scale * 0.6);
}

// Dattelpalme: Stamm mit Wedeln, für Ägypten und Syrien.
function palm(x, baseY, s, color) {
  let fronds = '';
  for (let i = 0; i < 7; i++) {
    const angle = -Math.PI + (i / 6) * Math.PI;
    const dx = Math.cos(angle) * 62 * s;
    const dy = Math.sin(angle) * 34 * s - 18 * s;
    fronds += `<path d="M ${x} ${baseY - 118 * s} q ${dx * 0.55} ${dy - 16 * s} ${dx} ${dy}
      q ${-dx * 0.4} ${-dy * 0.25} ${-dx} ${-dy + 12 * s} Z" fill="${color}"/>`;
  }
  return `<g><path d="M ${x - 6 * s} ${baseY} q ${4 * s} ${-60 * s} ${-2 * s} ${-120 * s}
    l ${14 * s} 0 q ${6 * s} ${60 * s} ${2 * s} ${120 * s} Z" fill="${color}"/>${fronds}</g>`;
}

// Kreidefelsen: eine steile Kante über dem Wasser, Britannien von See aus.
function cliffs(baseY, x0, x1, height, rng, color) {
  let d = `M ${x0} ${SCENE_H} L ${x0} ${baseY - height}`;
  for (let x = x0; x <= x1; x += 120) {
    d += ` L ${x + 60} ${baseY - height + rng() * 40} L ${x + 120} ${baseY - height * 0.94}`;
  }
  d += ` L ${x1} ${baseY} L ${x0} ${baseY} Z`;
  return `<path d="${d}" fill="${color}"/>`;
}

// Streitwagen: zwei Pferde, Kasten, Rad - das britannische Wahrzeichen.
function chariot(x, y, s, color) {
  const wheel = `<circle cx="${x - 10 * s}" cy="${y - 12 * s}" r="${16 * s}" fill="none"
    stroke="${color}" stroke-width="${4 * s}"/>`;
  return `<g fill="${color}">
    ${horseman(x + 62 * s, y, s * 0.9, color).replace(/<circle cx="[^"]*" cy="[^"]*" r="[^"]*"\/>\s*$/, '')}
    <path d="M ${x - 30 * s} ${y - 14 * s} l ${44 * s} 0 l 0 ${-26 * s} l ${-44 * s} 0 Z"/>
    <path d="M ${x + 14 * s} ${y - 26 * s} L ${x + 56 * s} ${y - 30 * s}" stroke="${color}"
      stroke-width="${4 * s}"/>
    ${wheel}
    <circle cx="${x - 6 * s}" cy="${y - 52 * s}" r="${8 * s}"/>
    <path d="M ${x - 12 * s} ${y - 26 * s} l 0 ${-20 * s} l ${13 * s} 0 l 0 ${20 * s} Z"/>
  </g>`;
}

// Der dakische Draco: Wolfskopf auf der Stange, mit wehendem Schlauch.
function draco(x, baseY, s, color) {
  return `<g fill="${color}">
    <rect x="${x - 3 * s}" y="${baseY - 210 * s}" width="${6 * s}" height="${210 * s}"/>
    <path d="M ${x} ${baseY - 214 * s} l ${34 * s} ${-12 * s} l ${-6 * s} ${20 * s}
      l ${16 * s} ${6 * s} l ${-44 * s} ${10 * s} Z"/>
    <path d="M ${x + 12 * s} ${baseY - 190 * s} q ${70 * s} ${10 * s} ${104 * s} ${44 * s}
      q ${-46 * s} ${-14 * s} ${-72 * s} ${-8 * s} q ${34 * s} ${18 * s} ${52 * s} ${44 * s}
      q ${-52 * s} ${-30 * s} ${-92 * s} ${-58 * s} Z" opacity="0.85"/>
  </g>`;
}

// Ein Feldzeichen mit Adler und Querbalken - das römische Signum.
function aquila(x, baseY, s, color) {
  return `<g fill="${color}">
    <rect x="${x - 3 * s}" y="${baseY - 200 * s}" width="${6 * s}" height="${200 * s}"/>
    <rect x="${x - 30 * s}" y="${baseY - 168 * s}" width="${60 * s}" height="${9 * s}"/>
    <rect x="${x - 24 * s}" y="${baseY - 142 * s}" width="${48 * s}" height="${9 * s}"/>
    <path d="M ${x} ${baseY - 232 * s} q ${26 * s} ${4 * s} ${30 * s} ${26 * s}
      q ${-18 * s} ${-10 * s} ${-30 * s} ${-4 * s} q ${-12 * s} ${-6 * s} ${-30 * s} ${4 * s}
      q ${4 * s} ${-22 * s} ${30 * s} ${-26 * s} Z"/>
    <circle cx="${x}" cy="${baseY - 236 * s}" r="${7 * s}"/>
  </g>`;
}

// Eine Stadtmauer mit Zinnen und Torbogen - für die Städte des Ostens.
function walledCity(x0, x1, baseY, height, color) {
  let merlons = '';
  for (let x = x0; x < x1; x += 46) {
    merlons += `<rect x="${x}" y="${baseY - height - 22}" width="26" height="24"/>`;
  }
  const cx = (x0 + x1) / 2;
  return `<g fill="${color}">
    <rect x="${x0}" y="${baseY - height}" width="${x1 - x0}" height="${height}"/>
    ${merlons}
    <rect x="${x0 - 26}" y="${baseY - height * 1.5}" width="60" height="${height * 1.5}"/>
    <rect x="${x1 - 34}" y="${baseY - height * 1.5}" width="60" height="${height * 1.5}"/>
  </g>
  <path d="M ${cx - 34} ${baseY} l 0 -54 a 34 40 0 0 1 68 0 l 0 54 Z" fill="#000" opacity="0.45"/>`;
}

// Ein Kurgan: der Grabhügel, der in der Steppe alles ist, was von weitem zu
// sehen ist.
function kurgan(x, baseY, width, color, opacity = 1) {
  const h = width * 0.42;
  return `<path d="M ${x - width} ${baseY} q ${width * 0.35} ${-h * 1.5} ${width} ${-h}
    q ${width * 0.65} ${-h * 0.5} ${width} ${h} Z" fill="${color}" opacity="${opacity}"/>`;
}

// --- Die Szenen ----------------------------------------------------------
// Jede Fraktion bekommt ihre Landschaft, ihr Licht und ihr Wahrzeichen: das
// Bild soll noch vor dem Text sagen, wo man beginnt und womit man kämpft.

export const FACTION_ART = {
  rom: {
    motto: 'Senat und Volk von Rom',
    render() {
      const rng = seeded(101);
      return `${sky([[0, '#2a3556'], [0.4, '#8d6a63'], [0.75, '#dda264'], [1, '#f6d69c']], 'faRom')}
        ${sun(1230, 600, 70, '#ffeec2', 0.32)}
        ${hills(650, 56, rng, '#8a6a55', 0.5)}
        ${hills(716, 44, rng, '#5d4739', 0.8)}
        ${temple(470, 700, 360, 262, '#2f2419')}
        ${temple(1060, 718, 200, 152, '#241c14')}
        <rect y="744" width="${SCENE_W}" height="${SCENE_H - 744}" fill="#1a140e"/>
        ${aquila(300, 800, 1, '#0f0b07')}
        ${aquila(1320, 806, 0.9, '#0f0b07')}
        ${spears(800, 30, 116, rng, '#120d09')}`;
    },
  },
  karthago: {
    motto: 'Herrin der Meere',
    render() {
      const rng = seeded(202);
      return `${sky([[0, '#10204a'], [0.42, '#2f5c86'], [0.78, '#7fb0c4'], [1, '#e8d9a8']], 'faKar')}
        ${sun(360, 560, 62, '#fff0c0', 0.28)}
        ${hills(640, 40, rng, '#3c5f73', 0.5)}
        ${walledCity(820, 1380, 706, 120, '#16283f')}
        ${elephant(560, 706, 1.15, '#16283f')}
        <rect y="706" width="${SCENE_W}" height="${SCENE_H - 706}" fill="#123050" opacity="0.9"/>
        ${warship(430, 810, 1.25, '#0a1729', '#20365a')}
        ${warship(1120, 852, 1.5, '#08111f', '#1a2b4a')}
        <path d="M -40 ${SCENE_H} L -40 878 Q 420 862 900 884 Q 1300 900 ${SCENE_W + 40} 876
          L ${SCENE_W + 40} ${SCENE_H} Z" fill="#081020"/>`;
    },
  },
  gallier: {
    motto: 'Der Heerbann der Stämme',
    render() {
      const rng = seeded(303);
      return `${sky([[0, '#20303a'], [0.44, '#4d6b5c'], [0.8, '#9db884'], [1, '#d8e0b0']], 'faGal')}
        ${hills(600, 70, rng, '#3f5a48', 0.6)}
        ${hills(690, 50, rng, '#2c4234', 0.85)}
        ${palisadeLine(690, 520, 1120, 46, '#1b2a20')}
        ${pines(742, 26, 150, rng, '#16241b')}
        <rect y="742" width="${SCENE_W}" height="${SCENE_H - 742}" fill="#101b13"/>
        ${spears(816, 34, 128, rng, '#0a120c')}`;
    },
  },
  numidien: {
    motto: 'Ohne Zaum und ohne Sattel',
    render() {
      const rng = seeded(1313);
      // Numidien ist das Land zwischen der Küste und dem Atlas: trockene
      // Hügel, Palmen an den Wasserstellen - und die Reiter, für die es
      // berühmt war, ohne Zaum und ohne Sattel.
      const riders = (baseY, count, scale, colour, x0, x1) => {
        let out = '';
        for (let i = 0; i < count; i++) {
          const x = x0 + ((x1 - x0) / count) * (i + rng() * 0.5);
          out += horseman(x, baseY + rng() * 8, scale * (0.85 + rng() * 0.35), colour);
        }
        return out;
      };
      return `${sky([[0, '#243a55'], [0.38, '#8a7f83'], [0.72, '#d9ab6a'], [1, '#f6dfae']], 'faNum')}
        ${sun(1160, 520, 82, '#ffeec0', 0.36)}
        ${peaks(600, 150, rng, '#6d5c46', 0.5, 8)}
        ${hills(650, 30, rng, '#9c7f4e', 0.62)}
        ${palm(240, 706, 1.05, '#241c12')}
        ${palm(330, 712, 0.75, '#241c12')}
        ${hills(712, 20, rng, '#6a5530', 0.9)}
        ${riders(716, 6, 0.9, '#2b2214', 140, 1500)}
        <rect y="742" width="${SCENE_W}" height="${SCENE_H - 742}" fill="#2a2015"/>
        ${riders(824, 4, 1.6, '#100c06', 160, 1460)}`;
    },
  },
  parther: {
    motto: 'Der Pfeil im Abreiten',
    render() {
      const rng = seeded(1414);
      // Die iranische Hochebene: kahle Ketten im Gegenlicht, davor die
      // Reiterei, die niemand stellen konnte, weil sie nicht stehen blieb.
      const riders = (baseY, count, scale, colour, x0, x1) => {
        let out = '';
        for (let i = 0; i < count; i++) {
          const x = x0 + ((x1 - x0) / count) * (i + rng() * 0.5);
          out += horseman(x, baseY + rng() * 8, scale * (0.9 + rng() * 0.3), colour);
        }
        return out;
      };
      return `${sky([[0, '#301a34'], [0.36, '#7a4256'], [0.7, '#d08a5c'], [1, '#f3d3a2']], 'faPar')}
        ${sun(420, 520, 90, '#ffe3b4', 0.4)}
        ${peaks(556, 220, rng, '#4a3040', 0.62, 7)}
        ${peaks(640, 150, rng, '#33212c', 0.9, 6)}
        ${hills(700, 26, rng, '#5c3f36', 0.9)}
        ${riders(706, 6, 0.95, '#251119', 130, 1520)}
        <rect y="736" width="${SCENE_W}" height="${SCENE_H - 736}" fill="#241119"/>
        ${riders(820, 4, 1.7, '#100609', 170, 1470)}
        ${spears(804, 12, 88, rng, '#170a0e', -20, 700)}`;
    },
  },
  armenien: {
    motto: 'Im Schatten des Ararat',
    render() {
      const rng = seeded(1515);
      // Das armenische Hochland: der Doppelgipfel über allem, davor die
      // Bergketten und die gepanzerte Reiterei des Adels.
      const riders = (baseY, count, scale, colour, x0, x1) => {
        let out = '';
        for (let i = 0; i < count; i++) {
          const x = x0 + ((x1 - x0) / count) * (i + rng() * 0.5);
          out += horseman(x, baseY + rng() * 8, scale * (0.9 + rng() * 0.3), colour);
        }
        return out;
      };
      return `${sky([[0, '#1d2f42'], [0.4, '#4f6a72'], [0.74, '#c4a878'], [1, '#f0dfb8']], 'faArm')}
        ${sun(1220, 470, 70, '#fff0cc', 0.3)}
        <path d="M 300 660 L 620 240 L 760 430 L 840 320 L 1180 660 Z" fill="#e9edf2" opacity="0.95"/>
        <path d="M 520 420 L 620 240 L 720 380 L 660 356 L 590 430 Z" fill="#ffffff"/>
        <path d="M 790 386 L 840 320 L 906 410 L 862 396 L 826 430 Z" fill="#ffffff"/>
        ${peaks(648, 150, rng, '#3f4f5c', 0.75, 7)}
        ${hills(700, 26, rng, '#5b5a3f', 0.9)}
        ${riders(708, 5, 0.95, '#221d16', 150, 1500)}
        <rect y="742" width="${SCENE_W}" height="${SCENE_H - 742}" fill="#221e17"/>
        ${riders(824, 4, 1.65, '#0d0b08', 180, 1450)}
        ${spears(806, 11, 92, rng, '#141009', -20, 660)}`;
    },
  },
  pontus: {
    motto: 'Stern und Sichel über dem Meer',
    render() {
      const rng = seeded(1616);
      // Die pontische Küste: das Schwarze Meer, dahinter die Kette des
      // Pontischen Gebirges, davor die Häfen und ihre Schiffe.
      return `${sky([[0, '#161f3e'], [0.38, '#3c4a72'], [0.72, '#8f8fae'], [1, '#e0d6c4']], 'faPon')}
        ${sun(360, 470, 62, '#fff2d0', 0.3)}
        ${peaks(560, 210, rng, '#39415e', 0.62, 8)}
        ${peaks(636, 140, rng, '#272d45', 0.9, 6)}
        ${walledCity(760, 1180, 646, 78, '#1c2133')}
        ${figures(650, 10, rng, '#161b2a', 220, 700, 1.2)}
        <path d="M -40 ${SCENE_H} L -40 668 Q 460 654 940 676 Q 1300 690 ${SCENE_W + 40} 666
          L ${SCENE_W + 40} ${SCENE_H} Z" fill="#1b3350" opacity="0.96"/>
        ${warship(360, 748, 1.0, '#0b1520', '#27435f')}
        ${warship(980, 800, 1.25, '#08111a', '#1e3750')}
        ${warship(1420, 858, 1.4, '#060d14', '#182c40')}`;
    },
  },
  athen: {
    motto: 'Die Stadt und ihre Schiffe',
    render() {
      const rng = seeded(404);
      // Die Akropolis über der Stadt, und darunter das, worauf Athen wirklich
      // stand: der Hafen von Piräus mit den Trieren darin.
      return `${sky([[0, '#1d3f74'], [0.45, '#4f86b8'], [0.8, '#a9d0e0'], [1, '#f0e6c4']], 'faAth')}
        ${sun(1300, 300, 58, '#fff6d8', 0.26)}
        ${peaks(640, 190, rng, '#5b6f86', 0.55, 7)}
        ${hills(712, 44, rng, '#7d8a72', 0.75)}
        ${temple(540, 706, 400, 280, '#2b2f33')}
        ${temple(1140, 716, 190, 132, '#232830')}
        <rect y="712" width="${SCENE_W}" height="48" fill="#5c6553"/>
        <path d="M -40 ${SCENE_H} L -40 758 Q 460 744 940 764 Q 1300 778 ${SCENE_W + 40} 754
          L ${SCENE_W + 40} ${SCENE_H} Z" fill="#1c3a52" opacity="0.95"/>
        ${warship(400, 820, 1.0, '#0d1a24', '#2c4f68')}
        ${warship(980, 860, 1.25, '#0a151d', '#224054')}
        ${warship(1430, 900, 1.4, '#080f16', '#1b3446')}`;
    },
  },
  sparta: {
    motto: 'Mauern aus Männern',
    render() {
      const rng = seeded(1515);
      // Kein Tempel, keine Mauer, keine Schiffe: der Taygetos, und davor die
      // Linie. Lykurg soll gesagt haben, eine Stadt sei durch ihre Männer
      // befestigt und nicht durch Ziegel - das Bild sagt dasselbe.
      return `${sky([[0, '#2a1c24'], [0.42, '#6b4340'], [0.78, '#b48a72'], [1, '#e8d3ae']], 'faSpa')}
        ${sun(360, 420, 62, '#ffe6c0', 0.24)}
        ${peaks(586, 300, rng, '#4a3436', 0.7, 5)}
        ${peaks(672, 150, rng, '#33242a', 0.9, 6)}
        ${hills(726, 30, rng, '#4a3c33', 0.85)}
        <rect y="726" width="${SCENE_W}" height="${SCENE_H - 726}" fill="#1d1517"/>
        ${figures(826, 22, rng, '#0c0809', -20, 1580, 1.7)}
        ${spears(826, 40, 150, rng, '#0c0809')}`;
    },
  },
  makedonien: {
    motto: 'Die Fesseln Griechenlands',
    render() {
      const rng = seeded(1313);
      // Der Olymp im Rücken, die Burg über der Landenge im Bild, davor die
      // Sarissen: fünf Meter Speer, deshalb stehen sie höher als anderswo.
      return `${sky([[0, '#1b2f4d'], [0.44, '#4a6e86'], [0.8, '#b6bda6'], [1, '#efe0b4']], 'faMak')}
        ${sun(300, 330, 60, '#fff4d6', 0.24)}
        ${peaks(600, 240, rng, '#4a5a6b', 0.6, 6)}
        ${peaks(668, 130, rng, '#33424f', 0.85, 5)}
        ${walledCity(880, 1320, 700, 150, '#22303c')}
        ${temple(430, 704, 260, 190, '#1c2833')}
        <rect y="704" width="${SCENE_W}" height="${SCENE_H - 704}" fill="#151f28"/>
        ${figures(812, 15, rng, '#0a1119', 120, 1500, 1.5)}
        ${spears(812, 34, 200, rng, '#0a1119')}`;
    },
  },
  syrakus: {
    motto: 'Die Insel zwischen zwei Reichen',
    render() {
      const rng = seeded(1414);
      // Der Ätna raucht im Hintergrund, im Hafen liegen die Fünfruderer, und
      // an der Mole steht das, wofür die Stadt berühmt war: ein Geschütz.
      const katapult = (x, baseY, sc, colour) => `<g fill="${colour}">
        <path d="M ${x - 60 * sc} ${baseY} l ${16 * sc} ${-52 * sc} l ${88 * sc} 0
          l ${16 * sc} ${52 * sc} Z"/>
        <path d="M ${x - 46 * sc} ${baseY - 52 * sc} L ${x + 34 * sc} ${baseY - 120 * sc}
          l ${14 * sc} ${10 * sc} L ${x - 32 * sc} ${baseY - 46 * sc} Z"/>
        <rect x="${x - 66 * sc}" y="${baseY - 62 * sc}" width="${132 * sc}" height="${10 * sc}"/>
        <circle cx="${x + 42 * sc}" cy="${baseY - 126 * sc}" r="${11 * sc}"/>
      </g>`;
      return `${sky([[0, '#243a63'], [0.42, '#7b6e88'], [0.76, '#d8a377'], [1, '#f6e0b2']], 'faSyr')}
        ${sun(1180, 520, 68, '#ffeec6', 0.3)}
        ${peaks(628, 210, rng, '#5c5560', 0.55, 3)}
        ${hills(690, 34, rng, '#8a7d5e', 0.75)}
        ${temple(360, 702, 300, 216, '#2a2620')}
        ${walledCity(760, 1260, 702, 118, '#241f19')}
        <path d="M -40 ${SCENE_H} L -40 720 Q 480 706 980 728 Q 1320 742 ${SCENE_W + 40} 716
          L ${SCENE_W + 40} ${SCENE_H} Z" fill="#1a3346" opacity="0.94"/>
        ${katapult(250, 830, 1.15, '#0d1a24')}
        ${warship(760, 812, 1.15, '#0c1a25', '#2b4a60')}
        ${warship(1330, 866, 1.4, '#08131b', '#20394a')}`;
    },
  },
  germanen: {
    motto: 'Der Wald hält uns',
    render() {
      const rng = seeded(505);
      return `${sky([[0, '#1a222c'], [0.46, '#3b4a52'], [0.82, '#7b8a84'], [1, '#c3cbbc']], 'faGer')}
        ${hills(596, 54, rng, '#33443f', 0.55)}
        ${pines(660, 22, 170, rng, '#243530', 60, 1560)}
        ${pines(744, 30, 210, rng, '#16221e')}
        <rect y="744" width="${SCENE_W}" height="${SCENE_H - 744}" fill="#0f1714"/>
        ${figures(806, 16, rng, '#080e0b', 120, 1480, 1.6)}
        ${spears(806, 22, 132, rng, '#080e0b')}`;
    },
  },
  britannier: {
    motto: 'Jenseits des Meeres',
    render() {
      const rng = seeded(606);
      return `${sky([[0, '#2b3a4a'], [0.45, '#61798a'], [0.8, '#a8bcc4'], [1, '#dfe6e2']], 'faBri')}
        ${cliffs(700, -40, 760, 210, rng, '#cfd6cf')}
        ${hills(700, 30, rng, '#5f7358', 0.9)}
        ${palisadeLine(700, 250, 620, 34, '#2c3a2e')}
        ${chariot(1080, 760, 1.5, '#1b2620')}
        <path d="M -40 ${SCENE_H} L -40 790 Q 500 774 1000 796 Q 1350 812 ${SCENE_W + 40} 788
          L ${SCENE_W + 40} ${SCENE_H} Z" fill="#2b4152" opacity="0.92"/>
        ${warship(400, 862, 1.2, '#111d26', '#243642')}`;
    },
  },
  iberer: {
    motto: 'Die Krieger der Meseta',
    render() {
      const rng = seeded(707);
      return `${sky([[0, '#3a2c3e'], [0.42, '#95614f'], [0.78, '#d99b5e'], [1, '#f2d59a']], 'faIbe')}
        ${sun(300, 620, 66, '#ffe6ae', 0.3)}
        ${peaks(624, 150, rng, '#6b4a44', 0.5, 8)}
        ${hills(700, 46, rng, '#8a5f42', 0.8)}
        ${walledCity(900, 1300, 700, 96, '#3a2620')}
        <rect y="740" width="${SCENE_W}" height="${SCENE_H - 740}" fill="#2a1a15"/>
        ${figures(812, 18, rng, '#150d0a', 80, 1520, 1.7)}`;
    },
  },
  daker: {
    motto: 'Hinter den Karpaten',
    render() {
      const rng = seeded(808);
      return `${sky([[0, '#1b2436'], [0.44, '#46566b'], [0.8, '#8f9bab'], [1, '#d9d5c4']], 'faDak')}
        ${peaks(600, 240, rng, '#3f4c5e', 0.7, 8)}
        ${peaks(682, 160, rng, '#2b3646', 0.9, 6)}
        ${pines(742, 24, 130, rng, '#1b2a26')}
        <rect y="742" width="${SCENE_W}" height="${SCENE_H - 742}" fill="#141d20"/>
        ${draco(1160, 810, 1.15, '#0b1114')}
        ${spears(810, 24, 124, rng, '#0b1114', -40, 1000)}`;
    },
  },
  seleukiden: {
    motto: 'Das Erbe Alexanders',
    render() {
      const rng = seeded(909);
      return `${sky([[0, '#3a2a4a'], [0.42, '#8c5b52'], [0.76, '#d9a259'], [1, '#f4dda4']], 'faSel')}
        ${sun(1140, 560, 74, '#ffeab4', 0.32)}
        ${hills(636, 44, rng, '#7a5b48', 0.55)}
        ${walledCity(180, 640, 700, 128, '#2c1f1c')}
        ${palm(760, 704, 1, '#241a16')}
        ${palm(830, 712, 0.7, '#241a16')}
        ${elephant(1130, 706, 1.35, '#241a16')}
        <rect y="706" width="${SCENE_W}" height="${SCENE_H - 706}" fill="#1a1210"/>
        ${spears(806, 30, 140, rng, '#0d0907')}`;
    },
  },
  ptolemaeer: {
    motto: 'Das Korn des Nils',
    render() {
      const rng = seeded(1010);
      return `${sky([[0, '#243a6b'], [0.4, '#6f7fa4'], [0.74, '#d9b878'], [1, '#f6e3b0']], 'faPto')}
        ${sun(430, 590, 78, '#fff1c4', 0.34)}
        ${pyramids(690, 1090, 1.15, '#2c2419', 0.95)}
        ${hills(700, 26, rng, '#8a7448', 0.7)}
        ${palm(300, 700, 1.15, '#1e1a12')}
        ${palm(400, 706, 0.85, '#1e1a12')}
        ${palm(700, 702, 0.95, '#1e1a12')}
        <rect y="700" width="${SCENE_W}" height="${SCENE_H - 700}" fill="#1d2a34" opacity="0.92"/>
        ${figures(792, 14, rng, '#0d1418', 120, 900, 1.6)}
        <path d="M -40 ${SCENE_H} L -40 856 Q 500 840 1000 862 Q 1340 876 ${SCENE_W + 40} 852
          L ${SCENE_W + 40} ${SCENE_H} Z" fill="#122029"/>`;
    },
  },
  illyrer: {
    motto: 'Die Ruder der Adria',
    render() {
      const rng = seeded(1111);
      return `${sky([[0, '#17324f'], [0.42, '#3f6f8f'], [0.78, '#93b6b8'], [1, '#e8d8ae']], 'faIll')}
        ${sun(1240, 300, 54, '#ffeec6', 0.28)}
        ${peaks(596, 190, rng, '#3d4f5c', 0.6, 7)}
        ${peaks(660, 120, rng, '#2b3a45', 0.9, 5)}
        ${palisadeLine(662, 180, 540, 32, '#1d2830')}
        ${figures(662, 9, rng, '#141d24', 200, 520, 1.3)}
        <path d="M -40 ${SCENE_H} L -40 678 Q 420 664 880 686 Q 1260 700 ${SCENE_W + 40} 676
          L ${SCENE_W + 40} ${SCENE_H} Z" fill="#1d4258" opacity="0.95"/>
        ${warship(430, 760, 0.95, '#0d1b24', '#2a5266')}
        ${warship(1010, 812, 1.2, '#0a151c', '#20404f')}
        ${warship(1440, 866, 1.35, '#080f14', '#1a3543')}`;
    },
  },
  sarmaten: {
    motto: 'Die Steppe hat kein Ende',
    render() {
      const rng = seeded(1212);
      // Ein Reitervolk ohne Städte: was in der Steppe von weitem auffällt,
      // sind die Grabhügel und der Staub eines Reiterzugs.
      const riders = (baseY, count, scale, colour, x0, x1) => {
        let out = '';
        for (let i = 0; i < count; i++) {
          const x = x0 + ((x1 - x0) / count) * (i + rng() * 0.5);
          out += horseman(x, baseY + rng() * 10, scale * (0.85 + rng() * 0.3), colour);
        }
        return out;
      };
      return `${sky([[0, '#2c3550'], [0.4, '#7c7a86'], [0.74, '#c9a86a'], [1, '#f0dcae']], 'faSar')}
        ${sun(1080, 560, 76, '#ffeec0', 0.34)}
        ${hills(618, 26, rng, '#8a7a52', 0.45)}
        ${kurgan(320, 660, 130, '#40391f', 0.75)}
        ${kurgan(560, 668, 84, '#3a3320', 0.75)}
        ${hills(690, 18, rng, '#5f5530', 0.9)}
        ${riders(700, 7, 0.8, '#2a2415', 120, 1520)}
        <rect y="712" width="${SCENE_W}" height="${SCENE_H - 712}" fill="#241f13"/>
        ${riders(790, 5, 1.5, '#100d08', 120, 1500)}
        ${spears(772, 10, 96, rng, '#171208', -20, 620)}`;
    },
  },
};

export function factionArt(factionId) {
  return FACTION_ART[factionId] || FACTION_ART.rom;
}

// Fertiges SVG-Markup, das jedes Seitenverhältnis füllt.
export function factionArtSVG(factionId) {
  return `<svg viewBox="0 0 ${SCENE_W} ${SCENE_H}" preserveAspectRatio="xMidYMid slice"
    xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${factionArt(factionId).render()}</svg>`;
}

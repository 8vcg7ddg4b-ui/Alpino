// Bilder zur Geschichte der römischen Republik für den Startbildschirm.
//
// Alles ist als SVG gezeichnet und wird zur Laufzeit zusammengesetzt: keine
// Bilddateien, damit das Spiel auch als einzelne HTML-Datei und ohne Netz
// funktioniert. Die Szenen arbeiten mit geschichteten Silhouetten vor einem
// Himmelsverlauf - eine Bildsprache, die in reinem SVG glaubwürdig aussieht,
// wo gezeichnete Figuren roh wirken würden.

const SCENE_W = 1600;
const SCENE_H = 900;

// Ein fester Zufall je Szene: dieselbe Bergkette, dieselbe Menge, jedes Mal.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s % 100000) / 100000;
  };
}

function sky(stops, id) {
  const marks = stops
    .map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`)
    .join('');
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${marks}</linearGradient></defs>
    <rect width="${SCENE_W}" height="${SCENE_H}" fill="url(#${id})"/>`;
}

function sun(x, y, r, color, glow = 0.22) {
  return `<circle cx="${x}" cy="${y}" r="${r * 3.4}" fill="${color}" opacity="${glow * 0.35}"/>
    <circle cx="${x}" cy="${y}" r="${r * 1.9}" fill="${color}" opacity="${glow * 0.6}"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
}

// Eine weiche SCENE_Hügelkette als geschlossener Pfad bis zum unteren Bildrand.
function hills(baseY, amplitude, rng, color, opacity = 1, step = 110) {
  let d = `M -40 ${SCENE_H} L -40 ${baseY}`;
  for (let x = -40; x <= SCENE_W + 40; x += step) {
    const y = baseY - Math.sin(x / 260) * amplitude * 0.6 - rng() * amplitude;
    d += ` Q ${x + step / 2} ${y - amplitude * 0.5} ${x + step} ${y}`;
  }
  d += ` L ${SCENE_W + 40} ${SCENE_H} Z`;
  return `<path d="${d}" fill="${color}" opacity="${opacity}"/>`;
}

// Eine zackige Bergkette - dieselbe Form, die auch auf der Spielkarte steht.
function peaks(baseY, height, rng, color, opacity = 1, count = 9) {
  let d = `M -40 ${SCENE_H} L -40 ${baseY}`;
  const step = (SCENE_W + 80) / count;
  for (let i = 0; i <= count; i++) {
    const x = -40 + i * step;
    const h = height * (0.45 + rng() * 0.55);
    d += ` L ${x - step * 0.28} ${baseY - h * 0.35} L ${x} ${baseY - h}`
      + ` L ${x + step * 0.3} ${baseY - h * 0.3}`;
  }
  d += ` L ${SCENE_W + 40} ${baseY} L ${SCENE_W + 40} ${SCENE_H} Z`;
  return `<path d="${d}" fill="${color}" opacity="${opacity}"/>`;
}

// Ein Tempel in Frontalansicht: Stufen, Säulen, Gebälk, Giebel.
function temple(cx, baseY, width, height, color) {
  const half = width / 2;
  const columns = 8;
  const colW = width / (columns * 2.1);
  const shaftTop = baseY - height * 0.62;
  let shafts = '';
  for (let i = 0; i < columns; i++) {
    const x = cx - half + (width / (columns - 1)) * i - colW / 2;
    shafts += `<rect x="${x}" y="${shaftTop}" width="${colW}" height="${baseY - shaftTop}"/>`;
  }
  return `<g fill="${color}">
    <rect x="${cx - half - 26}" y="${baseY}" width="${width + 52}" height="16"/>
    <rect x="${cx - half - 14}" y="${baseY + 16}" width="${width + 28}" height="16"/>
    ${shafts}
    <rect x="${cx - half - 18}" y="${shaftTop - 26}" width="${width + 36}" height="26"/>
    <path d="M ${cx - half - 30} ${shaftTop - 26} L ${cx} ${shaftTop - 26 - height * 0.26}
      L ${cx + half + 30} ${shaftTop - 26} Z"/>
  </g>`;
}

// Eine Reihe erhobener Speere mit Köpfen darunter: eine Menge, eine Schlachtreihe.
function spears(baseY, count, height, rng, color, x0 = -40, x1 = SCENE_W + 40) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = x0 + ((x1 - x0) / count) * (i + rng() * 0.6);
    const h = height * (0.7 + rng() * 0.5);
    const lean = (rng() - 0.5) * 14;
    out += `<path d="M ${x} ${baseY} L ${x + lean} ${baseY - h}" stroke="${color}"
      stroke-width="4" fill="none"/>`;
    out += `<path d="M ${x + lean} ${baseY - h} l -5 12 l 5 10 l 5 -10 Z" fill="${color}"/>`;
    // A helmeted head at the foot of each spear, sitting on the line rather
    // than floating above it.
    out += `<circle cx="${x - 4}" cy="${baseY - 7}" r="8" fill="${color}"/>`;
  }
  return out;
}

// Flammen als aufsteigende Zungen.
function flames(x0, x1, baseY, height, rng, colors) {
  let out = '';
  for (let i = 0; i < 26; i++) {
    const x = x0 + (x1 - x0) * rng();
    const h = height * (0.35 + rng() * 0.9);
    const w = 14 + rng() * 26;
    const color = colors[Math.floor(rng() * colors.length)];
    out += `<path d="M ${x} ${baseY} C ${x - w} ${baseY - h * 0.5} ${x + w * 0.6} ${baseY - h * 0.7}
      ${x} ${baseY - h} C ${x - w * 0.5} ${baseY - h * 0.6} ${x + w} ${baseY - h * 0.4} ${x} ${baseY} Z"
      fill="${color}" opacity="${0.45 + rng() * 0.45}"/>`;
  }
  return out;
}

// Ein Kriegsschiff von der Seite: Rumpf, Rammsporn, Ruderreihe, Mast.
function warship(x, y, scale, color, sail = null) {
  const s = scale;
  const oars = Array.from({ length: 9 }, (_, i) =>
    `<path d="M ${x - 60 * s + i * 15 * s} ${y} l -6 ${16 * s}" stroke="${color}"
      stroke-width="${2.5 * s}" fill="none"/>`).join('');
  return `<g>
    <path d="M ${x - 78 * s} ${y - 10 * s} L ${x + 74 * s} ${y - 10 * s}
      L ${x + 60 * s} ${y + 12 * s} L ${x - 62 * s} ${y + 12 * s} Z" fill="${color}"/>
    <path d="M ${x + 74 * s} ${y - 4 * s} l ${26 * s} ${8 * s} l -${26 * s} ${6 * s} Z" fill="${color}"/>
    <path d="M ${x - 78 * s} ${y - 10 * s} q -${16 * s} -${26 * s} ${6 * s} -${34 * s}"
      stroke="${color}" stroke-width="${5 * s}" fill="none"/>
    ${oars}
    <rect x="${x - 4 * s}" y="${y - 86 * s}" width="${7 * s}" height="${78 * s}" fill="${color}"/>
    ${sail ? `<path d="M ${x} ${y - 80 * s} L ${x + 52 * s} ${y - 60 * s} L ${x} ${y - 24 * s} Z"
      fill="${sail}"/>` : ''}
  </g>`;
}

function aqueduct(y, height, color, spanCount = 7, x0 = 380) {
  const span = (SCENE_W - x0 + 80) / spanCount;
  let arches = '';
  for (let i = 0; i < spanCount; i++) {
    const x = x0 + i * span;
    arches += `<path d="M ${x} ${y} L ${x} ${y - height * 0.62}
      A ${span * 0.42} ${height * 0.42} 0 0 1 ${x + span * 0.84} ${y - height * 0.62}
      L ${x + span * 0.84} ${y} L ${x + span * 0.7} ${y} L ${x + span * 0.7} ${y - height * 0.6}
      A ${span * 0.28} ${height * 0.34} 0 0 0 ${x + span * 0.14} ${y - height * 0.6}
      L ${x + span * 0.14} ${y} Z" fill="${color}"/>`;
  }
  // A light channel on top, not a slab: the arches have to stay open.
  return `${arches}<rect x="${x0}" y="${y - height * 0.78}" width="${SCENE_W - x0 + 80}"
    height="${height * 0.2}" fill="${color}"/>`;
}

// Palisade und Türme - dieselbe Befestigung, die im Spiel gebaut wird.
function palisadeLine(y, x0, x1, height, color, towerEvery = 5) {
  let out = '';
  const stakes = Math.round((x1 - x0) / 22);
  for (let i = 0; i < stakes; i++) {
    const x = x0 + ((x1 - x0) / stakes) * i;
    out += `<path d="M ${x} ${y} l 0 ${-height} l 5 -9 l 5 9 l 0 ${height} Z" fill="${color}"/>`;
    if (i % (towerEvery * 3) === 0) {
      out += `<g fill="${color}">
        <rect x="${x - 16}" y="${y - height * 2.1}" width="${34}" height="${height * 2.1}"/>
        <path d="M ${x - 26} ${y - height * 2.1} L ${x + 1} ${y - height * 2.7}
          L ${x + 28} ${y - height * 2.1} Z"/>
      </g>`;
    }
  }
  return out;
}

function elephant(x, y, s, color) {
  return `<g fill="${color}">
    <ellipse cx="${x}" cy="${y - 34 * s}" rx="${46 * s}" ry="${28 * s}"/>
    <circle cx="${x + 46 * s} " cy="${y - 44 * s}" r="${20 * s}"/>
    <path d="M ${x + 58 * s} ${y - 38 * s} q ${16 * s} ${14 * s} ${4 * s} ${34 * s}
      q -${4 * s} ${6 * s} -${10 * s} 0 q ${8 * s} -${18 * s} -${2 * s} -${28 * s} Z"/>
    <path d="M ${x + 54 * s} ${y - 34 * s} l ${22 * s} ${10 * s} l -${20 * s} 0 Z"/>
    <ellipse cx="${x + 36 * s}" cy="${y - 48 * s}" rx="${13 * s}" ry="${17 * s}"/>
    <rect x="${x - 34 * s}" y="${y - 18 * s}" width="${9 * s}" height="${18 * s}"/>
    <rect x="${x - 10 * s}" y="${y - 18 * s}" width="${9 * s}" height="${18 * s}"/>
    <rect x="${x + 16 * s}" y="${y - 18 * s}" width="${9 * s}" height="${18 * s}"/>
    <rect x="${x + 32 * s}" y="${y - 18 * s}" width="${9 * s}" height="${18 * s}"/>
    <rect x="${x - 22 * s}" y="${y - 70 * s}" width="${44 * s}" height="${20 * s}"/>
  </g>`;
}

// Pferd und Reiter von der Seite.
function horseman(x, y, s, color) {
  return `<g fill="${color}">
    <ellipse cx="${x}" cy="${y - 26 * s}" rx="${30 * s}" ry="${13 * s}"/>
    <path d="M ${x + 24 * s} ${y - 32 * s} l ${12 * s} ${-20 * s} l ${9 * s} ${3 * s}
      l ${-4 * s} ${13 * s} l ${11 * s} ${4 * s} l ${-3 * s} ${8 * s} l ${-25 * s} ${-2 * s} Z"/>
    <path d="M ${x - 30 * s} ${y - 30 * s} q ${-14 * s} ${6 * s} ${-6 * s} ${20 * s}
      q ${8 * s} ${-8 * s} ${8 * s} ${-16 * s} Z"/>
    <rect x="${x - 22 * s}" y="${y - 16 * s}" width="${5 * s}" height="${17 * s}"/>
    <rect x="${x - 10 * s}" y="${y - 16 * s}" width="${5 * s}" height="${17 * s}"/>
    <rect x="${x + 10 * s}" y="${y - 16 * s}" width="${5 * s}" height="${17 * s}"/>
    <rect x="${x + 20 * s}" y="${y - 16 * s}" width="${5 * s}" height="${17 * s}"/>
    <path d="M ${x - 4 * s} ${y - 38 * s} l ${10 * s} 0 l ${2 * s} ${14 * s} l ${-14 * s} 0 Z"/>
    <circle cx="${x + 1 * s}" cy="${y - 45 * s}" r="${6 * s}"/>
    <path d="M ${x + 6 * s} ${y - 42 * s} l ${26 * s} ${-24 * s}" stroke="${color}"
      stroke-width="${3 * s}" fill="none"/>
  </g>`;
}

function figures(baseY, count, rng, color, x0, x1, s = 1) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = x0 + ((x1 - x0) / count) * (i + rng() * 0.5);
    const h = (26 + rng() * 10) * s;
    out += `<g fill="${color}">
      <circle cx="${x}" cy="${baseY - h}" r="${5 * s}"/>
      <path d="M ${x - 6 * s} ${baseY} l 0 ${-h + 6 * s} l ${12 * s} 0 l 0 ${h - 6 * s} Z"/>
      <path d="M ${x + 8 * s} ${baseY} l 0 ${-h - 14 * s}" stroke="${color}" stroke-width="${2.5 * s}"/>
    </g>`;
  }
  return out;
}

// --- Die Szenen ----------------------------------------------------------

export const CHRONICLE = [
  {
    id: 'republik',
    year: '509 v. Chr.',
    title: 'Die Republik wird ausgerufen',
    text: 'Rom jagt seinen letzten König davon. An die Stelle der Krone treten '
      + 'zwei Konsuln, ein Jahr Amtszeit und der Senat. SPQR – Senat und Volk von Rom.',
    render() {
      const rng = seeded(11);
      return `${sky([[0, '#1d2a4d'], [0.45, '#7c5a5c'], [0.78, '#d99a5b'], [1, '#f3cf94']], 'sk1')}
        ${sun(1180, 620, 74, '#ffe9b8', 0.3)}
        ${hills(660, 60, rng, '#8a6a55', 0.55)}
        ${hills(730, 46, rng, '#5d4739', 0.8)}
        ${temple(430, 705, 340, 250, '#2f2419')}
        ${temple(1010, 725, 210, 160, '#241c14')}
        <rect y="750" width="${SCENE_W}" height="${SCENE_H - 750}" fill="#1a140e"/>
        ${spears(792, 34, 120, rng, '#120d09')}`;
    },
  },
  {
    id: 'allia',
    year: '390 v. Chr.',
    title: 'Die Gallier in Rom',
    text: 'Nach der Niederlage an der Allia stehen die Gallier des Brennus in der Stadt. '
      + 'Nur das Kapitol hält. „Vae victis“ – wehe den Besiegten.',
    render() {
      const rng = seeded(29);
      return `${sky([[0, '#160d10'], [0.42, '#3d1a15'], [0.75, '#8a2f18'], [1, '#c85a22']], 'sk2')}
        ${hills(690, 40, rng, '#4a1d13', 0.7)}
        ${flames(120, 1500, 700, 250, rng, ['#f2a03c', '#e2662a', '#f6d06a'])}
        <g fill="#1c0e0a">
          <rect x="180" y="560" width="200" height="150"/>
          <path d="M 170 560 l 110 -60 l 110 60 Z"/>
          <rect x="640" y="520" width="150" height="190"/>
          <path d="M 630 520 l 85 -52 l 85 52 Z"/>
          <rect x="1120" y="575" width="230" height="135"/>
          <path d="M 1110 575 l 125 -58 l 125 58 Z"/>
        </g>
        ${temple(950, 712, 250, 190, '#150a07')}
        <rect y="712" width="${SCENE_W}" height="${SCENE_H - 712}" fill="#100807"/>
        ${spears(790, 22, 150, rng, '#080403')}
        <g fill="#080403">
          <ellipse cx="330" cy="800" rx="42" ry="66"/>
          <ellipse cx="760" cy="812" rx="40" ry="62"/>
          <ellipse cx="1240" cy="798" rx="44" ry="68"/>
        </g>`;
    },
  },
  {
    id: 'appia',
    year: '312 v. Chr.',
    title: 'Die Via Appia',
    text: 'Appius Claudius lässt die erste große Staatsstraße bauen. Wo Roms Straßen '
      + 'hinreichen, reichen auch seine Legionen hin – und seine Verwaltung.',
    render() {
      const rng = seeded(47);
      return `${sky([[0, '#4b86bb'], [0.55, '#9dc6e0'], [1, '#e6ddc0']], 'sk3')}
        ${sun(340, 190, 46, '#fff6d8', 0.24)}
        ${hills(600, 54, rng, '#8fa5a0', 0.5)}
        ${hills(668, 34, rng, '#7d8f6a', 0.75)}
        ${aqueduct(680, 150, '#8b7c62', 7, 700)}
        <rect y="690" width="${SCENE_W}" height="${SCENE_H - 690}" fill="#93a06a"/>
        <path d="M 700 690 L 900 690 L 1320 ${SCENE_H} L 220 ${SCENE_H} Z" fill="#a89a80"/>
        <g stroke="#8d8071" stroke-width="3" fill="none">
          <path d="M 742 730 L 400 ${SCENE_H}"/><path d="M 786 780 L 560 ${SCENE_H}"/>
          <path d="M 830 830 L 720 ${SCENE_H}"/><path d="M 862 690 L 1140 ${SCENE_H}"/>
          <path d="M 700 745 L 1010 745"/><path d="M 660 810 L 1090 810"/>
          <path d="M 610 880 L 1180 880"/>
        </g>
        <g fill="#3f4a2c">
          <ellipse cx="560" cy="640" rx="22" ry="86"/>
          <ellipse cx="612" cy="655" rx="18" ry="70"/>
          <ellipse cx="1180" cy="646" rx="24" ry="92"/>
          <ellipse cx="1240" cy="662" rx="17" ry="66"/>
        </g>
        <g fill="#6d6154">
          <rect x="960" y="700" width="30" height="86"/>
          <ellipse cx="975" cy="700" rx="15" ry="9"/>
        </g>`;
    },
  },
  {
    id: 'alpen',
    year: '218 v. Chr.',
    title: 'Hannibal überquert die Alpen',
    text: 'Karthago greift Italien dort an, wo Rom keinen Feind erwartet: über das Gebirge. '
      + 'Der Zweite Punische Krieg wird Rom an den Rand des Untergangs führen.',
    render() {
      const rng = seeded(73);
      return `${sky([[0, '#3f5f86'], [0.5, '#8fb0c9'], [1, '#dfe7ec']], 'sk4')}
        ${peaks(620, 380, rng, '#8fa4bb', 0.55, 7)}
        ${peaks(700, 300, rng, '#6b7f96', 0.8, 6)}
        ${peaks(770, 210, rng, '#4a5b6e', 1, 5)}
        <path d="M -40 ${SCENE_H} L -40 780 Q 400 720 820 810 Q 1200 890 ${SCENE_W + 40} 830 L ${SCENE_W + 40} ${SCENE_H} Z"
          fill="#eef3f6"/>
        <path d="M -40 ${SCENE_H} L -40 856 Q 500 806 980 872 Q 1300 916 ${SCENE_W + 40} 890 L ${SCENE_W + 40} ${SCENE_H} Z"
          fill="#d5dee5"/>
        ${elephant(470, 858, 1.15, '#2c3540')}
        ${elephant(1090, 880, 0.9, '#333d49')}
        ${figures(864, 14, rng, '#2c3540', 620, 1000, 0.9)}
        ${figures(886, 9, rng, '#28313b', 1180, 1520, 1)}`;
    },
  },
  {
    id: 'zama',
    year: '202 v. Chr.',
    title: 'Zama',
    text: 'Scipio schlägt Hannibal in Afrika. Karthago verliert seine Flotte, sein Reich '
      + 'und seine Freiheit im Handeln – Rom wird zur Herrin des westlichen Meeres.',
    render() {
      const rng = seeded(97);
      return `${sky([[0, '#8d5a2a'], [0.4, '#d38b3c'], [0.72, '#efc06a'], [1, '#f6dda0']], 'sk5')}
        ${sun(820, 300, 88, '#fff2c8', 0.34)}
        ${hills(640, 26, rng, '#b9884f', 0.45)}
        <rect y="676" width="${SCENE_W}" height="${SCENE_H - 676}" fill="#c39456"/>
        <path d="M -40 ${SCENE_H} L -40 742 Q 500 706 1000 754 Q 1300 782 ${SCENE_W + 40} 748 L ${SCENE_W + 40} ${SCENE_H} Z"
          fill="#ab7d45"/>
        <g opacity="0.5">${hills(700, 18, rng, '#e0bd85', 0.6, 190)}</g>
        ${spears(716, 26, 92, rng, '#5c3d1f', -40, 700)}
        ${spears(716, 26, 92, rng, '#4a3018', 900, SCENE_W + 40)}
        ${horseman(700, 812, 1.25, '#3a2512')}
        ${horseman(880, 826, 1.35, '#33210f')}
        ${horseman(806, 786, 1.05, '#42291410'.slice(0, 7))}
        ${figures(852, 18, rng, '#33210f', -40, 640, 1.15)}
        ${figures(852, 18, rng, '#3b2713', 960, SCENE_W + 40, 1.15)}`;
    },
  },
  {
    id: 'karthago',
    year: '146 v. Chr.',
    title: 'Karthago fällt',
    text: 'Nach drei Kriegen wird die Stadt geschleift. Im selben Jahr brennt Korinth. '
      + 'Rom hat keinen ebenbürtigen Gegner mehr – und beginnt, sich selbst zu zerreiben.',
    render() {
      const rng = seeded(131);
      return `${sky([[0, '#120a12'], [0.35, '#3a1520'], [0.68, '#93361f'], [1, '#d9702e']], 'sk6')}
        <g opacity="0.55">${hills(560, 70, rng, '#2a1016', 0.9, 240)}</g>
        ${flames(300, 1340, 610, 210, rng, ['#f4a53f', '#e05c22', '#ffd97a'])}
        <g fill="#170a0b">
          <rect x="420" y="470" width="120" height="145"/>
          <rect x="600" y="500" width="90" height="115"/>
          <rect x="900" y="455" width="150" height="160"/>
          <path d="M 890 455 l 85 -46 l 85 46 Z"/>
        </g>
        ${palisadeLine(618, 340, 1300, 30, '#150809', 4)}
        <rect y="618" width="${SCENE_W}" height="${SCENE_H - 618}" fill="#1d2b3a"/>
        <g opacity="0.55">
          ${Array.from({ length: 16 }, (_, i) => {
    const y = 640 + i * 16;
    return `<rect x="${300 + rng() * 260}" y="${y}" width="${380 + rng() * 420}" height="5"
              fill="#e07a33" opacity="${0.5 - i * 0.026}"/>`;
  }).join('')}
        </g>
        ${warship(360, 760, 1.05, '#0e1620', '#2a1113')}
        ${warship(1180, 812, 1.25, '#0b1219', '#2a1113')}`;
    },
  },
  {
    id: 'alesia',
    year: '52 v. Chr.',
    title: 'Alesia',
    text: 'Caesar schließt Vercingetorix ein und sich selbst gleich mit: ein Wall nach innen, '
      + 'ein Wall nach außen. Gallien fällt, und Caesar hat ein Heer, das nur ihm gehorcht.',
    render() {
      const rng = seeded(163);
      return `${sky([[0, '#4a5468'], [0.5, '#8b93a1'], [1, '#c9c4b4']], 'sk7')}
        ${hills(520, 90, rng, '#6b7484', 0.55)}
        <path d="M 560 620 Q 800 380 1060 620 Z" fill="#5c6350"/>
        ${palisadeLine(596, 620, 1010, 22, '#3b4034', 3)}
        <g fill="#4a5142">
          <rect x="770" y="470" width="80" height="120"/>
          <path d="M 758 470 l 52 -32 l 52 32 Z"/>
        </g>
        ${hills(660, 30, rng, '#7c8266', 0.9)}
        ${palisadeLine(700, -40, SCENE_W + 40, 30, '#2f3428', 4)}
        <path d="M -40 ${SCENE_H} L -40 726 L ${SCENE_W + 40} 726 L ${SCENE_W + 40} ${SCENE_H} Z" fill="#5e6349"/>
        <path d="M -40 790 L ${SCENE_W + 40} 776 L ${SCENE_W + 40} 812 L -40 828 Z" fill="#3f4433"/>
        ${palisadeLine(790, -40, SCENE_W + 40, 26, '#262a1f', 5)}
        <g fill="#1c1f16">
          <rect x="720" y="700" width="10" height="200"/>
          <path d="M 690 706 q 35 -34 70 0 q -35 22 -70 0 Z"/>
          <rect x="686" y="716" width="78" height="16"/>
          <path d="M 700 748 l 50 0 l -8 40 l -34 0 Z"/>
        </g>
        ${figures(880, 22, rng, '#1a1d14', -40, 640, 1.2)}
        ${figures(880, 20, rng, '#1a1d14', 820, SCENE_W + 40, 1.2)}`;
    },
  },
  {
    id: 'actium',
    year: '31 v. Chr.',
    title: 'Actium – das Ende der Republik',
    text: 'Die letzte Schlacht des Bürgerkriegs entscheidet, wer Rom befiehlt. '
      + 'Vier Jahre später heißt der Sieger Augustus, und die Republik ist Geschichte.',
    render() {
      const rng = seeded(197);
      return `${sky([[0, '#1a2440'], [0.42, '#5b4a63'], [0.72, '#b4685a'], [1, '#efb47b']], 'sk8')}
        ${sun(1300, 560, 66, '#ffe2b0', 0.3)}
        <g opacity="0.4">${hills(596, 40, rng, '#2b2c46', 0.9, 260)}</g>
        <rect y="600" width="${SCENE_W}" height="${SCENE_H - 600}" fill="#26314b"/>
        <g opacity="0.6">
          ${Array.from({ length: 20 }, (_, i) => {
    const y = 616 + i * 14;
    return `<rect x="${1120 + rng() * 160}" y="${y}" width="${120 + rng() * 260}" height="5"
              fill="#f0b073" opacity="${0.46 - i * 0.02}"/>`;
  }).join('')}
        </g>
        <g opacity="0.85">
          ${warship(300, 676, 0.62, '#1a2237', '#2c2f4a')}
          ${warship(700, 662, 0.55, '#1a2237', '#2c2f4a')}
          ${warship(1120, 682, 0.6, '#1a2237', '#2c2f4a')}
        </g>
        ${warship(500, 790, 1.1, '#101728', '#1f2338')}
        ${warship(1080, 824, 1.3, '#0c1220', '#1b1f32')}
        <path d="M -40 ${SCENE_H} L -40 866 Q 400 848 820 872 Q 1200 894 ${SCENE_W + 40} 870 L ${SCENE_W + 40} ${SCENE_H} Z"
          fill="#0a0f1c"/>`;
    },
  },
];

// Fertiges SVG-Markup für eine Szene, passend zugeschnitten auf jedes Format.
export function chronicleSVG(scene) {
  return `<svg viewBox="0 0 ${SCENE_W} ${SCENE_H}" preserveAspectRatio="xMidYMid slice"
    xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${scene.render()}</svg>`;
}

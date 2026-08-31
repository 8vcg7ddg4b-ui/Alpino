// Ein Zeichen für jede Fraktion.
//
// Die Zeichen sind als Pfade auf einem Quadrat von 100 x 100 beschrieben und
// werden auf zwei Wegen gebraucht: als SVG in der Oberfläche (Fraktionsliste,
// Auswahlbildschirm) und als Textur auf den Fahnen im Zelt. Deshalb steht hier
// nur das Markup - wer daraus eine Textur macht, ist die Szene.
//
// Gewählt ist jeweils das Zeichen, das die Fraktion selbst geführt hat: der
// Adler der Legion, das Tanit-Zeichen Karthagos, der Anker der Seleukiden.

const EMBLEMS = {
  // Der Legionsadler mit ausgebreiteten Schwingen auf dem Blitzbündel.
  rom: `<path d="M50 22 L57 30 L50 34 L43 30 Z"/>
    <path d="M50 34 q22 -14 44 -6 q-16 6 -24 16 q-10 -8 -20 -10 Z"/>
    <path d="M50 34 q-22 -14 -44 -6 q16 6 24 16 q10 -8 20 -10 Z"/>
    <path d="M46 34 h8 l3 30 l-7 12 l-7 -12 Z"/>
    <path d="M28 74 h44 v6 h-44 Z"/>`,
  // Das Zeichen der Tanit: Dreieck, Querbalken, Scheibe.
  karthago: `<path d="M32 78 L50 44 L68 78 Z"/>
    <rect x="24" y="36" width="52" height="7"/>
    <circle cx="50" cy="24" r="10"/>`,
  // Der gallische Eber vom Feldzeichen (carnyx-Träger führten ihn mit).
  gallier: `<path d="M20 62 q4 -18 20 -22 q10 -3 20 -1 q8 -8 16 -6 q-3 6 -2 10
      q8 5 10 14 q1 8 -4 12 l-4 -8 l-6 10 h-10 l-3 -8 h-14 l-3 8 h-9 q-8 -4 -11 -9 Z"/>
    <path d="M40 34 l4 -10 l6 8 Z"/>
    <path d="M52 32 l5 -9 l5 9 Z"/>
    <circle cx="72" cy="46" r="2.6" fill="#000" opacity="0.5"/>`,
  // Die Eule der Athene, das Zeichen auf den Tetradrachmen.
  griechen: `<circle cx="50" cy="50" r="26"/>
    <path d="M24 46 q-8 -14 2 -22 q8 -6 16 2 Z"/>
    <path d="M76 46 q8 -14 -2 -22 q-8 -6 -16 2 Z"/>
    <circle cx="40" cy="46" r="8" fill="#1b1409"/>
    <circle cx="60" cy="46" r="8" fill="#1b1409"/>
    <path d="M50 54 l6 8 h-12 Z" fill="#1b1409"/>
    <path d="M34 76 h32 l-6 8 h-20 Z"/>`,
  // Makedonien: der sechzehnstrahlige Stern von Vergina, das Zeichen des
  // Königshauses - er stand auf der goldenen Larnax in Philipps Grab.
  makedonien: `<circle cx="50" cy="50" r="11"/>
    <path d="M50 4 L55 26 L45 26 Z"/><path d="M50 96 L55 74 L45 74 Z"/>
    <path d="M4 50 L26 45 L26 55 Z"/><path d="M96 50 L74 45 L74 55 Z"/>
    <path d="M17 17 L36 30 L30 36 Z"/><path d="M83 83 L64 70 L70 64 Z"/>
    <path d="M83 17 L70 36 L64 30 Z"/><path d="M17 83 L30 64 L36 70 Z"/>
    <path d="M32 7 L42 27 L34 30 Z"/><path d="M68 93 L58 73 L66 70 Z"/>
    <path d="M68 7 L58 27 L66 30 Z"/><path d="M32 93 L42 73 L34 70 Z"/>
    <path d="M7 32 L27 42 L30 34 Z"/><path d="M93 68 L73 58 L70 66 Z"/>
    <path d="M93 32 L73 42 L70 34 Z"/><path d="M7 68 L27 58 L30 66 Z"/>`,
  // Syrakus: die Triskeles, das Zeichen Siziliens - drei Beine um einen Kopf,
  // die drei Kaps der Insel. Sie stand auf den Münzen der Stadt.
  // Die drei Beine laufen alle gleich - gezeichnet wird eines, die anderen
  // beiden sind dasselbe, um 120 und 240 Grad um die Mitte gedreht.
  syrakus: `<g stroke="currentColor" stroke-width="10" stroke-linecap="round"
       stroke-linejoin="round" fill="none">
      <path d="M50 46 L72 26 L86 44"/>
      <path d="M50 46 L72 26 L86 44" transform="rotate(120 50 50)"/>
      <path d="M50 46 L72 26 L86 44" transform="rotate(240 50 50)"/>
    </g>
    <g>
      <path d="M86 38 l12 8 l-12 8 Z"/>
      <path d="M86 38 l12 8 l-12 8 Z" transform="rotate(120 50 50)"/>
      <path d="M86 38 l12 8 l-12 8 Z" transform="rotate(240 50 50)"/>
    </g>
    <circle cx="50" cy="50" r="12"/>`,
  // Der Irminsul-Pfahl der germanischen Stämme.
  germanen: `<rect x="45" y="26" width="10" height="54"/>
    <path d="M22 32 q14 -10 28 -4 q14 -6 28 4 q-12 -2 -22 6 q-6 -4 -12 0 q-10 -8 -22 -6 Z"/>
    <rect x="30" y="46" width="40" height="6"/>
    <path d="M34 80 h32 v6 h-32 Z"/>`,
  // Das britannische Pferd - die Kreidefigur von Uffington.
  britannier: `<path d="M14 60 q10 -12 26 -14 q10 -2 18 -8 q8 -8 20 -8 q-4 8 -12 12
      q10 2 16 10 q-10 -2 -18 2 q-6 10 -18 12 l4 14 h-8 l-4 -12 h-12 l-4 12 h-8 l4 -14
      q-6 -2 -4 -6 Z"/>
    <path d="M76 30 l6 -12 l2 12 Z"/>`,
  // Der iberische Falcata-Griff über zwei gekreuzten Speeren.
  iberer: `<path d="M22 78 L74 26" stroke-width="8" stroke="currentColor" fill="none"/>
    <path d="M78 78 L26 26" stroke-width="8" stroke="currentColor" fill="none"/>
    <path d="M50 18 q16 6 18 22 q2 16 -10 26 q6 -16 -2 -28 q-4 -8 -6 -20 Z"/>
    <circle cx="50" cy="72" r="9"/>`,
  // Der dakische Draco: Wolfskopf am Feldzeichen.
  daker: `<path d="M18 40 q14 -16 34 -12 l10 -10 l4 12 l12 -4 l-6 12
      q10 8 8 20 q-2 12 -14 16 q4 -12 -4 -18 q-10 -8 -24 -6 q-14 2 -20 -10 Z"/>
    <circle cx="60" cy="34" r="3.4" fill="#1b1409"/>
    <path d="M30 62 q18 12 40 8 q-14 12 -30 8 q-12 -4 -10 -16 Z"/>`,
  // Der Anker der Seleukiden, das Siegel des Hauses.
  seleukiden: `<circle cx="50" cy="20" r="8" fill="none" stroke="currentColor" stroke-width="7"/>
    <rect x="45" y="26" width="10" height="50"/>
    <rect x="30" y="34" width="40" height="8"/>
    <path d="M18 56 q0 26 32 28 q32 -2 32 -28 q-8 16 -26 18 l6 -10 h-24 l6 10
      q-18 -2 -26 -18 Z"/>`,
  // Der ptolemäische Adler auf dem Blitzbündel, wie auf ihren Münzen.
  ptolemaeer: `<path d="M50 26 q-6 -8 -16 -8 q6 6 6 12 q-16 2 -24 14 q14 -6 22 -2
      l-6 30 h36 l-6 -30 q8 -4 22 2 q-8 -12 -24 -14 q0 -6 6 -12 q-10 0 -16 8 Z"/>
    <path d="M26 78 l48 -8 l-4 10 l-40 6 Z"/>`,
  // Illyrien: das Lembos-Ruderschiff über der Adria.
  illyrer: `<path d="M12 56 h64 l10 -10 l-6 12 q-8 14 -30 14 q-24 0 -38 -16 Z"/>
    <rect x="46" y="16" width="7" height="40"/>
    <path d="M53 20 q22 6 22 18 h-22 Z"/>
    <path d="M16 76 q18 8 36 4 q16 -4 30 -12" stroke="currentColor" stroke-width="5" fill="none"/>`,
  // Eine sarmatische Tamga - das Brandzeichen des Stammes.
  sarmaten: `<path d="M50 16 v68" stroke="currentColor" stroke-width="9" fill="none"/>
    <path d="M22 30 q28 22 56 0" stroke="currentColor" stroke-width="9" fill="none"/>
    <path d="M26 62 q24 20 48 0" stroke="currentColor" stroke-width="9" fill="none"/>
    <circle cx="50" cy="84" r="8"/>`,
  // Numidien: der Pferdekopf, der auf den Münzen der numidischen Könige steht.
  numidien: `<path d="M34 84 v-22 q0-16 10-26 l8-8 q4-4 4-10 V6 l12 10 q6 5 6 13 v9
      q0 9-6 15 l-10 10 q-6 6-6 14 v7 Z"/>
    <circle cx="60" cy="26" r="3.4" fill="#1a1208"/>
    <path d="M62 6 l8 6 -9 3 Z"/>
    <path d="M26 84 h34" stroke="currentColor" stroke-width="7" fill="none"/>`,
  // Parther: der Reflexbogen, mit dem die berittenen Schützen im Abreiten
  // schießen - das Zeichen, unter dem Rom bei Carrhae unterging.
  parther: `<path d="M28 12 q34 38 0 76" stroke="currentColor" stroke-width="9" fill="none"
      stroke-linecap="round"/>
    <path d="M28 12 L28 88" stroke="currentColor" stroke-width="4.5" fill="none"/>
    <path d="M26 50 h48" stroke="currentColor" stroke-width="6" fill="none"/>
    <path d="M74 50 l-11 -7 v14 Z"/>`,
  // Armenien: der zweigipflige Ararat, unter dem das Hochland liegt.
  armenien: `<path d="M6 82 L34 30 L48 54 L58 38 L94 82 Z"/>
    <path d="M26 48 L34 30 L43 46 L37 44 L32 50 Z" fill="#1a1208" opacity="0.45"/>
    <path d="M52 46 L58 38 L65 48 L60 46 L56 50 Z" fill="#1a1208" opacity="0.45"/>`,
  // Pontus: Stern und Mondsichel, das Zeichen des pontischen Königshauses.
  pontus: `<path d="M62 14 a38 38 0 1 0 0 72 a30 30 0 1 1 0 -72 Z"/>
    <path d="M74 30 l6 15 16 1 -12 11 4 16 -14 -9 -14 9 4 -16 -12 -11 16 -1 Z"/>`,
  neutral: `<circle cx="50" cy="50" r="24" fill="none" stroke="currentColor" stroke-width="8"/>
    <circle cx="50" cy="50" r="7"/>`,
  // Die wandernden Stämme führen kein Feldzeichen, sondern das, was vorneweg
  // fährt: den Planwagen mit dem Ochsengespann.
  wanderer: `<path d="M18 62 q6 -26 32 -26 q26 0 32 26 Z"/>
    <rect x="16" y="62" width="68" height="10"/>
    <circle cx="30" cy="80" r="9" fill="none" stroke="currentColor" stroke-width="5"/>
    <circle cx="70" cy="80" r="9" fill="none" stroke="currentColor" stroke-width="5"/>
    <path d="M40 30 l4 -12 l6 10 Z"/>
    <path d="M54 28 l6 -12 l4 12 Z"/>`,
  // Die Seeräuber führen kein Zeichen. Was hier steht, ist das, was ihre Opfer
  // sahen: der schwarze Wimpel über zwei gekreuzten Entermessern.
  piraten: `<rect x="47" y="12" width="6" height="46"/>
    <path d="M53 16 q24 5 28 13 q-17 7 -28 4 Z"/>
    <path d="M20 84 l30 -28 l6 6 l-30 28 Z"/>
    <path d="M80 84 l-30 -28 l-6 6 l30 28 Z"/>
    <rect x="16" y="80" width="12" height="8"/>
    <rect x="72" y="80" width="12" height="8"/>`,
};

export function emblemPaths(factionId) {
  return EMBLEMS[factionId] || EMBLEMS.neutral;
}

// Fertiges SVG, wahlweise mit Scheibe dahinter - so, wie es auf einer Fahne
// oder in einer Liste steht.
export function emblemSVG(factionId, options = {}) {
  const {
    size = 100, color = '#f3e7c8', background = null, padding = 0,
  } = options;
  const disc = background
    ? `<circle cx="50" cy="50" r="${50 - padding}" fill="${background}"/>`
    : '';
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}"
    xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${disc}<g fill="${color}" color="${color}">${emblemPaths(factionId)}</g></svg>`;
}

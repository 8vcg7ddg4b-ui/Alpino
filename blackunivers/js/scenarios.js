// --- Ausgangslagen --------------------------------------------------------
// Die Karte, die Fraktionen und die Regeln bleiben gleich; was sich
// unterscheidet, ist der erste Tag. Drei Lagen aus drei Jahrzehnten Krieg.
export const SCENARIOS = [
  {
    id: 'vega',
    name: 'Der Vega-Feldzug',
    year: 2654,
    seed: 4711,
    blurb: 'Das Imperium hat McAuliffe überrannt. Der Vega-Sektor brennt, und '
      + 'die Konföderation hält, was sie noch halten kann.',
    hint: 'Die Ausgangslage des Krieges. Beide Großmächte stehen sich mit '
      + 'voller Kraft gegenüber.',
    systemOverrides: {},
    wars: [],
  },
  {
    id: 'enigma',
    name: 'Enigma 2667',
    year: 2667,
    seed: 2667,
    blurb: 'K’tithrak Mang ist gefallen, aber Ghorah Khar wankt und die '
      + 'Grenzwelten trauen niemandem mehr.',
    hint: 'Die Konföderation steht weiter östlich, das Imperium ist tiefer im '
      + 'Enigma-Sektor - und die Union blickt nach beiden Seiten.',
    systemOverrides: {
      'K’tithrak Mang': 'confed',
      Tanhauser: 'confed',
      'Ghorah Khar': 'borderworlds',
      Hyperion: 'confed',
      Locanda: 'kilrathi',
      Kurasawa: 'kilrathi',
      Blackmane: 'kilrathi',
    },
    wars: [['confed', 'borderworlds']],
  },
  {
    id: 'grenzkrieg',
    name: 'Der Grenzkrieg',
    year: 2673,
    seed: 2673,
    blurb: 'Kilrah ist gefallen, das Imperium zerbrochen - und die Flotte der '
      + 'Konföderation stellt Fragen an ihre eigenen Grenzwelten.',
    hint: 'Das Imperium ist geschrumpft, die Union stark, das Landreich frech. '
      + 'Der Krieg läuft zwischen Menschen.',
    systemOverrides: {
      Kilrah: 'confed',
      'Sar Hariti': 'confed',
      'N’Tanya': 'landreich',
      'H’hrass': 'landreich',
      Hari: 'kilrathi',
      'Vukar Tag': 'kilrathi',
      'Baka Kar': 'kilrathi',
      Hellespont: 'borderworlds',
      Niwen: 'borderworlds',
      Tesla: 'borderworlds',
      Masa: 'borderworlds',
      Caliban: 'borderworlds',
      Tiamat: 'landreich',
      'Höllenloch': 'landreich',
    },
    wars: [['confed', 'borderworlds'], ['confed', 'landreich']],
  },
];

export const DEFAULT_SCENARIO_ID = 'vega';

export function scenarioById(id) {
  return SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
}

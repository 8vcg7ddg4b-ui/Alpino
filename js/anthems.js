// Die Musik der Fraktionen.
//
// Jede Fraktion hat ihr eigenes Stück. Nicht als Aufnahme - das Spiel ist eine
// einzige Datei und trägt keine Tonspuren -, sondern als Partitur, die der
// Klangsatz in audio.js Takt für Takt spielt: Tonleiter, Grundton, Tempo,
// Taktart, ein Motiv und die Besetzung.
//
// Der kulturelle Unterschied steckt vor allem in zwei Dingen: in der Leiter
// und in der Besetzung. Ein Hidschas mit seiner übermäßigen Sekunde klingt
// nach Karthago, Persien und Ägypten; ein Mixolydisch nach dem keltischen
// Norden; eine fünftönige Leiter nach der Steppe. Und ein Stück, das ein
// Doppelrohrblatt führt, klingt nach dem Mittelmeer, während dieselbe Melodie
// auf Blech nach Rom klingt.
//
// Die Melodien stehen in Stufen der jeweiligen Leiter, nicht in Notennamen:
// 0 ist der Grundton, 7 die Oktave, -1 die Stufe darunter. So bleibt dieselbe
// Wendung in jeder Tonart lesbar, und eine Leiter zu ändern heißt, das ganze
// Stück umzufärben.

// --- Leitern --------------------------------------------------------------
export const SCALES = {
  // Natürliches Moll - der Norden.
  aeolisch: [0, 2, 3, 5, 7, 8, 10],
  // Die zweite Stufe tief: der Klang, den die Griechen selbst dorisch nannten.
  phrygisch: [0, 1, 3, 5, 7, 8, 10],
  // Wie phrygisch, aber mit großer Terz - die übermäßige Sekunde dazwischen
  // ist der Klang des ganzen Ostens und Südens.
  hidschas: [0, 1, 4, 5, 7, 8, 10],
  // Moll mit großer Sexte - der weiche Kriegsmodus.
  dorisch: [0, 2, 3, 5, 7, 9, 10],
  // Dur mit tiefer Septime - keltisch, offen, ohne Leitton.
  mixolydisch: [0, 2, 4, 5, 7, 9, 10],
  // Die übermäßige Sekunde in der Mitte: der Balkan.
  nikriz: [0, 2, 3, 6, 7, 9, 10],
  // Fünf Töne, keine Halbtonschritte: die Steppe.
  fuenftoenig: [0, 3, 5, 7, 10],
};

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Notenname wie 'A#3' zu Frequenz.
export function noteFrequency(name) {
  const step = SEMITONES[name[0]];
  const sharp = name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0;
  const octave = Number(name.slice(sharp ? 2 : 1));
  return 440 * 2 ** ((step + sharp - 9) / 12 + (octave - 4));
}

// Eine Stufe der Leiter zu einem Halbtonabstand vom Grundton. Stufen über der
// Oktave und unter dem Grundton laufen weiter durch die Leiter, statt an ihr
// abzuprallen - so kann ein Motiv über zwei Oktaven laufen.
export function degreeSemitones(scale, degree) {
  const steps = scale.length;
  const octave = Math.floor(degree / steps);
  const index = ((degree % steps) + steps) % steps;
  return scale[index] + octave * 12;
}

// Der Ton einer Stufe, in Hertz.
export function degreeFrequency(root, scale, degree, octaveShift = 0) {
  return noteFrequency(root) * 2 ** (degreeSemitones(scale, degree) / 12 + octaveShift);
}

// --- Die Stücke -----------------------------------------------------------
// Jedes Stück nennt:
//   modus     - die Leiter
//   grundton  - der Ton, auf dem sie steht
//   tempo     - Schläge je Minute
//   takt      - Schläge je Takt (7 gibt den Balkantakt)
//   bass      - je Takt eine Stufe: der Grundton des Takts
//   bordun    - Stufen, die durchgehend liegen (leer heißt: kein Bordun)
//   melodie   - je Takt so viele Felder, wie der Takt Achtel hat; null ist
//               Pause, eine Zahl eine Stufe der Leiter
//   fuehrung  - womit die Melodie gespielt wird: blech, rohr oder saite
//   grund     - womit der Bass kommt: blech, saite oder nichts
//   schlag    - das Schlagwerk: 'kriegstrommel', 'rahmentrommel' oder 'still'
//   muster    - auf welchen Achteln geschlagen wird
//   farbe     - ein Satz darüber, warum es so klingt (steht im Spiel nirgends,
//               aber er erklärt dem nächsten Leser die Wahl)

export const ANTHEMS = {
  rom: {
    name: 'Der Marsch der Legionen',
    modus: 'dorisch', grundton: 'D2', tempo: 84, takt: 4,
    bass: [0, 0, 5, 4], bordun: [],
    melodie: [
      [7, null, 7, 6, 7, null, 4, null],
      [5, null, 4, null, 2, null, null, null],
      [4, null, 5, 6, 7, null, null, null],
      [6, null, 4, null, 0, null, null, null],
    ],
    fuehrung: 'blech', grund: 'blech', schlag: 'kriegstrommel',
    muster: [0, 4, 6],
    farbe: 'Cornu und Tuba über dem Schritt der Cohorten: gerade, schwer, ohne Verzierung.',
  },
  karthago: {
    name: 'Die Häfen von Qart-Hadašt',
    modus: 'hidschas', grundton: 'D3', tempo: 92, takt: 4,
    bass: [0, 0, 3, 0], bordun: [0],
    melodie: [
      [0, 1, 2, null, 1, 0, null, null],
      [2, null, 3, 2, 1, null, 0, null],
      [4, null, 3, 2, 3, null, null, null],
      [1, 0, null, 6, null, 0, null, null],
    ],
    fuehrung: 'rohr', grund: 'saite', schlag: 'rahmentrommel',
    muster: [0, 3, 4, 6, 7],
    farbe: 'Phönizisch: die übermäßige Sekunde, ein Doppelrohrblatt, dazu die Laute des Kaufmanns.',
  },
  gallier: {
    name: 'Der Ruf der Carnyx',
    modus: 'mixolydisch', grundton: 'G2', tempo: 96, takt: 4,
    bass: [0, 0, 4, 4], bordun: [0, 4],
    melodie: [
      [0, null, 4, null, 5, 4, 2, null],
      [4, null, 2, null, 0, null, null, null],
      [7, null, 5, null, 4, null, 2, null],
      [0, null, null, 4, 0, null, null, null],
    ],
    fuehrung: 'blech', grund: 'nichts', schlag: 'kriegstrommel',
    muster: [0, 2, 4, 6],
    farbe: 'Keltisch: ein offener Quintbordun, kein Leitton, und darüber die Carnyx.',
  },
  numidien: {
    name: 'Staub der Reiter',
    modus: 'hidschas', grundton: 'A3', tempo: 112, takt: 4,
    bass: [0, 0, 4, 0], bordun: [0],
    melodie: [
      [0, 1, 2, 1, 0, null, 6, null],
      [0, null, 2, 3, 4, 3, 2, null],
      [4, null, 3, 4, 2, 1, 0, null],
      [1, 0, 6, null, 0, null, null, null],
    ],
    fuehrung: 'rohr', grund: 'nichts', schlag: 'rahmentrommel',
    muster: [0, 2, 3, 5, 6],
    farbe: 'Der schnellste Takt im Spiel - das Land wird von leichter Reiterei beherrscht.',
  },
  parther: {
    name: 'Der Bogen der Steppe',
    modus: 'hidschas', grundton: 'E3', tempo: 88, takt: 4,
    bass: [0, 0, 4, 3], bordun: [0, 4],
    melodie: [
      [4, null, 3, 2, 1, null, 0, null],
      [2, 1, 0, null, 6, null, null, null],
      [0, 1, 2, 3, 4, null, 5, null],
      [4, 3, 2, null, 1, 0, null, null],
    ],
    fuehrung: 'saite', grund: 'saite', schlag: 'rahmentrommel',
    muster: [0, 3, 4, 6],
    farbe: 'Persisch: die geschlagene Santur über einem Quintbordun, mit dem Tombak darunter.',
  },
  armenien: {
    name: 'Die Klage der Duduk',
    modus: 'nikriz', grundton: 'A2', tempo: 58, takt: 4,
    bass: [0, 0, 0, 0], bordun: [0],
    melodie: [
      [7, null, null, 6, null, null, 5, null],
      [6, null, 5, null, 4, null, null, null],
      [4, null, null, 3, null, 2, null, null],
      [3, null, 2, null, 0, null, null, null],
    ],
    fuehrung: 'rohr', grund: 'nichts', schlag: 'still',
    muster: [],
    farbe: 'Das langsamste Stück: eine Duduk über einem liegenden Ton, sonst nichts.',
  },
  pontus: {
    name: 'Die Küste am Schwarzen Meer',
    modus: 'phrygisch', grundton: 'E3', tempo: 92, takt: 4,
    bass: [0, 6, 5, 0], bordun: [0],
    melodie: [
      [0, 1, 2, null, 1, null, 0, null],
      [4, null, 3, 2, 1, null, null, null],
      [5, 4, 3, null, 2, null, 1, null],
      [2, 1, 0, null, null, 0, null, null],
    ],
    fuehrung: 'rohr', grund: 'saite', schlag: 'rahmentrommel',
    muster: [0, 3, 4, 6],
    farbe: 'Anatolisch-griechisch: phrygisch, ein Rohrblatt, dazu die Leier aus den Kolonien.',
  },
  griechen: {
    name: 'Der Chor vor der Phalanx',
    modus: 'phrygisch', grundton: 'E3', tempo: 78, takt: 4,
    bass: [0, 0, 3, 4], bordun: [],
    melodie: [
      [4, null, 3, null, 2, null, 3, null],
      [0, null, null, 1, 2, null, null, null],
      [5, null, 4, null, 3, null, 2, null],
      [1, null, 0, null, null, null, null, null],
    ],
    fuehrung: 'saite', grund: 'saite', schlag: 'rahmentrommel',
    muster: [0, 4],
    farbe: 'Was die Griechen selbst dorisch nannten, klingt für uns phrygisch: Kithara und Aulos.',
  },
  makedonien: {
    name: 'Der Schritt der Sarissen',
    modus: 'dorisch', grundton: 'A2', tempo: 72, takt: 4,
    bass: [0, 0, 4, 3], bordun: [0],
    melodie: [
      [0, null, 2, null, 4, null, null, null],
      [5, null, 4, null, 2, null, null, null],
      [7, null, null, 5, 4, null, 2, null],
      [3, null, 2, null, 0, null, null, null],
    ],
    fuehrung: 'blech', grund: 'saite', schlag: 'kriegstrommel',
    muster: [0, 4],
    farbe: 'Griechisch im Ton, königlich im Schritt: die Kithara des Hofes über '
      + 'einer Trommel, die eine Phalanx im Gleichschritt hält.',
  },
  syrakus: {
    name: 'Die Häfen unter dem Ätna',
    modus: 'phrygisch', grundton: 'D3', tempo: 86, takt: 4,
    bass: [0, 3, 2, 0], bordun: [],
    melodie: [
      [0, 1, 2, null, 3, null, 2, null],
      [4, null, 3, 2, 1, null, null, null],
      [5, null, 4, null, 3, 4, 5, null],
      [2, null, 1, null, 0, null, null, null],
    ],
    fuehrung: 'rohr', grund: 'saite', schlag: 'rahmentrommel',
    muster: [0, 3, 6],
    farbe: 'Dorisch-westgriechisch, aber weicher als in Athen: der Aulos einer '
      + 'Hafenstadt, die lieber handelt als kämpft.',
  },
  germanen: {
    name: 'Nebel über dem Hain',
    modus: 'aeolisch', grundton: 'C2', tempo: 64, takt: 4,
    bass: [0, 0, 5, 5], bordun: [0],
    melodie: [
      [0, null, null, null, 2, null, 3, null],
      [4, null, null, null, 3, null, null, null],
      [5, null, null, 4, null, null, 3, null],
      [2, null, null, null, 0, null, null, null],
    ],
    fuehrung: 'blech', grund: 'blech', schlag: 'kriegstrommel',
    muster: [0, 5],
    farbe: 'Tief, langsam, breit: Luren über einem liegenden Ton und der schwere Schlag.',
  },
  britannier: {
    name: 'Die Insel im Regen',
    modus: 'aeolisch', grundton: 'A2', tempo: 72, takt: 3,
    bass: [0, 5, 3, 4], bordun: [0],
    melodie: [
      [0, null, 2, null, 4, null],
      [3, null, 2, null, null, null],
      [4, null, 5, null, 4, null],
      [2, null, null, 0, null, null],
    ],
    fuehrung: 'saite', grund: 'nichts', schlag: 'rahmentrommel',
    muster: [0, 4],
    farbe: 'Dreitaktig und leise: eine Leier auf der anderen Seite des Kanals.',
  },
  iberer: {
    name: 'Feuer in den Bergen',
    modus: 'phrygisch', grundton: 'E3', tempo: 104, takt: 4,
    bass: [0, 0, 1, 0], bordun: [0],
    melodie: [
      [2, 1, 0, null, 1, 2, null, null],
      [3, 2, 1, 0, null, 6, null, null],
      [0, 1, 2, 3, 2, 1, 0, null],
      [1, null, 0, null, null, null, null, null],
    ],
    fuehrung: 'saite', grund: 'saite', schlag: 'rahmentrommel',
    muster: [0, 2, 3, 5, 6, 7],
    farbe: 'Der phrygische Abstieg über einem festen Grundton - was Jahrhunderte später Flamenco heißt.',
  },
  daker: {
    name: 'Tanz auf den Bergburgen',
    modus: 'nikriz', grundton: 'D3', tempo: 108, takt: 7,
    bass: [0, 0, 3, 4], bordun: [0],
    melodie: [
      [0, 2, 3, null, 4, 3, 2, null, 0, null, null, null, null, null],
      [4, null, 5, 4, 3, null, 2, null, 3, null, null, null, null, null],
      [2, 3, 4, null, 5, null, 6, null, 7, null, null, null, null, null],
      [4, 3, 2, null, 0, null, null, null, 0, null, null, null, null, null],
    ],
    fuehrung: 'rohr', grund: 'nichts', schlag: 'rahmentrommel',
    muster: [0, 4, 8, 10, 12],
    farbe: 'Sieben Schläge im Takt - der Balkan zählt anders, und die Leiter hat ihre Lücke in der Mitte.',
  },
  seleukiden: {
    name: 'Das Erbe Alexanders',
    modus: 'hidschas', grundton: 'G2', tempo: 82, takt: 4,
    bass: [0, 0, 4, 5], bordun: [0],
    melodie: [
      [0, null, 2, null, 4, null, 3, null],
      [4, null, 5, 4, 3, null, 2, null],
      [7, null, 6, null, 5, null, 4, null],
      [3, null, 2, null, 0, null, null, null],
    ],
    fuehrung: 'blech', grund: 'saite', schlag: 'kriegstrommel',
    muster: [0, 4, 6],
    farbe: 'Griechisches Blech über einer östlichen Leiter: genau das Reich, das dabei herauskam.',
  },
  ptolemaeer: {
    name: 'Der Strom und das Korn',
    modus: 'hidschas', grundton: 'F3', tempo: 76, takt: 4,
    bass: [0, 0, 5, 0], bordun: [0],
    melodie: [
      [0, 2, 4, 5, 4, 2, 0, null],
      [1, null, 0, null, 6, null, null, null],
      [4, 5, 6, 7, 6, 5, 4, null],
      [2, null, 1, null, 0, null, null, null],
    ],
    fuehrung: 'saite', grund: 'saite', schlag: 'rahmentrommel',
    muster: [0, 4, 6],
    farbe: 'Die Harfe läuft in Wellen auf und ab - der Nil, nicht der Marsch.',
  },
  illyrer: {
    name: 'Die Schiffe der Küste',
    modus: 'nikriz', grundton: 'G3', tempo: 112, takt: 7,
    bass: [0, 0, 4, 3], bordun: [0, 4],
    melodie: [
      [0, null, 3, 2, 0, null, 3, null, 4, null, null, null, null, null],
      [2, 3, 4, null, 3, 2, null, null, 0, null, null, null, null, null],
      [4, 5, 6, null, 5, 4, 3, null, 4, null, null, null, null, null],
      [3, 2, 0, null, 6, null, null, null, 0, null, null, null, null, null],
    ],
    fuehrung: 'rohr', grund: 'blech', schlag: 'kriegstrommel',
    muster: [0, 4, 8, 12],
    farbe: 'Derselbe Siebentakt wie bei den Dakern, aber schneller und mit Blech: Seeräuber, keine Bauern.',
  },
  sarmaten: {
    name: 'Der Wind über dem Grasland',
    modus: 'fuenftoenig', grundton: 'D2', tempo: 100, takt: 4,
    bass: [0, 0, 0, 0], bordun: [0, 4],
    melodie: [
      [4, null, 3, null, 2, null, 4, null],
      [2, null, 1, null, 0, null, null, null],
      [5, null, 4, null, 3, null, 2, null],
      [1, null, 0, null, null, null, 0, null],
    ],
    fuehrung: 'blech', grund: 'nichts', schlag: 'kriegstrommel',
    muster: [0, 1, 4, 5],
    farbe: 'Fünf Töne über einer liegenden Quinte, und der Schlag geht im Galopp paarweise.',
  },
};

// Ein Stück für jede Fraktion - und für die, die im Spiel erst entsteht, das
// römische: eine Stadt, die sich zum Staat erhebt, hat noch keine eigene.
export const DEFAULT_ANTHEM = 'rom';

export function anthemFor(factionId) {
  return ANTHEMS[factionId] || ANTHEMS[DEFAULT_ANTHEM];
}

// Wer eine Fraktion führt - und was für ein Mensch er ist.
//
// Jede Fraktion hat einen Herrscher. Er ist keine Verzierung: seine drei
// Eigenschaften entscheiden, ob seine Heere angreifen, ob er ein Friedens-
// angebot annimmt, ob er einen geschlossenen Frieden hält, und wofür er sein
// Gold ausgibt. Zwei Fraktionen mit denselben Truppen spielen sich unter zwei
// verschiedenen Herrschern verschieden.
//
// Die Werte laufen von 0 bis 100:
//   angriffslust - wie bereitwillig er Krieg führt und angreift
//   ehre         - wie verlässlich er ein gegebenes Wort hält
//   habgier      - wie schwer Gold für ihn wiegt: Tribut, Handel, Beute
//
// Vorsicht wird nicht eigens geführt - wer wenig Angriffslust hat, baut
// Mauern statt Heere. Das ist dieselbe Eigenschaft von der anderen Seite.

export const RULERS = {
  rom: {
    name: 'Appius Claudius Caudex', titel: 'der Konsul',
    angriffslust: 72, ehre: 64, habgier: 30,
    wort: 'Der Senat schickt ihn über die Meerenge, und er geht. Rom verhandelt, '
      + 'wenn es muss, und marschiert, sobald es kann.',
  },
  karthago: {
    name: 'Hanno', titel: 'der Große',
    angriffslust: 44, ehre: 58, habgier: 86,
    wort: 'Ihm ist der Karren lieber als das Schwert. Er zahlt für Frieden, wenn '
      + 'der Frieden billiger ist als der Krieg - und rechnet das jedes Mal nach.',
  },
  gallier: {
    name: 'Ambigatus', titel: 'der Hochkönig',
    angriffslust: 82, ehre: 46, habgier: 44,
    wort: 'Sein Ruhm steht auf dem Heerbann. Ein Sommer ohne Feldzug ist ein '
      + 'verlorener Sommer, und Verträge halten so lange wie die Ernte.',
  },
  numidien: {
    name: 'Gaia', titel: 'König der Massylier',
    angriffslust: 50, ehre: 70, habgier: 40,
    wort: 'Er weiß, dass sein Reich zwischen größeren liegt, und wählt seine '
      + 'Freunde sorgfältig. Wem er die Hand gibt, dem hält er sie.',
  },
  parther: {
    name: 'Arsakes II.', titel: 'der Bogenkönig',
    angriffslust: 66, ehre: 40, habgier: 52,
    wort: 'Er kämpft im Rückzug und schlägt zu, wenn der Gegner sich streckt. '
      + 'Ein Vertrag ist ihm ein Zeitgewinn, kein Versprechen.',
  },
  armenien: {
    name: 'Orontes III.', titel: 'der Bergfürst',
    angriffslust: 34, ehre: 76, habgier: 46,
    wort: 'Seine Berge verteidigen sich fast von selbst; er lässt es lieber dabei '
      + 'bewenden. Wer ihn in Ruhe lässt, wird von ihm in Ruhe gelassen.',
  },
  pontus: {
    name: 'Ariobarzanes', titel: 'der Erbe',
    angriffslust: 58, ehre: 52, habgier: 64,
    wort: 'Er hat ein reiches Küstenland geerbt und weiß, was es wert ist. '
      + 'Er handelt gern - und nimmt sich, was der Handel ihm nicht bringt.',
  },
  athen: {
    name: 'Chremonides', titel: 'der Redner',
    angriffslust: 60, ehre: 70, habgier: 34,
    wort: 'Er hat die Volksversammlung dazu gebracht, sich gegen Makedonien zu '
      + 'stellen - mit einem Antrag, nicht mit einem Heer. Er redet, bis er '
      + 'Bundesgenossen hat, und schlägt erst dann zu.',
  },
  sparta: {
    name: 'Areus I.', titel: 'der König',
    angriffslust: 68, ehre: 74, habgier: 20,
    wort: 'Gold beeindruckt ihn nicht, ein gebrochenes Wort empört ihn. '
      + 'Er schlägt zuerst, aber er lügt nicht dabei - und er weiß, wie wenige '
      + 'Spartiaten ihm nach jeder Schlacht noch bleiben.',
  },
  makedonien: {
    name: 'Antigonos II.', titel: 'Gonatas',
    angriffslust: 56, ehre: 68, habgier: 44,
    wort: 'Er nennt das Königtum eine ehrenvolle Knechtschaft und führt es so: '
      + 'er hält, was er hat, mit Besatzungen statt mit Feldzügen. Wer ihm eine '
      + 'seiner Burgen nimmt, lernt ihn von der anderen Seite kennen.',
  },
  syrakus: {
    name: 'Hieron II.', titel: 'der Rechner',
    angriffslust: 30, ehre: 74, habgier: 60,
    wort: 'Er hat begriffen, dass eine Insel zwischen zwei Großmächten nicht '
      + 'gewinnt, sondern wählt. Er wählt spät, er wählt einmal, und dann hält '
      + 'er es fünfzig Jahre lang.',
  },
  germanen: {
    name: 'Segimer', titel: 'der Gefolgsherr',
    angriffslust: 88, ehre: 38, habgier: 34,
    wort: 'Sein Gefolge hält zu ihm, solange er es führt - und führen heißt hier '
      + 'ziehen. Frieden zerfällt ihm unter den Händen.',
  },
  britannier: {
    name: 'Cassivellaunus', titel: 'der Wagenfürst',
    angriffslust: 54, ehre: 60, habgier: 36,
    wort: 'Das Meer ist seine Mauer. Er kämpft, wenn jemand über sie steigt, '
      + 'und sonst am liebsten gar nicht.',
  },
  iberer: {
    name: 'Indibilis', titel: 'der Unbeugsame',
    angriffslust: 62, ehre: 66, habgier: 28,
    wort: 'Er hat gelernt, dass fremde Heere immer wiederkommen. Bündnisse '
      + 'schließt er ungern, aber er bricht sie nicht.',
  },
  daker: {
    name: 'Oroles', titel: 'der Bergkönig',
    angriffslust: 60, ehre: 54, habgier: 42,
    wort: 'Seine Burgen liegen hoch, seine Beutezüge gehen weit. Beides zugleich '
      + 'geht nicht, und er entscheidet sich jeden Frühling neu.',
  },
  seleukiden: {
    name: 'Antiochos I.', titel: 'Soter',
    angriffslust: 64, ehre: 56, habgier: 58,
    wort: 'Er hält ein Reich zusammen, das an allen Rändern zerrt. Krieg führt '
      + 'er, wo er muss - Frieden kauft er, wo er kann.',
  },
  ptolemaeer: {
    name: 'Ptolemaios II.', titel: 'Philadelphos',
    angriffslust: 38, ehre: 62, habgier: 90,
    wort: 'Ägyptens Korn und Ägyptens Gold führen seine Kriege, nicht er selbst. '
      + 'Ein Tribut überzeugt ihn schneller als eine Schlacht.',
  },
  illyrer: {
    name: 'Agron', titel: 'der Seekönig',
    angriffslust: 78, ehre: 30, habgier: 74,
    wort: 'Seine Schiffe nehmen, was ihnen begegnet. Verträge unterschreibt er '
      + 'gern und erinnert sich ungern daran.',
  },
  sarmaten: {
    name: 'Gatalos', titel: 'der Steppenherr',
    angriffslust: 74, ehre: 44, habgier: 48,
    wort: 'Er kennt keine Grenze, die er nicht überreiten könnte. Wo etwas zu '
      + 'holen ist, ist er schon unterwegs.',
  },
};

// Ein Herrscher für jede Fraktion, auch für die, die erst im Spiel entsteht:
// eine unabhängige Stadt, die sich zum Staat erhebt, stellt jemanden an ihre
// Spitze, von dem noch niemand gehört hat.
export const DEFAULT_RULER = {
  name: 'Ein Stadtherr', titel: 'der Emporkömmling',
  angriffslust: 55, ehre: 50, habgier: 50,
  wort: 'Gestern noch Ratsherr einer Stadt, heute Herr über ein Land. '
    + 'Was er daraus macht, weiß er selbst noch nicht.',
};

export function rulerFor(factionId) {
  return RULERS[factionId] || DEFAULT_RULER;
}

// Ein Wert in Worten. Die Zahl steht daneben, aber gelesen wird das Wort.
const SKALEN = {
  angriffslust: [[80, 'kriegslüstern'], [62, 'angriffsfreudig'], [42, 'abwägend'], [25, 'zurückhaltend'], [0, 'friedfertig']],
  ehre: [[75, 'sein Wort gilt'], [58, 'verlässlich'], [42, 'wankelmütig'], [25, 'unstet'], [0, 'wortbrüchig']],
  habgier: [[80, 'goldgierig'], [62, 'handelsfreudig'], [45, 'rechnend'], [25, 'genügsam'], [0, 'Gold gilt ihm nichts']],
};

export function traitLabel(trait, value) {
  const skala = SKALEN[trait] || [];
  for (const [schwelle, wort] of skala) if (value >= schwelle) return wort;
  return '';
}

export const TRAIT_NAMES = {
  angriffslust: 'Angriffslust',
  ehre: 'Ehre',
  habgier: 'Habgier',
};

export const TRAITS = Object.keys(TRAIT_NAMES);

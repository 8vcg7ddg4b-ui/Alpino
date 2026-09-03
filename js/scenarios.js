// Die Ausgangslagen, aus denen ein Feldzug beginnen kann. Karte, Fraktionen
// und Regeln sind für alle gleich - ein Szenario ändert nur, in welchem Jahr
// die Uhr steht und wem zu diesem Zeitpunkt schon welcher Ort und welcher
// Krieg gehört. Alles andere - wo welches Heer steht, wie stark es ist -
// ergibt sich wie immer aus den Hauptstädten selbst.
export const SCENARIOS = [
  {
    id: 'punier',
    jahr: 264,
    name: 'Der Erste Punische Krieg',
    kurz: '264 v. Chr.',
    blurb: 'Rom hat eben ganz Italien geeint, Karthago die Meere zwischen '
      + 'Afrika und Sizilien. Noch ist keiner der beiden mit dem anderen im '
      + 'Krieg - aber Messana liegt zwischen ihnen, und ein Bündnis mit den '
      + 'Mamertinern reicht, das zu ändern.',
  },
  {
    id: 'hannibal',
    jahr: 218,
    name: 'Hannibals Krieg',
    kurz: '218 v. Chr.',
    blurb: 'Der Krieg ist längst erklärt: Hannibal hat Sagunt genommen, und '
      + 'Karthago hält Spanien bis zum Ebro fest in der Hand. Rom und '
      + 'Karthago stehen sich offen gegenüber, ehe der erste eigene Zug '
      + 'fällt.',
    // Karthagos neue Hauptstadt in Spanien - im Ersten Punischen Krieg gab es
    // sie noch nicht, jetzt ist sie sein Brückenkopf für den Feldzug nach
    // Italien.
    cityOverrides: { 'Karthago Nova': 'karthago' },
    atWar: [['rom', 'karthago']],
  },
];

export const DEFAULT_SCENARIO_ID = SCENARIOS[0].id;

export function scenarioById(id) {
  return SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
}

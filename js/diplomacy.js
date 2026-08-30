// Krieg und Frieden zwischen den Fraktionen.
//
// Zu Beginn steht jede Fraktion mit jeder anderen im Krieg - so hat dieses
// Spiel immer angefangen, und dabei bleibt es. Neu ist, dass sich das ändern
// lässt: ein Herrscher kann Frieden anbieten, und ein anderer kann ihn
// annehmen, halten oder brechen. Ob er das tut, hängt an seinen Eigenschaften
// (siehe rulers.js), an dem, was zwischen den beiden vorgefallen ist, und
// daran, wie der Krieg gerade steht.
//
// Zwei Fraktionen im Frieden können einander nicht angreifen: ihre Heere
// sperren sich gegenseitig die Felder, aber es fällt kein Schlag. Wer das
// ändern will, muss erst den Krieg erklären - und das kostet Ansehen bei
// allen, die zusehen.

import { logMsg, factionById, unitTotalCount, isFleet } from './state.js';
import { rulerFor } from './rulers.js';

// Ansehen läuft von 0 bis 100. 50 heißt: man kennt sich, mehr nicht.
export const OPINION_START = 50;
export const OPINION_MIN = 0;
export const OPINION_MAX = 100;
// Was das Ansehen bewegt.
export const OPINION_PER_BATTLE = -7;
export const OPINION_PER_CITY_TAKEN = -22;
export const OPINION_WAR_TURN = -1;
export const OPINION_PEACE_TURN = 1;
export const OPINION_PER_GIFT = 12;
export const OPINION_WAR_DECLARED = -25;
// Was ein Geschenk kostet und was ein Tribut zum Frieden beiträgt.
export const GIFT_COST = 100;
export const TRIBUTE_OFFER = 300;
// Ein frisch geschlossener Frieden hält mindestens so viele Runden, ehe ihn
// jemand aufkündigen kann. Ohne diese Frist wäre ein Vertrag wertlos.
export const PEACE_GRACE_TURNS = 6;
// Ab diesem Wert nimmt ein Herrscher ein Friedensangebot an.
export const PEACE_THRESHOLD = 58;
// Was eine Kriegserklärung bei allen kostet, die davon hören - nicht nur bei
// dem, dem sie gilt. Wer dreimal im Jahr einen Herold schickt, gilt als einer,
// mit dem kein Vertrag hält.
export const OPINION_WARMONGER = -6;

// --- Verträge --------------------------------------------------------------
// Zwischen Krieg und Frieden liegt mehr als nichts. Drei Verträge lassen sich
// schließen, alle drei setzen den Frieden voraus, und alle drei enden, wenn
// er endet:
//
//   Nichtangriffspakt - keiner von beiden erklärt dem anderen den Krieg,
//                       zwanzig Runden lang. Danach läuft er aus.
//   Handelsabkommen   - beide dürfen Handelswege in die Städte des anderen
//                       eröffnen; jede Seite verdient an ihrem Ende.
//   Bündnis           - wie ein Pakt, aber ohne Frist, und mit dem Bündnisfall:
//                       wer den einen angreift, hat den anderen mit im Feld.
//
// Je höher der Vertrag wiegt, desto mehr Ansehen setzt er voraus - und desto
// mehr wärmt er das Verhältnis, solange er hält.
export const PACT_TURNS = 20;
export const TRADE_PACT_TURNS = 30;
export const PASSAGE_TURNS = 25;

export const TREATIES = {
  durchmarsch: {
    key: 'durchmarsch',
    name: 'Betretungsrecht',
    genus: 'n',
    icon: '🚩',
    opinion: 40,
    drift: 0,
    dauer: PASSAGE_TURNS,
    chance: 0.12,
    zweck: 'eure Heere dürfen die Grenze überschreiten',
    versprechen: 'eure Heere dürfen einander das Land betreten, ohne dass es Krieg bedeutet',
  },
  pakt: {
    key: 'pakt',
    name: 'Nichtangriffspakt',
    genus: 'm',
    icon: '🤝',
    opinion: 45,
    drift: 1,
    dauer: PACT_TURNS,
    chance: 0.1,
    zweck: 'keine Kriegserklärung, solange er läuft',
    versprechen: `${PACT_TURNS} Runden lang erklärt euch keiner den Krieg`,
  },
  handel: {
    key: 'handel',
    name: 'Handelsabkommen',
    genus: 'n',
    icon: '⚖️',
    opinion: 55,
    drift: 1,
    dauer: TRADE_PACT_TURNS,
    chance: 0.08,
    zweck: 'Handelswege in die Städte des anderen',
    versprechen: 'beide Seiten dürfen Handelswege in die Städte des anderen legen',
  },
  buendnis: {
    key: 'buendnis',
    name: 'Bündnis',
    genus: 'n',
    icon: '🛡️',
    opinion: 70,
    drift: 1,
    dauer: 0,
    chance: 0.03,
    zweck: 'gemeinsame Sache – wer den einen angreift, hat den anderen im Feld',
    versprechen: 'wer deinen Verbündeten angreift, steht auch mit dir im Krieg',
  },
};

export const TREATY_KEYS = Object.keys(TREATIES);

// Deutsch verlangt den richtigen Artikel: man schließt einen Pakt, aber ein
// Betretungsrecht. Drei kleine Helfer statt vier Sonderfälle im Satzbau.
export function vertragAkk(def) {
  return `${def.genus === 'm' ? 'einen' : 'ein'} ${def.name}`;
}

// Im Nominativ heißt es bei beiden Geschlechtern "ein" - "es gilt ein
// Nichtangriffspakt", nicht "einen". Der Unterschied steckt nur im Akkusativ,
// und genau den hatte der erste Wurf überall eingesetzt.
export function vertragNom(def, gross = false) {
  return `${gross ? 'Ein' : 'ein'} ${def.name}`;
}

export function vertragDenAkk(def) {
  return `${def.genus === 'm' ? 'den' : 'das'} ${def.name}`;
}

export function vertragDer(def, gross = true) {
  const artikel = def.genus === 'm' ? 'der' : 'das';
  return `${gross ? artikel[0].toUpperCase() + artikel.slice(1) : artikel} ${def.name}`;
}

// So lange muss ein Nichtangriffspakt gehalten haben, ehe daraus ein Bündnis
// wird. Ein Bündnis ist kein Handschlag unter Fremden.
export const ALLY_PACT_TURNS = 10;

// Was ein gebrochenes Bündnis kostet: beim Verbündeten viel, bei allen, die
// zusehen, ein Stück.
export const OPINION_BREAK_ALLIANCE = -30;
export const OPINION_BREAK_WITNESS = -8;

export function treatyOf(state, a, b, kind) {
  const relation = relationOf(state, a, b);
  const eintrag = relation && relation.vertraege && relation.vertraege[kind];
  if (!eintrag) return null;
  if (eintrag.bis && eintrag.bis <= state.turn) return null;
  return eintrag;
}

export function treatiesOf(state, a, b) {
  return TREATY_KEYS.map((kind) => (treatyOf(state, a, b, kind) ? TREATIES[kind] : null))
    .filter(Boolean);
}

export function hasPact(state, a, b) {
  return !!treatyOf(state, a, b, 'pakt');
}

export function hasTradePact(state, a, b) {
  return !!treatyOf(state, a, b, 'handel');
}

export function isAllied(state, a, b) {
  return !!treatyOf(state, a, b, 'buendnis');
}

// Ob ein Heer die Grenze überschreiten darf, ohne dass es Krieg bedeutet.
// Das Betretungsrecht sagt es ausdrücklich; ein Bündnis schließt es ein -
// Verbündete marschieren durcheinander hindurch, sonst wären sie keine.
export function hasPassage(state, a, b) {
  if (!a || !b || a === b) return true;
  return isAllied(state, a, b) || !!treatyOf(state, a, b, 'durchmarsch');
}

// Ein Pakt oder ein Bündnis bindet die Hand: solange einer von beiden steht,
// wird kein Krieg erklärt.
export function warBound(state, a, b) {
  if (isAllied(state, a, b)) return TREATIES.buendnis;
  if (hasPact(state, a, b)) return TREATIES.pakt;
  return null;
}

export function alliesOf(state, factionId) {
  return state.factions
    .filter((f) => !f.isNeutral && f.alive && f.id !== factionId
      && isAllied(state, factionId, f.id))
    .map((f) => f.id);
}

// Alle Verträge zwischen zweien fallen, sobald der Krieg erklärt wird - und
// die Handelswege dazwischen mit ihnen.
function clearTreaties(state, a, b) {
  const relation = relationOf(state, a, b);
  if (relation) relation.vertraege = {};
}

// Ein abgelaufener Pakt verschwindet von selbst.
export function expireTreaties(state) {
  const beendet = [];
  for (const key of Object.keys(state.relations || {})) {
    const relation = state.relations[key];
    if (!relation.vertraege) continue;
    for (const kind of Object.keys(relation.vertraege)) {
      const eintrag = relation.vertraege[kind];
      if (!eintrag.bis || eintrag.bis > state.turn) continue;
      delete relation.vertraege[kind];
      const [a, b] = key.split('|');
      beendet.push({ a, b, kind });
      logMsg(state, `${TREATIES[kind].icon} ${vertragDer(TREATIES[kind])} zwischen `
        + `${factionById(state, a).name} und ${factionById(state, b).name} ist ausgelaufen.`,
      null, [a, b]);
    }
  }
  return beendet;
}

// Wie ein Herrscher über einen Vertragsvorschlag urteilt. Dieselbe Machart wie
// beim Frieden: eine Zahl, und ein Satz, den man ihm glaubt.
export function treatyVerdict(state, fromId, toId, kind) {
  const def = TREATIES[kind];
  const relation = relationOf(state, fromId, toId);
  if (!def || !relation) return { possible: false, grund: 'Mit ihnen lässt sich nicht verhandeln.' };
  if (relation.state !== 'frieden') {
    return { possible: false, grund: 'Erst der Friede, dann der Vertrag.' };
  }
  if (treatyOf(state, fromId, toId, kind)) {
    return { possible: false, grund: `${vertragNom(def, true)} steht bereits.` };
  }
  // Ein Bündnis kommt nicht aus dem Nichts: erst ein Pakt, dann das Wort.
  if (kind === 'buendnis') {
    const pakt = treatyOf(state, fromId, toId, 'pakt');
    if (!pakt) {
      return { possible: false, grund: 'Erst ein Nichtangriffspakt, dann ein Bündnis.' };
    }
    if (state.turn - pakt.seit < ALLY_PACT_TURNS) {
      const rest = ALLY_PACT_TURNS - (state.turn - pakt.seit);
      return { possible: false,
        grund: `Der Pakt ist zu jung – erst muss er ${rest} ${
          rest === 1 ? 'Runde' : 'Runden'} gehalten haben.` };
    }
  }
  const ruler = rulerOf(state, toId);
  // Wer sein Wort hält, schließt gern Verträge; wer den Krieg sucht, ungern.
  const neigung = ruler.ehre * 0.35 - ruler.angriffslust * 0.2;
  const score = relation.opinion + neigung;
  const schwelle = def.opinion + 10;
  const gruende = [];
  if (relation.opinion < def.opinion) gruende.push('er hält zu wenig von dir');
  if (ruler.ehre >= 70) gruende.push('ein Wort gilt ihm etwas');
  if (ruler.angriffslust >= 70) gruende.push('er sucht den Krieg, nicht den Vertrag');
  if (relation.opinion >= def.opinion + 15) gruende.push('er steht gut zu dir');
  return {
    possible: true,
    score: Math.round(score),
    schwelle,
    accepted: score >= schwelle,
    gruende,
  };
}

// Der Vertrag wird geschlossen. Beide Seiten wissen davon, und alle, die die
// beiden kennen, hören es.
export function signTreaty(state, a, b, kind, note) {
  const def = TREATIES[kind];
  const relation = relationOf(state, a, b);
  if (!def || !relation || relation.state !== 'frieden') return { ok: false };
  const vertraege = relation.vertraege || (relation.vertraege = {});
  if (vertraege[kind]) return { ok: false, reason: 'done' };
  vertraege[kind] = { seit: state.turn, bis: def.dauer ? state.turn + def.dauer : null };
  adjustOpinion(state, a, b, 6);
  const nameA = factionById(state, a).name;
  const nameB = factionById(state, b).name;
  logMsg(state, `${def.icon} ${nameA} und ${nameB} schließen ${vertragAkk(def)}`
    + `${note ? ` – ${note}` : ''}.`, null, [a, b]);
  return { ok: true };
}

// Und er lässt sich aufkündigen. Beim Pakt und beim Abkommen kostet das wenig,
// beim Bündnis den Ruf: wer seinen Verbündeten sitzen lässt, ist keiner.
export function cancelTreaty(state, a, b, kind) {
  const def = TREATIES[kind];
  const relation = relationOf(state, a, b);
  if (!def || !relation || !relation.vertraege || !relation.vertraege[kind]) {
    return { ok: false };
  }
  delete relation.vertraege[kind];
  if (kind === 'buendnis') {
    adjustOpinion(state, a, b, OPINION_BREAK_ALLIANCE);
    for (const other of state.factions) {
      if (other.isNeutral || other.id === a || other.id === b) continue;
      if (!knowsFaction(state, other.id, a)) continue;
      adjustOpinion(state, a, other.id, OPINION_BREAK_WITNESS);
    }
  } else {
    adjustOpinion(state, a, b, -8);
  }
  const nameA = factionById(state, a).name;
  const nameB = factionById(state, b).name;
  logMsg(state, `${nameA} kündigt ${vertragDenAkk(def)} mit ${nameB} auf.`, null, [a, b]);
  return { ok: true, text: `${vertragDer(def)} mit ${nameB} ist aufgekündigt.` };
}

// --- Bedenkzeit ------------------------------------------------------------
// Diplomatie ist kein Knopf, den man zweimal drückt. Wer heute den Krieg
// erklärt, kann nicht in derselben Runde um Frieden bitten; wer eben Frieden
// geschlossen hat, bricht ihn nicht sofort wieder; und wessen Gesandter
// abgewiesen wurde, schickt nicht am nächsten Morgen den nächsten. Jede
// Handlung legt deshalb eine Frist auf das Verhältnis, und erst wenn sie
// abgelaufen ist, steht wieder alles offen.
//
// Gespeichert wird nach der gesperrten Handlung, nicht nach der Ursache: so
// sperrt eine Kriegserklärung den Frieden, ohne nebenbei das Geschenk zu
// sperren, das man dem Nächsten schickt.
export const NACHWIRKUNG = {
  kriegserklaerung: { frieden: 8 },
  friedensschluss: { krieg: PEACE_GRACE_TURNS },
  abgelehnt: { frieden: 4 },
  geschenk: { geschenk: 3 },
  vertragAbgelehnt: { vertrag: 4 },
  vertragGekuendigt: { vertrag: 8 },
};

const SPERRTEXT = {
  kriegserklaerung: 'Die Kriegserklärung ist zu frisch – so kurz nach dem Herold '
    + 'redet niemand vom Frieden',
  friedensschluss: 'Der Friede ist zu frisch – ein Wort, das man nach zwei Runden '
    + 'bricht, ist keines',
  abgelehnt: 'Dein Gesandter ist eben erst abgewiesen worden',
  geschenk: 'Das letzte Geschenk liegt noch auf dem Tisch',
  vertragAbgelehnt: 'Dein Vorschlag ist eben erst ausgeschlagen worden',
  vertragGekuendigt: 'Ein aufgekündigter Vertrag will erst vergessen sein',
};

// Legt die Frist auf, die diese Handlung nach sich zieht.
export function applyCooldown(state, a, b, handlung) {
  const relation = relationOf(state, a, b);
  const wirkung = NACHWIRKUNG[handlung];
  if (!relation || !wirkung) return;
  const sperren = relation.sperren || (relation.sperren = {});
  for (const aktion of Object.keys(wirkung)) {
    const bis = state.turn + wirkung[aktion];
    if (!sperren[aktion] || sperren[aktion].bis < bis) {
      sperren[aktion] = { bis, wegen: handlung };
    }
  }
}

// Ob diese Handlung gerade gesperrt ist - und warum, und für wie lange noch.
export function diploLock(state, a, b, aktion) {
  const relation = relationOf(state, a, b);
  const eintrag = relation && relation.sperren && relation.sperren[aktion];
  if (!eintrag) return null;
  const rest = eintrag.bis - state.turn;
  if (rest <= 0) return null;
  return {
    rest,
    wegen: eintrag.wegen,
    text: `${SPERRTEXT[eintrag.wegen] || 'Es ist zu früh'} – noch ${rest} `
      + `${rest === 1 ? 'Runde' : 'Runden'}.`,
  };
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// Alle Beziehungen stehen in einer flachen Tabelle, damit sie der Undo-Stapel
// mitkopiert und niemand zwei Wahrheiten über dasselbe Verhältnis führt.
// Der Normalfall ist der Friede. Niemand beginnt einen Feldzug im Krieg mit
// aller Welt - Kriege werden erklärt, und wer sie erklärt, entscheidet sein
// Charakter. Das kostet die ersten Runden ihre Schlachten und gibt ihnen
// dafür etwas anderes: die Frage, wer als Erster zum Schwert greift.
export function initRelations(factions) {
  const relations = {};
  const ids = factions.filter((f) => !f.isNeutral).map((f) => f.id);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      relations[pairKey(ids[i], ids[j])] = {
        state: 'frieden', opinion: OPINION_START, since: 1,
        // Fristen aus vergangenen Handlungen - zu Beginn liegt keine an.
        sperren: {},
      };
    }
  }
  return relations;
}

// Die Unabhängigen und alles, was noch keinen Eintrag hat, stehen im Krieg:
// mit einer Miliz verhandelt niemand.
// --- Was man voneinander weiß -------------------------------------------
// Ein Feldherr im Jahr 264 v. Chr. kennt seine Nachbarn und hat von den
// Reichen dahinter gehört, mehr nicht. Erst wer einem Heer oder einer Stadt
// nahe genug kommt, weiß, wer dort herrscht - und nur mit dem lässt sich
// verhandeln. Wer im Krieg mit einem steht, kennt ihn ohnehin.
export const SIGHT_RANGE = 8;
// Was man schon immer wusste: die Reiche, die nah genug liegen, dass ihre
// Kaufleute und Gesandten seit Generationen kommen. Weiter gefasst als die
// Sicht eines Heeres - Rom kannte Karthago, ohne je einen Legionär dorthin
// geschickt zu haben.
export const KNOWN_AT_START = 16;

function factionSites(state, factionId) {
  const orte = state.cities.filter((c) => c.factionId === factionId);
  const heere = state.armies.filter((a) => a.factionId === factionId);
  return [...orte, ...heere];
}

// Trägt nach, wen diese Fraktion inzwischen kennt. Läuft jede Runde und beim
// Beginn des Feldzugs.
export function updateKnowledge(state, factionId) {
  const known = state.known || (state.known = {});
  const meine = known[factionId] || (known[factionId] = { [factionId]: true });
  const eigene = factionSites(state, factionId);
  for (const other of state.factions) {
    if (other.isNeutral || other.id === factionId) continue;
    if (meine[other.id]) continue;
    if (!atPeace(state, factionId, other.id)) { meine[other.id] = true; continue; }
    const fremde = factionSites(state, other.id);
    const nah = eigene.some((a) => fremde.some(
      (b) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row) <= SIGHT_RANGE
    ));
    if (nah) meine[other.id] = true;
  }
  return meine;
}

// Zu Beginn des Feldzugs: jeder kennt seine Nachbarn, niemand die Welt.
export function seedKnowledge(state) {
  state.known = {};
  for (const faction of state.factions) {
    if (faction.isNeutral) continue;
    const meine = (state.known[faction.id] = { [faction.id]: true });
    const eigene = state.cities.filter((c) => c.factionId === faction.id);
    for (const other of state.factions) {
      if (other.isNeutral || other.id === faction.id) continue;
      const fremde = state.cities.filter((c) => c.factionId === other.id);
      const nah = eigene.some((a) => fremde.some(
        (b) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row) <= KNOWN_AT_START
      ));
      if (nah) meine[other.id] = true;
    }
  }
  return state.known;
}

export function knowsFaction(state, factionId, otherId) {
  if (factionId === otherId) return true;
  const meine = (state.known || {})[factionId];
  return !!(meine && meine[otherId]);
}

// Grob, wo ein unbekanntes Reich liegt - mehr als eine Himmelsrichtung weiß
// man von einem Land, in dem man nie war, auch nicht.
export function roughDirection(state, fromId, toId) {
  const von = factionSites(state, fromId);
  const zu = state.cities.filter((c) => c.factionId === toId);
  if (!von.length || !zu.length) return 'irgendwo jenseits der bekannten Welt';
  const mitte = (liste, key) => liste.reduce((s2, x) => s2 + x[key], 0) / liste.length;
  const dcol = mitte(zu, 'col') - mitte(von, 'col');
  const drow = mitte(zu, 'row') - mitte(von, 'row');
  const senkrecht = drow < 0 ? 'im Norden' : 'im Süden';
  const waagerecht = dcol < 0 ? 'im Westen' : 'im Osten';
  if (Math.abs(dcol) > Math.abs(drow) * 1.6) return waagerecht;
  if (Math.abs(drow) > Math.abs(dcol) * 1.6) return senkrecht;
  return `${senkrecht.replace('im ', 'im ')}${dcol < 0 ? 'westen' : 'osten'}`.replace('im Norden', 'im Nord').replace('im Süden', 'im Süd');
}

export function relationOf(state, a, b) {
  if (!a || !b || a === b) return null;
  if (a === 'neutral' || b === 'neutral') return null;
  const relations = state.relations || (state.relations = {});
  return relations[pairKey(a, b)] || null;
}

export function atWar(state, a, b) {
  if (!a || !b || a === b) return false;
  const relation = relationOf(state, a, b);
  return relation ? relation.state === 'krieg' : true;
}

export function atPeace(state, a, b) {
  const relation = relationOf(state, a, b);
  return !!relation && relation.state === 'frieden';
}

export function opinionOf(state, a, b) {
  const relation = relationOf(state, a, b);
  return relation ? relation.opinion : OPINION_START;
}

export function adjustOpinion(state, a, b, delta) {
  const relation = relationOf(state, a, b);
  if (!relation) return;
  relation.opinion = Math.max(OPINION_MIN, Math.min(OPINION_MAX, relation.opinion + delta));
}

// Ein Herrscher in Worten, wie ihn ein Gesandter beschreiben würde.
export function rulerOf(state, factionId) {
  const faction = factionById(state, factionId);
  return (faction && faction.ruler) || rulerFor(factionId);
}

export function makePeace(state, a, b, note) {
  const relation = relationOf(state, a, b);
  if (!relation || relation.state === 'frieden') return { ok: false };
  // Nach einer Kriegserklärung wird nicht in derselben Woche Frieden
  // geschlossen - auch nicht von zwei Herrschern, die es beide wollen.
  const sperre = diploLock(state, a, b, 'frieden');
  if (sperre) return { ok: false, reason: 'sperre', lock: sperre };
  relation.state = 'frieden';
  relation.since = state.turn;
  relation.sperren = {};
  applyCooldown(state, a, b, 'friedensschluss');
  adjustOpinion(state, a, b, 10);
  const nameA = factionById(state, a).name;
  const nameB = factionById(state, b).name;
  logMsg(state, `Friede zwischen ${nameA} und ${nameB}${note ? ` – ${note}` : ''}.`, null, [a, b]);
  return { ok: true };
}

export function declareWar(state, a, b, note) {
  const relation = relationOf(state, a, b);
  if (!relation || relation.state === 'krieg') return { ok: false };
  // Ein gegebenes Wort bindet: gegen einen Pakt oder ein Bündnis marschiert
  // niemand, ohne es vorher aufzukündigen.
  const bindung = warBound(state, a, b);
  if (bindung) {
    return { ok: false, reason: 'vertrag', vertrag: bindung,
      text: `${vertragNom(bindung, true)} steht zwischen euch – erst aufkündigen, `
        + 'dann marschieren.' };
  }
  // Ein Friede, der gestern geschlossen wurde, wird nicht heute aufgekündigt.
  const sperre = diploLock(state, a, b, 'krieg');
  if (sperre) return { ok: false, reason: 'sperre', lock: sperre };
  relation.state = 'krieg';
  relation.since = state.turn;
  relation.sperren = {};
  // Mit dem Krieg fällt alles, was zwischen den beiden galt.
  clearTreaties(state, a, b);
  applyCooldown(state, a, b, 'kriegserklaerung');
  adjustOpinion(state, a, b, OPINION_WAR_DECLARED);
  // Ein Herold spricht vor Zeugen: wer den Krieg erklärt, verliert bei allen,
  // die davon hören, ein Stück Ansehen. Dreimal im Jahr, und man gilt als
  // einer, mit dem kein Vertrag hält.
  for (const other of state.factions) {
    if (other.isNeutral || other.id === a || other.id === b) continue;
    if (!knowsFaction(state, other.id, a)) continue;
    adjustOpinion(state, a, other.id, OPINION_WARMONGER);
  }
  const nameA = factionById(state, a).name;
  const nameB = factionById(state, b).name;
  logMsg(state, `${nameA} erklärt ${nameB} den Krieg${note ? ` – ${note}` : ''}.`, null, [a, b]);
  // Der Bündnisfall: wer einen angreift, hat dessen Verbündete mit im Feld.
  const gerufen = callAllies(state, a, b);
  return { ok: true, allies: gerufen };
}

// Die Verbündeten des Angegriffenen treten ein. Nicht durch eine eigene
// Kriegserklärung - sie haben ihr Wort schon gegeben, als sie das Bündnis
// schlossen -, sondern unmittelbar. Nur wen sein eigenes Wort an den Angreifer
// bindet, der bleibt draußen.
export function callAllies(state, angreifer, angegriffen) {
  const gerufen = [];
  for (const allyId of alliesOf(state, angegriffen)) {
    if (allyId === angreifer) continue;
    if (atWar(state, allyId, angreifer)) continue;
    if (warBound(state, allyId, angreifer)) continue;
    const relation = relationOf(state, allyId, angreifer);
    if (!relation) continue;
    // Ein Friede, der eben erst geschlossen wurde, hält auch dem Bündnisfall
    // stand: der Verbündete kann noch nicht beistehen und sagt es.
    const sperre = diploLock(state, allyId, angreifer, 'krieg');
    if (sperre) {
      logMsg(state, `${factionById(state, allyId).name} kann `
        + `${factionById(state, angegriffen).name} nicht beistehen: der Friede mit `
        + `${factionById(state, angreifer).name} ist zu frisch.`, null,
      [allyId, angreifer, angegriffen]);
      continue;
    }
    relation.state = 'krieg';
    relation.since = state.turn;
    relation.sperren = {};
    relation.vertraege = {};
    applyCooldown(state, allyId, angreifer, 'kriegserklaerung');
    adjustOpinion(state, allyId, angreifer, -15);
    gerufen.push(allyId);
    const nameAlly = factionById(state, allyId).name;
    const nameAngreifer = factionById(state, angreifer).name;
    const nameFreund = factionById(state, angegriffen).name;
    logMsg(state, `🛡️ Bündnisfall: ${nameAlly} steht ${nameFreund} bei und `
      + `zieht gegen ${nameAngreifer}.`, null, [allyId, angreifer, angegriffen]);
    pushNews(state, {
      kind: 'buendnisfall', von: angreifer, gegen: allyId,
      icon: '🛡️',
      kindLabel: `Der Bündnisfall · ${nameAngreifer}`,
      titel: `${nameAlly} steht im Krieg mit ${nameAngreifer}`,
      satz: `${nameAngreifer} hat ${nameFreund} angegriffen. Das Bündnis mit `
        + `${nameFreund} verlangt Beistand – ${nameAlly} zieht mit.`,
      folge: 'Ein Bündnis ist keine Höflichkeit: es zieht dich in die Kriege '
        + 'deines Verbündeten. Aufkündigen kannst du es im Diplomatiefenster.',
      verbuendeter: angegriffen,
    });
  }
  return gerufen;
}

// --- Wie ein Herrscher über ein Friedensangebot urteilt -------------------
// Er rechnet zusammen: was er von dem anderen hält, wie sehr ihm der Krieg
// überhaupt liegt, wie der Krieg gerade steht - und was auf dem Tisch liegt.
// Herauskommt eine Zahl und, wichtiger, ein Satz, den man ihm glauben kann.

function fieldStrength(state, factionId) {
  return state.armies
    .filter((a) => a.factionId === factionId)
    .reduce((sum, a) => sum + unitTotalCount(a.units), 0);
}

export function peaceVerdict(state, fromId, toId, tribute = 0) {
  const relation = relationOf(state, fromId, toId);
  if (!relation) return { possible: false, grund: 'Mit ihnen lässt sich nicht verhandeln.' };
  if (relation.state === 'frieden') {
    return { possible: false, grund: 'Ihr steht bereits im Frieden.' };
  }
  const sperre = diploLock(state, fromId, toId, 'frieden');
  if (sperre) return { possible: false, grund: sperre.text, sperre };
  const ruler = rulerOf(state, toId);
  // Wer den Krieg liebt, muss stärker überredet werden; wer sein Wort hält,
  // hält auch einen Frieden für etwas wert.
  const neigung = (100 - ruler.angriffslust) * 0.45 + ruler.ehre * 0.18;
  // Wer im Feld überlegen ist, sieht keinen Grund aufzuhören.
  const eigene = Math.max(1, fieldStrength(state, toId));
  const fremde = Math.max(1, fieldStrength(state, fromId));
  const uebermacht = Math.max(-18, Math.min(18, (eigene / (eigene + fremde) - 0.5) * 72));
  // Gold wiegt so schwer, wie er es wiegen lässt.
  const gold = tribute > 0 ? (tribute / 25) * (0.4 + ruler.habgier / 100) : 0;
  const score = relation.opinion * 0.5 + neigung + gold - uebermacht;

  const gruende = [];
  if (relation.opinion < 30) gruende.push('er traut dir nicht');
  if (ruler.angriffslust >= 70) gruende.push('er sucht den Krieg');
  if (uebermacht > 8) gruende.push('er hält sich für den Stärkeren');
  if (tribute > 0 && ruler.habgier >= 60) gruende.push('das Gold wiegt schwer');
  if (relation.opinion >= 60) gruende.push('er hat nichts gegen dich');
  if (ruler.ehre >= 70) gruende.push('ein Wort gilt ihm etwas');
  return {
    possible: true,
    score: Math.round(score),
    schwelle: PEACE_THRESHOLD,
    accepted: score >= PEACE_THRESHOLD,
    gruende,
  };
}

// Was ihn ein Frieden kosten würde. Ein fester Betrag hilft wenig: dem einen
// reicht ein Beutel, der andere ist für kein Gold der Welt zu haben. Gesucht
// wird deshalb die kleinste Summe, die reicht - in Schritten von 50, damit die
// Zahl auf dem Knopf nach einem Angebot aussieht und nicht nach einer Rechnung.
export const TRIBUTE_STEP = 50;
export const TRIBUTE_MAX = 3000;

export function peacePrice(state, fromId, toId) {
  if (!relationOf(state, fromId, toId)) return null;
  if (peaceVerdict(state, fromId, toId, 0).accepted) return 0;
  for (let gold = TRIBUTE_STEP; gold <= TRIBUTE_MAX; gold += TRIBUTE_STEP) {
    if (peaceVerdict(state, fromId, toId, gold).accepted) return gold;
  }
  return null;
}

// Der Spieler bietet Frieden an - mit oder ohne Tribut.
export function offerPeace(state, fromId, toId, tribute = 0) {
  const from = factionById(state, fromId);
  const to = factionById(state, toId);
  if (!from || !to || from.isNeutral || to.isNeutral) return { ok: false };
  if (tribute > 0 && from.gold < tribute) {
    return { ok: false, reason: 'gold', text: 'Der Schatz gibt den Tribut nicht her.' };
  }
  const urteil = peaceVerdict(state, fromId, toId, tribute);
  if (!urteil.possible) return { ok: false, text: urteil.grund };
  const ruler = rulerOf(state, toId);
  if (!urteil.accepted) {
    // Ein abgelehntes Angebot ist nicht umsonst: es zeigt guten Willen. Aber
    // es kostet Zeit - der nächste Gesandte bricht nicht morgen auf.
    adjustOpinion(state, fromId, toId, 3);
    applyCooldown(state, fromId, toId, 'abgelehnt');
    const grund = urteil.gruende.length ? ` – ${urteil.gruende[0]}` : '';
    logMsg(state, `${ruler.name} lehnt den Frieden mit ${from.name} ab${grund}.`,
      null, [fromId, toId]);
    return { ok: false, reason: 'abgelehnt', accepted: false, urteil,
      text: `${ruler.name} schlägt das Angebot aus${grund}.` };
  }
  if (tribute > 0) {
    from.gold -= tribute;
    to.gold += tribute;
    adjustOpinion(state, fromId, toId, Math.round(tribute / 60));
  }
  makePeace(state, fromId, toId, tribute > 0 ? `${to.name} nimmt einen Tribut von ${tribute} Gold` : null);
  return { ok: true, accepted: true, urteil,
    text: `${ruler.name} nimmt an. Zwischen euch ist Friede.` };
}

// Der Spieler schlägt einen Vertrag vor. Anders als beim Frieden gibt es
// nichts zu verhandeln: der andere sagt ja oder nein, und zwar sofort.
export function proposeTreaty(state, fromId, toId, kind) {
  const def = TREATIES[kind];
  const from = factionById(state, fromId);
  const to = factionById(state, toId);
  if (!def || !from || !to || from.isNeutral || to.isNeutral) return { ok: false };
  const sperre = diploLock(state, fromId, toId, 'vertrag');
  if (sperre) return { ok: false, reason: 'sperre', lock: sperre, text: sperre.text };
  const urteil = treatyVerdict(state, fromId, toId, kind);
  if (!urteil.possible) return { ok: false, text: urteil.grund };
  const ruler = rulerOf(state, toId);
  if (!urteil.accepted) {
    adjustOpinion(state, fromId, toId, 2);
    applyCooldown(state, fromId, toId, 'vertragAbgelehnt');
    const grund = urteil.gruende.length ? ` – ${urteil.gruende[0]}` : '';
    logMsg(state, `${ruler.name} lehnt ${vertragAkk(def)} mit ${from.name} ab${grund}.`,
      null, [fromId, toId]);
    return { ok: false, reason: 'abgelehnt', urteil,
      text: `${ruler.name} schlägt ${vertragDenAkk(def)} aus${grund}.` };
  }
  const ergebnis = signTreaty(state, fromId, toId, kind);
  if (!ergebnis.ok) return { ok: false, text: 'Daraus wird nichts.' };
  return { ok: true, urteil,
    text: `${ruler.name} setzt sein Siegel darunter. Zwischen euch gilt ${vertragNom(def)}.` };
}

// Und er kündigt ihn auf - was ihn beim Bündnis den Ruf kostet.
export function renounceTreaty(state, fromId, toId, kind) {
  const ergebnis = cancelTreaty(state, fromId, toId, kind);
  if (!ergebnis.ok) return { ok: false };
  applyCooldown(state, fromId, toId, 'vertragGekuendigt');
  return ergebnis;
}

export function sendGift(state, fromId, toId, amount = GIFT_COST) {
  const from = factionById(state, fromId);
  const to = factionById(state, toId);
  if (!from || !to || from.isNeutral || to.isNeutral) return { ok: false };
  // Zwei Geschenke in zwei Runden sind kein Geschenk, sondern ein Handel.
  const sperre = diploLock(state, fromId, toId, 'geschenk');
  if (sperre) return { ok: false, reason: 'sperre', lock: sperre, text: sperre.text };
  if (from.gold < amount) return { ok: false, reason: 'gold', text: 'Dafür fehlt das Gold.' };
  from.gold -= amount;
  to.gold += amount;
  adjustOpinion(state, fromId, toId, OPINION_PER_GIFT);
  applyCooldown(state, fromId, toId, 'geschenk');
  const ruler = rulerOf(state, toId);
  logMsg(state, `${from.name} sendet ${ruler.name} ein Geschenk von ${amount} Gold.`,
    null, [fromId, toId]);
  return { ok: true, text: `${ruler.name} nimmt das Geschenk entgegen.` };
}

// --- Gesandte, die auf eine Antwort warten ---------------------------------
// Bisher konnte nur der Spieler Frieden anbieten; die anderen Herrscher
// schlossen ihn untereinander und ließen ihn mit ihm laufen, bis er selbst
// etwas tat. Das war die größte Lücke im System: ein Gegner, der den Krieg
// längst satt hat, hatte keine Möglichkeit, das zu sagen.
//
// Jetzt schickt er einen Gesandten. Der steht im Diplomatiefenster und wartet
// - drei Runden lang, dann reist er ab. Wer schwächer ist, legt Gold dazu.

// Wie lange ein Gesandter auf Antwort wartet.
export const OFFER_TURNS = 3;

export function pendingOffers(state, forFactionId = null) {
  const offers = state.peaceOffers || [];
  return forFactionId ? offers.filter((o) => o.gegen === forFactionId) : offers;
}

export function offerFrom(state, factionId, forFactionId) {
  return pendingOffers(state, forFactionId).find((o) => o.von === factionId) || null;
}

// Ein müder Herrscher bietet dem Spieler Frieden an. Was er dazulegt, hängt
// davon ab, wie er im Feld steht: wer verliert, zahlt.
export function offerPeaceToPlayer(state, fromId, toId) {
  const offers = state.peaceOffers || (state.peaceOffers = []);
  if (offers.some((o) => o.von === fromId && o.gegen === toId)) return null;
  if (diploLock(state, fromId, toId, 'frieden')) return null;
  const meine = Math.max(1, fieldStrength(state, fromId));
  const seine = Math.max(1, fieldStrength(state, toId));
  const unterlegen = meine / (meine + seine);
  const from = factionById(state, fromId);
  // Wer klar unterliegt, kauft sich den Frieden - aus dem, was er hat.
  const wunsch = unterlegen < 0.4 ? Math.round((0.5 - unterlegen) * 1600) : 0;
  const tribut = Math.max(0, Math.min(wunsch - (wunsch % 50), Math.floor((from.gold || 0) * 0.6)));
  const ruler = rulerOf(state, fromId);
  const grund = unterlegen < 0.4 ? 'seine Heere sind aufgerieben'
    : ruler.angriffslust < 45 ? 'er hat den Krieg nie gewollt'
      : 'der Feldzug bringt ihm nichts mehr';
  const angebot = {
    von: fromId, gegen: toId, turn: state.turn, laeuftAb: state.turn + OFFER_TURNS,
    tribut, grund, ruler: ruler.name, titel: ruler.titel,
  };
  offers.push(angebot);
  pushNews(state, {
    kind: 'angebot', von: fromId, gegen: toId,
    ruler: ruler.name, titel: ruler.titel, grund, tribut,
  });
  return angebot;
}

// Der Spieler nimmt an: der Krieg endet, und was der Gesandte mitbrachte,
// wechselt den Besitzer.
export function acceptOffer(state, fromId, toId) {
  const angebot = offerFrom(state, fromId, toId);
  if (!angebot) return { ok: false };
  const from = factionById(state, fromId);
  const to = factionById(state, toId);
  const tribut = Math.min(angebot.tribut || 0, from.gold || 0);
  state.peaceOffers = pendingOffers(state).filter((o) => o !== angebot);
  const ergebnis = makePeace(state, fromId, toId,
    tribut > 0 ? `${from.name} zahlt ${tribut} Gold` : angebot.grund);
  if (!ergebnis.ok) return { ok: false, text: 'Dafür ist es zu früh.' };
  if (tribut > 0) {
    from.gold -= tribut;
    to.gold += tribut;
  }
  return {
    ok: true,
    text: `Zwischen dir und ${angebot.ruler} ist Friede${
      tribut > 0 ? ` – und ${tribut} Gold in deiner Truhe` : ''}.`,
  };
}

// Oder er schlägt ihn aus. Das merkt sich der andere.
export function rejectOffer(state, fromId, toId) {
  const angebot = offerFrom(state, fromId, toId);
  if (!angebot) return { ok: false };
  state.peaceOffers = pendingOffers(state).filter((o) => o !== angebot);
  adjustOpinion(state, toId, fromId, -8);
  applyCooldown(state, fromId, toId, 'abgelehnt');
  return { ok: true, text: `Du schickst ${angebot.ruler} ohne Antwort nach Hause.` };
}

// Was abgelaufen ist, reist ab.
export function expireOffers(state) {
  const offers = state.peaceOffers || [];
  const geblieben = offers.filter((o) => o.laeuftAb > state.turn
    && atWar(state, o.von, o.gegen));
  state.peaceOffers = geblieben;
}

// --- Was die Herrscher von sich aus tun ------------------------------------
// Einmal je Runde sieht jeder Herrscher seine Nachbarn durch. Der Friede ist
// der Normalfall; wer ihn bricht, tut es aus seinem Charakter heraus und weil
// er eine Gelegenheit sieht. Drei Dinge entscheiden:
//
//   Angriffslust - wie sehr es ihn überhaupt zum Krieg zieht
//   Ehre         - wie schwer ihm der Bruch eines Friedens fällt
//   Gelegenheit  - wie schwach der andere gerade dasteht
//
// Ein Segimer (Angriffslust 88, Ehre 38) findet fast immer einen Grund, ein
// Orontes (34/76) so gut wie nie.

// Wie weit zwei Fraktionen auseinanderliegen dürfen, damit sie einander
// überhaupt etwas angehen.
const NEIGHBOUR_RANGE = 16;
// Grundwahrscheinlichkeit einer Kriegserklärung je Runde und Nachbarpaar,
// bevor der Charakter sie hebt oder senkt.
const WAR_BASE_CHANCE = 0.16;
// So viele Runden hält ein frisch geschlossener Friede mindestens.
const WAR_MIN_PEACE = PEACE_GRACE_TURNS;

function fieldStrengthOf(state, factionId) {
  return state.armies
    .filter((a) => a.factionId === factionId && !isFleet(a))
    .reduce((sum, a) => sum + unitTotalCount(a.units), 0);
}

// Wie nah sich zwei Fraktionen kommen.
function nearestDistance(state, a, b) {
  let best = Infinity;
  for (const cityA of state.cities) {
    if (cityA.factionId !== a) continue;
    for (const cityB of state.cities) {
      if (cityB.factionId !== b) continue;
      const d = Math.abs(cityA.col - cityB.col) + Math.abs(cityA.row - cityB.row);
      if (d < best) best = d;
    }
  }
  return best;
}

// Wie sehr es diesen Herrscher gerade nach einem Krieg mit jenem verlangt -
// eine Zahl zwischen 0 und ungefähr 1, und der Satz dazu, den ein Gesandter
// später im Protokoll liest.
export function warAppetite(state, fromId, toId, opts = {}) {
  const relation = relationOf(state, fromId, toId);
  if (!relation || relation.state === 'krieg') return { wert: 0, grund: null };
  // Wer durch Pakt oder Bündnis gebunden ist, plant keinen Feldzug - es sei
  // denn, es wird gerade gefragt, ob er sein Wort brechen will.
  if (!opts.ignoreTreaty && warBound(state, fromId, toId)) return { wert: 0, grund: null };
  const ruler = rulerOf(state, fromId);
  const distance = nearestDistance(state, fromId, toId);
  if (distance > NEIGHBOUR_RANGE) return { wert: 0, grund: null };

  const lust = ruler.angriffslust / 100;
  // Ein gegebenes Wort wiegt - aber nicht bei jedem gleich schwer.
  const wort = 1 - (ruler.ehre / 100) * 0.7;
  // Die Gelegenheit: wer schwächer ist und nah dran, lockt.
  const meine = Math.max(1, fieldStrengthOf(state, fromId));
  const seine = Math.max(1, fieldStrengthOf(state, toId));
  const uebermacht = Math.max(0.35, Math.min(2.2, meine / seine));
  const naehe = distance <= 6 ? 1.35 : distance <= 10 ? 1 : 0.6;
  const stimmung = 1 - (relation.opinion / 100) * 0.8;

  const wert = lust * wort * uebermacht * naehe * stimmung;
  const grund = uebermacht > 1.4 ? 'er hält sich für den Stärkeren'
    : relation.opinion < 35 ? 'zwischen euch steht zu viel'
      : ruler.angriffslust >= 75 ? 'ein Sommer ohne Feldzug ist ihm ein verlorener Sommer'
        : distance <= 6 ? 'ihr sitzt einander zu nah'
          : 'er sieht seine Gelegenheit';
  return { wert, grund, distance, uebermacht };
}

// Eine Meldung für das Nachrichtenfenster. Sie steht im Spielstand, damit der
// Undo-Stapel sie mitnimmt und nichts doppelt gemeldet wird.
function pushNews(state, eintrag) {
  const news = state.diploNews || (state.diploNews = []);
  news.push({ turn: state.turn, ...eintrag });
  if (news.length > 40) news.splice(0, news.length - 40);
}

export function takeDiploNews(state) {
  const news = state.diploNews || [];
  state.diploNews = [];
  return news;
}

// Wie oft ein gebundener Herrscher sein Wort wieder aufkündigt, wenn ihn die
// Gelegenheit lockt - je nach Angriffslust und Ehre.
const TREATY_BREAK_CHANCE = 0.07;

// Der nächste Vertrag, der zwischen zweien möglich wäre - vom leichtesten zum
// schwersten: erst der Pakt, dann das Abkommen, dann das Bündnis.
function nextTreaty(state, a, b, rng) {
  for (const kind of TREATY_KEYS) {
    if (treatyOf(state, a, b, kind)) continue;
    if (rng() >= TREATIES[kind].chance) continue;
    const hier = treatyVerdict(state, a, b, kind);
    const dort = treatyVerdict(state, b, a, kind);
    if (!hier.possible || !dort.possible) continue;
    if (!hier.accepted || !dort.accepted) continue;
    return kind;
  }
  return null;
}

export function rulersTakeTurn(state, rng = Math.random) {
  const living = state.factions.filter((f) => !f.isNeutral && f.alive);
  for (const faction of living) updateKnowledge(state, faction.id);
  // Was seine Frist erreicht hat, endet - ehe irgendjemand darauf baut.
  expireTreaties(state);

  for (let i = 0; i < living.length; i++) {
    for (let j = i + 1; j < living.length; j++) {
      const a = living[i];
      const b = living[j];
      const relation = relationOf(state, a.id, b.id);
      if (!relation) continue;

      const distance = nearestDistance(state, a.id, b.id);
      const nachbarn = distance <= NEIGHBOUR_RANGE;
      // Die Zeit arbeitet: ein gehaltener Friede wärmt das Verhältnis, ein
      // laufender Krieg kühlt es ab - aber nur, wenn er wirklich geführt wird.
      // Ein Vertrag wärmt das Verhältnis über den Frieden hinaus - je
      // schwerer er wiegt, desto mehr.
      const vertragsDrift = treatiesOf(state, a.id, b.id)
        .reduce((sum, def) => sum + def.drift, 0);
      const drift = relation.state === 'frieden' ? OPINION_PEACE_TURN + vertragsDrift
        : nachbarn ? OPINION_WAR_TURN : 0;
      relation.opinion = Math.max(OPINION_MIN, Math.min(OPINION_MAX, relation.opinion + drift));

      if (relation.state === 'frieden') {
        // Zwei Herrscher, die einander schätzen, setzen es aufs Pergament.
        // Über die eigenen Verträge entscheidet der Spieler selbst.
        if (!a.isPlayer && !b.isPlayer && nachbarn) {
          const kind = nextTreaty(state, a.id, b.id, rng);
          if (kind && signTreaty(state, a.id, b.id, kind).ok) {
            const def = TREATIES[kind];
            pushNews(state, {
              kind: 'vertrag', von: a.id, gegen: b.id,
              icon: def.icon,
              kindLabel: `${vertragNom(def, true)} · ${b.name}`,
              titel: `${a.name} und ${b.name} schließen ${vertragAkk(def)}`,
              satz: `Die Gesandten haben sich geeinigt: zwischen ${a.name} und `
                + `${b.name} gilt von dieser Runde an ${vertragNom(def)}.`,
              folge: def.versprechen,
            });
            continue;
          }
        }
        // Wer den Krieg will und durch sein Wort gebunden ist, kündigt erst
        // auf. Ein Bündnis wiegt dabei schwerer als ein Pakt: es zu brechen
        // kostet das Ansehen bei allen, die davon hören.
        const bindung = warBound(state, a.id, b.id);
        if (bindung && nachbarn) {
          for (const [wer, wen] of [[a, b], [b, a]]) {
            if (wer.isPlayer || wen.isPlayer) continue;
            const ruler = rulerOf(state, wer.id);
            const wortbruch = (ruler.angriffslust / 100) * (1 - ruler.ehre / 100);
            const { wert } = warAppetite(state, wer.id, wen.id, { ignoreTreaty: true });
            const chance = TREATY_BREAK_CHANCE * wortbruch * Math.min(1.5, wert)
              * (bindung.key === 'buendnis' ? 0.35 : 1);
            if (rng() >= chance) continue;
            if (!cancelTreaty(state, wer.id, wen.id, bindung.key).ok) continue;
            pushNews(state, {
              kind: 'vertragsbruch', von: wer.id, gegen: wen.id,
              icon: '✋',
              kindLabel: `Ein gebrochenes Wort · ${wer.name}`,
              titel: `${wer.name} kündigt ${vertragDenAkk(bindung)} mit ${wen.name} auf`,
              satz: `${ruler.name}, ${ruler.titel}, lässt das Pergament zurückschicken: `
                + `zwischen ${wer.name} und ${wen.name} gilt ${vertragDer(bindung, false)} nicht mehr.`,
              folge: 'Ein aufgekündigtes Wort ist noch kein Krieg – aber es geht ihm '
                + 'meist voraus.',
            });
            break;
          }
          continue;
        }
        if (state.turn - relation.since < WAR_MIN_PEACE) continue;
        if (!nachbarn) continue;
        // Beide Seiten prüfen für sich, ob sie zum Schwert greifen. Der
        // Spieler nicht: über seinen Frieden entscheidet nur er.
        for (const [wer, wen] of [[a, b], [b, a]]) {
          if (wer.isPlayer) continue;
          // Niemand erklärt einem Reich den Krieg, von dem er nur gehört hat.
          if (!knowsFaction(state, wer.id, wen.id)) continue;
          const { wert, grund } = warAppetite(state, wer.id, wen.id);
          if (wert <= 0 || rng() >= WAR_BASE_CHANCE * wert) continue;
          const ruler = rulerOf(state, wer.id);
          if (!declareWar(state, wer.id, wen.id, grund).ok) continue;
          pushNews(state, {
            kind: 'krieg', von: wer.id, gegen: wen.id,
            ruler: ruler.name, titel: ruler.titel, grund,
          });
          break;
        }
        continue;
      }

      const rulerA = rulerOf(state, a.id);
      const rulerB = rulerOf(state, b.id);
      // Kriegsmüdigkeit: je länger er dauert, desto eher hören beide auf.
      const dauer = Math.min(2.5, (state.turn - relation.since) / 12);
      const willeA = (100 - rulerA.angriffslust) / 100;
      const willeB = (100 - rulerB.angriffslust) / 100;
      const stimmung = 0.4 + (relation.opinion / 100);
      const ferne = !nachbarn && state.turn - relation.since > 4;

      // Im Krieg mit dem Spieler: über seinen Frieden entscheidet nur er.
      // Aber ein müder Herrscher schickt einen Gesandten - und der wartet im
      // Diplomatiefenster auf eine Antwort.
      if (a.isPlayer || b.isPlayer) {
        const gegner = a.isPlayer ? b : a;
        const spieler = a.isPlayer ? a : b;
        const wille = (100 - rulerOf(state, gegner.id).angriffslust) / 100;
        const chance = 0.06 * wille * stimmung * (1 + dauer);
        if (state.turn - relation.since >= 8 && rng() < chance) {
          offerPeaceToPlayer(state, gegner.id, spieler.id);
        }
        continue;
      }
      const chance = 0.05 * willeA * willeB * stimmung * (1 + dauer);
      if (ferne ? rng() < 0.09 : (state.turn - relation.since >= 8 && rng() < chance)) {
        const grund = ferne ? 'der Krieg war nur noch ein Wort' : 'beide Seiten haben genug';
        if (!makePeace(state, a.id, b.id, grund).ok) continue;
        pushNews(state, {
          kind: 'frieden', von: a.id, gegen: b.id,
          ruler: rulerA.name, titel: rulerA.titel, grund,
        });
      }
    }
  }
}

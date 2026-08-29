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
  relation.state = 'frieden';
  relation.since = state.turn;
  adjustOpinion(state, a, b, 10);
  const nameA = factionById(state, a).name;
  const nameB = factionById(state, b).name;
  logMsg(state, `Friede zwischen ${nameA} und ${nameB}${note ? ` – ${note}` : ''}.`, null, [a, b]);
  return { ok: true };
}

export function declareWar(state, a, b, note) {
  const relation = relationOf(state, a, b);
  if (!relation || relation.state === 'krieg') return { ok: false };
  relation.state = 'krieg';
  relation.since = state.turn;
  adjustOpinion(state, a, b, OPINION_WAR_DECLARED);
  const nameA = factionById(state, a).name;
  const nameB = factionById(state, b).name;
  logMsg(state, `${nameA} erklärt ${nameB} den Krieg${note ? ` – ${note}` : ''}.`, null, [a, b]);
  return { ok: true };
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
    // Ein abgelehntes Angebot ist nicht umsonst: es zeigt guten Willen.
    adjustOpinion(state, fromId, toId, 3);
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

export function sendGift(state, fromId, toId, amount = GIFT_COST) {
  const from = factionById(state, fromId);
  const to = factionById(state, toId);
  if (!from || !to || from.isNeutral || to.isNeutral) return { ok: false };
  if (from.gold < amount) return { ok: false, reason: 'gold', text: 'Dafür fehlt das Gold.' };
  from.gold -= amount;
  to.gold += amount;
  adjustOpinion(state, fromId, toId, OPINION_PER_GIFT);
  const ruler = rulerOf(state, toId);
  logMsg(state, `${from.name} sendet ${ruler.name} ein Geschenk von ${amount} Gold.`,
    null, [fromId, toId]);
  return { ok: true, text: `${ruler.name} nimmt das Geschenk entgegen.` };
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
export function warAppetite(state, fromId, toId) {
  const relation = relationOf(state, fromId, toId);
  if (!relation || relation.state === 'krieg') return { wert: 0, grund: null };
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

export function rulersTakeTurn(state, rng = Math.random) {
  const living = state.factions.filter((f) => !f.isNeutral && f.alive);
  for (const faction of living) updateKnowledge(state, faction.id);

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
      const drift = relation.state === 'frieden' ? OPINION_PEACE_TURN
        : nachbarn ? OPINION_WAR_TURN : 0;
      relation.opinion = Math.max(OPINION_MIN, Math.min(OPINION_MAX, relation.opinion + drift));

      if (relation.state === 'frieden') {
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
          declareWar(state, wer.id, wen.id, grund);
          pushNews(state, {
            kind: 'krieg', von: wer.id, gegen: wen.id,
            ruler: ruler.name, titel: ruler.titel, grund,
          });
          break;
        }
        continue;
      }

      // Im Krieg: über den Frieden des Spielers entscheidet nur er selbst.
      if (a.isPlayer || b.isPlayer) continue;
      const rulerA = rulerOf(state, a.id);
      const rulerB = rulerOf(state, b.id);
      // Kriegsmüdigkeit: je länger er dauert, desto eher hören beide auf.
      const dauer = Math.min(2.5, (state.turn - relation.since) / 12);
      const willeA = (100 - rulerA.angriffslust) / 100;
      const willeB = (100 - rulerB.angriffslust) / 100;
      const stimmung = 0.4 + (relation.opinion / 100);
      const chance = 0.05 * willeA * willeB * stimmung * (1 + dauer);
      const ferne = !nachbarn && state.turn - relation.since > 4;
      if (ferne ? rng() < 0.09 : (state.turn - relation.since >= 8 && rng() < chance)) {
        makePeace(state, a.id, b.id,
          ferne ? 'der Krieg war nur noch ein Wort' : 'beide Seiten haben genug');
        pushNews(state, {
          kind: 'frieden', von: a.id, gegen: b.id,
          ruler: rulerA.name, titel: rulerA.titel,
          grund: ferne ? 'der Krieg war nur noch ein Wort' : 'beide Seiten haben genug',
        });
      }
    }
  }
}

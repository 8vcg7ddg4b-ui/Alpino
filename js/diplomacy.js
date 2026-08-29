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

import { logMsg, factionById, unitTotalCount } from './state.js';
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
export function initRelations(factions) {
  const relations = {};
  const ids = factions.filter((f) => !f.isNeutral).map((f) => f.id);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      relations[pairKey(ids[i], ids[j])] = {
        state: 'krieg', opinion: OPINION_START, since: 1,
      };
    }
  }
  return relations;
}

// Die Unabhängigen und alles, was noch keinen Eintrag hat, stehen im Krieg:
// mit einer Miliz verhandelt niemand.
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
// Einmal je Runde sieht jeder Herrscher seine Nachbarn durch: ob er einen
// Frieden aufkündigt, den er nicht mehr braucht, und ob er einem Krieg ein
// Ende macht, der ihm nichts mehr bringt.

// Wie nah sich zwei Fraktionen überhaupt kommen. Wer keinen Ort in der Nähe
// hat, hat auch keinen Grund, den Krieg zu erklären.
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

const NEIGHBOUR_RANGE = 16;

export function rulersTakeTurn(state, rng = Math.random) {
  const living = state.factions.filter((f) => !f.isNeutral && f.alive);
  for (let i = 0; i < living.length; i++) {
    for (let j = i + 1; j < living.length; j++) {
      const a = living[i];
      const b = living[j];
      const relation = relationOf(state, a.id, b.id);
      if (!relation) continue;

      const distance = nearestDistance(state, a.id, b.id);
      const nachbarn = distance <= NEIGHBOUR_RANGE;
      // Die Zeit arbeitet: ein gehaltener Frieden wärmt das Verhältnis, ein
      // laufender Krieg kühlt es ab - aber nur, wenn er wirklich geführt wird.
      // Ein Krieg über den halben Erdkreis hinweg macht keine Feindschaft.
      const drift = relation.state === 'frieden' ? OPINION_PEACE_TURN
        : nachbarn ? OPINION_WAR_TURN : 0;
      relation.opinion = Math.max(OPINION_MIN, Math.min(OPINION_MAX, relation.opinion + drift));
      if (relation.state === 'frieden') {
        if (state.turn - relation.since < PEACE_GRACE_TURNS) continue;
        if (distance > NEIGHBOUR_RANGE) continue;
        // Wer den Frieden bricht, tut es aus Angriffslust - und wer sein Wort
        // hält, tut es fast nie. Der Spieler wird nicht bevorzugt: für ihn
        // gilt dieselbe Rechnung.
        for (const [wer, wen] of [[a, b], [b, a]]) {
          if (wer.isPlayer) continue;
          const ruler = rulerOf(state, wer.id);
          const lust = (ruler.angriffslust / 100) * (1 - ruler.ehre / 100);
          const abneigung = (60 - relation.opinion) / 100;
          // Vor der eigenen Haustür wiegt die Gelegenheit schwerer als das
          // Wort: wer eng beieinander sitzt, greift eher wieder zum Schwert.
          const naehe = distance <= 8 ? 3 : 1;
          const chance = 0.05 * naehe * lust * Math.max(0.2, 1 + abneigung);
          if (rng() < chance) {
            declareWar(state, wer.id, wen.id, `${ruler.name} sieht seine Stunde gekommen`);
            break;
          }
        }
        continue;
      }

      // Im Krieg: zwei Herrscher, die beide nicht mehr wollen, hören auf.
      // Über den Frieden des Spielers entscheidet niemand außer ihm selbst:
      // er ist der Herrscher, nicht der Zuschauer. Ein fremder Herrscher kann
      // ihm den Krieg erklären - beenden kann ihn nur er.
      if (a.isPlayer || b.isPlayer) continue;
      if (distance > NEIGHBOUR_RANGE && state.turn - relation.since > 4) {
        // Ein Krieg über den halben Erdkreis hinweg findet gar nicht statt -
        // er läuft aus, sobald beide Seiten ihn vergessen haben und einander
        // nichts vorzuwerfen haben.
        if (relation.opinion >= 35 && rng() < 0.09) {
          makePeace(state, a.id, b.id, 'der Krieg war nur noch ein Wort');
        }
        continue;
      }
      const rulerA = rulerOf(state, a.id);
      const rulerB = rulerOf(state, b.id);
      const willeA = (100 - rulerA.angriffslust) / 100;
      const willeB = (100 - rulerB.angriffslust) / 100;
      const stimmung = relation.opinion / 100;
      const chance = 0.05 * willeA * willeB * (0.4 + stimmung);
      if (state.turn - relation.since >= 8 && rng() < chance) {
        makePeace(state, a.id, b.id, 'beide Seiten haben genug');
      }
    }
  }
}

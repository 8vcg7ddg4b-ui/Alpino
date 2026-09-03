// --- Diplomatie -----------------------------------------------------------
// Zwischen den Flaggen läuft ein zweiter Feldzug: Beziehungen, Verträge,
// Geschenke, Kriegserklärungen. Er wird in Zahlen geführt (-100 bis +100)
// und in Nachrichten erzählt.
import { FACTIONS, factionProfile } from './data.js';
import { rulerFor, rulerTraitSum } from './pilots.js';

export const GIFT_COST = 400;
export const TREATY_TYPES = {
  nichtangriff: { id: 'nichtangriff', name: 'Nichtangriffspakt', need: 15, desc: 'Keine Flotte überschreitet die Grenze des anderen.' },
  handel: { id: 'handel', name: 'Handelsabkommen', need: 30, desc: 'Handelsrouten in beide Reiche, Kredits für beide.' },
  buendnis: { id: 'buendnis', name: 'Bündnis', need: 60, desc: 'Wer den einen angreift, hat den anderen gegen sich.' },
};

function key(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function initRelations(state) {
  const dip = {
    relations: {},
    treaties: {},
    wars: {},
    offers: [],
    news: [],
    knowledge: {},
    warTurn: {},
  };
  const ids = FACTIONS.filter((f) => !f.isNeutral).map((f) => f.id);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      dip.relations[key(a, b)] = startingRelation(a, b);
    }
  }
  // Der Krieg von 2654 läuft schon: Konföderation und Imperium liegen im
  // Feld, ehe der Spieler den ersten Zug macht. Alles andere ist offen.
  dip.wars[key('confed', 'kilrathi')] = true;
  dip.warTurn[key('confed', 'kilrathi')] = 1;
  dip.wars[key('kilrathi', 'firekka')] = true;
  dip.warTurn[key('kilrathi', 'firekka')] = 1;
  dip.wars[key('kilrathi', 'landreich')] = true;
  dip.warTurn[key('kilrathi', 'landreich')] = 1;
  dip.treaties[key('confed', 'firekka')] = { type: 'handel', since: 1 };
  state.diplomacy = dip;
  return dip;
}

function startingRelation(a, b) {
  const pairs = {
    'confed|kilrathi': -85,
    'confed|firekka': 45,
    'confed|borderworlds': 20,
    'confed|landreich': -10,
    'kilrathi|firekka': -70,
    'kilrathi|landreich': -60,
    'kilrathi|borderworlds': -40,
    'borderworlds|landreich': 25,
    'borderworlds|firekka': 10,
    'firekka|landreich': 5,
    'confed|nephilim': -100,
    'kilrathi|nephilim': -100,
    'borderworlds|nephilim': -100,
    'landreich|nephilim': -100,
    'firekka|nephilim': -100,
  };
  return pairs[key(a, b)] ?? 0;
}

export function relationOf(state, a, b) {
  if (a === b) return 100;
  return state.diplomacy.relations[key(a, b)] ?? 0;
}

export function adjustRelation(state, a, b, delta) {
  if (a === b || a === 'neutral' || b === 'neutral') return;
  const k = key(a, b);
  const cur = state.diplomacy.relations[k] ?? 0;
  state.diplomacy.relations[k] = Math.max(-100, Math.min(100, cur + delta));
}

export function relationLabel(value) {
  if (value >= 70) return 'verbündet';
  if (value >= 35) return 'freundlich';
  if (value >= 10) return 'wohlwollend';
  if (value > -10) return 'gleichgültig';
  if (value > -35) return 'kühl';
  if (value > -70) return 'feindlich';
  return 'verhasst';
}

export function atWar(state, a, b) {
  if (!state || !state.diplomacy) return false;
  if (a === b) return false;
  if (a === 'neutral' || b === 'neutral') return false;
  return !!state.diplomacy.wars[key(a, b)];
}

export function treatyOf(state, a, b) {
  return state.diplomacy.treaties[key(a, b)] || null;
}

export function alliedWith(state, a, b) {
  const t = treatyOf(state, a, b);
  return !!t && t.type === 'buendnis';
}

export function declareWar(state, a, b, reason = '') {
  if (a === b || atWar(state, a, b)) return false;
  const k = key(a, b);
  state.diplomacy.wars[k] = true;
  state.diplomacy.warTurn[k] = state.turn || 1;
  delete state.diplomacy.treaties[k];
  adjustRelation(state, a, b, -55);
  pushNews(state, {
    kind: 'krieg', a, b,
    text: `${factionProfile(a).name} erklärt ${factionProfile(b).name} den Krieg.`
      + (reason ? ` (${reason})` : ''),
  });
  // Bündnispartner ziehen mit: das ist der Sinn eines Bündnisses.
  for (const f of FACTIONS) {
    if (f.isNeutral || f.id === a || f.id === b) continue;
    if (alliedWith(state, f.id, b) && !atWar(state, f.id, a)) {
      state.diplomacy.wars[key(f.id, a)] = true;
      state.diplomacy.warTurn[key(f.id, a)] = state.turn || 1;
      pushNews(state, {
        kind: 'krieg', a: f.id, b: a,
        text: `${factionProfile(f.id).name} steht zu ${factionProfile(b).name} `
          + `und tritt in den Krieg gegen ${factionProfile(a).name} ein.`,
      });
    }
  }
  return true;
}

export function makePeace(state, a, b) {
  const k = key(a, b);
  if (!state.diplomacy.wars[k]) return false;
  delete state.diplomacy.wars[k];
  delete state.diplomacy.warTurn[k];
  adjustRelation(state, a, b, 25);
  pushNews(state, {
    kind: 'frieden', a, b,
    text: `${factionProfile(a).name} und ${factionProfile(b).name} schließen Frieden.`,
  });
  return true;
}

// Ob ein Friedensangebot angenommen wird, hängt an drei Dingen: wie lange
// der Krieg läuft, wie es an der Front steht, und wer da regiert.
export function peaceChance(state, from, to) {
  const rel = relationOf(state, from, to);
  const k = key(from, to);
  const years = ((state.turn || 1) - (state.diplomacy.warTurn[k] || 1)) / 12;
  const ruler = rulerFor(to);
  const aggression = rulerTraitSum(ruler, 'aggression');
  const scoreFrom = powerOf(state, from);
  const scoreTo = powerOf(state, to);
  const losing = scoreTo < scoreFrom * 0.7 ? 0.25 : 0;
  const winning = scoreTo > scoreFrom * 1.4 ? -0.3 : 0;
  let p = 0.1 + rel / 200 + years * 0.08 + losing + winning - aggression * 0.5;
  if (to === 'kilrathi' && from === 'confed') p -= 0.25;
  if (to === 'nephilim') return 0;
  return Math.max(0, Math.min(0.92, p));
}

function powerOf(state, factionId) {
  const systems = state.systems.filter((s) => s.factionId === factionId).length;
  const fleets = state.fleets.filter((f) => f.factionId === factionId).length;
  return systems * 2 + fleets;
}

export function offerPeace(state, from, to, rnd = Math.random) {
  if (!atWar(state, from, to)) return { ok: false, text: 'Ihr liegt nicht im Krieg.' };
  const chance = peaceChance(state, from, to);
  if (rnd() < chance) {
    makePeace(state, from, to);
    return { ok: true, text: `${factionProfile(to).name} nimmt den Frieden an.` };
  }
  adjustRelation(state, from, to, -5);
  return { ok: false, text: `${factionProfile(to).name} lehnt ab. Der Krieg geht weiter.` };
}

export function sendGift(state, from, to, amount = GIFT_COST) {
  const giver = state.factions.find((f) => f.id === from);
  if (!giver || giver.credits < amount) return { ok: false, text: 'Nicht genug Kredits.' };
  giver.credits -= amount;
  const ruler = rulerFor(from);
  const bonus = 1 + rulerTraitSum(ruler, 'diplomacy');
  const gain = Math.round((amount / 40) * bonus);
  adjustRelation(state, from, to, gain);
  pushNews(state, {
    kind: 'geschenk', a: from, b: to,
    text: `${factionProfile(from).name} schickt ${amount} Kredits an `
      + `${factionProfile(to).name}. (+${gain} Ansehen)`,
  });
  return { ok: true, text: `Das Geschenk ist unterwegs. Ansehen +${gain}.` };
}

export function proposeTreaty(state, from, to, type, rnd = Math.random) {
  const def = TREATY_TYPES[type];
  if (!def) return { ok: false, text: 'Diesen Vertrag gibt es nicht.' };
  if (atWar(state, from, to)) {
    return { ok: false, text: 'Erst Frieden, dann Verträge.' };
  }
  const rel = relationOf(state, from, to);
  const ruler = rulerFor(to);
  const honour = rulerTraitSum(ruler, 'honour');
  const chance = Math.max(0, Math.min(0.95, (rel - def.need) / 60 + 0.35 + honour * 0.3));
  if (rnd() < chance) {
    state.diplomacy.treaties[key(from, to)] = { type, since: state.turn || 1 };
    adjustRelation(state, from, to, 10);
    pushNews(state, {
      kind: 'vertrag', a: from, b: to,
      text: `${factionProfile(from).name} und ${factionProfile(to).name} `
        + `unterzeichnen einen ${def.name}.`,
    });
    return { ok: true, text: `${def.name} geschlossen.` };
  }
  adjustRelation(state, from, to, -3);
  return { ok: false, text: `${factionProfile(to).name} sieht dafür keinen Anlass.` };
}

export function renounceTreaty(state, from, to) {
  const k = key(from, to);
  const t = state.diplomacy.treaties[k];
  if (!t) return { ok: false, text: 'Da ist kein Vertrag.' };
  delete state.diplomacy.treaties[k];
  adjustRelation(state, from, to, -20);
  pushNews(state, {
    kind: 'vertrag', a: from, b: to,
    text: `${factionProfile(from).name} kündigt den ${TREATY_TYPES[t.type].name} `
      + `mit ${factionProfile(to).name}.`,
  });
  return { ok: true, text: 'Der Vertrag ist gekündigt. Das kostet Ansehen.' };
}

// --- Wissen ---------------------------------------------------------------
// Man verhandelt nur mit dem, den man kennt. Kennen heißt: eine eigene
// Flotte oder ein eigenes System hat den anderen gesehen.
export function seedKnowledge(state) {
  for (const f of state.factions) {
    state.diplomacy.knowledge[f.id] = {};
    state.diplomacy.knowledge[f.id][f.id] = true;
  }
  // Wer im Krieg liegt, kennt sich.
  for (const k of Object.keys(state.diplomacy.wars)) {
    const [a, b] = k.split('|');
    state.diplomacy.knowledge[a][b] = true;
    state.diplomacy.knowledge[b][a] = true;
  }
  for (const k of Object.keys(state.diplomacy.treaties)) {
    const [a, b] = k.split('|');
    state.diplomacy.knowledge[a][b] = true;
    state.diplomacy.knowledge[b][a] = true;
  }
}

export function knowsFaction(state, a, b) {
  if (a === b) return true;
  const kn = state.diplomacy.knowledge[a];
  return !!(kn && kn[b]);
}

export function learnFaction(state, a, b) {
  if (a === b) return;
  if (!state.diplomacy.knowledge[a]) state.diplomacy.knowledge[a] = {};
  if (state.diplomacy.knowledge[a][b]) return;
  state.diplomacy.knowledge[a][b] = true;
  if (a === state.playerFactionId) {
    pushNews(state, {
      kind: 'kontakt', a, b,
      text: `Erster Kontakt mit ${factionProfile(b).name}.`,
    });
  }
}

// Nach jedem Zug: wer wen gesehen hat. Reichweite ist die Sensorreichweite
// der eigenen Flotten und Systeme.
export function updateKnowledge(state, visibleFactionIds) {
  const me = state.playerFactionId;
  for (const id of visibleFactionIds) learnFaction(state, me, id);
}

// --- Angebote der anderen ------------------------------------------------
export function pushOffer(state, offer) {
  state.diplomacy.offers.push({ id: `offer_${state.diplomacy.offers.length + 1}_${state.turn}`, turn: state.turn, ...offer });
}

export function acceptOffer(state, offerId) {
  const idx = state.diplomacy.offers.findIndex((o) => o.id === offerId);
  if (idx < 0) return { ok: false, text: 'Das Angebot ist verfallen.' };
  const offer = state.diplomacy.offers[idx];
  state.diplomacy.offers.splice(idx, 1);
  if (offer.kind === 'frieden') {
    makePeace(state, offer.from, state.playerFactionId);
    return { ok: true, text: `Frieden mit ${factionProfile(offer.from).name}.` };
  }
  if (offer.kind === 'vertrag') {
    state.diplomacy.treaties[key(offer.from, state.playerFactionId)] = { type: offer.treaty, since: state.turn };
    adjustRelation(state, offer.from, state.playerFactionId, 12);
    return { ok: true, text: `${TREATY_TYPES[offer.treaty].name} mit ${factionProfile(offer.from).name}.` };
  }
  if (offer.kind === 'geschenk') {
    const me = state.factions.find((f) => f.id === state.playerFactionId);
    me.credits += offer.amount;
    adjustRelation(state, offer.from, state.playerFactionId, 6);
    return { ok: true, text: `${offer.amount} Kredits von ${factionProfile(offer.from).name}.` };
  }
  return { ok: false, text: 'Unklar, was da angeboten wurde.' };
}

export function rejectOffer(state, offerId) {
  const idx = state.diplomacy.offers.findIndex((o) => o.id === offerId);
  if (idx < 0) return { ok: false, text: 'Das Angebot ist verfallen.' };
  const offer = state.diplomacy.offers[idx];
  state.diplomacy.offers.splice(idx, 1);
  adjustRelation(state, offer.from, state.playerFactionId, -6);
  return { ok: true, text: 'Abgelehnt.' };
}

export function expireOffers(state) {
  state.diplomacy.offers = state.diplomacy.offers.filter((o) => state.turn - o.turn < 4);
}

// --- Was die anderen Höfe tun -------------------------------------------
// Einmal je Zug: Kriegserklärungen, Friedensfühler, Verträge, Geschenke.
// Die Höfe handeln nach Beziehung, Macht und dem Charakter ihres Herrschers.
export function rulersTakeTurn(state, rnd = Math.random) {
  const ids = state.factions.filter((f) => !f.isNeutral && f.alive && !f.isPlayer && f.id !== 'nephilim').map((f) => f.id);
  const player = state.playerFactionId;
  for (const id of ids) {
    const ruler = rulerFor(id);
    const aggression = 0.5 + rulerTraitSum(ruler, 'aggression');
    const honour = rulerTraitSum(ruler, 'honour');
    for (const other of state.factions.filter((f) => !f.isNeutral && f.alive && f.id !== id).map((f) => f.id)) {
      if (!knowsFaction(state, id, other)) continue;
      const rel = relationOf(state, id, other);
      const war = atWar(state, id, other);
      const treaty = treatyOf(state, id, other);
      if (!war) {
        // Krieg erklären: nur bei schlechtem Verhältnis, ohne Vertrag - es
        // sei denn, der Herrscher ist hinterhältig.
        const blocked = treaty && honour >= 0;
        const wants = rel < -45 && powerOf(state, id) > powerOf(state, other) * 0.85;
        if (!blocked && wants && rnd() < 0.1 * aggression) {
          declareWar(state, id, other, 'alte Rechnung');
          continue;
        }
        if (rel > 25 && !treaty && rnd() < 0.12) {
          const type = rel > 65 ? 'buendnis' : rel > 40 ? 'handel' : 'nichtangriff';
          if (other === player) {
            pushOffer(state, { kind: 'vertrag', from: id, treaty: type });
          } else {
            proposeTreaty(state, id, other, type, rnd);
          }
        }
      } else if (rnd() < 0.12 && peaceChance(state, id, other) > 0.4) {
        if (other === player) {
          pushOffer(state, { kind: 'frieden', from: id });
        } else {
          offerPeace(state, id, other, rnd);
        }
      }
    }
    // Ein Hof, der den Spieler mag und Geld hat, schickt auch mal etwas.
    if (knowsFaction(state, id, player) && relationOf(state, id, player) > 40 && rnd() < 0.05) {
      pushOffer(state, { kind: 'geschenk', from: id, amount: 300 });
    }
  }
  driftRelations(state);
}

// Beziehungen kriechen mit den Jahren zur Mitte: Hass kühlt ab, Freundschaft
// wird lau. Krieg zieht sie nach unten.
function driftRelations(state) {
  for (const k of Object.keys(state.diplomacy.relations)) {
    const [a, b] = k.split('|');
    const v = state.diplomacy.relations[k];
    let next = v;
    if (atWar(state, a, b)) next -= 1.5;
    else next += v > 0 ? -0.4 : 0.6;
    if (treatyOf(state, a, b)) next += 0.8;
    state.diplomacy.relations[k] = Math.max(-100, Math.min(100, Math.round(next * 10) / 10));
  }
}

export function pushNews(state, news) {
  state.diplomacy.news.push({ turn: state.turn || 1, ...news });
  if (state.diplomacy.news.length > 200) state.diplomacy.news.shift();
}

// Die neuen Nachrichten seit dem letzten Abholen - für die Meldungen am
// Rand des Bildschirms.
export function takeDiploNews(state) {
  const out = state.diplomacy.news.filter((n) => !n.seen);
  for (const n of out) n.seen = true;
  return out;
}

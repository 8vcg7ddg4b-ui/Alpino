// --- Wer befiehlt, und wer fliegt ----------------------------------------
// Jede Fraktion hat einen Oberkommandierenden - der Spieler ist nicht der
// Zuschauer einer Flagge, sondern dieser eine Mensch (oder Kilrathi). Und
// jede Flotte kann ein Ass tragen: einen Namen, der im Funk steht und im
// Gefecht zählt.
import { pick, rollInt } from './prng.js';

export const TRAITS = {
  angriffslustig: { id: 'angriffslustig', name: 'Angriffslustig', desc: 'Sucht das Gefecht, auch gegen die Zahlen.', ai: { aggression: 0.25 } },
  vorsichtig: { id: 'vorsichtig', name: 'Vorsichtig', desc: 'Greift nur mit Überzahl an, baut lieber Schilde.', ai: { aggression: -0.2, build: 0.2 } },
  ehrenhaft: { id: 'ehrenhaft', name: 'Ehrenhaft', desc: 'Hält Verträge, auch wenn es teuer wird.', ai: { honour: 0.3 } },
  hinterhaeltig: { id: 'hinterhaeltig', name: 'Hinterhältig', desc: 'Bricht Waffenruhen, wenn die Lage passt.', ai: { honour: -0.35, aggression: 0.1 } },
  baumeister: { id: 'baumeister', name: 'Baumeister', desc: 'Werften und Ringe zuerst, Flotten danach.', ai: { build: 0.35 } },
  flieger: { id: 'flieger', name: 'Flieger', desc: 'War selbst im Cockpit. Jägerstaffeln kämpfen besser.', combat: { jaeger: 0.1 } },
  stratege: { id: 'stratege', name: 'Stratege', desc: 'Liest die Karte. Flotten bewegen sich weiter.', move: 1 },
  sparsam: { id: 'sparsam', name: 'Sparsam', desc: 'Der Unterhalt der Flotte fällt geringer aus.', upkeep: -0.15 },
  grausam: { id: 'grausam', name: 'Grausam', desc: 'Erobertes wirft mehr Beute ab, kostet aber Ansehen.', loot: 0.3, ai: { honour: -0.15 } },
  diplomat: { id: 'diplomat', name: 'Diplomat', desc: 'Fremde Höfe hören zu; Geschenke wirken doppelt.', diplomacy: 0.3 },
};

export function traitLabel(id) {
  const t = TRAITS[id];
  return t ? t.name : id;
}

// Die Oberkommandierenden. Namen und Titel stehen fest - man führt nicht
// irgendein Reich, sondern dieses.
const RULERS = {
  confed: {
    name: 'Geoffrey Tolwyn', title: 'Admiral der Flotte',
    seat: 'Sol, Flottenkommando', traits: ['stratege', 'ehrenhaft', 'baumeister'],
    word: 'Wir halten die Linie bei Vega, oder wir halten sie über Terra.',
  },
  kilrathi: {
    name: 'Thrakhath nar Kiranka', title: 'Kronprinz des Imperiums',
    seat: 'Kilrah, Klanhalle', traits: ['angriffslustig', 'grausam', 'flieger'],
    word: 'Die Affen zählen ihre Schiffe. Wir zählen ihre Welten.',
  },
  borderworlds: {
    name: 'Jacob Manley', title: 'Admiral der Union',
    seat: 'Tyr, Unionsrat', traits: ['flieger', 'sparsam', 'vorsichtig'],
    word: 'Uns hat niemand geschickt. Wir sind schon hier.',
  },
  landreich: {
    name: 'Max Kruger', title: 'Präsident und Großadmiral',
    seat: 'Landreich, Kruger-Hof', traits: ['angriffslustig', 'grausam', 'sparsam'],
    word: 'Die Konföderation schreibt Noten. Wir kapern Träger.',
  },
  firekka: {
    name: 'Rikik', title: 'Königin der Nester',
    seat: 'Firekka, Hochnest', traits: ['ehrenhaft', 'vorsichtig', 'diplomat'],
    word: 'Der Himmel gehört den Schwingen, nicht den Klauen.',
  },
  nephilim: {
    name: 'Der Wille des Schwarms', title: 'ohne Namen',
    seat: 'jenseits des Tores', traits: ['angriffslustig', 'hinterhaeltig', 'grausam'],
    word: '—',
  },
  neutral: {
    name: 'Handelsrat', title: 'Vorsitz auf Zeit',
    seat: 'New Detroit', traits: ['sparsam', 'diplomat'],
    word: 'Wir verkaufen an beide Seiten. Fragen Sie nicht weiter.',
  },
};

export function rulerFor(factionId) {
  const r = RULERS[factionId] || RULERS.neutral;
  return { ...r, traits: [...r.traits] };
}

export function rulerTraitSum(ruler, key) {
  if (!ruler) return 0;
  let sum = 0;
  for (const id of ruler.traits || []) {
    const t = TRAITS[id];
    if (!t) continue;
    if (key === 'move' || key === 'upkeep' || key === 'loot' || key === 'diplomacy') {
      sum += t[key] || 0;
    } else if (t.ai) {
      sum += t.ai[key] || 0;
    }
  }
  return sum;
}

// --- Die Asse -------------------------------------------------------------
// Ein Ass hängt an einer Flotte. Es macht sie besser, und wenn die Flotte
// stirbt, kann es fallen - dann steht sein Name in der Chronik und nie
// wieder auf der Karte.
const ACE_POOL = {
  terran: [
    { name: 'Christopher Blair', call: 'Maverick', bonus: 'jaeger', power: 0.18 },
    { name: 'Todd Marshall', call: 'Maniac', bonus: 'jaeger', power: 0.14, wild: true },
    { name: 'Jeanette Devereaux', call: 'Angel', bonus: 'moral', power: 0.16 },
    { name: 'Ian St. John', call: 'Hunter', bonus: 'jaeger', power: 0.15 },
    { name: 'Etienne Montclair', call: 'Doomsday', bonus: 'bomber', power: 0.17 },
    { name: 'Michael Casey', call: 'Iceman', bonus: 'panzerung', power: 0.15 },
    { name: 'James Taggart', call: 'Paladin', bonus: 'bewegung', power: 1 },
    { name: 'Mariko Tanaka', call: 'Spirit', bonus: 'bomber', power: 0.14 },
    { name: 'William Kerr', call: 'Bossman', bonus: 'panzerung', power: 0.13 },
    { name: 'Robin Peters', call: 'Flint', bonus: 'jaeger', power: 0.13 },
    { name: 'Vagabond Chang', call: 'Vagabond', bonus: 'moral', power: 0.12 },
    { name: 'Jacob Manley', call: 'Hawk', bonus: 'marines', power: 0.18 },
  ],
  kilrathi: [
    { name: 'Ralgha nar Hhallas', call: 'Hobbes', bonus: 'bewegung', power: 1 },
    { name: 'Dakhath', call: 'Todesklaue', bonus: 'jaeger', power: 0.19 },
    { name: 'Bhurak Starkiller', call: 'Sternentöter', bonus: 'bomber', power: 0.17 },
    { name: 'Khajja', call: 'Der Fang', bonus: 'jaeger', power: 0.16 },
    { name: 'Baron Jukaga nar Ki’ra', call: 'Der Stratege', bonus: 'moral', power: 0.18 },
    { name: 'Melek nar Kiranka', call: 'Die Stimme', bonus: 'panzerung', power: 0.15 },
    { name: 'Kur’utak', call: 'Blutklaue', bonus: 'marines', power: 0.2 },
    { name: 'Thrakhra', call: 'Die Sichel', bonus: 'jaeger', power: 0.14 },
  ],
  firekkan: [
    { name: 'K’Tithrik', call: 'Sturmschwinge', bonus: 'jaeger', power: 0.16 },
    { name: 'Rikik-Ka', call: 'Hochnest', bonus: 'moral', power: 0.17 },
    { name: 'Fikk’ra', call: 'Klippenwind', bonus: 'bewegung', power: 1 },
    { name: 'Threk', call: 'Rotfeder', bonus: 'bomber', power: 0.14 },
  ],
  nephilim: [
    { name: 'Erster Chor', call: 'Chor', bonus: 'jaeger', power: 0.2 },
    { name: 'Tiefer Ruf', call: 'Ruf', bonus: 'panzerung', power: 0.18 },
  ],
};

export const ACE_BONUS_LABELS = {
  jaeger: 'Jägerstaffeln +%d% Angriff',
  bomber: 'Bomberstaffeln +%d% Angriff',
  marines: 'Landungstruppen +%d% Angriff',
  moral: 'Moral steigt schneller, Verluste treffen weniger',
  panzerung: 'Panzerung +%d%',
  bewegung: 'Bewegung +1',
};

export function aceBonusText(ace) {
  if (!ace) return '';
  if (ace.bonus === 'bewegung') return 'Bewegung +1';
  if (ace.bonus === 'moral') return `Moral +${Math.round(ace.power * 100)}%`;
  const label = ACE_BONUS_LABELS[ace.bonus] || '%d%';
  return label.replace('%d', String(Math.round(ace.power * 100)));
}

// Ein neues Ass für eine Fraktion, das nicht schon fliegt oder gefallen ist.
export function drawAce(rnd, kind, usedNames) {
  const pool = (ACE_POOL[kind] || ACE_POOL.terran).filter((a) => !usedNames.has(a.name));
  if (!pool.length) return null;
  const base = pick(rnd, pool);
  return {
    ...base,
    id: `ace_${base.call.toLowerCase().replace(/[^a-z]/g, '')}_${rollInt(rnd, 100, 999)}`,
    kills: 0,
    alive: true,
  };
}

export function acePoolFor(kind) {
  return ACE_POOL[kind] || ACE_POOL.terran;
}

// Der Wert, mit dem ein Ass in die Kampfrechnung eingeht.
export function aceCombatBonus(ace, role) {
  if (!ace || !ace.alive) return 0;
  if (ace.bonus === role) return ace.power;
  if (ace.bonus === 'moral') return ace.power * 0.4;
  return 0;
}

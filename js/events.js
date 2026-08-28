// Zufallsereignisse: was zwischen den Zügen geschieht, ohne dass jemand es
// befohlen hätte. Seuchen, Missernten, Erdbeben, Söldner vor dem Tor.
//
// Jedes Ereignis prüft zuerst, ob es überhaupt passt - eine Flotte kann nur
// verlieren, wer eine hat -, und sagt danach in einem Satz, was es angerichtet
// hat. Der Spieler bekommt sein eigenes Ereignis in einem Fenster zu sehen;
// was den anderen Fraktionen zustößt, steht im Protokoll.
//
// Über alle Fraktionen hinweg halten sich Glück und Unglück ungefähr die
// Waage: es sind ebenso viele gute wie schlechte Ereignisse in der Liste, und
// jede Fraktion würfelt mit derselben Wahrscheinlichkeit.

import { WATCH_ROLE, UNIT_ROLES, MORALE_MAX, unitDef } from './data.js';
import { logMsg, unitTotalCount } from './state.js';

// Wie wahrscheinlich es ist, dass einer Fraktion in einer Runde etwas
// zustößt. Bei zwölf Fraktionen passiert damit fast jede Runde irgendwo etwas,
// die einzelne Fraktion trifft es aber nur alle zehn Runden.
export const EVENT_CHANCE = 0.1;
// Vor der zehnten Runde bleibt es ruhig: die Eröffnung soll planbar sein.
export const EVENT_FIRST_TURN = 10;

function ownCities(state, faction) {
  return state.cities.filter((c) => c.factionId === faction.id);
}

function ownArmies(state, faction) {
  return state.armies.filter((a) => a.factionId === faction.id);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function between(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function gold(faction, amount) {
  faction.gold = Math.max(0, Math.round(faction.gold + amount));
}

const EVENTS = [
  {
    id: 'seuche',
    icon: '☠️',
    title: 'Eine Seuche geht um',
    good: false,
    when: (state, faction) => ownCities(state, faction).some((c) => c.population >= 1500),
    apply(state, faction) {
      const city = pick(ownCities(state, faction).filter((c) => c.population >= 1500));
      const lost = Math.round(city.population * 0.17);
      city.population -= lost;
      const watch = city.garrison[WATCH_ROLE] || 0;
      city.garrison[WATCH_ROLE] = Math.round(watch * 0.72);
      return {
        text: `In ${city.name} bricht ein Fieber aus. Die Gassen liegen leer, die `
          + 'Toten werden vor den Mauern verbrannt.',
        effect: `${city.name}: ${lost.toLocaleString('de-DE')} Einwohner weniger, `
          + `die Stadtwache auf ${Math.round(watch * 0.72).toLocaleString('de-DE')} Mann geschrumpft.`,
      };
    },
  },
  {
    id: 'ernte',
    icon: '🌾',
    title: 'Ein Jahr voller Korn',
    good: true,
    when: (state, faction) => ownCities(state, faction).length > 0,
    apply(state, faction) {
      let grown = 0;
      for (const city of ownCities(state, faction)) {
        const plus = Math.round(city.population * 0.07);
        city.population += plus;
        grown += plus;
      }
      const purse = between(60, 140);
      gold(faction, purse);
      return {
        text: 'Der Regen kam, als er kommen musste. Die Speicher sind voll, und was '
          + 'übrig bleibt, wird verkauft.',
        effect: `${grown.toLocaleString('de-DE')} Einwohner mehr im ganzen Reich, `
          + `dazu ${purse} Gold aus dem Überschuss.`,
      };
    },
  },
  {
    id: 'duerre',
    icon: '🔥',
    title: 'Eine Dürre',
    good: false,
    when: (state, faction) => ownCities(state, faction).length > 0,
    apply(state, faction) {
      let lost = 0;
      for (const city of ownCities(state, faction)) {
        const down = Math.round(city.population * 0.05);
        city.population = Math.max(200, city.population - down);
        lost += down;
      }
      const cost = between(40, 110);
      gold(faction, -cost);
      return {
        text: 'Die Brunnen sinken, das Vieh verendet auf den Weiden. Getreide muss '
          + 'zugekauft werden, und der Preis ist der des Hungers.',
        effect: `${lost.toLocaleString('de-DE')} Einwohner weniger, ${cost} Gold für Getreide.`,
      };
    },
  },
  {
    id: 'handel',
    icon: '💰',
    title: 'Ein guter Handelszug',
    good: true,
    when: () => true,
    apply(state, faction) {
      const purse = between(120, 260);
      gold(faction, purse);
      return {
        text: 'Eine Karawane kommt durch, wo sonst keine durchkommt, und die Zölle '
          + 'fallen an deiner Grenze an.',
        effect: `${purse} Gold in den Schatz.`,
      };
    },
  },
  {
    id: 'getreideflotte',
    icon: '⚓',
    title: 'Die Getreideflotte läuft ein',
    good: true,
    when: (state, faction) => ownCities(state, faction).some((c) => c.harbour),
    apply(state, faction) {
      const port = pick(ownCities(state, faction).filter((c) => c.harbour));
      const purse = between(160, 300);
      gold(faction, purse);
      return {
        text: `Vor ${port.name} liegen die Frachter Bug an Heck. Was nicht in die `
          + 'Speicher passt, geht noch am Kai über den Tisch.',
        effect: `${purse} Gold in den Schatz.`,
      };
    },
  },
  {
    id: 'soeldner',
    icon: '🗡️',
    title: 'Söldner vor dem Tor',
    good: true,
    when: (state, faction) => ownArmies(state, faction).some((a) => !a.embarked),
    apply(state, faction) {
      const army = pick(ownArmies(state, faction).filter((a) => !a.embarked));
      const foot = between(60, 120);
      const horse = between(20, 50);
      army.units.infantry = (army.units.infantry || 0) + foot;
      army.units.cavalry = (army.units.cavalry || 0) + horse;
      return {
        text: 'Eine Schar ohne Herrn bietet ihre Dienste an. Sie fragen nicht nach '
          + 'der Sache, nur nach dem Sold - und diesmal ist er schon bezahlt.',
        effect: `${army.name}: ${foot} Mann zu Fuß und ${horse} Reiter treten ein.`,
      };
    },
  },
  {
    id: 'erdbeben',
    icon: '🌋',
    title: 'Die Erde bebt',
    good: false,
    when: (state, faction) => ownCities(state, faction).some((c) => (c.wallLevel || 0) > 0),
    apply(state, faction) {
      const city = pick(ownCities(state, faction).filter((c) => (c.wallLevel || 0) > 0));
      city.wallLevel -= 1;
      city.wallBuilding = null;
      const lost = Math.round(city.population * 0.06);
      city.population -= lost;
      return {
        text: `Ein Stoß, ein zweiter - und die Mauer von ${city.name} steht nicht mehr, `
          + 'wo sie stand.',
        effect: `Die Befestigung von ${city.name} fällt eine Stufe zurück, `
          + `${lost.toLocaleString('de-DE')} Einwohner kommen um.`,
      };
    },
  },
  {
    id: 'aufstand',
    icon: '🔥',
    title: 'Aufruhr in der Stadt',
    good: false,
    when: (state, faction) => ownCities(state, faction).some((c) => (c.garrison[WATCH_ROLE] || 0) > 40),
    apply(state, faction) {
      const city = pick(ownCities(state, faction).filter((c) => (c.garrison[WATCH_ROLE] || 0) > 40));
      const watch = city.garrison[WATCH_ROLE] || 0;
      const fallen = Math.round(watch * 0.28);
      city.garrison[WATCH_ROLE] = watch - fallen;
      const cost = between(30, 90);
      gold(faction, -cost);
      return {
        text: `In ${city.name} brennen die Kornhäuser. Es dauert drei Tage, bis die `
          + 'Wache die Gassen wieder hat.',
        effect: `${fallen.toLocaleString('de-DE')} Mann der Stadtwache gefallen, `
          + `${cost} Gold für die Wiederherstellung.`,
      };
    },
  },
  {
    id: 'vorzeichen_gut',
    icon: '🦅',
    title: 'Günstige Vorzeichen',
    good: true,
    when: (state, faction) => ownArmies(state, faction).length > 0,
    apply(state, faction) {
      const armies = ownArmies(state, faction);
      for (const army of armies) {
        army.morale = Math.min(MORALE_MAX, (army.morale || 0) + 12);
      }
      return {
        text: 'Die Zeichen stehen gut, sagen die Auguren, und die Leute glauben es. '
          + 'Ein Heer, das an seinen Sieg glaubt, ficht anders.',
        effect: `Moral aller ${armies.length} Heere um 12 gestiegen.`,
      };
    },
  },
  {
    id: 'vorzeichen_boese',
    icon: '🌑',
    title: 'Böse Vorzeichen',
    good: false,
    when: (state, faction) => ownArmies(state, faction).length > 0,
    apply(state, faction) {
      const armies = ownArmies(state, faction);
      for (const army of armies) {
        army.morale = Math.max(0, (army.morale || 0) - 10);
      }
      return {
        text: 'Ein Kalb mit zwei Köpfen, ein Blitz aus heiterem Himmel. Was die '
          + 'Priester daraus lesen, spricht sich schneller herum als jeder Befehl.',
        effect: `Moral aller ${armies.length} Heere um 10 gefallen.`,
      };
    },
  },
  {
    id: 'feldherr',
    icon: '⭐',
    title: 'Ein Feldherr von Ruf',
    good: true,
    when: (state, faction) => ownArmies(state, faction).length > 0,
    apply(state, faction) {
      const army = pick(ownArmies(state, faction));
      army.experience = Math.min(100, (army.experience || 0) + 30);
      return {
        text: 'Ein Mann aus den eigenen Reihen bekommt das Kommando, und plötzlich '
          + 'steht die Linie dort, wo sie stehen soll.',
        effect: `${army.name} sammelt Erfahrung – die Truppe rückt einer Stufe näher.`,
      };
    },
  },
  {
    id: 'seesturm',
    icon: '🌊',
    title: 'Ein Sturm auf See',
    good: false,
    when: (state, faction) => ownArmies(state, faction).some((a) => (a.units.ships || 0) > 10),
    apply(state, faction) {
      const fleet = pick(ownArmies(state, faction).filter((a) => (a.units.ships || 0) > 10));
      const before = fleet.units.ships;
      const lost = Math.round(before * 0.22);
      fleet.units.ships = before - lost;
      return {
        text: 'Drei Tage Weststurm. Was nicht in eine Bucht kam, liegt jetzt an der '
          + 'Küste, Kiel nach oben.',
        effect: `${fleet.name}: ${lost} Schiffe verloren, ${before - lost} bleiben.`,
      };
    },
  },
  {
    id: 'siedler',
    icon: '🏘️',
    title: 'Zuzug aus dem Umland',
    good: true,
    when: (state, faction) => ownCities(state, faction).length > 0,
    apply(state, faction) {
      const city = pick(ownCities(state, faction));
      const plus = between(200, 600);
      city.population += plus;
      return {
        text: `Wer draußen nichts mehr hat, kommt hinter die Mauern von ${city.name}. `
          + 'Das kostet Brot und bringt Hände.',
        effect: `${city.name} wächst um ${plus.toLocaleString('de-DE')} Einwohner.`,
      };
    },
  },
  {
    id: 'brand',
    icon: '🔥',
    title: 'Feuer in der Stadt',
    good: false,
    when: (state, faction) => ownCities(state, faction).length > 0,
    apply(state, faction) {
      const city = pick(ownCities(state, faction));
      const lost = Math.round(city.population * 0.08);
      city.population = Math.max(200, city.population - lost);
      const cost = between(50, 130);
      gold(faction, -cost);
      return {
        text: `Ein umgestoßenes Licht, ein Wind aus der falschen Richtung - und ein `
          + `halbes Viertel von ${city.name} ist Asche.`,
        effect: `${lost.toLocaleString('de-DE')} Einwohner obdachlos oder tot, `
          + `${cost} Gold für den Wiederaufbau.`,
      };
    },
  },
  {
    id: 'werkstatt',
    icon: '🔨',
    title: 'Ein Meister der Waffenschmiede',
    good: true,
    when: (state, faction) => ownArmies(state, faction).some(
      (a) => UNIT_ROLES.some((role) => (a.units[role] || 0) > 0)
    ),
    apply(state, faction) {
      const army = pick(ownArmies(state, faction).filter(
        (a) => UNIT_ROLES.some((role) => (a.units[role] || 0) > 0)
      ));
      const role = pick(UNIT_ROLES.filter((r) => (army.units[r] || 0) > 0));
      const plus = Math.max(20, Math.round((army.units[role] || 0) * 0.15));
      army.units[role] += plus;
      return {
        text: 'In der Schmiede arbeitet einer, der es kann. Was er liefert, hält, und '
          + 'es liegt genug davon bereit.',
        effect: `${army.name}: ${plus} ${unitDef(faction.id, role).name} treten hinzu.`,
      };
    },
  },
];

// Würfelt für eine Fraktion. Gibt das Ereignis zurück oder null.
export function rollEventFor(state, faction) {
  if (state.turn < EVENT_FIRST_TURN) return null;
  if (faction.isNeutral || !faction.alive) return null;
  if (Math.random() > EVENT_CHANCE) return null;
  const possible = EVENTS.filter((event) => event.when(state, faction));
  if (!possible.length) return null;
  const event = pick(possible);
  const outcome = event.apply(state, faction);
  return {
    id: event.id,
    icon: event.icon,
    title: event.title,
    good: event.good,
    faction: faction.id,
    factionName: faction.name,
    text: outcome.text,
    effect: outcome.effect,
  };
}

// Eine Runde Ereignisse für alle. Was den Spieler betrifft, kommt zurück -
// dafür gibt es das Fenster; alles andere steht im Protokoll.
export function rollEvents(state) {
  let mine = null;
  for (const faction of state.factions) {
    const event = rollEventFor(state, faction);
    if (!event) continue;
    logMsg(state, `${event.icon} ${event.factionName}: ${event.title}. ${event.effect}`,
      null, [faction.id]);
    if (faction.isPlayer) mine = event;
  }
  return mine;
}

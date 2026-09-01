import {
  UNIT_ROLES, GARRISON_ROLES, COMBAT_ROLES, WATCH_ROLE, SHIP_ROLE, watchTarget,
  WARSHIP_BATCH,
  unitDef, ROLE_LABELS, settlementTier, garrisonCapacity, TILE_TYPES,
  wallLevelInfo, wallLevelName, MAX_WALL_LEVEL,
  starMarks, starTitle, experienceStars, EXPERIENCE_THRESHOLDS, MAX_EXPERIENCE,
  shipTypesOf, shipTypeByKey,
  SHIP_COST, NAVAL_MOVEMENT, SEA_MOVE_COST, ZOC_EXTRA_COST, ROAD_MOVE_COST, RECRUIT_BATCH,
  recruitPopCost, RECRUIT_MIN_POPULATION,
  STONE_ROAD_MOVE_COST, roadLevelOf, roadStepCost,
  CAMP_NAME, CAMP_COST, CAMP_DEFENCE,
  TRANSPORT_NAME, transportCount,
  tacticsFor, tacticByKey, tacticEffect,
  AMBUSH_NAME, AMBUSH_ATTACK, AMBUSH_MORALE,
  RIVER_CROSSING_COST,
  MINE_NAME, MINE_ORE, MINE_RANGE, MINE_MIN_ORE,
  FISHERY_NAME, HUNT_NAME, HUNT_GAME, HUNT_RANGE, HUNT_MIN_GAME, HUNT_GROWTH, huntIncome,
  SIEGE_ENGINES, SIEGE_ENGINE_MAX, SIEGE_ENGINE_MOVE, engineCount, engineCost, siegeBreach,
  BUILDINGS, buildingDef, buildingName, mineIncome, TAX_PER_INHABITANTS,
  repairCost, repairTurns,
  TRADE_GOODS, TRADE_ROUTE_COST, TRADE_ROUTES_PER_CITY,
  tileImpassable, tileMoveCost, tileAltitude, PASSABLE_ALTITUDE,
  levyStrength,
} from './data.js';
import { TRAITS, TRAIT_NAMES, traitLabel } from './rulers.js';
import {
  atWar, opinionOf, relationOf, rulerOf, peaceVerdict, peacePrice,
  GIFT_COST, knowsFaction, roughDirection,
  diploLock, offerFrom,
  TREATIES, TREATY_KEYS, treatyOf, treatiesOf, treatyVerdict, isAllied, hasPact,
  hasPassage, vertragDenAkk, warBound, hasTradePact,
} from './diplomacy.js';
import {
  unitTotalCount, playerFaction, factionById, tilePosition, cityAt, armyAt,
  isWaterTile, isCoastalCity, isFleet, riverSidesOf, tradeGoodInfo,
} from './state.js';
import {
  embarkStatus, cityWallLevel, nextWallLevel, roadTargets, roadProjectOf, roadConnected, cityIncome,
  armyUpkeep, factionIncome,
  tradeRoutesOf, tradePartners, tradePartnerOf, tradeRouteIncome, tradeIncomeOf,
  siegeStatus,
  tradeRouteRaided, tradeRouteBlockaded, blockadingFleets,
  mineOre, mineIncomeOf, huntGame, huntIncomeOf, canBuildBuilding, siegeInfo, citySieged,
  engineSummary, movementAllowance,
  campStatus, campSiegeTarget, ambushStatus,
  buildingPrice, buildingRuined, wallRuined, stoneTargets,
} from './actions.js';
import {
  calendarOfTurn, weatherAt, weatherInfo, zoneOf, zoneName, TURNS_PER_SEASON,
} from './weather.js';
import { territoryOwner } from './territory.js';
import { emblemSVG } from './emblems.js';
import { wonderAt, wondersOfCity } from './wonders.js';

const TERRAIN_NAMES = {
  plains: 'Ebene', forest: 'Wald', hills: 'Hügel', mountain: 'Gebirge', water: 'Wasser',
};

function escapeHTML(text) {
  return String(text).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

// One side of the report: every unit type that took part, with how many
// marched in, how many walked away, and the shortfall between the two.
function sideHTML(state, factionId, label, engaged, survivors, lossPct, won) {
  const faction = factionById(state, factionId);
  const rows = COMBAT_ROLES.filter((k) => (engaged[k] || 0) > 0).map((k) => {
    const before = engaged[k] || 0;
    const after = survivors[k] || 0;
    const lost = before - after;
    const def = unitDef(factionId, k);
    return `<tr>
      <td class="u-name">${def.icon} ${escapeHTML(def.name)}</td>
      <td class="u-num">${before.toLocaleString('de-DE')}</td>
      <td class="u-num">${after.toLocaleString('de-DE')}</td>
      <td class="u-num u-loss">${lost > 0 ? '−' + lost.toLocaleString('de-DE') : '0'}</td>
    </tr>`;
  }).join('');

  const before = unitTotalCount(engaged);
  const after = unitTotalCount(survivors);

  return `
    <div class="report-side ${won ? 'side-won' : 'side-lost'}">
      <div class="side-head">
        <span class="dot" style="background:${faction ? faction.color : '#888'}"></span>
        <strong>${escapeHTML(faction ? faction.name : '?')}</strong>
        <span class="side-role">${label}</span>
        <span class="side-verdict">${won ? 'Sieg' : 'Niederlage'}</span>
      </div>
      <table class="report-table">
        <thead><tr><th>Einheit</th><th>Eingesetzt</th><th>Übrig</th><th>Verlust</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="muted">keine Truppen</td></tr>'}</tbody>
        <tfoot><tr>
          <td>Gesamt</td>
          <td class="u-num">${before.toLocaleString('de-DE')}</td>
          <td class="u-num">${after.toLocaleString('de-DE')}</td>
          <td class="u-num u-loss">${Math.round(lossPct * 100)}%</td>
        </tr></tfoot>
      </table>
    </div>`;
}

function roundsHTML(rounds) {
  if (!rounds || !rounds.length) return '';
  const bars = rounds.map((r) => `
    <tr>
      <td class="r-no">${r.round}${r.volley ? ' <span class="r-volley" title="Fernkampf-Eröffnung">🏹</span>' : ''}</td>
      <td class="u-num u-loss">−${r.attackerLost.toLocaleString('de-DE')}</td>
      <td class="u-num">${r.attackerLeft.toLocaleString('de-DE')}</td>
      <td class="u-num">${r.defenderLeft.toLocaleString('de-DE')}</td>
      <td class="u-num u-loss">−${r.defenderLost.toLocaleString('de-DE')}</td>
    </tr>`).join('');
  return `
    <details class="report-rounds" open>
      <summary>Rundenverlauf (${rounds.length} ${rounds.length === 1 ? 'Runde' : 'Runden'})</summary>
      <table class="report-table rounds-table">
        <thead><tr>
          <th>#</th><th>Angr. Verlust</th><th>Angr. übrig</th><th>Vert. übrig</th><th>Vert. Verlust</th>
        </tr></thead>
        <tbody>${bars}</tbody>
      </table>
    </details>`;
}

// Says what became of the men the report counts as survivors, so the numbers
// can never contradict what the player then sees on the map.
function aftermathHTML(report) {
  const a = report.aftermath;
  if (!a) return '';
  const captured = a.garrisonCaptured
    ? ` Die überlebende Garnison (${a.garrisonCaptured.toLocaleString('de-DE')}) fällt mit der Stadt in Gefangenschaft.`
    : '';

  let text;
  switch (a.fate) {
    case 'retreated':
      text = `Die geschlagene Armee zieht sich mit ihren Überlebenden auf ein Nachbarfeld zurück.${captured}`;
      break;
    case 'encircled':
      text = `Eingekesselt – ohne Rückzugsweg ergeben sich die Überlebenden.${captured}`;
      break;
    case 'destroyed':
      text = `Die Streitmacht wird vollständig aufgerieben.${captured}`;
      break;
    case 'cityFell':
      text = captured.trim() || 'Die Stadt fällt.';
      break;
    case 'held':
      text = 'Die Verteidiger halten das Feld; der Angreifer weicht auf seine Ausgangsstellung zurück.';
      break;
    default:
      return '';
  }
  return `<p class="report-aftermath">${escapeHTML(text)}</p>`;
}

// Every modifier that bent this fight, in the same words for the forecast and
// for the report - so what the player was promised is what they get told.
function modifierNotesHTML(info) {
  const notes = [];
  // Der Überfall zuerst: er erklärt eine Übermacht, die sonst niemand
  // nachrechnen kann.
  if (info.ambush) {
    notes.push(`<span class="mod-note mod-ambush">🌿 ${AMBUSH_NAME}: der Angreifer `
      + `bricht aus der Deckung hervor (+${Math.round((AMBUSH_ATTACK - 1) * 100)} % `
      + `Schlagkraft), der Überfallene verliert ${AMBUSH_MORALE} Moral</span>`);
  }
  // Ein freier Ort stellt seine eigenen Leute auf die Mauer. Wer das nicht
  // liest, wundert sich, warum vor ihm mehr steht, als die Aufklärung meldete.
  if (info.levy > 0) {
    notes.push(`<span class="mod-note mod-levy">🏘️ Aufgebot der Bürger: ${
      info.levy.toLocaleString('de-DE')} Mann treten zur Verteidigung an</span>`);
  }
  // Die Frontbreite erklärt, warum ein doppelt so großes Heer nicht doppelt so
  // hart zuschlägt: der Rest steht dahinter und wartet. Ohne diese Zeile wirkt
  // die Vorschau falsch gerechnet.
  for (const [side, share, width, engaged] of [
    ['Angreifer', info.attackerEngagedShare, info.attackerFrontage, info.attackerEngaged],
    ['Verteidiger', info.defenderEngagedShare, info.defenderFrontage, info.defenderEngaged],
  ]) {
    if (!(share < 0.999) || !width) continue;
    const total = Object.values(engaged || {}).reduce((sum, n) => sum + n, 0);
    notes.push(`<span class="mod-note mod-front">⚔ Frontbreite ${side}: ${
      Math.round(width).toLocaleString('de-DE')} von ${total.toLocaleString('de-DE')} Mann
      kommen ins Gefecht, der Rest steht dahinter</span>`);
  }
  if (info.wallMultiplier > 1) {
    notes.push(`<span class="mod-note mod-wall">${
      escapeHTML(info.wallName || 'Befestigung')}: +${
      Math.round((info.wallMultiplier - 1) * 100)}% Verteidigung</span>`);
  }
  // Was das Gerät davor davon wieder wegnimmt - und was die Katapulte schießen.
  if (info.engineSummary) {
    notes.push(`<span class="mod-note mod-engine">🪵 ${escapeHTML(info.engineSummary)}: ${
      info.engineBreach ? `die Mauer zählt nur noch +${
        Math.round((info.wallMultiplier - 1) * 100)}% statt +${
        Math.round((info.wallBase - 1) * 100)}%` : 'vor dem Sturm ohne Wirkung'}${
      info.siegeVolley ? ' · und sie schießen in der ersten Runde' : ''}</span>`);
  }
  // Wer stürmt, tut das zu Fuß: die Reiterei kommt an einer Mauer kaum zur
  // Wirkung. Ohne diese Zeile sieht ein Reiterheer aus, als hätte es schlicht
  // Pech gehabt.
  const sturm = Object.entries(info.assaultScale || {})
    .map(([unit, scale]) => `${ROLE_LABELS[unit]} −${Math.round((1 - scale) * 100)}%`);
  if (sturm.length) {
    notes.push(`<span class="mod-note mod-wall">🐎 Sturm auf die Mauer: ${
      sturm.join(', ')} – gestürmt wird zu Fuß</span>`);
  }
  if (info.amphibious || (info.attackerMultiplier ?? 1) < 1) {
    notes.push(`<span class="mod-note mod-sea">🌊 Landung vom Meer: −${
      Math.round((1 - (info.attackerMultiplier ?? 1)) * 100)}% Angriffskraft</span>`);
  }
  // Graben, Wall, Palisade: wer ein Lager stürmt, stürmt über den Wall.
  if ((info.defenderMultiplier ?? 1) > 1) {
    notes.push(`<span class="mod-note mod-wall">⛺ ${CAMP_NAME}: +${
      Math.round(((info.defenderMultiplier ?? 1) - 1) * 100)}% Verteidigung</span>`);
  }
  if ((info.defenderMultiplier ?? 1) < 1) {
    notes.push(`<span class="mod-note mod-sea">⛵ Auf offener See: −${
      Math.round((1 - (info.defenderMultiplier ?? 1)) * 100)}% Verteidigung</span>`);
  }
  // Zur See zählt das Schiff: was an Truppen an Bord ist, kämpft gemindert.
  // Das ist keine Sache des Wetters und steht deshalb in einer eigenen Zeile.
  const seaScaled = Object.entries(info.seaScale || {})
    .map(([unit, scale]) => `${ROLE_LABELS[unit]} ${Math.round((scale - 1) * 100)}%`);
  if (seaScaled.length) {
    notes.push(`<span class="mod-note mod-sea">⛵ Kampf auf See: ${
      seaScaled.join(', ')} – Kriegsschiffe kämpfen voll</span>`);
  }
  // The report stores the weather flattened, the forecast passes the object;
  // both describe the same sky.
  for (const [side, value] of [['Angreifer', info.attackerVeterancy], ['Verteidiger', info.defenderVeterancy]]) {
    if (!(value > 1.001)) continue;
    const experience = side === 'Angreifer' ? info.attackerExperience : info.defenderExperience;
    notes.push(`<span class="mod-note mod-vet">${starMarks(experience)} ${side}: +${
      Math.round((value - 1) * 100)}% aus Erfahrung</span>`);
  }
  const sky = info.weather || (info.weatherKey ? weatherInfo(info.weatherKey) : null);
  const scaled = Object.entries(info.weatherScale || sky?.unitScale || {})
    .map(([unit, scale]) => `${ROLE_LABELS[unit]} ${Math.round((scale - 1) * 100)}%`);
  const noVolley = info.openingVolley === false || sky?.volley === false;
  if (sky && (scaled.length || noVolley)) {
    notes.push(`<span class="mod-note mod-weather">${sky.icon} ${escapeHTML(sky.name)}: ${
      [...scaled, noVolley ? 'kein Fernkampf-Auftakt' : null].filter(Boolean).join(', ')}</span>`);
  }
  return notes.length ? `<p class="report-meta mod-notes">${notes.join('')}</p>` : '';
}

export function battleReportHTML(state, report) {
  const attackerWon = report.outcome === 'attacker';
  const terrain = TERRAIN_NAMES[report.terrainType] || report.terrainType;
  const place = report.cityName
    ? `${report.kind === 'city' ? 'Belagerung von' : 'Schlacht bei'} ${escapeHTML(report.cityName)}`
    : report.naval ? 'Seeschlacht' : 'Feldschlacht';
  const bonus = report.terrainBonus > 0
    ? ` · Geländevorteil für den Verteidiger: +${Math.round(report.terrainBonus * 15)}% Verteidigung`
    : ' · kein Geländevorteil';

  return `
    <h2 class="report-title">${place}</h2>
    <p class="report-meta">Runde ${report.turn} · ${escapeHTML(terrain)}${bonus}</p>
    <p class="report-meta">Entschieden: ${escapeHTML(report.endedBy || '—')}</p>
    <p class="report-meta">Schlachtordnung – Angreifer:
      ${escapeHTML(tacticLabel('angriff', report.attackerTactic))} ·
      Verteidiger: ${escapeHTML(tacticLabel('verteidigung', report.defenderTactic))}</p>
    <p class="report-meta">Verfassung – Angreifer: Moral ${Math.round(report.attackerMorale ?? 100)},
      Erschöpfung ${Math.round(report.attackerExhaustion ?? 0)} ·
      Verteidiger: Moral ${Math.round(report.defenderMorale ?? 100)},
      Erschöpfung ${Math.round(report.defenderExhaustion ?? 0)}</p>
    ${modifierNotesHTML(report)}
    ${report.combined
      ? '<p class="report-meta report-combined">Feldarmee und Stadtgarnison verteidigen gemeinsam.</p>'
      : ''}
    <div class="report-sides">
      ${sideHTML(state, report.attackerFactionId, 'Angreifer', report.attackerEngaged,
    report.attackerSurvivors, report.attackerLossesPct, attackerWon)}
      ${sideHTML(state, report.defenderFactionId,
    report.combined ? 'Verteidiger (Armee + Garnison)' : 'Verteidiger', report.defenderEngaged,
    report.defenderSurvivors, report.defenderLossesPct, !attackerWon)}
    </div>
    ${aftermathHTML(report)}
    ${roundsHTML(report.rounds)}`;
}

function unitBreakdownHTML(units, factionId) {
  return COMBAT_ROLES.filter((k) => units[k] > 0)
    .map((k) => {
      const def = unitDef(factionId, k);
      return `<span class="unit-chip" title="${escapeHTML(ROLE_LABELS[k])} · Angriff ${
        def.attack}, Verteidigung ${def.defense}">${def.icon} ${units[k]} <em>${
        escapeHTML(def.name)}</em></span>`;
    })
    .join('') || '<span class="unit-chip empty">keine Truppen</span>';
}

function conditionLabel(value, scale) {
  for (const [threshold, label] of scale) {
    if (value >= threshold) return label;
  }
  return scale[scale.length - 1][1];
}

const MORALE_SCALE = [[85, 'entschlossen'], [65, 'zuversichtlich'], [45, 'schwankend'], [25, 'mürbe'], [0, 'gebrochen']];
const EXHAUSTION_SCALE = [[75, 'erschöpft'], [50, 'ermattet'], [25, 'angestrengt'], [0, 'frisch']];

// A bar plus a word: the number alone does not tell a player whether 55 is
// good, and the wording is what they will actually read mid-turn.
function conditionBarHTML(name, value, scale, tone) {
  const pct = Math.round(Math.max(0, Math.min(100, value)));
  return `
    <div class="cond-row">
      <span class="cond-name">${name}</span>
      <span class="cond-track"><span class="cond-fill cond-${tone}" style="width:${pct}%"></span></span>
      <span class="cond-value">${pct} <em>${conditionLabel(pct, scale)}</em></span>
    </div>`;
}

// Sterne, was sie einbringen, und wie weit es zum nächsten ist.
function veterancyHTML(army) {
  const experience = army.experience || 0;
  const stars = experienceStars(experience);
  const next = EXPERIENCE_THRESHOLDS[stars];
  const bonus = Math.round(stars * 12);
  const progress = next
    ? Math.round(((experience - (EXPERIENCE_THRESHOLDS[stars - 1] || 0))
      / (next - (EXPERIENCE_THRESHOLDS[stars - 1] || 0))) * 100)
    : 100;
  return `
    <div class="vet-row">
      <span class="vet-stars" title="${escapeHTML(starTitle(experience))}">${starMarks(experience)}</span>
      <span class="vet-title">${escapeHTML(starTitle(experience))}</span>
      <span class="vet-bonus">${bonus ? `+${bonus}% Kampfkraft` : 'noch ohne Bonus'}</span>
    </div>
    <div class="vet-track" title="${next ? `${Math.round(experience)} von ${next} Erfahrung`
    : `Höchststufe (${MAX_EXPERIENCE})`}">
      <span class="vet-fill" style="width:${Math.max(0, Math.min(100, progress))}%"></span>
    </div>`;
}

const EMBARK_REASONS = {
  noCity: 'Nur in einer eigenen Hafenstadt kann eine Armee an Bord gehen.',
  noPort: 'Diese Stadt liegt nicht am Meer.',
  noHarbour: `Diese Stadt hat keinen Hafen – erst einen bauen `
    + `(${buildingDef('harbour').cost} Gold).`,
  gold: `Zu wenig Gold – eine Flotte kostet ${SHIP_COST}.`,
  blocked: 'Der Hafen ist belegt.',
  blockade: 'Feindliche Schiffe sperren den Hafen – erst müssen sie fort.',
};

function embarkHTML(state, army) {
  if (isFleet(army)) {
    const ship = shipTypeByKey(army.shipKind, army.factionId);
    return `<p class="sea-line">${ship.icon} ${escapeHTML(ship.name)} –
      ${army.maxMovement || NAVAL_MOVEMENT} Bewegungspunkte.
      <span class="muted">${escapeHTML(ship.note)} Sie hält das Meer: sie greift
      feindliche Flotten und Transporte an, geht aber nie an Land.
      Mit einer Flotte anderer Bauart legt sie sich nicht zusammen – was
      zusammen fährt, fährt gleich schnell.</span></p>`;
  }
  const ruempfe = transportCount(unitTotalCount(army.units));
  if (army.embarked) {
    return `<p class="sea-line">⛵ Auf See – ${ruempfe} ${TRANSPORT_NAME}e,
      ${NAVAL_MOVEMENT} Bewegungspunkte.
      <span class="muted">Das Heer liegt auf Transportern; ein gelbes Feld ist eine
      Landung und beendet die Fahrt.</span></p>`;
  }
  const status = embarkStatus(state, army);
  if (status.can) {
    return `<button class="embark-btn" data-army="${army.id}">⛵ Auf Transporter verladen – ${SHIP_COST} Gold
      <small>${ruempfe} ${TRANSPORT_NAME}e aus ${escapeHTML(status.city.name)};
        die Einschiffung kostet die Runde</small></button>`;
  }
  if (status.reason === 'noCity') return '';
  return `<button class="embark-btn" disabled>⛵ Auf Transporter verladen – ${SHIP_COST} Gold
    <small>${escapeHTML(EMBARK_REASONS[status.reason] || '')}</small></button>`;
}

// Steht die Armee in einer eigenen Stadt, kann sie dort frische Truppen
// kaufen: schneller als der Umweg über die Garnison, und man sieht sofort,
// was es kostet.
function reinforceHTML(state, army, city) {
  const player = playerFaction(state);
  if (army.embarked) return '';
  if (!city || city.factionId !== army.factionId || army.factionId !== player.id) return '';
  // Auch die Verstärkung im Feld nimmt Männer aus dem Ort, in dem sie steht.
  const leute = recruitPopCost();
  const entvoelkert = city.population - leute < RECRUIT_MIN_POPULATION;
  return `
    <p class="road-head">⚔️ Verstärkung kaufen <span class="muted">· je ${RECRUIT_BATCH} Mann,
      tritt sofort in die Armee ein</span></p>
    <div class="recruit-row">
      ${UNIT_ROLES.map((k) => {
    const def = unitDef(city.factionId, k);
    const tooPoor = player.gold < def.cost;
    return `<button class="reinforce-btn" data-unit="${k}" data-army="${army.id}"
        ${tooPoor || entvoelkert ? 'disabled' : ''}>
        ${def.icon} ${escapeHTML(def.name)}<br><small>${def.cost} Gold · −${leute} Einw.</small>
      </button>`;
  }).join('')}
    </div>
    <p class="wall-line muted recruit-note">${entvoelkert
    ? `👥 ${escapeHTML(city.name)} gibt keinen Mann mehr her.`
    : `👥 Aus ${escapeHTML(city.name)}: ${leute} Einwohner je Trupp.`}</p>`;
}

// --- Belagerungsgerät ------------------------------------------------------
// Was ein Heer an Widdern und Katapulten mitführt, und wo es welche bekommt.
// Der Knopf steht bei der Armee, nicht beim Ort: das Gerät zieht mit dem Heer,
// und ein Ort, in dem gerade keines steht, hat nichts davon.
function engineLineHTML(army) {
  const zahl = engineCount(army.engines);
  if (!zahl) return '';
  const bruch = Math.round(siegeBreach(army.engines) * 100);
  return `<p class="ti-line engine-line">🪵 Belagerungsgerät:
    <strong>${escapeHTML(engineSummary(army.engines))}</strong>
    <span class="muted">· nimmt einer Mauer ${bruch} % ihrer Wirkung ·
      ${Math.round((1 - SIEGE_ENGINE_MOVE) * 100)} % weniger Bewegung</span></p>`;
}

function engineBuildHTML(state, army, city) {
  const player = playerFaction(state);
  if (army.embarked || isFleet(army)) return '';
  if (!city || city.factionId !== army.factionId || army.factionId !== player.id) return '';
  if (!city.barracks) return '';
  const voll = engineCount(army.engines) >= SIEGE_ENGINE_MAX;
  return `
    <p class="road-head">🪵 Belagerungsgerät zimmern
      <span class="muted">· höchstens ${SIEGE_ENGINE_MAX} Stück je Heer</span></p>
    <div class="recruit-row">
      ${SIEGE_ENGINES.map((def) => {
    const preis = engineCost(def, player);
    const tooPoor = player.gold < preis;
    return `<button class="engine-btn" data-engine="${def.key}" data-army="${army.id}"
        title="${escapeHTML(def.note)}" ${tooPoor || voll ? 'disabled' : ''}>
        ${def.icon} ${escapeHTML(def.name)}<br><small>${preis} Gold ·
          −${Math.round(def.bruch * 100)} % Mauer${def.salve ? ' · schießt' : ''}</small>
      </button>`;
  }).join('')}
    </div>
    <p class="wall-line muted recruit-note">${voll
    ? '🪵 Mehr als sechs Stücke schleppt kein Heer.'
    : 'Zimmern kostet den Tag: das Heer zieht in dieser Runde nicht mehr.'}</p>`;
}

// --- Das Lager -------------------------------------------------------------
// Graben, Wall, Palisade - und vor einer fremden Stadt aufgeschlagen die
// Belagerung selbst. Der Knopf steht bei der Armee, weil das Lager zu ihr
// gehört und nicht zum Ort.
const CAMP_REASONS = {
  atSea: 'Auf See wird kein Lager aufgeschlagen.',
  fleet: 'Eine Flotte schlägt kein Lager auf.',
  inCity: 'In einer Stadt braucht es kein Lager – sie ist eines.',
  movement: 'Dafür ist der Tag zu weit fortgeschritten – ein Lager kostet, was an Bewegung übrig ist.',
  gold: `Dafür fehlt das Gold (${CAMP_COST}).`,
};

// Der Ort, vor dem dieses Heer steht und den es einschließen könnte - oder
// schon einschließt. Eine Belagerung wird erklärt; wer schon davorsteht, tut
// das hier, ohne noch einmal anzugreifen.
function siegeButtonHTML(state, army) {
  const nah = state.cities.filter((c) => c.factionId !== army.factionId
    && Math.abs(c.col - army.col) + Math.abs(c.row - army.row) <= 1);
  const laufend = nah.find((c) => c.siege && c.siege.by === army.factionId);
  if (laufend) {
    return `<p class="camp-line">⚔️ Belagert ${escapeHTML(laufend.name)}
      <span class="muted">· der Ort ist abgeschnitten. Marschiert das Heer ab,
      ist die Belagerung aufgehoben.</span></p>`;
  }
  const ziel = nah.find((c) => siegeStatus(state, army, c).can);
  if (!ziel) return '';
  return `<button class="siege-btn" data-army="${army.id}" data-city="${ziel.id}">
      ⛺ ${escapeHTML(ziel.name)} einschließen
      <small>Keine Steuer, kein Nachschub, kein Bau für den Ort – und nach ein paar
        Runden beginnt der Hunger. Kostet den Rest des Tages.</small>
    </button>`;
}

// --- Der Hinterhalt --------------------------------------------------------
const AMBUSH_REASONS = {
  atSea: 'Auf See legt sich niemand in den Hinterhalt.',
  fleet: 'Eine Flotte legt keinen Hinterhalt.',
  inCity: 'Aus einer Stadt heraus überfällt man niemanden.',
  terrain: 'Hier ist keine Deckung – dafür braucht es Wald, Hügel oder Gebirge.',
  movement: 'Dafür ist der Tag zu weit fortgeschritten – Lauern kostet, was an Bewegung übrig ist.',
};

function ambushHTML(state, army) {
  if (isFleet(army) || army.embarked) return '';
  if (army.ambush) {
    return `<p class="camp-line">🌿 ${AMBUSH_NAME}
      <span class="muted">· der Feind sieht dieses Heer nicht. Zieht eines an
      ihm vorbei, bricht es hervor: +${Math.round((AMBUSH_ATTACK - 1) * 100)} %
      Schlagkraft, und der Überfallene verliert ${AMBUSH_MORALE} Moral, ehe der
      erste Schlag fällt.</span></p>
      <button class="ambush-btn" data-army="${army.id}" data-ambush="leave">
        🚶 ${AMBUSH_NAME} aufgeben
        <small>Das Heer steht wieder offen – und ist wieder zu sehen.</small>
      </button>`;
  }
  const status = ambushStatus(state, army);
  if (!status.can) {
    const grund = AMBUSH_REASONS[status.reason];
    return grund ? `<p class="wall-line muted">🌿 Kein ${AMBUSH_NAME} – ${grund}</p>` : '';
  }
  return `<button class="ambush-btn" data-army="${army.id}" data-ambush="lay">
      🌿 In den ${AMBUSH_NAME} legen
      <small>Unsichtbar für den Feind. Wer vorbeizieht, wird überfallen:
        +${Math.round((AMBUSH_ATTACK - 1) * 100)} % Schlagkraft und
        −${AMBUSH_MORALE} Moral für ihn · kostet den Rest des Tages</small>
    </button>`;
}

function campHTML(state, army) {
  if (isFleet(army) || army.embarked) return '';
  const belagert = campSiegeTarget(state, army);
  if (army.camp) {
    return `<p class="camp-line">⛺ ${CAMP_NAME}
      <span class="muted">· +${Math.round((CAMP_DEFENCE - 1) * 100)}% Verteidigung,
      Rast wie in der eigenen Stadt, halbes Wetter${belagert
    ? ` · Belagerungslager vor ${escapeHTML(belagert.name)}: der Ort ist abgeschnitten `
      + 'und hungert von der nächsten Runde an' : ''}</span></p>
      <button class="camp-btn" data-army="${army.id}" data-camp="break">
        ⛏️ ${CAMP_NAME} abbrechen
        <small>Der Wall bleibt stehen, aber er zählt nicht mehr für dich.</small>
      </button>`;
  }
  const status = campStatus(state, army);
  if (!status.can) {
    const grund = CAMP_REASONS[status.reason];
    return grund ? `<p class="wall-line muted">⛺ Kein ${CAMP_NAME} – ${grund}</p>` : '';
  }
  return `<button class="camp-btn" data-army="${army.id}" data-camp="build">
      ⛺ ${CAMP_NAME} aufschlagen – ${CAMP_COST} Gold
      <small>${belagert
    ? `Belagert ${escapeHTML(belagert.name)}, ohne es zu stürmen: der Ort wird abgeschnitten `
      + 'und hungert von der nächsten Runde an'
    : `+${Math.round((CAMP_DEFENCE - 1) * 100)}% Verteidigung, Rast wie in der eigenen Stadt`}
        · kostet den Rest des Tages</small>
    </button>`;
}

function renderSelectedArmy(state, army) {
  const faction = factionById(state, army.factionId);
  const city = state.cities.find((c) => c.col === army.col && c.row === army.row);
  const canDisband = city && city.factionId === army.factionId && !army.embarked
    && !isFleet(army);
  return `
    <h3><span class="dot" style="background:${faction.color}"></span>${escapeHTML(army.name)}
      ${army.embarked
    ? `<span class="afloat-tag">⛵ ${isFleet(army) ? 'Flotte' : 'auf Transportern'}</span>`
    : ''}</h3>
    <p class="muted">${escapeHTML(faction.name)} · Bewegung: ${army.movement} / ${movementAllowance(army)}</p>
    ${veterancyHTML(army)}
    <div class="cond-block">
      ${conditionBarHTML('Moral', army.morale ?? 100, MORALE_SCALE, 'morale')}
      ${conditionBarHTML('Erschöpfung', army.exhaustion ?? 0, EXHAUSTION_SCALE, 'fatigue')}
    </div>
    <div class="unit-list">${unitBreakdownHTML(army.units, army.factionId)}</div>
    ${engineLineHTML(army)}
    ${siegeButtonHTML(state, army)}
    ${campHTML(state, army)}
    ${ambushHTML(state, army)}
    ${reinforceHTML(state, army, city)}
    ${engineBuildHTML(state, army, city)}
    ${canDisband
      ? `<button class="disband-btn" data-army="${army.id}">🏰 In ${escapeHTML(city.name)} auflösen – Garnison verstärken
          ${experienceStars(army.experience)
    ? '<small>Die Erfahrung der Armee geht dabei verloren.</small>' : ''}</button>`
      : ''}
    ${embarkHTML(state, army)}
    <p class="hint">Grüne Felder: freie Bewegung · Orange: vom Feind kontrolliert
      (+${ZOC_EXTRA_COST} Bewegung, kein Weiterziehen entlang der Front) ·
      Rot: Angriff · Blau: eigenes Heer, beide vereinigen sich${
  army.embarked ? ' · Gelb: an Land gehen' : ''}.</p>
  `;
}

// Große Stadt / Stadt / Dorf - and a capital says so on top of its tier.
function settlementLabel(city) {
  const tier = settlementTier(city.size).label;
  return city.capital ? `Hauptstadt · ${tier}` : tier;
}

// Welcher Reiter im Stadtfenster offen liegt. Die Wahl bleibt stehen: wer
// baut, baut meist mehrmals hintereinander.
let cityTab = 'info';
const CITY_TABS = ['info', 'build', 'trade'];

export function setCityTab(tab) {
  cityTab = CITY_TABS.includes(tab) ? tab : 'info';
  return cityTab;
}

// Was der Ort in der letzten Runde an Menschen gewonnen hat. Steht als „+7"
// neben der Einwohnerzahl - und nur, wenn es etwas war: eine Null hinter jeder
// Zahl wäre Lärm, und eine belagerte Stadt wächst gar nicht.
export function wachstumHTML(city) {
  const zuwachs = city && city.lastGrowth;
  if (!zuwachs) return '';
  return ` <span class="delta-up">+${zuwachs.toLocaleString('de-DE')}</span>`;
}

// Was der Ort einbringt. Aufgeschlüsselt, weil sonst niemand nachvollziehen
// kann, warum eine Große Stadt mehr wert ist als zwei Dörfer.
function incomeLineHTML(state, city) {
  const income = cityIncome(state, city);
  const parts = [`Steuer ${income.people}`];
  if (income.wonders) parts.push(`Bauwerk ${income.wonders}`);
  if (income.trade) parts.push(`Handel ${income.trade}`);
  if (income.mine) parts.push(`${MINE_NAME} ${income.mine}`);
  if (income.fishery) parts.push(`${FISHERY_NAME} ${income.fishery}`);
  if (income.hunt) parts.push(`${HUNT_NAME} ${income.hunt}`);
  return `<p class="income-line">💰 Einnahmen
    <strong>${income.total.toLocaleString('de-DE')} Gold je Runde</strong>
    <span class="muted">· ${parts.join(' · ')}</span></p>`;
}

// --- Was man von fremden Orten weiß ---------------------------------------
// Ein Feldherr sieht von einer fremden Stadt, was von außen zu sehen ist: wie
// groß sie ist, ob sie Mauern und einen Hafen hat, und wie stark sie ungefähr
// besetzt scheint. Kopfzahlen, Bevölkerung und Einnahmen kennt nur, wer sie
// hält - und Genaueres erfährt, wer ein Heer davorstehen hat.

const SCOUT_ARMY_RANGE = 2;
const SCOUT_CITY_RANGE = 3;

function cityIntel(state, city) {
  const player = playerFaction(state);
  if (city.factionId === player.id) return 'own';
  const near = (a, range) => Math.abs(a.col - city.col) + Math.abs(a.row - city.row) <= range;
  const watched = state.armies.some((a) => a.factionId === player.id && near(a, SCOUT_ARMY_RANGE))
    || state.cities.some((c) => c.factionId === player.id && near(c, SCOUT_CITY_RANGE));
  return watched ? 'scouted' : 'distant';
}

// Die Besatzung in Worten - so, wie ein Kundschafter sie melden würde.
function garrisonWord(total) {
  if (total < 100) return 'schwach besetzt';
  if (total < 300) return 'besetzt';
  if (total < 700) return 'gut besetzt';
  return 'stark besetzt';
}

function roughly(value, step) {
  return `etwa ${(Math.round(value / step) * step).toLocaleString('de-DE')}`;
}

// Der Ort aus der Ferne: Rang, Besitzer, Mauern, Hafen - und so viel über die
// Besatzung, wie die Nähe hergibt.
function foreignCityHTML(state, city, intel) {
  const faction = factionById(state, city.factionId);
  const level = cityWallLevel(city);
  const total = unitTotalCount(city.garrison);
  const wonders = wondersOfCity(state, city.id);
  const facts = [
    ['Rang', `${settlementLabel(city)}${city.capital ? ' · Hauptstadt' : ''}`],
    ['Herr', faction.name],
    ['Befestigung', level ? `${wallLevelInfo(level).icon} ${wallLevelName(level)}` : 'offen'],
    ['Hafen', city.harbour
      ? `⚓ vorhanden${city.shipyard ? ' · 🔨 Werft' : ''}${
        blockadingFleets(state, city).length ? ' · ⛔ gesperrt' : ''}`
      : 'keiner'],
    ['Besatzung', intel === 'scouted'
      ? `${roughly(total, 50)} Mann · ${garrisonWord(total)}`
      : garrisonWord(total)],
  ];
  if (intel === 'scouted') facts.push(['Einwohner', roughly(city.population, 500)]);
  // Ein freier Ort hat keinen Herrn hinter sich - er stellt seine eigenen
  // Leute auf die Mauer. Wer davorsteht, sollte damit rechnen.
  if (city.factionId === 'neutral' && levyStrength(city) > 0) {
    facts.push(['Aufgebot', intel === 'scouted'
      ? `${levyStrength(city).toLocaleString('de-DE')} Bürger treten im Ernstfall an`
      : 'die Bürger greifen selbst zu den Waffen']);
  }
  if (wonders.length) {
    facts.push(['Bauwerk', wonders.map((w) => w.name).join(', ')]);
  }
  return `
    <h3><span class="dot" style="background:${faction.color}"></span>${escapeHTML(city.name)}
      ${city.capital ? '👑' : ''}</h3>
    ${siegeHTML(state, city, false)}
    <div class="terrain-facts">${facts.map(([label, value]) =>
    `<div class="terrain-fact"><span>${escapeHTML(label)}</span>
      <strong>${escapeHTML(value)}</strong></div>`).join('')}</div>
    <p class="terrain-note">${intel === 'scouted'
    ? 'Deine Leute stehen nah genug für eine Schätzung. Was genau hinter den '
      + 'Mauern steht, sagt erst die Kampfvorschau.'
    : 'Aus der Ferne gesehen. Wer ein Heer davorstellt, erfährt mehr.'}</p>`;
}

function renderSelectedCity(state, city, onRecruit, onRaise) {
  const faction = factionById(state, city.factionId);
  const player = playerFaction(state);
  const isMine = city.factionId === player.id;
  // Ein fremder Ort gibt nur her, was von außen zu sehen ist.
  if (!isMine) return foreignCityHTML(state, city, cityIntel(state, city));
  const maxTotal = garrisonCapacity(city, faction);
  const current = unitTotalCount(city.garrison);
  // Was ausrücken kann, und was auf der Mauer bleibt.
  const field = UNIT_ROLES.reduce((sum, k) => sum + (city.garrison[k] || 0), 0);
  const watch = city.garrison[WATCH_ROLE] || 0;
  const watchGoal = watchTarget(city, faction);

  // Ohne Kaserne gibt es hier nichts auszuheben - dann steht auch keine
  // Reihe ausgegrauter Knöpfe da, sondern nichts. Der Knopf, mit dem man die
  // Kaserne baut, steht ohnehin darüber.
  let recruitHTML = '';
  if (isMine && city.barracks) {
    // Eine Aushebung kostet zweierlei: Gold aus der Truhe und Menschen aus der
    // Stadt. Beides steht auf dem Knopf, ehe er gedrückt wird.
    const leute = recruitPopCost();
    const entvoelkert = city.population - leute < RECRUIT_MIN_POPULATION;
    recruitHTML = `
      <div class="recruit-row">
        ${UNIT_ROLES.map((k) => {
          const def = unitDef(city.factionId, k);
          const disabled = current >= maxTotal || player.gold < def.cost || entvoelkert;
          return `<button class="recruit-btn" data-unit="${k}" ${disabled ? 'disabled' : ''}>
            ${def.icon} ${def.name}<br><small>${def.cost} Gold · −${leute} Einw.</small>
          </button>`;
        }).join('')}
      </div>
      <p class="wall-line muted recruit-note">${entvoelkert
    ? `👥 ${escapeHTML(city.name)} ist zu klein für eine weitere Aushebung – `
      + `unter ${RECRUIT_MIN_POPULATION.toLocaleString('de-DE')} Einwohner geht niemand.`
    : `👥 Jede Aushebung nimmt ${RECRUIT_BATCH} Mann aus ${escapeHTML(city.name)}: `
      + `${leute} Einwohner weniger, und damit auch weniger Steuer und Wache.`}</p>
      <button class="raise-btn" ${field === 0 ? 'disabled' : ''}>🚩 Armee ausheben / verstärken
        <small>${field === 0
    ? 'Erst Truppen ausheben – die Stadtwache rückt nicht aus.'
    : `${field.toLocaleString('de-DE')} Mann marschbereit`}</small></button>
    `;
  }

  // Zwei Ansichten auf denselben Ort: was er ist, und was sich an ihm tun
  // lässt. Ungetrennt stand der Mauerbau zwischen Bevölkerung und Garnison,
  // und wer nur nachsehen wollte, was ein Ort trägt, scrollte an drei
  // Bauknöpfen vorbei.
  const infoHTML = `
    <p class="muted">${settlementLabel(city)} ·
      ${escapeHTML(faction.name)} · Bevölkerung: ${city.population.toLocaleString('de-DE')}</p>
    <p class="muted">Garnison: ${current.toLocaleString('de-DE')}
      ${current > maxTotal
    ? `<span class="over-strength">über Sollstärke (${maxTotal.toLocaleString('de-DE')})</span>`
    : `/ ${maxTotal.toLocaleString('de-DE')}`}</p>
    ${incomeLineHTML(state, city)}
    <p class="wall-line ${watch >= watchGoal ? 'wall-done' : ''}">🛡️ Stadtwache
      ${watch.toLocaleString('de-DE')} / ${watchGoal.toLocaleString('de-DE')}
      <span class="muted">· ${watch >= watchGoal
    ? 'vollzählig; sie verteidigt die Stadt, rückt aber nie aus'
    : 'stellt sich aus der Bevölkerung nach'}</span></p>
    ${wondersOfCity(state, city.id).map((w) => `
      <p class="wall-line wall-done">${w.wonder ? '🏛️' : '🗿'} ${escapeHTML(w.name)}
        <span class="muted">· ${w.wonder ? 'Weltwunder' : 'Wahrzeichen'}, +${w.income} Gold je Runde</span></p>`).join('')}
    <p class="wall-line ${cityWallLevel(city) ? 'wall-done' : 'muted'}">
      ${cityWallLevel(city)
    ? `${wallLevelInfo(cityWallLevel(city)).icon} ${wallLevelName(cityWallLevel(city))}`
    : 'Keine Befestigung'}</p>
    ${buildingSummaryHTML(city)}
    ${roadStatusHTML(state, city)}
    <div class="unit-list">${unitBreakdownHTML(city.garrison, city.factionId)}</div>`;

  const buildHTML = `
    ${buildingsHTML(state, city, isMine, player)}
    ${wallHTML(state, city, isMine, player)}
    ${fleetHTML(city, isMine, player)}
    ${roadHTML(state, city, isMine, player)}
    ${recruitHTML}`;

  return `
    <h3><span class="dot" style="background:${faction.color}"></span>${escapeHTML(city.name)} ${city.capital ? '👑' : ''}</h3>
    ${siegeHTML(state, city, isMine)}
    <div class="city-tabs" role="tablist">
      <button data-citytab="info" class="${cityTab === 'info' ? 'active' : ''}"
        role="tab" aria-selected="${cityTab === 'info'}">Infos</button>
      <button data-citytab="build" class="${cityTab === 'build' ? 'active' : ''}"
        role="tab" aria-selected="${cityTab === 'build'}">Bauen</button>
      <button data-citytab="trade" class="${cityTab === 'trade' ? 'active' : ''}"
        role="tab" aria-selected="${cityTab === 'trade'}">Handel</button>
    </div>
    ${cityTab === 'build' ? buildHTML : cityTab === 'trade'
    ? tradeHTML(state, city, isMine, player) : infoHTML}
  `;
}

function wallHTML(state, city, isMine, player) {
  const level = cityWallLevel(city);
  const built = level
    ? `<p class="wall-line wall-done">${wallLevelInfo(level).icon} ${wallLevelName(level)}
        <span class="muted">· +${Math.round((wallLevelInfo(level).defence - 1) * 100)}% Verteidigung</span></p>`
    : '<p class="wall-line muted">Keine Befestigung</p>';

  if (city.wallBuilding) {
    const stage = wallLevelInfo(city.wallBuilding.level);
    const left = city.wallBuilding.turnsLeft;
    const gesamt = city.wallBuilding.turns || stage.turns;
    const done = gesamt - left;
    return `${built}
      <p class="wall-line wall-building">🏗️ ${escapeHTML(stage.name)}
        ${city.wallBuilding.repair ? 'wird ausgebessert' : 'im Bau'} –
        noch ${left} ${left === 1 ? 'Runde' : 'Runden'}
        <span class="wall-track"><span class="wall-fill" style="width:${(done / gesamt) * 100}%"></span></span>
      </p>`;
  }

  const next = nextWallLevel(city);
  if (!next) {
    return `${built}<p class="wall-line muted">Höchste Ausbaustufe erreicht.</p>`;
  }
  if (!isMine || citySieged(state, city)) return built;

  const stage = wallLevelInfo(next);
  const bresche = wallRuined(city);
  const kosten = bresche ? repairCost(stage.cost) : stage.cost;
  const dauer = bresche ? repairTurns(stage.turns) : stage.turns;
  const tooPoor = player.gold < kosten;
  return `${built}
    ${bresche ? '<p class="wall-line muted">🏚️ Die Mauer hat eine Bresche aus der '
    + 'Eroberung – ausbessern kostet die Hälfte.</p>' : ''}
    <button class="build-btn wall-btn" ${tooPoor ? 'disabled' : ''}>
      ${stage.icon} ${escapeHTML(stage.name)} ${bresche ? 'ausbessern' : 'bauen'} – ${kosten} Gold
      <small>Stufe ${next} von ${MAX_WALL_LEVEL} · ${dauer} ${dauer === 1 ? 'Runde' : 'Runden'} ·
        +${Math.round((stage.defence - 1) * 100)}% Verteidigung${
  tooPoor ? ' · zu wenig Gold' : ''}</small>
    </button>
    <p class="wall-note">${escapeHTML(stage.note)}</p>`;
}

// --- Belagerung -----------------------------------------------------------
// Steht ein Feind unmittelbar vor dem Ort - oder eine Flotte vor seinem Hafen
// -, dann ist der Ort eingeschlossen. Das ist die wichtigste Zeile, die eine
// Stadt haben kann: sie steht deshalb ganz oben, in beiden Reitern.
function siegeHTML(state, city, isMine) {
  const info = siegeInfo(state, city);
  if (!info) return '';
  const feind = info.factions
    .map((id) => escapeHTML(factionById(state, id).name)).join(' und ');
  const art = info.camp ? 'aus einem Belagerungslager'
    : info.land && info.sea ? 'zu Lande und zur See'
      : info.sea ? 'vom Meer her' : 'zu Lande';
  const folgen = isMine
    ? 'Keine Steuer, kein Nachschub für die Wache, kein Bau.'
    : 'Der Ort trägt seinem Herrn nichts ein und stellt seine Wache nicht nach.';
  const hunger = info.hungert
    ? ' Es wird gehungert: jede Runde kostet Besatzung und Bürger.'
    : ` Nach ${info.bisHunger} ${info.bisHunger === 1 ? 'Runde' : 'Runden'} beginnt der Hunger.`;
  // Wer sonst noch davorsteht, führt die Belagerung nicht mit: ein Ort wird
  // von einem Reich belagert, nicht von zweien.
  const daneben = (info.daneben || [])
    .map((id) => escapeHTML(factionById(state, id).name));
  const auchDa = daneben.length
    ? ` <span class="muted">· ${daneben.join(' und ')} ${daneben.length === 1
      ? 'steht ebenfalls davor, führt die Belagerung aber nicht'
      : 'stehen ebenfalls davor, führen die Belagerung aber nicht'}.</span>`
    : '';
  return `<p class="siege-line">⚔️ Belagert ${art} – ${feind},
    ${info.men.toLocaleString('de-DE')} Mann${info.seit > 0
    ? `, seit ${info.seit} ${info.seit === 1 ? 'Runde' : 'Runden'}` : ''}
    <span class="muted">· ${folgen}${hunger}</span>${auchDa}</p>`;
}

// --- Bauwerke -------------------------------------------------------------
// Der Bauen-Reiter zeigt genau dreierlei: was steht, was gerade gebaut wird,
// und was sich hier und jetzt bauen ließe. Ein Bauwerk, dessen Voraussetzung
// fehlt - der Kornspeicher ohne Farm, das Bergwerk ohne Verwaltung, die Werft
// ohne Hafen -, erscheint gar nicht. Vorher stand für jedes Bauwerk eine
// eigene Funktion hier, und für jedes fehlende ein Satz, warum es nicht geht;
// beides zusammen war eine Liste, die man überspringen musste.
function buildingsHTML(state, city, isMine, player) {
  const liste = BUILDINGS.map((def) => buildingHTML(state, city, isMine, player, def)).join('');
  // Unter Belagerung ruht jede Baustelle. Ohne diesen Satz stünde der Reiter
  // einfach leer da, und man suchte den Fehler bei sich.
  if (isMine && citySieged(state, city)) {
    return `${liste}<p class="wall-line muted">🏗️ Unter Belagerung wird nicht gebaut –
      erst muss der Feind fort.</p>`;
  }
  return liste;
}

// Was ein fertiges Bauwerk hier tut. Beim Bergwerk hängt das am Berg, bei
// allen anderen steht es in der Tabelle.
function buildingEffect(state, city, def) {
  if (def.key === 'mine') {
    return `${mineIncomeOf(state, city)} Gold je Runde aus ${mineOre(state, city)} Erz im Umland`;
  }
  if (def.key === 'hunt') {
    return `${Math.round(HUNT_GROWTH * 100)} % mehr Zuwachs und `
      + `${huntIncomeOf(state, city)} Gold je Runde aus ${huntGame(state, city)} Wild im Umland`;
  }
  return def.purpose;
}

// Und was es verspricht, solange es noch ein Knopf ist.
function buildingPromise(state, city, def) {
  if (def.key === 'mine') {
    const erz = mineOre(state, city);
    return `danach ${mineIncome(erz)} Gold je Runde aus ${erz} Erz im Umland`;
  }
  if (def.key === 'hunt') {
    const wild = huntGame(state, city);
    return `${Math.round(HUNT_GROWTH * 100)} % mehr Zuwachs und `
      + `${huntIncome(wild)} Gold je Runde aus ${wild} Wild im Umland`;
  }
  return def.promise;
}

function buildingHTML(state, city, isMine, player, def) {
  const name = escapeHTML(buildingName(def.key, city.factionId));
  if (city[def.key]) {
    return `<p class="wall-line wall-done">${def.icon} ${name}
      <span class="muted">· ${escapeHTML(buildingEffect(state, city, def))}</span></p>`;
  }
  const bau = city[`${def.key}Building`];
  if (bau) {
    const gesamt = bau.turns || def.turns;
    const done = gesamt - bau.turnsLeft;
    return `<p class="wall-line wall-building">🏗️ ${name}
      ${bau.repair ? 'im Wiederaufbau' : 'im Bau'} –
      noch ${bau.turnsLeft} ${bau.turnsLeft === 1 ? 'Runde' : 'Runden'}
      <span class="wall-track"><span class="wall-fill" style="width:${(done / gesamt) * 100}%"></span></span>
    </p>`;
  }
  if (!isMine || !canBuildBuilding(state, city, def.key)) return '';
  // Über Trümmern wird billiger gebaut: die Grundmauern stehen noch.
  const preis = buildingPrice(city, def);
  const tooPoor = player.gold < preis.cost;
  return `<button class="build-btn" data-build="${def.key}" ${tooPoor ? 'disabled' : ''}>
      ${preis.repair ? '🏚️' : def.icon} ${name}
      ${preis.repair ? 'wieder aufbauen' : 'bauen'} – ${preis.cost} Gold
      <small>${preis.turns} ${preis.turns === 1 ? 'Runde' : 'Runden'} ·
        ${preis.repair ? 'aus den Trümmern der Eroberung, zum halben Preis · ' : ''}${
  escapeHTML(buildingPromise(state, city, def))}${
  tooPoor ? ' · zu wenig Gold' : ''}</small>
    </button>`;
}

// Im Info-Reiter dieselbe Auskunft in einer Zeile: was hier steht.
function buildingSummaryHTML(city) {
  const stehen = BUILDINGS.filter((def) => city[def.key]);
  // Und was die letzte Eroberung liegen ließ.
  const truemmer = BUILDINGS.filter((def) => buildingRuined(city, def.key));
  const ruinen = truemmer.length || wallRuined(city)
    ? `<p class="wall-line muted">🏚️ In Trümmern: ${[
      wallRuined(city) ? 'die Mauer' : null,
      ...truemmer.map((def) => escapeHTML(buildingName(def.key, city.factionId))),
    ].filter(Boolean).join(', ')} – Wiederaufbau zum halben Preis</p>` : '';
  if (!stehen.length) return `<p class="wall-line muted">🏗️ Keine Bauwerke</p>${ruinen}`;
  return `<p class="wall-line wall-done">${stehen.map((def) =>
    `${def.icon} ${escapeHTML(buildingName(def.key, city.factionId))}`).join(' · ')}</p>${ruinen}`;
}

function fleetHTML(city, isMine, player) {
  if (!isMine || !city.harbour || !city.shipyard) return '';
  // Bis zu drei Bauarten je Fraktion, und die Werft baut die, die man wählt.
  // Die erste ist die, mit der dieses Reich in den Krieg zieht; die anderen
  // sind billiger oder schneller, aber nicht besser.
  const bauarten = shipTypesOf(city.factionId);
  if (!bauarten.length) return '';
  return `
    <p class="road-head">⚓ Werft <span class="muted">· ${bauarten.length === 1
    ? 'eine Bauart' : `${bauarten.length} Bauarten · je ${WARSHIP_BATCH} Schiffe`}</span></p>
    ${bauarten.map((ship, index) => {
    const tooPoor = player.gold < ship.cost;
    return `<button class="fleet-btn" data-ship="${ship.key}" ${tooPoor ? 'disabled' : ''}>
      ${ship.icon} ${WARSHIP_BATCH} ${escapeHTML(ship.name)} bauen – ${ship.cost} Gold
      <small>${index === 0 ? 'Hauptbauart · ' : ''}${escapeHTML(ship.note)}${
  tooPoor ? ' · zu wenig Gold' : ''}</small>
    </button>`;
  }).join('')}`;
}

// --- Straßenbau ----------------------------------------------------------
// Die Stadt bietet an, wohin sie als Nächstes eine Straße legen kann: die
// nächsten eigenen Orte ohne Anschluss, mit Preis und Bauzeit.
// --- Handel ---------------------------------------------------------------
// Der dritte Reiter: was der Ort hervorbringt, welche Wege von ihm ausgehen,
// und mit wem sich noch einer eröffnen ließe. Bewusst knapp - der Handel soll
// eine Entscheidung von zwei Klicks sein, keine Tabelle.
function tradeHTML(state, city, isMine, player) {
  if (!isMine) return '<p class="muted">Über den Handel fremder Orte ist nichts bekannt.</p>';
  const own = tradeGoodInfo(state, city);
  const routes = tradeRoutesOf(state, city.id);
  const partners = tradePartners(state, city);
  const income = tradeIncomeOf(state, city);

  const head = `
    <p class="income-line">${own.icon} ${escapeHTML(own.name)}
      <span class="muted">· was ${escapeHTML(city.name)} hervorbringt</span></p>
    <p class="wall-line ${income ? 'wall-done' : 'muted'}">⚖️ Handel
      ${income ? `<strong>+${income} Gold je Runde</strong>` : 'kein Handel'}
      <span class="muted">· ${routes.length} von ${TRADE_ROUTES_PER_CITY} Wegen</span></p>`;

  const open = routes.map((route) => {
    const other = tradePartnerOf(state, route, city.id);
    if (!other) return '';
    const good = tradeGoodInfo(state, other);
    // Ein Seeweg, auf dem Seeräuber kreuzen, trägt nur die Hälfte - das steht
    // hier, sonst wundert man sich über die fehlenden Einnahmen.
    const gekapert = tradeRouteRaided(state, city, other);
    // Und ein Seeweg, dessen Hafen gesperrt ist, trägt gar nichts.
    const gesperrt = tradeRouteBlockaded(state, city, other);
    const fremd = other.factionId !== city.factionId
      ? factionById(state, other.factionId) : null;
    return `<p class="wall-line ${gekapert || gesperrt ? '' : 'wall-done'} trade-line"><span>${
  gesperrt ? '⛔' : gekapert ? '🏴' : route.kind === 'sea' ? '⛵' : '🛣️'}
      ${escapeHTML(other.name)}${fremd ? ` <span class="muted">(${escapeHTML(fremd.name)})</span>` : ''}
      <span class="muted">· ${good.icon} ${escapeHTML(good.name)} ·
      +${tradeRouteIncome(state, city, other)} Gold je Runde${
  gesperrt ? ' · der Hafen ist gesperrt' : gekapert ? ' · Seeräuber nehmen die Hälfte' : ''}</span></span>
      <button class="trade-close-btn" data-route="${route.id}">aufgeben</button></p>`;
  }).join('');

  if (routes.length >= TRADE_ROUTES_PER_CITY) {
    return `${head}${open}
      <p class="wall-line muted">Mehr Wege trägt ${escapeHTML(city.name)} nicht.</p>`;
  }
  // Mit wem ein Handelsabkommen steht: dessen Städte zählen wie eigene, wenn
  // eine Straße oder zwei Häfen dazwischenliegen. Das steht hier, weil man den
  // Vertrag im Diplomatiefenster schließt und die Wirkung hier sieht.
  const paktMit = state.factions
    .filter((f) => !f.isNeutral && f.alive && f.id !== city.factionId
      && hasTradePact(state, city.factionId, f.id))
    .map((f) => f.name);
  const paktZeile = paktMit.length
    ? `<p class="wall-line muted">⚖️ Handelsabkommen mit ${escapeHTML(paktMit.join(', '))}
       – deren Städte stehen dir offen wie eigene.</p>`
    : '<p class="wall-line muted">⚖️ Ohne Handelsabkommen handelst du nur zwischen '
      + 'eigenen Orten. Ein Abkommen im Diplomatiefenster öffnet dir auch die Städte '
      + 'des anderen Reichs.</p>';

  if (!partners.length) {
    return `${head}${open}
      <p class="wall-line muted">Kein Ort in Reichweite, mit dem sich handeln ließe.
      Es braucht eine durchgehende Straße – oder auf beiden Seiten einen Hafen.</p>
      ${paktZeile}`;
  }
  return `${head}${open}${paktZeile}
    <p class="road-head">⚖️ Handelsweg eröffnen <span class="muted">· einmalig
      ${TRADE_ROUTE_COST} Gold, trägt beiden Enden</span></p>
    <div class="road-row">
      ${partners.map((p) => {
        const tooPoor = player.gold < TRADE_ROUTE_COST;
        const good = TRADE_GOODS[p.good];
        const fremd = p.city.factionId !== city.factionId
          ? factionById(state, p.city.factionId) : null;
        return `<button class="trade-btn" data-target="${p.city.id}" ${tooPoor ? 'disabled' : ''}>
          ${p.kind === 'sea' ? '⛵' : '🛣️'} ${escapeHTML(p.city.name)}${
  fremd ? ` <em>· ${escapeHTML(fremd.name)}</em>` : ''}
          <small>${good.icon} ${escapeHTML(good.name)} · +${p.income} Gold je Seite${
  tooPoor ? ' · zu wenig Gold' : ''}</small>
        </button>`;
      }).join('')}
    </div>`;
}

// Ob dieser Ort am Straßennetz hängt - und wenn ja, woran. Eine Straße auf
// der Karte ist unter den Dächern schwer zu sehen; hier steht sie als Satz.
function roadStatusHTML(state, city) {
  const eigene = state.cities.filter((c) => c.factionId === city.factionId && c.id !== city.id);
  const verbunden = eigene.filter((other) => roadConnected(state, city, other));
  if (!verbunden.length) {
    return `<p class="wall-line muted">🛣️ Ohne Anschluss ans Straßennetz</p>`;
  }
  const naechste = verbunden
    .map((other) => ({ other, d: Math.abs(other.col - city.col) + Math.abs(other.row - city.row) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 2)
    .map((entry) => escapeHTML(entry.other.name));
  return `<p class="wall-line wall-done">🛣️ Am Straßennetz
    <span class="muted">· verbunden mit ${naechste.join(' und ')}${
  verbunden.length > naechste.length ? ` und ${verbunden.length - naechste.length} weiteren` : ''
}</span></p>`;
}

// Der Ausbau: was schon liegt, wird gepflastert. Das setzt eine Verwaltung
// voraus - eine Steinstraße ist Vermessung, Fronarbeit und Abrechnung.
function stoneHTML(state, city, player) {
  const ziele = stoneTargets(state, city);
  if (!ziele.length) {
    if (!city.forum) {
      return `<p class="wall-line muted">🧱 Kein Ausbau zur Steinstraße –
        ${escapeHTML(buildingName('forum', city.factionId))} fehlt.</p>`;
    }
    return '';
  }
  return `
    <p class="road-head">🧱 Ausbau zur Steinstraße <span class="muted">· ein Feld kostet dann
      nur ${STONE_ROAD_MOVE_COST} Bewegungspunkt statt ${ROAD_MOVE_COST}</span></p>
    <div class="road-row">
      ${ziele.map((t) => {
    const tooPoor = player.gold < t.cost;
    return `<button class="road-btn" data-stone="${t.cityId}" ${tooPoor ? 'disabled' : ''}>
          nach ${escapeHTML(t.name)}
          <small>${t.cost} Gold · ${t.length} Felder · ${t.turns} Runden${
  tooPoor ? ' · zu wenig Gold' : ''}</small>
        </button>`;
  }).join('')}
    </div>`;
}

function roadHTML(state, city, isMine, player) {
  const project = roadProjectOf(state, city.id);
  if (project) {
    const done = project.turns - project.turnsLeft;
    const other = project.fromId === city.id ? project.toName : project.fromName;
    const stein = (project.level || 1) >= 2;
    return `<p class="wall-line wall-building">${stein ? '🧱 Steinstraße' : '🛣️ Straße'}
      nach ${escapeHTML(other)} im Bau –
      noch ${project.turnsLeft} ${project.turnsLeft === 1 ? 'Runde' : 'Runden'}
      <span class="wall-track"><span class="wall-fill" style="width:${(done / project.turns) * 100}%"></span></span>
    </p>`;
  }
  if (!isMine || citySieged(state, city)) return '';

  const targets = roadTargets(state, city);
  const stein = stoneTargets(state, city);
  if (!targets.length && !stein.length) {
    return `<p class="wall-line muted">🛣️ Alle nahen Orte sind an das Straßennetz
      angeschlossen${city.forum ? ' und ausgebaut' : ''}.</p>`;
  }
  return `
    ${targets.length ? `
    <p class="road-head">🛣️ Straßenbau <span class="muted">· ein Feld Straße kostet nur
      ${ROAD_MOVE_COST} Bewegungspunkte statt ${TILE_TYPES.plains.cost}</span></p>
    <div class="road-row">
      ${targets.map((t) => {
        const tooPoor = player.gold < t.cost;
        return `<button class="road-btn" data-target="${t.cityId}" ${tooPoor ? 'disabled' : ''}>
          nach ${escapeHTML(t.name)}
          <small>${t.cost} Gold · ${t.length} Felder · ${t.turns} Runden${
  tooPoor ? ' · zu wenig Gold' : ''}</small>
        </button>`;
      }).join('')}
    </div>` : ''}
    ${stoneHTML(state, city, player)}`;
}

// --- Nachschlagefenster --------------------------------------------------
// Was auf einem Feld steht, ohne dass man dafür etwas auswählen muss: Gelände,
// Wetter, Stadt und Armee mit allem, was für die nächste Entscheidung zählt.

function armyInfoHTML(state, army) {
  const owner = factionById(state, army.factionId);
  const stars = starMarks(army.experience);
  return `
    <div class="ti-block">
      <h4><span class="dot" style="background:${owner.color}"></span>${escapeHTML(army.name)}
        ${army.embarked ? '⛵' : ''}</h4>
      <p class="ti-line">${escapeHTML(owner.name)} ·
        ${unitTotalCount(army.units).toLocaleString('de-DE')} Mann ·
        <span class="vet-stars">${stars}</span> ${escapeHTML(starTitle(army.experience))}</p>
      <p class="ti-line">Moral ${Math.round(army.morale ?? 100)} ·
        Erschöpfung ${Math.round(army.exhaustion ?? 0)} ·
        Bewegung ${army.movement} / ${army.maxMovement}</p>
      <div class="unit-list">${unitBreakdownHTML(army.units, army.factionId)}</div>
    </div>`;
}

function cityInfoHTML(state, city) {
  const owner = factionById(state, city.factionId);
  const level = cityWallLevel(city);
  const watch = city.garrison[WATCH_ROLE] || 0;
  const intel = cityIntel(state, city);
  if (intel !== 'own') {
    // Von einem fremden Ort steht hier nur, was von außen zu sehen ist.
    const total = unitTotalCount(city.garrison);
    return `
    <div class="ti-block">
      <h4><span class="dot" style="background:${owner.color}"></span>${escapeHTML(city.name)}
        ${city.capital ? '👑' : ''}</h4>
      <p class="ti-line">${settlementLabel(city)} · ${escapeHTML(owner.name)}</p>
      <p class="ti-line">${level ? `${wallLevelInfo(level).icon} ${wallLevelName(level)}` : 'keine Befestigung'}
        · ${city.harbour ? '⚓ Hafen' : 'kein Hafen'}</p>
      <p class="ti-line">${intel === 'scouted'
    ? `Besatzung ${roughly(total, 50)} Mann · ${garrisonWord(total)}`
    : garrisonWord(total)}</p>
      ${siegeHTML(state, city, false)}
    </div>`;
  }
  return `
    <div class="ti-block">
      <h4><span class="dot" style="background:${owner.color}"></span>${escapeHTML(city.name)}
        ${city.capital ? '👑' : ''}</h4>
      <p class="ti-line">${settlementLabel(city)} · ${escapeHTML(owner.name)} ·
        ${city.population.toLocaleString('de-DE')} Einwohner${wachstumHTML(city)}</p>
      <p class="ti-line">Garnison ${unitTotalCount(city.garrison).toLocaleString('de-DE')} ·
        🛡️ Stadtwache ${watch.toLocaleString('de-DE')} /
        ${watchTarget(city, owner).toLocaleString('de-DE')}</p>
      <p class="ti-line">${level ? `${wallLevelInfo(level).icon} ${wallLevelName(level)}` : 'keine Befestigung'}
        · ${city.harbour ? '⚓ Hafen' : 'kein Hafen'}</p>
      ${siegeHTML(state, city, true)}
      <p class="ti-line">💰 ${cityIncome(state, city).total.toLocaleString('de-DE')} Gold je Runde</p>
      <div class="unit-list">${unitBreakdownHTML(city.garrison, city.factionId)}</div>
    </div>`;
}

export function tileInfoHTML(state, tile) {
  if (!tile) return '';
  const { col, row } = tile;
  if (col < 0 || col >= state.map.cols || row < 0 || row >= state.map.rows) return '';
  const city = cityAt(state, col, row);
  const army = armyAt(state, col, row);
  return `
    ${city ? cityInfoHTML(state, city) : ''}
    ${army ? armyInfoHTML(state, army) : ''}
    ${wonderPanelHTML(state, wonderAt(state, col, row))}
    ${terrainPanelHTML(state, tile, { standalone: true })}`;
}

const TERRAIN_ICONS = {
  plains: '🌾', forest: '🌲', hills: '⛰️', desert: '🏜️', mountain: '🏔️', water: '🌊',
};

function terrainFactsHTML(state, col, row) {
  const tile = state.map.tiles[row][col];
  const def = TILE_TYPES[tile.type];
  const facts = [];

  if (tile.type === 'water') {
    facts.push(['Bewegung', `zur See ${SEA_MOVE_COST} `
      + `${SEA_MOVE_COST === 1 ? 'Punkt' : 'Punkte'} je Feld · für Landarmeen unpassierbar`]);
  } else {
    const stufe = roadLevelOf(state.roads && state.roads[`${col},${row}`]);
    const gelaende = tileMoveCost(tile);
    const stride = stufe ? roadStepCost(stufe) : gelaende;
    const saved = stufe && gelaende > stride
      ? ` (${stufe >= 2 ? 'Steinstraße' : 'Straße'} statt ${gelaende})` : '';
    facts.push(['Bewegungskosten', tileImpassable(tile)
      ? 'unpassierbar'
      : `${stufe >= 2 ? '🧱 ' : stufe ? '🛣️ ' : ''}${stride} `
        + `${stride === 1 ? 'Punkt' : 'Punkte'} je Feld${saved}`]);
    facts.push(['Verteidigung', def.defense > 0
      ? `+${Math.round(def.defense * 15)}% für den Verteidiger`
      : 'kein Geländevorteil']);
    facts.push(['Höhe', `${tileAltitude(tile)} m`]);
    // Ein Gebirge ist nicht mehr pauschal gesperrt - beim Gebirge gehört
    // deshalb dazu, warum man hier durchkommt oder eben nicht.
    if (tile.type === 'mountain') {
      facts.push(['Übergang', tileImpassable(tile)
        ? `über ${PASSABLE_ALTITUDE} m – Fels und Eis, kein Weg für ein Heer`
        : `ein Pass unter ${PASSABLE_ALTITUDE} m – mühsam, aber begehbar`]);
    }
  }
  // Was im Berg liegt. Auf der Karte steht dort ein aufgebrochener Fels; hier
  // steht, was er für ein Bergwerk zählt.
  const erzwert = MINE_ORE[tile.type] || 0;
  if (erzwert > 0) {
    const orte = state.cities.filter((c) => Math.abs(c.col - col) <= MINE_RANGE
      && Math.abs(c.row - row) <= MINE_RANGE);
    const beste = orte.map((c) => ({ city: c, erz: mineOre(state, c) }))
      .filter((e) => e.erz >= MINE_MIN_ORE)
      .sort((a, b) => b.erz - a.erz)[0];
    facts.push(['⛏️ Erz', `${erzwert} ${erzwert === 1 ? 'Punkt' : 'Punkte'} für ein `
      + `${MINE_NAME}${beste ? ` in ${beste.city.name} (${beste.erz} Erz im Umland)`
        : ' – kein Ort nah genug'}`]);
  }
  // Wessen Land das ist. Seit eine Grenzverletzung Krieg bedeutet, ist das
  // keine Farbe mehr, sondern eine Auskunft, die man vor dem Marsch braucht.
  const herr = territoryOwner(state, col, row);
  if (herr) {
    const faction = factionById(state, herr);
    const spieler = playerFaction(state);
    const eigen = herr === spieler.id;
    const zutritt = eigen || atWar(state, spieler.id, herr)
      || hasPassage(state, spieler.id, herr);
    facts.push(['Land', `${faction ? faction.name : herr}${eigen ? ' – dein Land'
      : zutritt ? '' : ' · ohne Betretungsrecht bedeutet ein Marsch dorthin Krieg'}`]);
  } else if (tile.type !== 'water') {
    facts.push(['Land', 'niemandes Land']);
  }
  facts.push(['Lage', tilePosition(col, row).label]);

  const weather = weatherAt(state, col, row);
  const consequences = [];
  if (weather.moveCost) consequences.push(`+${weather.moveCost} Bewegung je Feld`);
  if (weather.wear) consequences.push(`Erschöpfung +${weather.wear} je Runde`);
  if (weather.spirit) consequences.push(`Moral ${weather.spirit} je Runde`);
  if (weather.volley === false) consequences.push('kein Fernkampf-Auftakt');
  for (const [unit, scale] of Object.entries(weather.unitScale || {})) {
    consequences.push(`${ROLE_LABELS[unit]} ${Math.round((scale - 1) * 100)}%`);
  }
  facts.push([`${weather.icon} ${weather.name}`,
    consequences.length ? consequences.join(' · ') : 'ohne Auswirkung']);

  return facts.map(([label, value]) =>
    `<div class="terrain-fact"><span>${label}</span><strong>${escapeHTML(value)}</strong></div>`).join('');
}

// Ein Weltwunder oder Wahrzeichen auf dem angeklickten Feld: was es ist, wann
// es gebaut wurde, wer daran verdient.
function wonderPanelHTML(state, wonder) {
  if (!wonder) return '';
  const city = wonder.cityId && state.cities.find((c) => c.id === wonder.cityId);
  const owner = city && factionById(state, city.factionId);
  const heading = wonder.wonder ? 'Weltwunder der Antike' : 'Wahrzeichen der Alten Welt';
  const holder = city
    ? `<span class="dot" style="background:${owner.color}"></span>${escapeHTML(city.name)}
       <em>${escapeHTML(owner.name)}</em> – ${wonder.income} Gold je Runde`
    : 'Kein Ort in der Nähe – niemand zieht Nutzen daraus.';
  return `
    <div class="wonder-panel">
      <p class="wonder-kind">${wonder.wonder ? '🏛️' : '🗿'} ${heading}</p>
      <h3 class="wonder-name">${escapeHTML(wonder.name)}</h3>
      <p class="wonder-built">Errichtet ${escapeHTML(wonder.built)}</p>
      <p class="wonder-note">${escapeHTML(wonder.note)}</p>
      <p class="wonder-owner">${holder}</p>
    </div>`;
}

// What the player learns by clicking a tile. Shown on its own for open ground,
// and under the army or city panel for a tile that is occupied.
export function terrainPanelHTML(state, tile, opts = {}) {
  if (!tile) return '';
  const { col, row } = tile;
  if (col < 0 || col >= state.map.cols || row < 0 || row >= state.map.rows) return '';
  const type = state.map.tiles[row][col].type;
  const def = TILE_TYPES[type];

  const city = cityAt(state, col, row);
  const army = armyAt(state, col, row);
  const occupants = [];
  // Was oben schon als Auswahl steht, wird hier nicht wiederholt.
  // Im Nachschlagefenster stehen Stadt und Armee schon ausführlich darüber,
  // in der Seitenleiste nur, was gerade ausgewählt ist.
  const shownAbove = opts.standalone
    ? new Set([city && city.id, army && army.id].filter(Boolean))
    : new Set([state.selectedCityId, state.selectedArmyId].filter(Boolean));
  if (city && !shownAbove.has(city.id)) {
    const owner = factionById(state, city.factionId);
    occupants.push(`<span class="dot" style="background:${owner.color}"></span>
      ${escapeHTML(city.name)} <em>${settlementLabel(city)}, ${escapeHTML(owner.name)}</em>`);
  }
  if (army && !shownAbove.has(army.id)) {
    const owner = factionById(state, army.factionId);
    occupants.push(`<span class="dot" style="background:${owner.color}"></span>
      ${escapeHTML(army.name)} <span class="vet-stars">${starMarks(army.experience)}</span>
      <em>${unitTotalCount(army.units).toLocaleString('de-DE')} Mann${
  army.embarked ? ', zur See' : ''}</em>`);
  }

  const notes = [];
  if (type !== 'water' && !def.impassable) {
    const shore = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .some(([dc, dr]) => isWaterTile(state, col + dc, row + dr));
    if (shore) notes.push('Küstenfeld – eine Flotte kann hier landen.');
  }
  if (city && !shownAbove.has(city.id)) {
    if (city.harbour) notes.push('Hafen – hier kann eine Armee in See stechen.');
    if (cityWallLevel(city)) notes.push(`Befestigt: ${wallLevelName(cityWallLevel(city))}.`);
  }

  // Whose ground this is in the sense that matters for movement. Only hostile
  // control is worth saying - your own army holding the ground next to your
  // own capital is not news.
  const player = playerFaction(state);
  const holders = state.armies.filter((a) => a.factionId !== player.id
    && !!a.embarked === (type === 'water')
    && Math.abs(a.col - col) + Math.abs(a.row - row) === 1);
  if (holders.length) {
    const names = [...new Set(holders.map((a) => factionById(state, a.factionId).name))];
    notes.push(`Im Kontrollbereich von ${names.join(' und ')} – hineinzuziehen kostet `
      + `${ZOC_EXTRA_COST} Bewegungspunkte mehr, und aus dem Kontrollbereich heraus `
      + 'geht es nur ins Freie oder in den Angriff.');
  }
  // Einmal je Ansicht genügt: im Nachschlagefenster steht das Bauwerk in
  // seinem eigenen Block darüber, und in der Seitenleiste in der Stadt, wenn
  // die gerade ausgewählt ist.
  const landmark = wonderAt(state, col, row);
  if (landmark && !opts.standalone && !(city && shownAbove.has(city.id))) {
    notes.push(`${landmark.wonder ? '🏛️ Weltwunder' : '🗿 Wahrzeichen'}: ${landmark.name} `
      + `– ${landmark.income} Gold je Runde für den, der den nächsten Ort hält.`);
  }
  const rivers = riverSidesOf(state, col, row);
  if (rivers.length) {
    const offen = rivers.filter((r) => !r.bridged).map((r) => r.name);
    const bruecken = rivers.filter((r) => r.bridged).map((r) => r.name);
    const teile = [];
    if (offen.length) {
      teile.push(`im ${offen.join(' und ')} ein Fluss – hinüberzuziehen kostet `
        + `${RIVER_CROSSING_COST} Bewegungspunkte zusätzlich`);
    }
    if (bruecken.length) {
      teile.push(`im ${bruecken.join(' und ')} führt eine Straßenbrücke hinüber – `
        + 'das kostet nichts');
    }
    notes.push(`🌉 ${teile.join('; ')}.`);
  }
  if (type === 'desert') notes.push('Wüste – zäh zu durchqueren und ohne Deckung.');
  const sky = weatherAt(state, col, row);
  if (sky.note && sky.effect) notes.push(`${zoneName(zoneOf(row, type === 'water'))}: ${sky.note}`);
  if (type === 'mountain') notes.push('Gebirge – für Armeen unpassierbar.');

  return `
    <div class="terrain-panel">
      <h3 class="terrain-head">${TERRAIN_ICONS[type] || ''} ${escapeHTML(def.name || type)}</h3>
      <div class="terrain-facts">${terrainFactsHTML(state, col, row)}</div>
      ${occupants.length ? `<ul class="terrain-here">${
        occupants.map((o) => `<li>${o}</li>`).join('')}</ul>` : ''}
      ${notes.map((n) => `<p class="terrain-note">${escapeHTML(n)}</p>`).join('')}
    </div>`;
}

// --- Protokollfilter ------------------------------------------------------
// Zwölf Fraktionen führen zwölf Kriege; ungefiltert geht der eigene darin
// unter. Standardmäßig steht deshalb nur im Protokoll, was die eigene
// Fraktion angeht - Jahreszeiten und Wetter gelten für alle und bleiben.

let logFilter = 'own';

// Wie viele Zeilen der Filter gerade durchlässt - die Zahl am Reiter zählt
// dasselbe, was auch zu sehen wäre.
export function visibleLogCount(state) {
  if (!state) return 0;
  const player = playerFaction(state);
  return state.log.filter((entry) => logConcernsPlayer(entry, player.id)).length;
}

function logConcernsPlayer(entry, playerId) {
  if (logFilter === 'all') return true;
  if (!entry.factions || !entry.factions.length) return true;
  return entry.factions.includes(playerId);
}

// --- Reichsübersicht -------------------------------------------------------
// Was das Reich in dieser Runde trägt: jeder Ort mit seinen Einnahmen, die
// Summe darunter, und was die Heere davon wieder auffressen. Gerechnet wird
// mit denselben Funktionen wie beim Rundenwechsel - die Übersicht zeigt keine
// Schätzung, sondern die Abrechnung selbst.
// --- Diplomatie -----------------------------------------------------------
// Das Fenster zeigt jeden lebenden Herrscher: wer er ist, was für einer er
// ist, wie er zu dir steht - und was sich daran tun lässt. Der Spieler steht
// mit oben in der Liste: er ist einer von ihnen, nicht die Ausnahme.

function traitBarHTML(trait, value) {
  return `
    <div class="cond-row">
      <span class="cond-name">${TRAIT_NAMES[trait]}</span>
      <span class="cond-track"><span class="cond-fill cond-trait"
        style="width:${Math.round(value)}%"></span></span>
      <span class="cond-value">${Math.round(value)} <em>${traitLabel(trait, value)}</em></span>
    </div>`;
}

export function rulerCardHTML(state, faction, options = {}) {
  const ruler = rulerOf(state, faction.id);
  const player = playerFaction(state);
  const own = faction.id === player.id;
  const krieg = !own && atWar(state, player.id, faction.id);
  const ansehen = own ? null : opinionOf(state, player.id, faction.id);
  const relation = own ? null : relationOf(state, player.id, faction.id);
  const urteil = own || !krieg ? null : peaceVerdict(state, player.id, faction.id, 0);
  // Was ihn ein Frieden kostet, steht auf dem Knopf: bei dem einen ein Beutel
  // Gold, bei dem anderen gar nichts - und bei manchem ist kein Preis genug.
  const preis = own || !krieg ? null : peacePrice(state, player.id, faction.id);
  const bezahlbar = preis !== null && preis > 0 && player.gold >= preis;

  // Fristen: nach einer Kriegserklärung wird nicht sofort wieder verhandelt,
  // nach einem Frieden nicht sofort wieder gebrochen. Was gesperrt ist, steht
  // ausgegraut da und sagt, wie lange noch.
  const friedensSperre = own ? null : diploLock(state, player.id, faction.id, 'frieden');
  const kriegsSperre = own ? null : diploLock(state, player.id, faction.id, 'krieg');
  const geschenkSperre = own ? null : diploLock(state, player.id, faction.id, 'geschenk');
  // Ein gegebenes Wort bindet die Hand: gegen einen Pakt oder ein Bündnis wird
  // nicht marschiert, ehe es aufgekündigt ist. Der Knopf sagt das, statt den
  // Klick ins Leere laufen zu lassen.
  const bindung = own ? null : warBound(state, player.id, faction.id);
  // Ein Gesandter, der auf eine Antwort wartet, geht allem anderen vor.
  const angebot = own ? null : offerFrom(state, faction.id, player.id);

  const angebotHTML = !angebot ? '' : `
    <div class="road-row diplo-actions diplo-offer">
      <p class="diplo-note">🕊 ${escapeHTML(angebot.ruler)} schickt einen Gesandten:
        ${escapeHTML(angebot.grund)}${angebot.tribut > 0
    ? ` – und ${angebot.tribut.toLocaleString('de-DE')} Gold dazu` : ''}.
        Er wartet noch ${Math.max(1, angebot.laeuftAb - state.turn)} Runden.</p>
      <button class="diplo-btn" data-act="accept" data-faction="${faction.id}">
        🕊 Angebot annehmen
        <small>${angebot.tribut > 0
    ? `${angebot.tribut.toLocaleString('de-DE')} Gold gehen in deine Truhe`
    : 'der Krieg endet ohne Zahlung'}</small>
      </button>
      <button class="diplo-btn diplo-war" data-act="reject" data-faction="${faction.id}">
        ✋ Ausschlagen
        <small>er merkt es sich – und schickt so bald keinen zweiten</small>
      </button>
    </div>`;

  // --- Wie dieses Reich zur Welt steht -----------------------------------
  // Mit wem es Krieg führt und mit wem es verbündet ist. Genannt wird nur, was
  // man selbst wissen kann: ein Reich, das man nicht kennt, taucht auch in
  // fremden Kriegen nicht auf. Vorher stand in der Karte nur, wie dieses Reich
  // zu einem selbst steht - wer wissen wollte, ob sein Gegner noch andere
  // Feinde hat, musste raten.
  const dritte = state.factions.filter((f) => !f.isNeutral && f.alive
    && f.id !== faction.id && f.id !== player.id
    && knowsFaction(state, player.id, f.id));
  const kriege = dritte.filter((f) => atWar(state, faction.id, f.id));
  const buende = dritte.filter((f) => isAllied(state, faction.id, f.id));
  const pakte = dritte.filter((f) => !isAllied(state, faction.id, f.id)
    && hasPact(state, faction.id, f.id));
  const lage = [
    kriege.length ? `⚔ Krieg mit ${kriege.map((f) => escapeHTML(f.name)).join(', ')}` : null,
    buende.length ? `🛡️ verbündet mit ${buende.map((f) => escapeHTML(f.name)).join(', ')}` : null,
    pakte.length ? `🤝 Pakt mit ${pakte.map((f) => escapeHTML(f.name)).join(', ')}` : null,
  ].filter(Boolean);
  const lageHTML = `<p class="diplo-lage">${lage.length
    ? lage.join(' · ')
    : `${own ? 'Du stehst' : 'Er steht'} mit keinem anderen bekannten Reich `
      + 'im Krieg oder im Bund.'}</p>`;

  // --- Verträge ---------------------------------------------------------
  // Was zwischen euch gilt, und was sich schließen ließe. Im Krieg steht hier
  // nichts: erst der Friede, dann das Pergament.
  const vertraege = own ? [] : treatiesOf(state, player.id, faction.id);
  const vertragsSperre = own ? null : diploLock(state, player.id, faction.id, 'vertrag');
  const vertragsZeilen = vertraege.map((def) => {
    const eintrag = treatyOf(state, player.id, faction.id, def.key);
    const rest = eintrag && eintrag.bis ? eintrag.bis - state.turn : null;
    return `<p class="diplo-treaty">${def.icon} ${def.name}
      <span class="muted">· ${escapeHTML(def.zweck)}${rest !== null
    ? ` · noch ${rest} ${rest === 1 ? 'Runde' : 'Runden'}` : ''}</span></p>`;
  }).join('');

  const vertragsKnoepfe = own || krieg ? '' : TREATY_KEYS.map((kind) => {
    const def = TREATIES[kind];
    if (treatyOf(state, player.id, faction.id, kind)) {
      // Was steht, lässt sich aufkündigen - beim Bündnis vor aller Augen.
      return `<button class="diplo-btn${kind === 'buendnis' ? ' diplo-war' : ''}"
        data-act="renounce" data-faction="${faction.id}" data-kind="${kind}">
        ✋ ${vertragDenAkk(def)} aufkündigen
        <small>${kind === 'buendnis'
    ? 'kostet dich sein Ansehen – und das aller, die davon hören'
    : 'er gilt dann nicht mehr'}</small>
      </button>`;
    }
    const urteil = treatyVerdict(state, player.id, faction.id, kind);
    if (!urteil.possible) {
      return `<button class="diplo-btn" disabled>
        ${def.icon} ${def.name}
        <small>${escapeHTML(urteil.grund)}</small>
      </button>`;
    }
    return `<button class="diplo-btn" data-act="treaty" data-faction="${faction.id}"
      data-kind="${kind}" ${vertragsSperre ? 'disabled' : ''}>
      ${def.icon} ${def.name} vorschlagen
      <small>${vertragsSperre ? escapeHTML(vertragsSperre.text)
    : `${escapeHTML(def.versprechen)} · ${urteil.accepted
      ? 'er würde annehmen' : 'er würde ablehnen'}${urteil.gruende.length
      ? ` · ${escapeHTML(urteil.gruende[0])}` : ''}`}</small>
    </button>`;
  }).join('');

  const knoepfe = own ? '' : `${angebotHTML}
    <div class="road-row diplo-actions">
      ${krieg ? `
        <button class="diplo-btn" data-act="peace" data-faction="${faction.id}" data-tribute="0"
          ${friedensSperre ? 'disabled' : ''}>
          🕊 Frieden anbieten
          <small>${friedensSperre ? escapeHTML(friedensSperre.text)
    : `${urteil && urteil.accepted ? 'er würde annehmen' : 'er würde ablehnen'}${
      urteil && urteil.gruende && urteil.gruende.length ? ` · ${urteil.gruende[0]}` : ''}`}</small>
        </button>
        ${preis === 0 || friedensSperre ? '' : `
        <button class="diplo-btn" data-act="peace" data-faction="${faction.id}"
          data-tribute="${preis || 0}" ${bezahlbar ? '' : 'disabled'}>
          🕊 Frieden mit Tribut
          <small>${preis === null
    ? 'für kein Gold der Welt zu haben'
    : `${preis.toLocaleString('de-DE')} Gold · ${bezahlbar
      ? 'so viel verlangt er' : 'so viel verlangt er – der Schatz gibt es nicht her'}`}</small>
        </button>`}`
    : `
        <button class="diplo-btn diplo-war" data-act="war" data-faction="${faction.id}"
          ${kriegsSperre || bindung ? 'disabled' : ''}>
          ⚔ Krieg erklären
          <small>${bindung
    ? `${escapeHTML(bindung.name)} – erst aufkündigen, dann marschieren`
    : kriegsSperre ? escapeHTML(kriegsSperre.text)
      : 'der Friede endet sofort – und alle, die davon hören, rechnen es dir an'}</small>
        </button>`}
      <button class="diplo-btn" data-act="gift" data-faction="${faction.id}"
        ${player.gold < GIFT_COST || geschenkSperre ? 'disabled' : ''}>
        🎁 Geschenk senden
        <small>${geschenkSperre ? escapeHTML(geschenkSperre.text)
    : `${GIFT_COST} Gold · hebt sein Ansehen von dir`}</small>
      </button>
      ${vertragsKnoepfe}
    </div>`;

  return `
    <div class="diplo-card${own ? ' diplo-own' : ''}">
      <h4><span class="dot" style="background:${faction.color}"></span>
        ${escapeHTML(faction.name)}
        <span class="diplo-state ${own ? '' : krieg ? 'diplo-krieg' : 'diplo-frieden'}">${
  own ? 'du' : krieg ? '⚔ Krieg'
    : isAllied(state, player.id, faction.id) ? '🛡️ Bündnis'
      : hasPact(state, player.id, faction.id) ? '🤝 Pakt' : '🕊 Friede'}</span></h4>
      <p class="diplo-name"><strong>${escapeHTML(ruler.name)}</strong>,
        ${escapeHTML(ruler.titel)}${own || !relation ? '' : `
        <span class="muted"> · ${krieg ? 'im Krieg' : 'im Frieden'} seit ${
  Math.max(0, state.turn - relation.since)} Runden</span>`}</p>
      <p class="muted diplo-wort">${escapeHTML(ruler.wort)}</p>
      <div class="cond-block">
        ${TRAITS.map((t) => traitBarHTML(t, ruler[t])).join('')}
        ${own ? '' : `
        <div class="cond-row">
          <span class="cond-name">Ansehen</span>
          <span class="cond-track"><span class="cond-fill cond-morale"
            style="width:${Math.round(ansehen)}%"></span></span>
          <span class="cond-value">${Math.round(ansehen)} <em>${
  ansehen >= 70 ? 'gewogen' : ansehen >= 50 ? 'neutral'
    : ansehen >= 30 ? 'misstrauisch' : 'feindselig'}</em></span>
        </div>`}
      </div>
      ${lageHTML}
      ${vertragsZeilen}
      ${options.note ? `<p class="diplo-note">${escapeHTML(options.note)}</p>` : ''}
      ${knoepfe}
    </div>`;
}

// Zwei Reiter: die Reiche, die man kennt, und die, von denen man nur gehört
// hat. Mit einem Unbekannten lässt sich nicht verhandeln - man weiß nicht
// einmal, wer dort herrscht.
let diploTab = 'bekannt';

export function setDiploTab(tab) {
  diploTab = tab === 'unbekannt' ? 'unbekannt' : 'bekannt';
  return diploTab;
}

export function getDiploTab() {
  return diploTab;
}

// Eine Karte für ein Reich, von dem nur Gerüchte kommen.
function unknownCardHTML(state, faction) {
  const player = playerFaction(state);
  return `
    <div class="diplo-card diplo-unknown">
      <h4><span class="dot diplo-dot-unknown"></span>${escapeHTML(faction.name)}
        <span class="diplo-state">? unbekannt</span></h4>
      <p class="diplo-name">Ein Reich
        <strong>${escapeHTML(roughDirection(state, player.id, faction.id))}</strong>,
        von dem die Händler erzählen.</p>
    </div>`;
}

export function diplomacyHTML(state, note) {
  const player = playerFaction(state);
  const others = state.factions.filter((f) => !f.isNeutral && f.alive && f.id !== player.id);
  const bekannt = others.filter((f) => knowsFaction(state, player.id, f.id));
  const unbekannt = others.filter((f) => !knowsFaction(state, player.id, f.id));
  const kriege = bekannt.filter((f) => atWar(state, player.id, f.id)).length;
  const { season, year } = calendarOfTurn(state.turn);
  const zeigeUnbekannt = diploTab === 'unbekannt' && unbekannt.length;
  return `
    <h2 class="report-title">🕊 Diplomatie · ${season.icon} ${season.name} ${year} v. Chr.</h2>
    <p class="emp-note muted">Du führst ${escapeHTML(rulerOf(state, player.id).name)}.
      Im Krieg mit ${kriege} von ${bekannt.length} bekannten Herrschern; ${
  unbekannt.length ? `${unbekannt.length} Reiche kennst du nur vom Hörensagen`
    : 'die ganze bekannte Welt liegt vor dir'}. Ein Friede sperrt beiden
      Seiten die Waffen: eure Heere gehen aneinander vorbei, bis einer ihn aufkündigt.</p>
    <div class="city-tabs diplo-tabs" role="tablist">
      <button data-diplotab="bekannt" class="${diploTab === 'bekannt' ? 'active' : ''}"
        role="tab" aria-selected="${diploTab === 'bekannt'}">Bekannt (${bekannt.length})</button>
      <button data-diplotab="unbekannt" class="${diploTab === 'unbekannt' ? 'active' : ''}"
        role="tab" aria-selected="${diploTab === 'unbekannt'}">Unbekannt (${unbekannt.length})</button>
    </div>
    ${note ? `<p class="diplo-answer">${escapeHTML(note)}</p>` : ''}
    <div class="diplo-grid">
      ${zeigeUnbekannt
    ? unbekannt.map((f) => unknownCardHTML(state, f)).join('')
    : `${rulerCardHTML(state, player)}${bekannt.map((f) => rulerCardHTML(state, f)).join('')}`}
    </div>
    ${diploTab === 'unbekannt' ? `<p class="emp-note muted">${unbekannt.length
    ? 'Wer einem fremden Heer oder einer fremden Stadt nahe genug kommt, erfährt, wer '
      + 'dort herrscht. Bis dahin gibt es mit diesen Reichen nichts zu verhandeln – '
      + 'und sie erklären dir auch keinen Krieg.'
    : 'Es gibt kein Reich mehr, von dem du nichts weißt.'}</p>` : ''}`;
}

export function empireHTML(state) {
  const player = playerFaction(state);
  const cities = state.cities
    .filter((c) => c.factionId === player.id)
    .map((city) => ({ city, income: cityIncome(state, city) }))
    .sort((a, b) => b.income.total - a.income.total || a.city.name.localeCompare(b.city.name, 'de'));

  const income = factionIncome(state, player.id);
  const upkeep = armyUpkeep(state, player.id);
  const balance = Math.round(income - upkeep);
  const armies = state.armies.filter((a) => a.factionId === player.id);
  const fleets = armies.filter((a) => isFleet(a));
  const land = armies.filter((a) => !isFleet(a));
  const troops = land.reduce((sum, a) => sum + unitTotalCount(a.units), 0);
  const ships = fleets.reduce((sum, a) => sum + (a.units[SHIP_ROLE] || 0), 0);
  const watch = cities.reduce((sum, { city }) => sum + (city.garrison[WATCH_ROLE] || 0), 0);
  const people = cities.reduce((sum, { city }) => sum + city.population, 0);
  const held = state.wonders
    ? state.wonders.filter((w) => cities.some(({ city }) => city.id === w.cityId))
    : [];
  const { season, year } = calendarOfTurn(state.turn);

  const tile = (label, value, note = '') => `
    <div class="emp-tile"><span class="emp-tile-label">${label}</span>
      <strong>${value}</strong>${note ? `<small>${note}</small>` : ''}</div>`;

  const belagerte = cities.filter(({ city }) => siegeInfo(state, city));
  const rows = cities.map(({ city, income: entry }) => {
    const level = cityWallLevel(city);
    const belagert = !!siegeInfo(state, city);
    const marks = [
      belagert ? '⚔️' : '',
      city.capital ? '👑' : '',
      level ? wallLevelInfo(level).icon : '',
      city.harbour ? '⚓' : '',
      city.mine ? '⛏️' : '',
      city.fishery ? '🐟' : '',
      city.hunt ? '🏹' : '',
      // Woran es fehlt, ist so wichtig wie das, was steht: ohne Kaserne
      // stellt der Ort keine Truppen, ohne Verwaltung baut er nichts.
      city.barracks ? '🛡️' : '',
      city.forum ? '🏛️' : '',
    ].filter(Boolean).join(' ');
    return `<tr class="${belagert ? 'emp-siege' : ''}">
      <td>${escapeHTML(city.name)} <span class="emp-marks">${marks}</span></td>
      <td>${settlementLabel(city)}</td>
      <td class="emp-num">${city.population.toLocaleString('de-DE')}${wachstumHTML(city)}</td>
      <td class="emp-num">${entry.people}</td>
      <td class="emp-num">${entry.wonders || '–'}</td>
      <td class="emp-num">${entry.trade || '–'}</td>
      <td class="emp-num">${entry.mine || '–'}</td>
      <td class="emp-num">${(entry.fishery + entry.hunt) || '–'}</td>
      <td class="emp-num emp-total">${entry.total.toLocaleString('de-DE')}</td>
    </tr>`;
  }).join('');

  return `
    <h2 class="report-title">${escapeHTML(player.name)} · ${season.icon} ${season.name} ${year} v. Chr.</h2>
    <div class="emp-tiles">
      ${tile('Schatz', `${player.gold.toLocaleString('de-DE')} Gold`)}
      ${tile('Einnahmen', `+${income.toLocaleString('de-DE')}`, 'je Runde')}
      ${tile('Sold', `−${Math.round(upkeep).toLocaleString('de-DE')}`, 'je Runde')}
      ${tile('Bilanz', `${balance >= 0 ? '+' : '−'}${Math.abs(balance).toLocaleString('de-DE')}`,
    balance >= 0 ? 'Der Schatz wächst' : 'Der Schatz schrumpft')}
    </div>
    <div class="emp-tiles">
      ${tile('Orte', cities.length, `${people.toLocaleString('de-DE')} Einwohner`)}
      ${tile('Heere', land.length, `${troops.toLocaleString('de-DE')} Mann im Feld`)}
      ${tile('Flotten', fleets.length, `${ships.toLocaleString('de-DE')} Schiffe`)}
      ${tile('Stadtwachen', watch.toLocaleString('de-DE'), 'auf den Mauern')}
    </div>

    ${cities.length ? `
    <table class="emp-table">
      <thead><tr>
        <th>Ort</th><th>Rang</th><th class="emp-num">Einwohner</th>
        <th class="emp-num">Steuer</th>
        <th class="emp-num">Bauwerk</th><th class="emp-num">Handel</th>
        <th class="emp-num">Bergwerk</th><th class="emp-num">Fang &amp; Jagd</th>
        <th class="emp-num">Summe</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td colspan="3">${cities.length} ${cities.length === 1 ? 'Ort' : 'Orte'}</td>
        <td class="emp-num">${cities.reduce((s, e) => s + e.income.people, 0)}</td>
        <td class="emp-num">${cities.reduce((s, e) => s + e.income.wonders, 0) || '–'}</td>
        <td class="emp-num">${cities.reduce((s, e) => s + e.income.trade, 0) || '–'}</td>
        <td class="emp-num">${cities.reduce((s, e) => s + e.income.mine, 0) || '–'}</td>
        <td class="emp-num">${cities.reduce((s, e) => s + e.income.fishery + e.income.hunt, 0) || '–'}</td>
        <td class="emp-num emp-total">${income.toLocaleString('de-DE')}</td>
      </tr></tfoot>
    </table>` : '<p class="muted">Kein Ort mehr in eigener Hand.</p>'}

    <div class="tactic-block">
      <p class="road-head">🛡️ Stehende Schlachtordnung
        <span class="muted">· wie deine Heere und Orte sich wehren, wenn du
        angegriffen wirst</span></p>
      <p class="emp-note muted">Wer angegriffen wird, wird nicht gefragt: ein
        fremdes Heer steht vor dem Tor, und der Befehl muss vorher gegeben sein.
        Für den Angriff wählst du die Ordnung jedes Mal neu – in der
        Kampfvorschau.</p>
      ${tacticPickerHTML('verteidigung', player.tacticDefence, null, 'verteidigung')}
    </div>

    ${held.length ? `<p class="emp-note">${held.map((w) =>
    `${w.wonder ? '🏛️' : '🗿'} ${escapeHTML(w.name)}`).join(' · ')}</p>` : ''}
    ${belagerte.length ? `<p class="emp-note">⚔️ ${belagerte.length === 1
    ? `${escapeHTML(belagerte[0].city.name)} ist belagert und trägt nichts`
    : `${belagerte.length} Orte sind belagert und tragen nichts`} –
      solange ein Feind davorsteht, gibt es dort weder Steuer noch Nachschub
      noch Bau.</p>` : ''}
    <p class="emp-note muted">Die Zeichen hinter dem Namen: ⚔️ belagert, 👑 Hauptstadt,
      Mauerstufe, ⚓ Hafen, ⛏️ Bergwerk, 🛡️ Kaserne, 🏛️ Verwaltung.
      Die Spalte „Steuer" ist das, was die Einwohner tragen –
      ein Gold je ${TAX_PER_INHABITANTS} Einwohner und Runde; dafür, dass es einen Ort
      gibt, zahlt niemand etwas. „Bauwerk" ist ein Weltwunder oder Wahrzeichen in
      seiner Nähe, „Handel" sind die Wege, die von hier ausgehen, und „Bergwerk"
      ist, was der Berg im Umland hergibt.
      Der Sold wird beim Rundenwechsel vom Schatz abgezogen.</p>`;
}

// --- Die Reiche im Vergleich -----------------------------------------------
// Wer ist der Stärkste, wer der Reichste, wer der Mächtigste? Die Liste
// beantwortet alle drei Fragen - sortiert wird nach der, die gerade
// interessiert, und daneben steht, woraus sich die Antwort ergibt. Vorher
// standen dort nur Orte und Heere, immer in derselben Reihenfolge.
//
// Die Übersicht rechnet mit dem, was auf der Karte steht: sie ist der
// strategische Blick von oben, nicht der Bericht eines Gesandten. Was ein
// Herrscher von einem anderen weiß, steht im Diplomatiefenster.
const FACTION_SORTS = ['macht', 'militaer', 'gold'];
let factionSort = 'macht';

export function setFactionSort(sort) {
  factionSort = FACTION_SORTS.includes(sort) ? sort : 'macht';
  return factionSort;
}

export function getFactionSort() {
  return factionSort;
}

// Macht ist keine einzelne Zahl, sondern die Summe dreier: Land, Heer, Kasse.
// Zehn Punkte je Ort, einer je hundert Mann, einer je dreihundert Gold.
export function factionPower(entry) {
  return Math.round(entry.cities * 10 + entry.men / 100 + entry.gold / 300);
}

function factionRows(state) {
  return state.factions.filter((f) => !f.isNeutral).map((f) => {
    const cities = state.cities.filter((c) => c.factionId === f.id);
    const armies = state.armies.filter((a) => a.factionId === f.id);
    const feld = armies.reduce((sum, a) => sum + unitTotalCount(a.units), 0);
    const wache = cities.reduce((sum, c) => sum + unitTotalCount(c.garrison), 0);
    const einnahmen = Math.round(factionIncome(state, f.id));
    const sold = Math.round(armyUpkeep(state, f.id));
    const entry = {
      faction: f,
      cities: cities.length,
      armies: armies.length,
      men: feld + wache,
      field: feld,
      gold: f.gold,
      income: einnahmen,
      upkeep: sold,
      balance: einnahmen - sold,
    };
    entry.power = factionPower(entry);
    return entry;
  });
}

function renderFactionList(state) {
  const list = document.getElementById('factionList');
  if (!list) return;
  const player = playerFaction(state);
  const alle = factionRows(state);
  // Gezählt wird nur, was man kennt. Über ein Reich, dem noch niemand von uns
  // begegnet ist, weiß auch der Feldherr im Zelt nichts - weder wie viele Orte
  // es hält noch wie voll seine Truhe ist. Es steht deshalb nicht in der
  // Rangliste, sondern darunter, mit nichts als einer Himmelsrichtung.
  const rows = alle.filter((entry) => entry.faction.id === player.id
    || knowsFaction(state, player.id, entry.faction.id));
  const fremde = alle.filter((entry) => !rows.includes(entry));
  const key = factionSort === 'militaer' ? 'men' : factionSort === 'gold' ? 'gold' : 'power';
  rows.sort((a, b) => (b.faction.alive ? 1 : 0) - (a.faction.alive ? 1 : 0)
    || b[key] - a[key] || b.power - a.power);
  const spitze = rows.length ? Math.max(1, rows[0][key]) : 1;

  // Eine Rangliste, keine Akte: Platz, Wappen, Name, die Zahl, nach der
  // sortiert wird - und darunter eine einzige knappe Zeile mit Orten, Mann,
  // Schatz und Bilanz. Was sich daraus zusammensetzt, steht im Tooltip; auf
  // dem Schirm bleibt es kurz.
  list.innerHTML = rows.map((entry, i) => {
    const { faction } = entry;
    const classes = ['fl-row', !faction.alive ? 'faction-dead' : '',
      faction.isPlayer ? 'faction-self' : ''].filter(Boolean).join(' ');
    const bilanz = `${entry.balance >= 0 ? '+' : '−'}${Math.abs(entry.balance)}`;
    // Die Zahl, nach der sortiert wird, steht rechts und als Balken darunter.
    const wert = factionSort === 'militaer'
      ? entry.men.toLocaleString('de-DE')
      : factionSort === 'gold'
        ? entry.gold.toLocaleString('de-DE')
        : String(entry.power);
    const einheit = factionSort === 'militaer' ? 'Mann'
      : factionSort === 'gold' ? 'Gold' : 'Macht';
    const tooltip = `${faction.name}: ${entry.cities} Orte, ${entry.armies} Heere, `
      + `${entry.field.toLocaleString('de-DE')} Mann im Feld, `
      + `${(entry.men - entry.field).toLocaleString('de-DE')} auf den Mauern. `
      + `Einnahmen ${entry.income} − Sold ${entry.upkeep} = ${bilanz} je Runde.`;
    return `<li class="${classes}" title="${escapeHTML(tooltip)}">
      <span class="fl-rank">${i + 1}</span>
      <span class="fl-emblem">${emblemSVG(faction.id, { size: 18, color: faction.color })}</span>
      <div class="fl-main">
        <div class="fl-head"><span class="fl-name">${escapeHTML(faction.name)}</span>
          <span class="fl-value">${wert}<small> ${einheit}</small></span></div>
        <div class="fl-bar"><span style="width:${
  Math.max(2, Math.round((entry[key] / spitze) * 100))}%;background:${faction.color}"></span></div>
        <div class="fl-facts muted">🏛️ ${entry.cities} · ⚔️ ${
  entry.men.toLocaleString('de-DE')} · 💰 ${entry.gold.toLocaleString('de-DE')}
          <span class="${entry.balance >= 0 ? 'fl-plus' : 'fl-minus'}">${bilanz}</span></div>
      </div>
    </li>`;
  }).join('');

  // Die Unbekannten stehen darunter: dass es sie gibt, weiß man - mehr nicht.
  list.innerHTML += fremde.map((entry) => {
    const { faction } = entry;
    const richtung = roughDirection(state, player.id, faction.id);
    return `<li class="fl-row faction-unknown"
      title="Ein Reich, dem noch keiner deiner Männer begegnet ist. Was es hält und was es besitzt, erfährst du erst, wenn ihr einander begegnet.">
      <span class="fl-rank">?</span>
      <span class="fl-emblem">❔</span>
      <div class="fl-main">
        <div class="fl-head"><span class="fl-name">Ein unbekanntes Reich</span></div>
        <div class="fl-facts muted">${escapeHTML(richtung)} · nichts Genaues bekannt</div>
      </div>
    </li>`;
  }).join('');

  const note = document.getElementById('factionNote');
  if (note) {
    // Kurz halten: die Zeile erklärt die Sortierung, nicht das Spiel. Die
    // Aufschlüsselung je Reich steht im Tooltip der Zeile.
    note.textContent = factionSort === 'militaer'
      ? '🏛️ Orte · ⚔️ Mann · 💰 Schatz und Bilanz. Sortiert nach Mann unter Waffen.'
      : factionSort === 'gold'
        ? '🏛️ Orte · ⚔️ Mann · 💰 Schatz und Bilanz. Sortiert nach dem Schatz.'
        : '🏛️ Orte · ⚔️ Mann · 💰 Schatz und Bilanz. Macht: 10 je Ort, 1 je 100 Mann, '
          + '1 je 300 Gold.';
    if (fremde.length) {
      note.textContent += ` ${fremde.length === 1 ? 'Ein Reich kennst du noch nicht'
        : `${fremde.length} Reiche kennst du noch nicht`} – über sie steht hier nichts.`;
    }
  }
}

export function renderUI(state, handlers) {
  // Eine Runde ist ein Monat, drei Monate sind eine Jahreszeit. Angezeigt wird
  // der Monat: er wechselt mit jeder Runde und sagt damit von selbst, wie weit
  // die Jahreszeit ist - ein Zähler daneben wäre dasselbe zweimal.
  const { season, year, month, monthOfSeason } = calendarOfTurn(state.turn);
  const label = document.getElementById('turnLabel');
  label.textContent = `${season.icon} ${month} ${year} v. Chr.`;
  label.title = `Runde ${state.turn} · ${season.name}, ${monthOfSeason}. von ${TURNS_PER_SEASON} Monaten`;
  const player = playerFaction(state);
  // Neben dem Schatz steht, was die letzte Runde daran verändert hat. Eine
  // Zahl allein sagt nicht, ob sie steigt oder fällt - und genau das ist das,
  // was man von ihr wissen will.
  const goldDiff = (state.lastDeltas && state.lastDeltas.gold) || 0;
  const goldLabel = document.getElementById('goldLabel');
  goldLabel.textContent = `💰 ${player.gold} Gold`;
  if (goldDiff) {
    const wandel = document.createElement('span');
    wandel.className = goldDiff > 0 ? 'delta-up' : 'delta-down';
    wandel.textContent = ` ${goldDiff > 0 ? '+' : '−'}${Math.abs(goldDiff).toLocaleString('de-DE')}`;
    wandel.title = 'Veränderung in der letzten Runde';
    goldLabel.appendChild(wandel);
  }

  renderFactionList(state);

  const panel = document.getElementById('selectedPanel');
  if (state.selectedArmyId) {
    const army = state.armies.find((a) => a.id === state.selectedArmyId);
    panel.innerHTML = army ? renderSelectedArmy(state, army) : '<p class="muted">Nichts ausgewählt.</p>';
    const disbandBtn = panel.querySelector('.disband-btn');
    if (disbandBtn) {
      disbandBtn.addEventListener('click', () => handlers.onDisband(disbandBtn.dataset.army));
    }
    const siegeBtn = panel.querySelector('.siege-btn');
    if (siegeBtn && handlers.onSiege) {
      siegeBtn.addEventListener('click', () => handlers.onSiege(siegeBtn.dataset.army,
        siegeBtn.dataset.city));
    }
    const campBtn = panel.querySelector('.camp-btn');
    if (campBtn) {
      campBtn.addEventListener('click', () => handlers.onCamp(campBtn.dataset.army,
        campBtn.dataset.camp === 'break'));
    }
    const ambushBtn = panel.querySelector('.ambush-btn');
    if (ambushBtn && handlers.onAmbush) {
      ambushBtn.addEventListener('click', () => handlers.onAmbush(ambushBtn.dataset.army,
        ambushBtn.dataset.ambush === 'leave'));
    }
    const embarkBtn = panel.querySelector('.embark-btn:not([disabled])');
    if (embarkBtn) {
      embarkBtn.addEventListener('click', () => handlers.onEmbark(embarkBtn.dataset.army));
    }
    panel.querySelectorAll('.reinforce-btn:not([disabled])').forEach((btn) => {
      btn.addEventListener('click', () => handlers.onReinforce(btn.dataset.army, btn.dataset.unit));
    });
    panel.querySelectorAll('.engine-btn:not([disabled])').forEach((btn) => {
      btn.addEventListener('click', () => handlers.onEngine(btn.dataset.army, btn.dataset.engine));
    });
  } else if (state.selectedCityId) {
    const city = state.cities.find((c) => c.id === state.selectedCityId);
    if (city) {
      panel.innerHTML = renderSelectedCity(state, city);
      panel.querySelectorAll('.recruit-btn').forEach((btn) => {
        btn.addEventListener('click', () => handlers.onRecruit(city.id, btn.dataset.unit));
      });
      const raiseBtn = panel.querySelector('.raise-btn');
      if (raiseBtn) raiseBtn.addEventListener('click', () => handlers.onRaise(city.id));
      const wallBtn = panel.querySelector('.wall-btn');
      if (wallBtn) wallBtn.addEventListener('click', () => handlers.onBuyWalls(city.id));
      // Alle Bauwerke hängen an einem Knopf mit einem Schlüssel daran.
      panel.querySelectorAll('.build-btn[data-build]:not([disabled])').forEach((btn) => {
        btn.addEventListener('click', () => handlers.onBuild(city.id, btn.dataset.build));
      });
      panel.querySelectorAll('.fleet-btn:not([disabled])').forEach((btn) => {
        btn.addEventListener('click', () => handlers.onBuildFleet(city.id, btn.dataset.ship));
      });
      panel.querySelectorAll('.road-btn').forEach((btn) => {
        btn.addEventListener('click', () => (btn.dataset.stone
          ? handlers.onUpgradeRoad(city.id, btn.dataset.stone)
          : handlers.onBuildRoad(city.id, btn.dataset.target)));
      });
      panel.querySelectorAll('.trade-btn:not([disabled])').forEach((btn) => {
        btn.addEventListener('click', () => handlers.onOpenTrade(city.id, btn.dataset.target));
      });
      panel.querySelectorAll('.trade-close-btn').forEach((btn) => {
        btn.addEventListener('click', () => handlers.onCloseTrade(btn.dataset.route));
      });
      panel.querySelectorAll('[data-citytab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          setCityTab(btn.dataset.citytab);
          if (handlers.onRefresh) handlers.onRefresh();
        });
      });
    }
  } else {
    panel.innerHTML = '';
  }

  // The terrain read-out sits under whatever is selected, and stands alone
  // when the player clicked open ground.
  // Im Reiter "Bauen" bleibt die Geländeauskunft aus: dort geht es darum, was
  // man tun kann, und die Bauknöpfe sollen nicht unter einer Wand aus
  // Höhenangaben verschwinden.
  const terrainPanel = document.getElementById('terrainPanel');
  const buildingHere = state.selectedCityId && cityTab !== 'info';
  if (terrainPanel) {
    terrainPanel.innerHTML = state.inspectedTile && !buildingHere
      ? terrainPanelHTML(state, state.inspectedTile)
      : '';
  }
  if (!panel.innerHTML && !(terrainPanel && terrainPanel.innerHTML)) {
    panel.innerHTML = '<p class="muted">Klicke auf ein Feld, eine Armee oder eine Stadt.</p>';
  }

  const logPanel = document.getElementById('logPanel');
  const visible = state.log.filter((entry) => logConcernsPlayer(entry, player.id));
  logPanel.innerHTML = visible.slice(0, 30).map((entry) => {
    const linked = entry.reportId ? ' log-battle' : '';
    const attr = entry.reportId ? ` data-report="${entry.reportId}"` : '';
    return `<div class="log-line${linked}"${attr}>${escapeHTML(entry.text)}${
      entry.reportId ? '<span class="log-more">Bericht ansehen</span>' : ''}</div>`;
  }).join('') || `<p class="muted">${logFilter === 'own'
    ? 'Noch nichts, was dich betrifft. „Alle Fraktionen“ zeigt auch die Kriege der anderen.'
    : 'Noch keine Ereignisse.'}</p>`;
  logPanel.querySelectorAll('[data-report]').forEach((el) => {
    el.addEventListener('click', () => handlers.onShowReport(el.dataset.report));
  });
  document.querySelectorAll('#logFilter button').forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === logFilter);
    button.onclick = () => {
      logFilter = button.dataset.filter;
      if (handlers.onRefresh) handlers.onRefresh();
    };
  });

  const overlay = document.getElementById('gameOverOverlay');
  if (state.gameOver) {
    overlay.classList.remove('hidden');
    overlay.querySelector('.overlay-title').textContent =
      state.gameOver.result === 'victory'
        ? `🏆 Sieg für ${player.name}!`
        : `💀 ${player.name} ist gefallen`;
    overlay.querySelector('.overlay-text').textContent =
      state.gameOver.result === 'victory'
        ? `Alle feindlichen Fraktionen wurden in Runde ${state.turn} besiegt.`
        : `${player.name} hat in Runde ${state.turn} alle Städte und Armeen verloren.`;
  } else {
    overlay.classList.add('hidden');
  }
}


const ODDS_SCALE = [
  [0.95, 'Sieg so gut wie sicher', 'odds-great'],
  [0.75, 'klar im Vorteil', 'odds-good'],
  [0.55, 'leicht im Vorteil', 'odds-even'],
  [0.45, 'Ausgang offen', 'odds-even'],
  [0.25, 'im Nachteil', 'odds-bad'],
  [0.05, 'kaum Aussicht', 'odds-bad'],
  [0, 'Niederlage so gut wie sicher', 'odds-awful'],
];

function oddsVerdict(chance) {
  for (const [threshold, label, tone] of ODDS_SCALE) {
    if (chance >= threshold) return { label, tone };
  }
  return { label: 'Ausgang offen', tone: 'odds-even' };
}

// One side of the forecast: what marches in and what is expected to walk away.
function forecastSideHTML(state, factionId, label, engaged, survivors, lossPct) {
  const faction = factionById(state, factionId);
  const rows = COMBAT_ROLES.filter((k) => (engaged[k] || 0) > 0).map((k) => `<tr>
      <td class="u-name">${unitDef(factionId, k).icon} ${escapeHTML(unitDef(factionId, k).name)}</td>
      <td class="u-num">${(engaged[k] || 0).toLocaleString('de-DE')}</td>
      <td class="u-num">${(survivors[k] || 0).toLocaleString('de-DE')}</td>
    </tr>`).join('');
  return `
    <div class="preview-side">
      <div class="side-head">
        <span class="dot" style="background:${faction ? faction.color : '#888'}"></span>
        <strong>${escapeHTML(faction ? faction.name : 'Niemand')}</strong>
        <span class="side-role">${label}</span>
      </div>
      <table class="report-table">
        <thead><tr><th>Einheit</th><th>Stärke</th><th>voraussichtl. übrig</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3" class="muted">keine Truppen</td></tr>'}</tbody>
        <tfoot><tr>
          <td>Gesamt</td>
          <td class="u-num">${unitTotalCount(engaged).toLocaleString('de-DE')}</td>
          <td class="u-num">${unitTotalCount(survivors).toLocaleString('de-DE')}
            <span class="u-loss">(−${Math.round(lossPct * 100)}%)</span></td>
        </tr></tfoot>
      </table>
    </div>`;
}

// The forecast the player sees before committing. It is an estimate and says
// so: the numbers come from playing the same battle through many times, and
// the real one is fought once.
// Der zweite Weg über eine Mauer: nicht darüber, sondern davor warten. Die
// Vorschau nennt ihn, weil die Entscheidung hier fällt - im Sturm oder im
// Lager -, und sagt auch, wann er nicht offensteht.
const SIEGE_HINDERNIS = {
  peace: 'Dazu müsstet ihr im Krieg stehen.',
  besetzt: 'Ein anderes Reich belagert diesen Ort bereits.',
  running: 'Du belagerst diesen Ort schon.',
  fleet: 'Eine Flotte schließt keinen Ort ein – das tut ein Heer.',
  far: 'Dafür muss das Heer unmittelbar vor dem Ort stehen.',
};

function siegeHintHTML(preview) {
  const s = preview.siege;
  if (!s) return '';
  return s.can
    ? `<p class="siege-hint">⛺ <strong>Oder einschließen:</strong> Statt zu stürmen legt
       sich das Heer vor den Ort. Keine Steuer, kein Nachschub, kein Bau für ihn – und
       nach ein paar Runden beginnt der Hunger. Es kostet keinen Mann, aber Zeit.</p>`
    : `<p class="siege-hint muted">⛺ Einschließen geht hier nicht: ${
  escapeHTML(SIEGE_HINDERNIS[s.reason] || 'nicht möglich.')}</p>`;
}

// --- Herolde und Meldungen ------------------------------------------------
// Aus einem Eintrag der Nachrichtenschlange wird das, was im Meldefenster
// steht. Verträge, Vertragsbrüche und der Bündnisfall bringen ihren Text schon
// mit (`kindLabel`, `titel`, `satz`, `folge`); Krieg und Frieden werden aus
// zwei Fällen zusammengesetzt und bleiben deshalb dem Fenster überlassen.
//
// Diese Reihenfolge ist der ganze Witz der Funktion: solche Meldungen tragen
// AUCH ein `icon`, und wer zuerst danach fragt, hält sie für eine fertig
// ausformulierte Meldung und greift nach `kind`, `title` und `text` - Felder,
// die sie nicht haben. Ein Bündnisfall, der den Spieler in einen Krieg zieht,
// war deshalb ein Fenster ohne Überschrift und ohne Text.
export function noticeFromNews(meldung) {
  if (!meldung) return null;
  if (meldung.kindLabel) {
    return {
      icon: meldung.icon, kind: meldung.kindLabel, title: meldung.titel,
      text: meldung.satz, effect: meldung.folge,
    };
  }
  if (meldung.icon) return meldung;
  return null;
}

// --- Die Schlachtordnung --------------------------------------------------
// Sechs Ordnungen je Seite, und jede hat ihren Preis. Der Spieler wählt die
// Angriffsordnung vor jedem Angriff neu; die Verteidigungsordnung ist ein
// stehender Befehl, denn wenn ein fremdes Heer vor dem Tor steht, ist niemand
// mehr da, den man fragen könnte.
export function tacticPickerHTML(seite, gewaehlt, units = null, name = 'tactic',
  gelaende = null) {
  const liste = tacticsFor(seite);
  const knoepfe = liste.map((t) => {
    const wirkung = tacticEffect(seite, t.key, units, gelaende);
    // Wo eine Ordnung an einer Bedingung hängt, steht hier, ob sie erfüllt ist.
    const teile = [];
    if (wirkung.reiterei === false) teile.push('<span class="tactic-warn">zu wenig Reiterei</span>');
    if (wirkung.reiterei === true) teile.push('<span class="tactic-ok">Reiterei genügt</span>');
    if (wirkung.gelaende === false) teile.push('<span class="tactic-warn">keine Höhe</span>');
    if (wirkung.gelaende === true) teile.push('<span class="tactic-ok">Höhe im Rücken</span>');
    const hinweis = teile.length ? ` · ${teile.join(' · ')}` : '';
    return `<button type="button" class="tactic-btn${t.key === gewaehlt ? ' active' : ''}"
      data-tactic-group="${escapeHTML(name)}" data-tactic-side="${escapeHTML(seite)}"
      data-tactic="${escapeHTML(t.key)}">
      <span class="tactic-head">${t.icon} <strong>${escapeHTML(t.name)}</strong>${hinweis}</span>
      <span class="tactic-note">${escapeHTML(t.note)}</span>
    </button>`;
  }).join('');
  return `<div class="tactic-picker" data-tactic-group="${escapeHTML(name)}">${knoepfe}</div>`;
}

// Wie eine Ordnung in einem Bericht genannt wird.
export function tacticLabel(seite, key) {
  const t = tacticByKey(seite, key);
  return `${t.icon} ${t.name}`;
}

export function battlePreviewHTML(state, preview) {
  const attacker = factionById(state, preview.attackerFactionId);
  // Wer im Frieden angreift, greift kein feindliches Heer an, sondern ein
  // fremdes - feindlich wird es erst durch den Schlag.
  const target = preview.cityName
    ? `${escapeHTML(preview.cityName)}`
    : preview.naval ? (preview.declareWarOn ? 'fremde Flotte' : 'feindliche Flotte')
      : (preview.declareWarOn ? 'fremdes Heer' : 'feindliche Armee');
  const heading = preview.naval ? `Seegefecht – ${target}`
    : preview.amphibious ? `Landung bei ${target}`
      : preview.cityName ? `Angriff auf ${target}` : `Angriff auf ${target}`;
  const terrain = TERRAIN_NAMES[preview.terrainType] || preview.terrainType;
  // Wer im Frieden zuschlägt, hat den Krieg. Das steht über allem anderen -
  // ein Feldzug beginnt nicht aus Versehen.
  const kriegsWarnung = preview.declareWarOn
    ? `<p class="preview-war">⚔️ <strong>Das bedeutet Krieg mit
         ${escapeHTML(preview.declareWarName || preview.declareWarOn)}.</strong>
         Ihr steht im Frieden – der erste Schlag kündigt ihn auf, und was an
         Verträgen zwischen euch stand, fällt mit ihm. Die Verbündeten des
         Angegriffenen treten sofort ein.</p>`
    : '';
  // Und wenn der Weg dorthin über eine dritte Grenze führt, ist das ein
  // zweiter Krieg. Vorher stand davon in der Vorschau nichts: das Fenster für
  // die Grenzverletzung kam bei einem Angriff gar nicht erst hoch.
  const grenzWarnung = preview.borderOn
    ? `<p class="preview-war">🚩 <strong>Und der Weg dorthin führt über die Grenze
         von ${escapeHTML(preview.borderName || preview.borderOn)}.</strong>
         Auch das ist eine Kriegserklärung – wer ohne Betretungsrecht
         einmarschiert, hat den Krieg, ehe er den Feind erreicht.</p>`
    : '';

  if (preview.unopposed) {
    return `
      <h2 class="report-title">${escapeHTML(heading)}</h2>
      ${kriegsWarnung}${grenzWarnung}
      <p class="report-meta">${escapeHTML(terrain)} · Bewegungskosten ${preview.moveCost}</p>
      <p class="preview-unopposed">Hier steht niemand mehr, der sich wehrt.
        ${preview.cityName ? escapeHTML(preview.cityName) + ' fällt kampflos.' : 'Das Feld ist frei.'}</p>`;
  }

  const f = preview.forecast;
  const verdict = oddsVerdict(f.attackerWinChance);
  const chance = Math.round(f.attackerWinChance * 100);
  const bonus = f.terrainBonus > 0
    ? ` · Geländevorteil für den Verteidiger: +${Math.round(f.terrainBonus * 15)}% Verteidigung`
    : ' · kein Geländevorteil';

  // Die Schlachtordnung steht über der Prognose: sie ist die eine
  // Entscheidung, die der Spieler hier noch treffen kann, und die Prognose
  // darunter rechnet schon mit ihr.
  const ordnung = `<div class="tactic-block">
      <p class="road-head">⚔️ Schlachtordnung
        <span class="muted">· der Verteidiger steht in
        ${escapeHTML(tacticLabel('verteidigung', preview.defenderTactic))}</span></p>
      ${tacticPickerHTML('angriff', preview.attackerTactic, preview.attackerEngaged
    || (preview.forecast && preview.forecast.attackerEngaged), 'angriff',
  preview.terrainType || null)}
    </div>`;

  return `
    <h2 class="report-title">${escapeHTML(heading)}</h2>
    ${kriegsWarnung}${grenzWarnung}
    ${ordnung}
    ${siegeHintHTML(preview)}
    <p class="report-meta">${escapeHTML(terrain)}${bonus} · Bewegungskosten ${preview.moveCost}</p>
    <div class="odds-block ${verdict.tone}">
      <div class="odds-bar"><span style="width:${chance}%"></span></div>
      <p class="odds-verdict"><strong>${chance}%</strong> Siegchance für ${escapeHTML(attacker.name)}
        – ${verdict.label}</p>
    </div>
    ${modifierNotesHTML({ ...preview, ...f })}
    <p class="report-meta">Verfassung – Angreifer: Moral ${Math.round(f.attackerMorale)},
      Erschöpfung ${Math.round(f.attackerExhaustion)} <span class="muted">(nach dem Marsch)</span> ·
      Verteidiger: Moral ${Math.round(f.defenderMorale)},
      Erschöpfung ${Math.round(f.defenderExhaustion)}</p>
    ${preview.combined
      ? '<p class="report-meta report-combined">Feldarmee und Stadtgarnison verteidigen gemeinsam.</p>'
      : ''}
    <div class="report-sides">
      ${forecastSideHTML(state, preview.attackerFactionId, 'Angriff',
    f.attackerEngaged, f.attackerSurvivors, f.attackerLossesPct)}
      ${forecastSideHTML(state, preview.defenderFactionId,
    preview.combined ? 'Verteidigung (Armee + Garnison)' : 'Verteidigung',
    f.defenderEngaged, f.defenderSurvivors, f.defenderLossesPct)}
    </div>
    ${f.attackerWipeChance > 0.02
      ? `<p class="preview-warn">⚠️ In ${Math.round(f.attackerWipeChance * 100)}% der Fälle
         wird die angreifende Armee vollständig aufgerieben.</p>`
      : ''}
    <p class="preview-note">Schätzung aus ${f.samples} durchgerechneten Schlachten.
      Gekämpft wird sie nur einmal – der Ausgang kann abweichen.</p>`;
}

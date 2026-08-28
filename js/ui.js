import {
  UNIT_ROLES, GARRISON_ROLES, COMBAT_ROLES, WATCH_ROLE, watchTarget,
  WARSHIP_BATCH, WARSHIP_COST,
  unitDef, ROLE_LABELS, settlementTier, garrisonCapacity, TILE_TYPES,
  wallLevelInfo, wallLevelName, MAX_WALL_LEVEL,
  starMarks, starTitle, experienceStars, EXPERIENCE_THRESHOLDS, MAX_EXPERIENCE,
  SHIP_COST, NAVAL_MOVEMENT, SEA_MOVE_COST, ZOC_EXTRA_COST, ROAD_MOVE_COST, RECRUIT_BATCH,
  HARBOUR_COST, HARBOUR_TURNS,
} from './data.js';
import {
  unitTotalCount, playerFaction, factionById, tilePosition, cityAt, armyAt,
  isWaterTile, isCoastalCity, isFleet,
} from './state.js';
import {
  embarkStatus, cityWallLevel, nextWallLevel, roadTargets, roadProjectOf,
} from './actions.js';
import { calendarOfTurn, weatherAt, weatherInfo, zoneOf, zoneName } from './weather.js';

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
  if (info.wallMultiplier > 1) {
    notes.push(`<span class="mod-note mod-wall">${
      escapeHTML(info.wallName || 'Befestigung')}: +${
      Math.round((info.wallMultiplier - 1) * 100)}% Verteidigung</span>`);
  }
  if (info.amphibious || (info.attackerMultiplier ?? 1) < 1) {
    notes.push(`<span class="mod-note mod-sea">🌊 Landung vom Meer: −${
      Math.round((1 - (info.attackerMultiplier ?? 1)) * 100)}% Angriffskraft</span>`);
  }
  if (info.naval || (info.defenderMultiplier ?? 1) < 1) {
    notes.push(`<span class="mod-note mod-sea">⛵ Kampf auf See: −${
      Math.round((1 - (info.defenderMultiplier ?? 1)) * 100)}% Verteidigung</span>`);
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
  const scaled = Object.entries(info.unitScale || sky?.unitScale || {})
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
  noHarbour: `Diese Stadt hat keinen Hafen – erst einen bauen (${HARBOUR_COST} Gold).`,
  gold: `Zu wenig Gold – eine Flotte kostet ${SHIP_COST}.`,
  blocked: 'Der Hafen ist belegt.',
};

function embarkHTML(state, army) {
  if (isFleet(army)) {
    return `<p class="sea-line">⛵ Flotte – ${NAVAL_MOVEMENT} Bewegungspunkte.
      <span class="muted">Sie hält das Meer: sie greift feindliche Flotten und
      Transporte an, geht aber nie an Land.</span></p>`;
  }
  if (army.embarked) {
    return `<p class="sea-line">⛵ Auf See – ${NAVAL_MOVEMENT} Bewegungspunkte.
      <span class="muted">Ein gelbes Feld ist eine Landung; sie beendet die Fahrt.</span></p>`;
  }
  const status = embarkStatus(state, army);
  if (status.can) {
    return `<button class="embark-btn" data-army="${army.id}">⛵ In See stechen – ${SHIP_COST} Gold
      <small>aus ${escapeHTML(status.city.name)}; die Einschiffung kostet die Runde</small></button>`;
  }
  if (status.reason === 'noCity') return '';
  return `<button class="embark-btn" disabled>⛵ In See stechen – ${SHIP_COST} Gold
    <small>${escapeHTML(EMBARK_REASONS[status.reason] || '')}</small></button>`;
}

// Steht die Armee in einer eigenen Stadt, kann sie dort frische Truppen
// kaufen: schneller als der Umweg über die Garnison, und man sieht sofort,
// was es kostet.
function reinforceHTML(state, army, city) {
  const player = playerFaction(state);
  if (army.embarked) return '';
  if (!city || city.factionId !== army.factionId || army.factionId !== player.id) return '';
  return `
    <p class="road-head">⚔️ Verstärkung kaufen <span class="muted">· je ${RECRUIT_BATCH} Mann,
      tritt sofort in die Armee ein</span></p>
    <div class="recruit-row">
      ${UNIT_ROLES.map((k) => {
    const def = unitDef(city.factionId, k);
    const tooPoor = player.gold < def.cost;
    return `<button class="reinforce-btn" data-unit="${k}" data-army="${army.id}"
        ${tooPoor ? 'disabled' : ''}>
        ${def.icon} ${escapeHTML(def.name)}<br><small>${def.cost} Gold</small>
      </button>`;
  }).join('')}
    </div>`;
}

function renderSelectedArmy(state, army) {
  const faction = factionById(state, army.factionId);
  const city = state.cities.find((c) => c.col === army.col && c.row === army.row);
  const canDisband = city && city.factionId === army.factionId && !army.embarked
    && !isFleet(army);
  return `
    <h3><span class="dot" style="background:${faction.color}"></span>${escapeHTML(army.name)}
      ${army.embarked ? '<span class="afloat-tag">⛵ Flotte</span>' : ''}</h3>
    <p class="muted">${escapeHTML(faction.name)} · Bewegung: ${army.movement} / ${army.maxMovement}</p>
    ${veterancyHTML(army)}
    <div class="cond-block">
      ${conditionBarHTML('Moral', army.morale ?? 100, MORALE_SCALE, 'morale')}
      ${conditionBarHTML('Erschöpfung', army.exhaustion ?? 0, EXHAUSTION_SCALE, 'fatigue')}
    </div>
    <div class="unit-list">${unitBreakdownHTML(army.units, army.factionId)}</div>
    ${reinforceHTML(state, army, city)}
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

function renderSelectedCity(state, city, onRecruit, onRaise) {
  const faction = factionById(state, city.factionId);
  const player = playerFaction(state);
  const isMine = city.factionId === player.id;
  const maxTotal = garrisonCapacity(city, faction);
  const current = unitTotalCount(city.garrison);
  // Was ausrücken kann, und was auf der Mauer bleibt.
  const field = UNIT_ROLES.reduce((sum, k) => sum + (city.garrison[k] || 0), 0);
  const watch = city.garrison[WATCH_ROLE] || 0;
  const watchGoal = watchTarget(city, faction);

  let recruitHTML = '';
  if (isMine) {
    recruitHTML = `
      <div class="recruit-row">
        ${UNIT_ROLES.map((k) => {
          const def = unitDef(city.factionId, k);
          const disabled = current >= maxTotal || player.gold < def.cost;
          return `<button class="recruit-btn" data-unit="${k}" ${disabled ? 'disabled' : ''}>
            ${def.icon} ${def.name}<br><small>${def.cost} Gold</small>
          </button>`;
        }).join('')}
      </div>
      <button class="raise-btn" ${field === 0 ? 'disabled' : ''}>🚩 Armee ausheben / verstärken
        <small>${field === 0
    ? 'Erst Truppen ausheben – die Stadtwache rückt nicht aus.'
    : `${field.toLocaleString('de-DE')} Mann marschbereit`}</small></button>
    `;
  }

  return `
    <h3><span class="dot" style="background:${faction.color}"></span>${escapeHTML(city.name)} ${city.capital ? '👑' : ''}</h3>
    <p class="muted">${settlementLabel(city)} ·
      ${escapeHTML(faction.name)} · Bevölkerung: ${city.population.toLocaleString('de-DE')}</p>
    <p class="muted">Garnison: ${current.toLocaleString('de-DE')}
      ${current > maxTotal
        ? `<span class="over-strength">über Sollstärke (${maxTotal.toLocaleString('de-DE')})</span>`
        : `/ ${maxTotal.toLocaleString('de-DE')}`}</p>
    <p class="wall-line ${watch >= watchGoal ? 'wall-done' : ''}">🛡️ Stadtwache
      ${watch.toLocaleString('de-DE')} / ${watchGoal.toLocaleString('de-DE')}
      <span class="muted">· ${watch >= watchGoal
    ? 'vollzählig; sie verteidigt die Stadt, rückt aber nie aus'
    : 'stellt sich aus der Bevölkerung nach'}</span></p>
    ${wallHTML(city, isMine, player)}
    ${harbourHTML(state, city, isMine, player)}
    ${fleetHTML(city, isMine, player)}
    ${roadHTML(state, city, isMine, player)}
    <div class="unit-list">${unitBreakdownHTML(city.garrison, city.factionId)}</div>
    ${recruitHTML}
  `;
}

function wallHTML(city, isMine, player) {
  const level = cityWallLevel(city);
  const built = level
    ? `<p class="wall-line wall-done">${wallLevelInfo(level).icon} ${wallLevelName(level)}
        <span class="muted">· +${Math.round((wallLevelInfo(level).defence - 1) * 100)}% Verteidigung</span></p>`
    : '<p class="wall-line muted">Keine Befestigung</p>';

  if (city.wallBuilding) {
    const stage = wallLevelInfo(city.wallBuilding.level);
    const left = city.wallBuilding.turnsLeft;
    const done = stage.turns - left;
    return `${built}
      <p class="wall-line wall-building">🏗️ ${escapeHTML(stage.name)} im Bau –
        noch ${left} ${left === 1 ? 'Runde' : 'Runden'}
        <span class="wall-track"><span class="wall-fill" style="width:${(done / stage.turns) * 100}%"></span></span>
      </p>`;
  }

  const next = nextWallLevel(city);
  if (!next) {
    return `${built}<p class="wall-line muted">Höchste Ausbaustufe erreicht.</p>`;
  }
  if (!isMine) return built;

  const stage = wallLevelInfo(next);
  const tooPoor = player.gold < stage.cost;
  return `${built}
    <button class="wall-btn" ${tooPoor ? 'disabled' : ''}>
      ${stage.icon} ${escapeHTML(stage.name)} bauen – ${stage.cost} Gold
      <small>Stufe ${next} von ${MAX_WALL_LEVEL} · ${stage.turns} Runden ·
        +${Math.round((stage.defence - 1) * 100)}% Verteidigung${
  tooPoor ? ' · zu wenig Gold' : ''}</small>
    </button>
    <p class="wall-note">${escapeHTML(stage.note)}</p>`;
}

// --- Hafen ---------------------------------------------------------------
// Der Hafen entscheidet, ob hier überhaupt eine Armee an Bord gehen kann -
// die Zeile steht deshalb auch bei fremden Städten, damit man sieht, wo eine
// Flotte auslaufen könnte.
function harbourHTML(state, city, isMine, player) {
  if (city.harbour) {
    return `<p class="wall-line wall-done">⚓ Hafen
      <span class="muted">· hier können Armeen in See stechen</span></p>`;
  }
  if (city.harbourBuilding) {
    const left = city.harbourBuilding.turnsLeft;
    const done = HARBOUR_TURNS - left;
    return `<p class="wall-line wall-building">🏗️ Hafen im Bau –
      noch ${left} ${left === 1 ? 'Runde' : 'Runden'}
      <span class="wall-track"><span class="wall-fill" style="width:${(done / HARBOUR_TURNS) * 100}%"></span></span>
    </p>`;
  }
  if (!isCoastalCity(state, city)) {
    return '<p class="wall-line muted">⚓ Kein Hafen – die Stadt liegt nicht am Meer.</p>';
  }
  if (!isMine) return '<p class="wall-line muted">⚓ Kein Hafen</p>';
  const tooPoor = player.gold < HARBOUR_COST;
  return `<button class="harbour-btn" ${tooPoor ? 'disabled' : ''}>
      ⚓ Hafen bauen – ${HARBOUR_COST} Gold
      <small>${HARBOUR_TURNS} Runden · ohne Hafen kann hier keine Armee in See stechen${
  tooPoor ? ' · zu wenig Gold' : ''}</small>
    </button>`;
}

// Im Hafen liegt die Werft: hier entstehen Kriegsschiffe, die als eigene
// Flotte auslaufen - kein Transport für ein Heer, sondern ein Verband, der das
// Meer selbst hält.
function fleetHTML(city, isMine, player) {
  if (!isMine || !city.harbour) return '';
  const tooPoor = player.gold < WARSHIP_COST;
  return `<button class="fleet-btn" ${tooPoor ? 'disabled' : ''}>
      ⛵ ${WARSHIP_BATCH} Kriegsschiffe bauen – ${WARSHIP_COST} Gold
      <small>Läuft als eigene Flotte aus; eine schon im Hafen liegende wird
        verstärkt${tooPoor ? ' · zu wenig Gold' : ''}</small>
    </button>`;
}

// --- Straßenbau ----------------------------------------------------------
// Die Stadt bietet an, wohin sie als Nächstes eine Straße legen kann: die
// nächsten eigenen Orte ohne Anschluss, mit Preis und Bauzeit.
function roadHTML(state, city, isMine, player) {
  const project = roadProjectOf(state, city.id);
  if (project) {
    const done = project.turns - project.turnsLeft;
    const other = project.fromId === city.id ? project.toName : project.fromName;
    return `<p class="wall-line wall-building">🛣️ Straße nach ${escapeHTML(other)} im Bau –
      noch ${project.turnsLeft} ${project.turnsLeft === 1 ? 'Runde' : 'Runden'}
      <span class="wall-track"><span class="wall-fill" style="width:${(done / project.turns) * 100}%"></span></span>
    </p>`;
  }
  if (!isMine) return '';

  const targets = roadTargets(state, city);
  if (!targets.length) {
    return '<p class="wall-line muted">🛣️ Alle nahen Orte sind an das Straßennetz angeschlossen.</p>';
  }
  return `
    <p class="road-head">🛣️ Straßenbau <span class="muted">· ein Feld Straße kostet nur
      ${ROAD_MOVE_COST} Bewegungspunkt</span></p>
    <div class="road-row">
      ${targets.map((t) => {
        const tooPoor = player.gold < t.cost;
        return `<button class="road-btn" data-target="${t.cityId}" ${tooPoor ? 'disabled' : ''}>
          nach ${escapeHTML(t.name)}
          <small>${t.cost} Gold · ${t.length} Felder · ${t.turns} Runden${
  tooPoor ? ' · zu wenig Gold' : ''}</small>
        </button>`;
      }).join('')}
    </div>`;
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
  return `
    <div class="ti-block">
      <h4><span class="dot" style="background:${owner.color}"></span>${escapeHTML(city.name)}
        ${city.capital ? '👑' : ''}</h4>
      <p class="ti-line">${settlementLabel(city)} · ${escapeHTML(owner.name)} ·
        ${city.population.toLocaleString('de-DE')} Einwohner</p>
      <p class="ti-line">Garnison ${unitTotalCount(city.garrison).toLocaleString('de-DE')} ·
        🛡️ Stadtwache ${watch.toLocaleString('de-DE')} /
        ${watchTarget(city, owner).toLocaleString('de-DE')}</p>
      <p class="ti-line">${level ? `${wallLevelInfo(level).icon} ${wallLevelName(level)}` : 'keine Befestigung'}
        · ${city.harbour ? '⚓ Hafen' : 'kein Hafen'}</p>
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
    ${terrainPanelHTML(state, tile, { standalone: true })}`;
}

const TERRAIN_ICONS = {
  plains: '🌾', forest: '🌲', hills: '⛰️', desert: '🏜️', mountain: '🏔️', water: '🌊',
};

// One tile unit of elevation is about this many metres, which is what turns a
// number nobody can read into a height a player recognises.
const METRES_PER_ELEVATION = 900;

function terrainFactsHTML(state, col, row) {
  const tile = state.map.tiles[row][col];
  const def = TILE_TYPES[tile.type];
  const facts = [];

  if (tile.type === 'water') {
    facts.push(['Bewegung', `zur See ${SEA_MOVE_COST} Punkt je Feld · für Landarmeen unpassierbar`]);
  } else {
    const paved = !!(state.roads && state.roads[`${col},${row}`]);
    const stride = paved ? Math.min(ROAD_MOVE_COST, def.cost) : def.cost;
    const saved = paved && def.cost > ROAD_MOVE_COST ? ` (Straße statt ${def.cost})` : '';
    facts.push(['Bewegungskosten', def.impassable
      ? 'unpassierbar'
      : `${paved ? '🛣️ ' : ''}${stride} ${stride === 1 ? 'Punkt' : 'Punkte'} je Feld${saved}`]);
    facts.push(['Verteidigung', def.defense > 0
      ? `+${Math.round(def.defense * 15)}% für den Verteidiger`
      : 'kein Geländevorteil']);
    facts.push(['Höhe', `${Math.round(tile.elevation * METRES_PER_ELEVATION)} m`]);
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

export function renderUI(state, handlers) {
  const { season, year } = calendarOfTurn(state.turn);
  document.getElementById('turnLabel').textContent =
    `${season.icon} ${season.name} ${year} v. Chr.`;
  document.getElementById('turnLabel').title = `Runde ${state.turn}`;
  const player = playerFaction(state);
  document.getElementById('goldLabel').textContent = `💰 ${player.gold} Gold`;

  // Die eigene Fraktion zuerst, danach die lebenden nach Größe - wer vorne
  // steht, ist die Frage, die den Spieler betrifft.
  const factionList = document.getElementById('factionList');
  const rows = state.factions
    .filter((f) => !f.isNeutral)
    .map((f) => ({
      faction: f,
      cities: state.cities.filter((c) => c.factionId === f.id).length,
      armies: state.armies.filter((a) => a.factionId === f.id).length,
    }))
    .sort((a, b) => (b.faction.isPlayer ? 1 : 0) - (a.faction.isPlayer ? 1 : 0)
      || b.cities - a.cities || b.armies - a.armies);
  factionList.innerHTML = rows.map(({ faction, cities, armies }) => {
    const classes = [!faction.alive ? 'faction-dead' : '', faction.isPlayer ? 'faction-self' : '']
      .filter(Boolean).join(' ');
    return `<li class="${classes}"><span class="dot" style="background:${faction.color}"></span>${
      escapeHTML(faction.name)}
      <span class="muted">🏛️${cities} · ⚔️${armies}</span></li>`;
  }).join('');

  const panel = document.getElementById('selectedPanel');
  if (state.selectedArmyId) {
    const army = state.armies.find((a) => a.id === state.selectedArmyId);
    panel.innerHTML = army ? renderSelectedArmy(state, army) : '<p class="muted">Nichts ausgewählt.</p>';
    const disbandBtn = panel.querySelector('.disband-btn');
    if (disbandBtn) {
      disbandBtn.addEventListener('click', () => handlers.onDisband(disbandBtn.dataset.army));
    }
    const embarkBtn = panel.querySelector('.embark-btn:not([disabled])');
    if (embarkBtn) {
      embarkBtn.addEventListener('click', () => handlers.onEmbark(embarkBtn.dataset.army));
    }
    panel.querySelectorAll('.reinforce-btn:not([disabled])').forEach((btn) => {
      btn.addEventListener('click', () => handlers.onReinforce(btn.dataset.army, btn.dataset.unit));
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
      const harbourBtn = panel.querySelector('.harbour-btn:not([disabled])');
      if (harbourBtn) harbourBtn.addEventListener('click', () => handlers.onBuyHarbour(city.id));
      const fleetBtn = panel.querySelector('.fleet-btn:not([disabled])');
      if (fleetBtn) fleetBtn.addEventListener('click', () => handlers.onBuildFleet(city.id));
      panel.querySelectorAll('.road-btn').forEach((btn) => {
        btn.addEventListener('click', () => handlers.onBuildRoad(city.id, btn.dataset.target));
      });
    }
  } else {
    panel.innerHTML = '';
  }

  // The terrain read-out sits under whatever is selected, and stands alone
  // when the player clicked open ground.
  const terrainPanel = document.getElementById('terrainPanel');
  if (terrainPanel) {
    terrainPanel.innerHTML = state.inspectedTile
      ? terrainPanelHTML(state, state.inspectedTile)
      : '';
  }
  if (!panel.innerHTML && !(terrainPanel && terrainPanel.innerHTML)) {
    panel.innerHTML = '<p class="muted">Klicke auf ein Feld, eine Armee oder eine Stadt.</p>';
  }

  const logPanel = document.getElementById('logPanel');
  logPanel.innerHTML = state.log.slice(0, 30).map((entry) => {
    const linked = entry.reportId ? ' log-battle' : '';
    const attr = entry.reportId ? ` data-report="${entry.reportId}"` : '';
    return `<div class="log-line${linked}"${attr}>${escapeHTML(entry.text)}${
      entry.reportId ? '<span class="log-more">Bericht ansehen</span>' : ''}</div>`;
  }).join('');
  logPanel.querySelectorAll('[data-report]').forEach((el) => {
    el.addEventListener('click', () => handlers.onShowReport(el.dataset.report));
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
export function battlePreviewHTML(state, preview) {
  const attacker = factionById(state, preview.attackerFactionId);
  const target = preview.cityName
    ? `${escapeHTML(preview.cityName)}`
    : preview.naval ? 'feindliche Flotte' : 'feindliche Armee';
  const heading = preview.naval ? `Seegefecht – ${target}`
    : preview.amphibious ? `Landung bei ${target}`
      : preview.cityName ? `Angriff auf ${target}` : `Angriff auf ${target}`;
  const terrain = TERRAIN_NAMES[preview.terrainType] || preview.terrainType;

  if (preview.unopposed) {
    return `
      <h2 class="report-title">${escapeHTML(heading)}</h2>
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

  return `
    <h2 class="report-title">${escapeHTML(heading)}</h2>
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

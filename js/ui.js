import {
  UNIT_ORDER, UNIT_TYPES, settlementTier, garrisonCapacity, TILE_TYPES,
  WALL_COST, WALL_BUILD_TURNS, WALL_DEFENCE_MULTIPLIER,
  SHIP_COST, NAVAL_MOVEMENT, SEA_MOVE_COST,
} from './data.js';
import {
  unitTotalCount, playerFaction, factionById, tilePosition, cityAt, armyAt,
  isWaterTile, isCoastalCity,
} from './state.js';
import { embarkStatus } from './actions.js';

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
  const rows = UNIT_ORDER.filter((k) => (engaged[k] || 0) > 0).map((k) => {
    const before = engaged[k] || 0;
    const after = survivors[k] || 0;
    const lost = before - after;
    return `<tr>
      <td class="u-name">${UNIT_TYPES[k].icon} ${UNIT_TYPES[k].name}</td>
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
    notes.push(`<span class="mod-note mod-wall">🧱 Stadtmauer: +${
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

function unitBreakdownHTML(units) {
  return UNIT_ORDER.filter((k) => units[k] > 0)
    .map((k) => `<span class="unit-chip">${UNIT_TYPES[k].icon} ${units[k]} <em>${UNIT_TYPES[k].name}</em></span>`)
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

const EMBARK_REASONS = {
  noCity: 'Nur in einer eigenen Hafenstadt kann eine Armee an Bord gehen.',
  noPort: 'Diese Stadt liegt nicht am Meer.',
  gold: `Zu wenig Gold – eine Flotte kostet ${SHIP_COST}.`,
  blocked: 'Der Hafen ist belegt.',
};

function embarkHTML(state, army) {
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

function renderSelectedArmy(state, army) {
  const faction = factionById(state, army.factionId);
  const city = state.cities.find((c) => c.col === army.col && c.row === army.row);
  const canDisband = city && city.factionId === army.factionId && !army.embarked;
  return `
    <h3><span class="dot" style="background:${faction.color}"></span>${escapeHTML(army.name)}
      ${army.embarked ? '<span class="afloat-tag">⛵ Flotte</span>' : ''}</h3>
    <p class="muted">${escapeHTML(faction.name)} · Bewegung: ${army.movement} / ${army.maxMovement}</p>
    <div class="cond-block">
      ${conditionBarHTML('Moral', army.morale ?? 100, MORALE_SCALE, 'morale')}
      ${conditionBarHTML('Erschöpfung', army.exhaustion ?? 0, EXHAUSTION_SCALE, 'fatigue')}
    </div>
    <div class="unit-list">${unitBreakdownHTML(army.units)}</div>
    ${canDisband
      ? `<button class="disband-btn" data-army="${army.id}">🏰 In ${escapeHTML(city.name)} auflösen – Garnison verstärken</button>`
      : ''}
    ${embarkHTML(state, army)}
    <p class="hint">Grüne Felder: freie Bewegung · Rote Felder: Angriff${
      army.embarked ? ' · Gelbe Felder: an Land gehen' : ''}.</p>
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

  let recruitHTML = '';
  if (isMine) {
    recruitHTML = `
      <div class="recruit-row">
        ${UNIT_ORDER.map((k) => {
          const def = UNIT_TYPES[k];
          const disabled = current >= maxTotal || player.gold < def.cost;
          return `<button class="recruit-btn" data-unit="${k}" ${disabled ? 'disabled' : ''}>
            ${def.icon} ${def.name}<br><small>${def.cost} Gold</small>
          </button>`;
        }).join('')}
      </div>
      <button class="raise-btn" ${current === 0 ? 'disabled' : ''}>🚩 Armee ausheben / verstärken</button>
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
    ${wallHTML(city, isMine, player)}
    <div class="unit-list">${unitBreakdownHTML(city.garrison)}</div>
    ${recruitHTML}
  `;
}

function wallHTML(city, isMine, player) {
  if (city.walls === 'complete') {
    return `<p class="wall-line wall-done">🧱 Stadtmauer errichtet
      <span class="muted">· +${Math.round((WALL_DEFENCE_MULTIPLIER - 1) * 100)}% Verteidigung</span></p>`;
  }
  if (city.walls === 'building') {
    const left = city.wallTurnsLeft;
    const done = WALL_BUILD_TURNS - left;
    return `<p class="wall-line wall-building">🏗️ Stadtmauer im Bau –
      noch ${left} ${left === 1 ? 'Runde' : 'Runden'}
      <span class="wall-track"><span class="wall-fill" style="width:${(done / WALL_BUILD_TURNS) * 100}%"></span></span>
    </p>`;
  }
  if (!isMine) return '<p class="wall-line muted">Keine Stadtmauer</p>';
  const tooPoor = player.gold < WALL_COST;
  return `
    <button class="wall-btn" ${tooPoor ? 'disabled' : ''}>
      🧱 Stadtmauer kaufen – ${WALL_COST} Gold
      <small>${WALL_BUILD_TURNS} Runden Bauzeit</small>
    </button>`;
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
    facts.push(['Bewegungskosten', def.impassable
      ? 'unpassierbar'
      : `${def.cost} ${def.cost === 1 ? 'Punkt' : 'Punkte'} je Feld`]);
    facts.push(['Verteidigung', def.defense > 0
      ? `+${Math.round(def.defense * 15)}% für den Verteidiger`
      : 'kein Geländevorteil']);
    facts.push(['Höhe', `${Math.round(tile.elevation * METRES_PER_ELEVATION)} m`]);
  }
  facts.push(['Lage', tilePosition(col, row).label]);

  return facts.map(([label, value]) =>
    `<div class="terrain-fact"><span>${label}</span><strong>${escapeHTML(value)}</strong></div>`).join('');
}

// What the player learns by clicking a tile. Shown on its own for open ground,
// and under the army or city panel for a tile that is occupied.
export function terrainPanelHTML(state, tile) {
  if (!tile) return '';
  const { col, row } = tile;
  if (col < 0 || col >= state.map.cols || row < 0 || row >= state.map.rows) return '';
  const type = state.map.tiles[row][col].type;
  const def = TILE_TYPES[type];

  const city = cityAt(state, col, row);
  const army = armyAt(state, col, row);
  const occupants = [];
  if (city) {
    const owner = factionById(state, city.factionId);
    occupants.push(`<span class="dot" style="background:${owner.color}"></span>
      ${escapeHTML(city.name)} <em>${settlementLabel(city)}, ${escapeHTML(owner.name)}</em>`);
  }
  if (army) {
    const owner = factionById(state, army.factionId);
    occupants.push(`<span class="dot" style="background:${owner.color}"></span>
      ${escapeHTML(army.name)} <em>${unitTotalCount(army.units).toLocaleString('de-DE')} Mann${
      army.embarked ? ', zur See' : ''}</em>`);
  }

  const notes = [];
  if (type !== 'water' && !def.impassable) {
    const shore = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .some(([dc, dr]) => isWaterTile(state, col + dc, row + dr));
    if (shore) notes.push('Küstenfeld – eine Flotte kann hier landen.');
  }
  if (city && isCoastalCity(state, city)) notes.push('Hafen – hier kann eine Armee in See stechen.');
  if (type === 'desert') notes.push('Wüste – zäh zu durchqueren und ohne Deckung.');
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
  document.getElementById('turnLabel').textContent = `Runde ${state.turn}`;
  const player = playerFaction(state);
  document.getElementById('goldLabel').textContent = `💰 ${player.gold} Gold`;

  const factionList = document.getElementById('factionList');
  factionList.innerHTML = state.factions
    .filter((f) => !f.isNeutral)
    .map((f) => {
      const cities = state.cities.filter((c) => c.factionId === f.id).length;
      const armies = state.armies.filter((a) => a.factionId === f.id).length;
      const dead = !f.alive ? ' faction-dead' : '';
      return `<li class="${dead}"><span class="dot" style="background:${f.color}"></span>${f.name}
        <span class="muted">🏛️${cities} · ⚔️${armies}</span></li>`;
    })
    .join('');

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
      state.gameOver.result === 'victory' ? '🏆 Sieg für Rom!' : '💀 Rom ist gefallen';
    overlay.querySelector('.overlay-text').textContent =
      state.gameOver.result === 'victory'
        ? `Alle feindlichen Fraktionen wurden in Runde ${state.turn} besiegt.`
        : `Rom hat in Runde ${state.turn} alle Städte und Armeen verloren.`;
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
  const rows = UNIT_ORDER.filter((k) => (engaged[k] || 0) > 0).map((k) => `<tr>
      <td class="u-name">${UNIT_TYPES[k].icon} ${UNIT_TYPES[k].name}</td>
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

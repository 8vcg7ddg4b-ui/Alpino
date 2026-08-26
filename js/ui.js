import { UNIT_ORDER, UNIT_TYPES, GARRISON_POP_RATIO, TILE_TYPES } from './data.js';
import { unitTotalCount, playerFaction, factionById } from './state.js';

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

export function battleReportHTML(state, report) {
  const attackerWon = report.outcome === 'attacker';
  const terrain = TERRAIN_NAMES[report.terrainType] || report.terrainType;
  const place = report.cityName
    ? `${report.kind === 'city' ? 'Belagerung von' : 'Schlacht bei'} ${escapeHTML(report.cityName)}`
    : 'Feldschlacht';
  const bonus = report.terrainBonus > 0
    ? ` · Geländevorteil für den Verteidiger: +${Math.round(report.terrainBonus * 15)}% Verteidigung`
    : ' · kein Geländevorteil';

  return `
    <h2 class="report-title">${place}</h2>
    <p class="report-meta">Runde ${report.turn} · ${escapeHTML(terrain)}${bonus}</p>
    <p class="report-meta">Entschieden: ${escapeHTML(report.endedBy || '—')}</p>
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

function renderSelectedArmy(state, army) {
  const faction = factionById(state, army.factionId);
  return `
    <h3><span class="dot" style="background:${faction.color}"></span>${army.name}</h3>
    <p class="muted">${faction.name} · Bewegung: ${army.movement} / ${army.maxMovement}</p>
    <div class="unit-list">${unitBreakdownHTML(army.units)}</div>
    <p class="hint">Grüne Felder: freie Bewegung · Rote Felder: Angriff auslösen.</p>
  `;
}

function renderSelectedCity(state, city, onRecruit, onRaise) {
  const faction = factionById(state, city.factionId);
  const player = playerFaction(state);
  const isMine = city.factionId === player.id;
  const maxTotal = Math.floor(city.population / GARRISON_POP_RATIO);
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
    <h3><span class="dot" style="background:${faction.color}"></span>${city.name} ${city.capital ? '👑' : ''}</h3>
    <p class="muted">${faction.name} · Bevölkerung: ${city.population.toLocaleString('de-DE')}</p>
    <p class="muted">Garnison: ${current} / ${maxTotal}</p>
    <div class="unit-list">${unitBreakdownHTML(city.garrison)}</div>
    ${recruitHTML}
  `;
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
  } else if (state.selectedCityId) {
    const city = state.cities.find((c) => c.id === state.selectedCityId);
    if (city) {
      panel.innerHTML = renderSelectedCity(state, city);
      panel.querySelectorAll('.recruit-btn').forEach((btn) => {
        btn.addEventListener('click', () => handlers.onRecruit(city.id, btn.dataset.unit));
      });
      const raiseBtn = panel.querySelector('.raise-btn');
      if (raiseBtn) raiseBtn.addEventListener('click', () => handlers.onRaise(city.id));
    }
  } else {
    panel.innerHTML = '<p class="muted">Klicke auf eine Armee oder Stadt, um Details zu sehen.</p>';
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

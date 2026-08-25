import { UNIT_ORDER, UNIT_TYPES, GARRISON_POP_RATIO } from './data.js';
import { unitTotalCount, playerFaction, factionById } from './state.js';

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
  logPanel.innerHTML = state.log.slice(0, 30).map((m) => `<div class="log-line">${m}</div>`).join('');

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

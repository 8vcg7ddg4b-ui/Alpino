// --- Die Anzeige ----------------------------------------------------------
// Alles, was in HTML steht: Kopfleiste, Auswahltafel, Reichsübersicht,
// Diplomatie, Technik, Chronik, Gefechtsbericht. Hier wird nur gebaut und
// beschrieben - gehandelt wird in `main.js`.
import {
  ROLE_LABELS, ROLE_SHORT, UNIT_ROLES, WATCH_ROLE, unitDefs, shipName,
  BUILDING_DEFS, BUILDING_ORDER, buildingName, sizeTier, shieldInfo,
  SHIELD_LEVELS, MAX_SHIELD_LEVEL, TECH_LINES, TECH_ORDER, MAX_TECH_LEVEL,
  techStep, TACTICS, ATTACK_TACTICS, DEFENCE_TACTICS, calendarOfTurn,
  experienceStars, experienceLabel, factionProfile, GREAT_WORKS, TILE_LABELS,
  VICTORY_SYSTEMS, ROLE_REQUIRES, GAME_NAME,
} from './data.js';
import {
  factionById, systemsOf, fleetsOf, fleetTotalCount, fleetRoleCount, garrisonTotal,
  garrisonFieldUnits, movementMaxFor, greatWorksOf, systemAt, fleetsAt, hasSeen,
  totalPopulation, playerFaction, capitalOf, tileOf,
} from './state.js';
import {
  atWar, relationOf, relationLabel, treatyOf, TREATY_TYPES, knowsFaction, GIFT_COST,
} from './diplomacy.js';
import { systemIncome, upkeepOf, canBuildRole, sensorRangeOf } from './actions.js';
import { emblemSVG, iconSVG } from './emblems.js';
import { sectorOfTile } from './starchart.js';
import { aceBonusText } from './pilots.js';
import { battleRoundsHTML } from './battle3d.js';

const nf = new Intl.NumberFormat('de-DE');
export function num(value) {
  return nf.format(Math.round(value || 0));
}

function bar(value, max, cls = '') {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return `<span class="bar ${cls}"><span style="width:${pct}%"></span></span>`;
}

function stars(exp) {
  const n = experienceStars(exp);
  return `<span class="stars" title="${experienceLabel(exp)}">${'★'.repeat(n)}${'☆'.repeat(3 - n)}</span>`;
}

// --- Kopfleiste -----------------------------------------------------------
export function topBarHTML(state) {
  const me = playerFaction(state);
  const profile = factionProfile(me.id);
  const cal = calendarOfTurn(state.turn);
  const systems = systemsOf(state, me.id);
  const income = systems.reduce((s, sys) => s + systemIncome(state, sys), 0) + 90;
  const upkeep = upkeepOf(state, me.id);
  const net = income - upkeep;
  const research = me.research
    ? `${TECH_LINES[me.research.line].name} ${me.research.level} · noch ${me.research.turnsLeft}`
    : 'nichts in Arbeit';
  return `
    <div class="tb-faction" style="--faction:${profile.color}">
      <span class="tb-emblem">${emblemSVG(profile.emblem, { size: 30, color: profile.color })}</span>
      <span class="tb-names"><strong>${me.short}</strong><small>${me.ruler.name}</small></span>
    </div>
    <div class="tb-stat" title="Kredits in der Kriegskasse">
      ${iconSVG('credits', { size: 18 })}
      <span><strong>${num(me.credits)}</strong>
      <small class="${net >= 0 ? 'good' : 'bad'}">${net >= 0 ? '+' : ''}${num(net)} je Zug</small></span>
    </div>
    <div class="tb-stat" title="Systeme im Reich">
      ${iconSVG('system', { size: 18 })}
      <span><strong>${systems.length}</strong><small>von ${VICTORY_SYSTEMS} zum Sieg</small></span>
    </div>
    <div class="tb-stat" title="Flotten im Feld">
      ${iconSVG('fleet', { size: 18 })}
      <span><strong>${fleetsOf(state, me.id).length}</strong><small>Flotten</small></span>
    </div>
    <div class="tb-stat" title="Forschung">
      ${iconSVG('tech', { size: 18 })}
      <span><strong>${me.tech.triebwerke}/${me.tech.waffen}/${me.tech.schilde}</strong><small>${research}</small></span>
    </div>
    <div class="tb-turn">
      <strong>Zug ${state.turn}</strong>
      <small>${cal.month} ${cal.year}</small>
    </div>`;
}

// --- Auswahltafel ---------------------------------------------------------
// Was links steht, wenn man eine Flotte oder ein System angeklickt hat.
export function fleetPanelHTML(state, fleet, extra = {}) {
  const profile = factionProfile(fleet.factionId);
  const mine = fleet.factionId === state.playerFactionId;
  const sys = systemAt(state, fleet.col, fleet.row);
  const tile = tileOf(state, fleet.col, fleet.row);
  const sector = sectorOfTile(fleet.col, fleet.row);
  const defs = unitDefs(fleet.factionId);
  const rows = fleet.units.map((u) => `
    <tr>
      <td class="u-name">${shipName(fleet.factionId, u.role)}</td>
      <td class="u-count">${u.count}<small>/${defs[u.role].staffel}</small></td>
      <td class="u-exp">${stars(u.exp)}</td>
    </tr>`).join('');

  return `
    <header class="panel-head" style="--faction:${profile.color}">
      <span class="ph-emblem">${emblemSVG(profile.emblem, { size: 26, color: profile.color })}</span>
      <span class="ph-title">
        <strong>${fleet.name}</strong>
        <small>${profile.short} · ${sector.name}${sys ? ` · über ${sys.name}` : ''}</small>
      </span>
    </header>
    <div class="panel-stats">
      <div><span>Maschinen</span><strong>${fleetTotalCount(fleet)}</strong></div>
      <div><span>Moral</span><strong>${Math.round(fleet.morale)}</strong>${bar(fleet.morale, 100, 'moral')}</div>
      <div><span>Bewegung</span><strong>${fleet.movement}/${movementMaxFor(state, fleet)}</strong>${bar(fleet.movement, movementMaxFor(state, fleet), 'move')}</div>
      <div><span>Raum</span><strong>${TILE_LABELS[tile ? tile.type : 'leere']}</strong></div>
    </div>
    ${fleet.ace ? `<div class="ace-line">${iconSVG('star', { size: 16 })}
      <strong>${fleet.ace.name}</strong> „${fleet.ace.call}" · ${aceBonusText(fleet.ace)}</div>` : ''}
    <table class="unit-table"><tbody>${rows}</tbody></table>
    ${mine ? fleetActionsHTML(state, fleet, sys, extra) : `
      <p class="hint">Fremde Flotte. ${atWar(state, state.playerFactionId, fleet.factionId)
    ? 'Ihr liegt im Krieg – sie kann angegriffen werden.'
    : 'Kein Krieg – ein Angriff wäre eine Kriegserklärung.'}</p>`}`;
}

function fleetActionsHTML(state, fleet, sys, extra) {
  const own = sys && sys.factionId === fleet.factionId;
  const canSiege = sys && sys.factionId !== fleet.factionId;
  return `
    <div class="panel-actions">
      <button data-action="fleet-center" title="Auf die Flotte blicken">${iconSVG('eye', { size: 16 })} Ansehen</button>
      ${own ? `<button data-action="fleet-reinforce">${iconSVG('yard', { size: 16 })} Auffrischen</button>` : ''}
      ${own ? '<button data-action="fleet-disband">In die Garnison</button>' : ''}
      ${canSiege ? `<button data-action="fleet-siege">${iconSVG('siege', { size: 16 })} Einschließen</button>` : ''}
      ${fleet.stance !== 'normal' ? '<button data-action="fleet-release">Einschließung aufheben</button>' : ''}
      ${extra.canMerge ? '<button data-action="fleet-merge">Mit Flotte hier vereinen</button>' : ''}
      <button data-action="fleet-sleep">Zug beenden für diese Flotte</button>
    </div>
    <p class="hint">${fleet.stance === 'belagern' ? 'Diese Flotte schließt das System ein: die Wache zehrt aus, der Schild fällt.'
    : fleet.stance === 'blockade' ? 'Diese Flotte blockiert das System: seine Kassen bleiben leer.'
    : 'Klicke ein blaues Feld an, um zu fliegen – ein rotes, um anzugreifen.'}</p>`;
}

export function systemPanelHTML(state, sys) {
  const profile = factionProfile(sys.factionId);
  const mine = sys.factionId === state.playerFactionId;
  const tier = sizeTier(sys.size);
  const shield = shieldInfo(sys.shield.level);
  const work = sys.greatWork ? GREAT_WORKS.find((w) => w.id === sys.greatWork) : null;
  const garrison = Object.entries(sys.garrison).filter(([, n]) => n > 0)
    .map(([role, n]) => `<li>${shipName(sys.factionId, role)} <strong>${n}</strong></li>`).join('');
  const builds = sys.training.map((t) => `<li>${shipName(sys.factionId, t.role)}
    <small>noch ${t.turnsLeft} ${t.turnsLeft === 1 ? 'Zug' : 'Züge'}</small>
    ${mine ? `<button class="mini" data-action="cancel-build" data-id="${t.id}">×</button>` : ''}</li>`).join('');
  const buildings = BUILDING_ORDER.map((id) => {
    const def = BUILDING_DEFS[id];
    const cur = sys.buildings[id] || { level: 0, building: null };
    const state_ = cur.building ? `<small>baut Stufe ${cur.building.level}, noch ${cur.building.turnsLeft}</small>`
      : cur.level ? `<small>Stufe ${cur.level}/${def.maxLevel}</small>`
        : '<small>nicht vorhanden</small>';
    const next = def.levels[cur.level];
    const canBuy = mine && !cur.building && cur.level < def.maxLevel;
    return `<li class="${cur.level ? 'has' : ''}">
      <span>${def.name} ${state_}</span>
      ${canBuy ? `<button class="mini" data-action="buy-building" data-id="${id}"
        title="${def.desc}">${num(next.cost)} ⧉</button>` : ''}
    </li>`;
  }).join('');

  return `
    <header class="panel-head" style="--faction:${profile.color}">
      <span class="ph-emblem">${emblemSVG(profile.emblem, { size: 26, color: profile.color })}</span>
      <span class="ph-title">
        <strong>${sys.name}${sys.capital ? ' ★' : ''}</strong>
        <small>${tier.label} · ${profile.short} · ${sectorOfTile(sys.col, sys.row).name}</small>
      </span>
    </header>
    <div class="panel-stats">
      <div><span>Bevölkerung</span><strong>${num(sys.population)} Mio</strong></div>
      <div><span>Ertrag</span><strong>${num(systemIncome(state, sys))}</strong></div>
      <div><span>Schild</span><strong>${shield.name}</strong>${sys.shield.down > 0
    ? bar(1 - sys.shield.down, 1, 'shield') : ''}</div>
      <div><span>Wache</span><strong>${garrisonTotal(sys)}</strong></div>
    </div>
    ${sys.siege ? '<p class="warn">Dieses System ist eingeschlossen.</p>' : ''}
    ${sys.blockade ? '<p class="warn">Dieses System ist blockiert – die Kassen bleiben leer.</p>' : ''}
    ${sys.unrest > 2 ? `<p class="warn">Unruhe: ${Math.round(sys.unrest)}/10</p>` : ''}
    ${work ? `<p class="work">${iconSVG('star', { size: 14 })} <strong>${work.name}</strong> – ${work.effect}</p>` : ''}
    ${garrison ? `<div class="panel-block"><h4>Garnison</h4><ul class="tight">${garrison}</ul></div>` : ''}
    ${builds ? `<div class="panel-block"><h4>Auf der Werft</h4><ul class="tight builds">${builds}</ul></div>` : ''}
    ${mine ? `
      <div class="panel-block"><h4>Bauen</h4>
        <div class="build-grid">${buildShipButtons(state, sys)}</div>
      </div>
      <div class="panel-block"><h4>Ausbauten</h4><ul class="tight buildings">${buildings}</ul></div>
      <div class="panel-actions">
        ${sys.shield.level < MAX_SHIELD_LEVEL && !sys.shield.building
    ? `<button data-action="build-shield">${iconSVG('shield', { size: 16 })}
        ${SHIELD_LEVELS[sys.shield.level + 1].name} (${num(SHIELD_LEVELS[sys.shield.level + 1].cost)})</button>` : ''}
        ${Object.keys(garrisonFieldUnits(sys)).length
    ? `<button data-action="raise-fleet">${iconSVG('fleet', { size: 16 })} Flotte aufstellen</button>` : ''}
      </div>` : `<p class="hint">${atWar(state, state.playerFactionId, sys.factionId)
    ? 'Feindliches System. Bomber drücken den Schild, Landungstruppen nehmen die Welt.'
    : 'Fremdes System.'}</p>`}`;
}

function buildShipButtons(state, sys) {
  const defs = unitDefs(sys.factionId);
  const faction = factionById(state, sys.factionId);
  return UNIT_ROLES.map((role) => {
    const def = defs[role];
    const allowed = canBuildRole(state, sys, role);
    const affordable = faction.credits >= def.cost;
    const need = ROLE_REQUIRES[role];
    const title = allowed ? `${def.name} · ${def.time} Züge · Angriff ${def.attack} · Panzerung ${def.armour}`
      : `Braucht ${buildingName(need.building)} Stufe ${need.level}`;
    return `<button class="build-btn ${allowed ? '' : 'locked'} ${affordable ? '' : 'poor'}"
      data-action="build-ship" data-role="${role}" title="${title}" ${allowed ? '' : 'disabled'}>
      <span class="bb-name">${ROLE_SHORT[role]}</span>
      <span class="bb-cost">${num(def.cost)}</span>
    </button>`;
  }).join('');
}

// Was auf einem leeren Feld steht, wenn man es anklickt.
export function tileInfoHTML(state, col, row) {
  const tile = tileOf(state, col, row);
  if (!tile) return '<p class="hint">Außerhalb der Karte.</p>';
  const sector = sectorOfTile(col, row);
  const fleets = fleetsAt(state, col, row);
  return `
    <header class="panel-head">
      <span class="ph-title">
        <strong>${TILE_LABELS[tile.type]}</strong>
        <small>${tile.zoneName || sector.name} · Feld ${col}/${row}</small>
      </span>
    </header>
    <div class="panel-stats">
      <div><span>Sektor</span><strong>${sector.name}</strong></div>
      <div><span>Flugkosten</span><strong>${tile.type === 'graben' ? 'kein Weg'
    : tile.type === 'asteroiden' ? '3' : tile.type === 'nebel' || tile.type === 'strahlung' ? '2' : '1'}</strong></div>
      ${tile.jump ? `<div><span>Sprungpunkt</span><strong>${tile.jump.name}</strong></div>` : ''}
    </div>
    ${fleets.length ? `<div class="panel-block"><h4>Verbände hier</h4><ul class="tight">
      ${fleets.map((f) => `<li>${f.name} <small>${factionProfile(f.factionId).short}</small></li>`).join('')}
    </ul></div>` : ''}
    <p class="hint">${tileHint(tile)}</p>`;
}

function tileHint(tile) {
  switch (tile.type) {
    case 'nebel': return 'Im Nebel sieht man nur, wer daneben steht – gut zum Verstecken, schlecht zum Suchen.';
    case 'asteroiden': return 'Trümmer kosten Zeit und Maschinen. Wer es eilig hat, verliert hier Jäger.';
    case 'strahlung': return 'Strahlung frisst Panzerung. Kein Ort zum Warten.';
    case 'graben': return 'Ein Gravitationsgraben. Hier geht kein Sprung – man fliegt herum.';
    default: return tile.jump ? 'Ein Sprungpunkt: von hier geht es in einem Zug an das andere Ende.'
      : 'Offener Raum.';
  }
}

// --- Vorschau und Gefechtsbericht ---------------------------------------
export function battlePreviewHTML(preview, attacker, defenderName) {
  return `
    <div class="preview">
      <div class="pv-head"><strong>${attacker.name}</strong> greift <strong>${defenderName}</strong> an</div>
      <div class="pv-bars">
        <div class="pv-side"><span>Angriff</span><strong>${num(preview.attackStrength)}</strong></div>
        <div class="pv-chance ${preview.chance > 60 ? 'good' : preview.chance > 40 ? 'even' : 'bad'}">
          ${preview.chance}%</div>
        <div class="pv-side"><span>Abwehr</span><strong>${num(preview.defenceStrength)}</strong></div>
      </div>
      <ul class="pv-notes">
        <li>Raum: ${preview.terrain}</li>
        <li>Ordnung: ${TACTICS[preview.attackerTactic].name} gegen ${TACTICS[preview.defenderTactic].name}</li>
        ${preview.needsMarines ? `<li>${preview.hasMarines ? 'Landungstruppen an Bord'
    : '<span class="bad">Ohne Landungstruppen fällt die Welt nicht</span>'}</li>` : ''}
        ${preview.shieldLevel ? `<li>Schild: ${shieldInfo(preview.shieldLevel).name}
          (${Math.round(preview.shieldDown * 100)}% niedergedrückt)</li>` : ''}
      </ul>
    </div>`;
}

export function battleReportHTML(state, report) {
  if (!report) return '';
  const me = state.playerFactionId;
  const good = (report.winner === 'angreifer' && report.attacker.factionId === me)
    || (report.winner === 'verteidiger' && report.defender.factionId === me);
  const title = report.winner === 'unentschieden' ? 'Unentschieden'
    : good ? 'Sieg' : 'Niederlage';
  const aProfile = factionProfile(report.attacker.factionId);
  const dProfile = factionProfile(report.defender.factionId);
  const where = report.kind === 'system' ? `bei ${report.defender.name}`
    : `gegen ${report.defender.name}`;
  return `
    <div class="report ${good ? 'won' : 'lost'}">
      <h3>${title} ${where}</h3>
      <div class="rp-sides">
        <div style="--faction:${aProfile.color}">
          ${emblemSVG(aProfile.emblem, { size: 34, color: aProfile.color })}
          <strong>${report.attacker.name}</strong>
          <small>${TACTICS[report.attacker.tactic].name} · Moral ${report.attacker.morale}</small>
          ${report.attacker.ace ? `<small>Ass: ${report.attacker.ace}</small>` : ''}
        </div>
        <div class="rp-vs">gegen</div>
        <div style="--faction:${dProfile.color}">
          ${emblemSVG(dProfile.emblem, { size: 34, color: dProfile.color })}
          <strong>${report.defender.name}</strong>
          <small>${TACTICS[report.defender.tactic].name} · Moral ${report.defender.morale}</small>
          ${report.defender.ace ? `<small>Ass: ${report.defender.ace}</small>` : ''}
        </div>
      </div>
      <p class="rp-terrain">Gefochten im ${report.terrain}${report.shield
    ? `, gegen ${shieldInfo(report.shield.level).name}` : ''}.</p>
      ${battleRoundsHTML(report)}
    </div>`;
}

// --- Reichsübersicht ------------------------------------------------------
export function empireHTML(state) {
  const me = playerFaction(state);
  const systems = systemsOf(state, me.id).sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
  const fleets = fleetsOf(state, me.id);
  const income = systems.reduce((s, sys) => s + systemIncome(state, sys), 0) + 90;
  const upkeep = upkeepOf(state, me.id);
  const works = greatWorksOf(state, me.id);
  return `
    <div class="empire">
      <div class="em-summary">
        <div><span>Kredits</span><strong>${num(me.credits)}</strong></div>
        <div><span>Einnahmen</span><strong class="good">+${num(income)}</strong></div>
        <div><span>Unterhalt</span><strong class="bad">−${num(upkeep)}</strong></div>
        <div><span>Bevölkerung</span><strong>${num(totalPopulation(state, me.id))} Mio</strong></div>
        <div><span>Systeme</span><strong>${systems.length}</strong></div>
        <div><span>Flotten</span><strong>${fleets.length}</strong></div>
      </div>
      ${works.length ? `<p class="work">${works.map((w) => `<strong>${w.name}</strong> – ${w.effect}`).join('<br>')}</p>` : ''}
      <h4>Schlachtordnungen</h4>
      <div class="tactic-grid">
        <div>
          <span>Im Angriff</span>
          ${ATTACK_TACTICS.map((id) => `<button class="tactic ${me.tacticAttack === id ? 'on' : ''}"
            data-action="set-tactic" data-kind="angriff" data-id="${id}"
            title="${TACTICS[id].desc}">${TACTICS[id].name}</button>`).join('')}
        </div>
        <div>
          <span>In der Verteidigung</span>
          ${DEFENCE_TACTICS.map((id) => `<button class="tactic ${me.tacticDefence === id ? 'on' : ''}"
            data-action="set-tactic" data-kind="verteidigung" data-id="${id}"
            title="${TACTICS[id].desc}">${TACTICS[id].name}</button>`).join('')}
        </div>
      </div>
      <h4>Systeme</h4>
      <table class="list">
        <thead><tr><th>Name</th><th>Rang</th><th>Bev.</th><th>Ertrag</th><th>Schild</th><th>Werft</th><th>Wache</th></tr></thead>
        <tbody>${systems.map((s) => `<tr data-action="goto-system" data-id="${s.id}">
          <td>${s.name}${s.capital ? ' ★' : ''}</td>
          <td>${sizeTier(s.size).label}</td>
          <td>${num(s.population)}</td>
          <td>${num(systemIncome(state, s))}</td>
          <td>${shieldInfo(s.shield.level).name}</td>
          <td>${s.buildings.werft ? `Stufe ${s.buildings.werft.level}` : '—'}</td>
          <td>${garrisonTotal(s)}</td>
        </tr>`).join('')}</tbody>
      </table>
      <h4>Flotten</h4>
      <table class="list">
        <thead><tr><th>Name</th><th>Maschinen</th><th>Moral</th><th>Ass</th><th>Steht bei</th></tr></thead>
        <tbody>${fleets.map((f) => {
    const sys = systemAt(state, f.col, f.row);
    return `<tr data-action="goto-fleet" data-id="${f.id}">
          <td>${f.name}</td>
          <td>${fleetTotalCount(f)}</td>
          <td>${Math.round(f.morale)}</td>
          <td>${f.ace ? f.ace.call : '—'}</td>
          <td>${sys ? sys.name : `${sectorOfTile(f.col, f.row).name}`}</td>
        </tr>`;
  }).join('')}</tbody>
      </table>
    </div>`;
}

// --- Diplomatie -----------------------------------------------------------
export function diplomacyHTML(state) {
  const me = playerFaction(state);
  const others = state.factions.filter((f) => f.id !== me.id && !f.isNeutral && f.alive
    && knowsFaction(state, me.id, f.id));
  const offers = state.diplomacy.offers;
  return `
    <div class="diplo">
      ${offers.length ? `<div class="offers"><h4>Auf dem Tisch</h4>${offers.map((o) => `
        <div class="offer">
          <span>${offerText(state, o)}</span>
          <button class="mini good" data-action="offer-accept" data-id="${o.id}">Annehmen</button>
          <button class="mini" data-action="offer-reject" data-id="${o.id}">Ablehnen</button>
        </div>`).join('')}</div>` : ''}
      ${others.map((f) => {
    const profile = factionProfile(f.id);
    const rel = relationOf(state, me.id, f.id);
    const war = atWar(state, me.id, f.id);
    const treaty = treatyOf(state, me.id, f.id);
    return `
        <div class="diplo-card" style="--faction:${profile.color}">
          <div class="dc-head">
            ${emblemSVG(profile.emblem, { size: 34, color: profile.color })}
            <div>
              <strong>${f.name}</strong>
              <small>${f.ruler.title} ${f.ruler.name}</small>
            </div>
            <div class="dc-state ${war ? 'war' : ''}">${war ? 'Krieg' : relationLabel(rel)}</div>
          </div>
          <div class="dc-rel">${bar(rel + 100, 200, rel >= 0 ? 'good' : 'bad')}<small>${rel > 0 ? '+' : ''}${Math.round(rel)}</small></div>
          <p class="dc-word">„${f.ruler.word}"</p>
          ${treaty ? `<p class="dc-treaty">${TREATY_TYPES[treaty.type].name} seit Zug ${treaty.since}</p>` : ''}
          <div class="dc-actions">
            ${war ? `<button data-action="offer-peace" data-id="${f.id}">Frieden anbieten</button>`
    : `<button data-action="declare-war" data-id="${f.id}">Krieg erklären</button>`}
            <button data-action="send-gift" data-id="${f.id}">Geschenk (${GIFT_COST})</button>
            ${!war && !treaty ? `<button data-action="propose-treaty" data-id="${f.id}" data-type="nichtangriff">Nichtangriffspakt</button>
              <button data-action="propose-treaty" data-id="${f.id}" data-type="handel">Handelsabkommen</button>
              <button data-action="propose-treaty" data-id="${f.id}" data-type="buendnis">Bündnis</button>` : ''}
            ${treaty ? `<button data-action="renounce-treaty" data-id="${f.id}">Vertrag kündigen</button>` : ''}
          </div>
        </div>`;
  }).join('')}
      ${others.length ? '' : '<p class="hint">Noch kennst du niemanden. Schick Flotten hinaus.</p>'}
    </div>`;
}

function offerText(state, offer) {
  const from = factionProfile(offer.from).name;
  if (offer.kind === 'frieden') return `${from} bietet Frieden an.`;
  if (offer.kind === 'vertrag') return `${from} schlägt einen ${TREATY_TYPES[offer.treaty].name} vor.`;
  if (offer.kind === 'geschenk') return `${from} schickt ${num(offer.amount)} Kredits.`;
  return `${from} lässt etwas ausrichten.`;
}

// --- Technik --------------------------------------------------------------
export function techHTML(state) {
  const me = playerFaction(state);
  return `
    <div class="tech">
      ${me.research ? `<p class="running">In Arbeit: <strong>${TECH_LINES[me.research.line].name}
        Stufe ${me.research.level}</strong> – noch ${me.research.turnsLeft} Züge.</p>`
    : '<p class="hint">Nichts in Arbeit. Forschung gilt für das ganze Reich.</p>'}
      ${TECH_ORDER.map((id) => {
    const line = TECH_LINES[id];
    const level = me.tech[id] || 0;
    const next = level < MAX_TECH_LEVEL ? techStep(id, level) : null;
    return `
        <div class="tech-line">
          <div class="tl-head">
            ${iconSVG('tech', { size: 20 })}
            <strong>${line.name}</strong>
            <span class="tl-level">${'●'.repeat(level)}${'○'.repeat(MAX_TECH_LEVEL - level)}</span>
          </div>
          <p>${line.desc}</p>
          ${next ? `<button data-action="research" data-id="${id}"
            ${me.research || me.credits < next.cost ? 'disabled' : ''}>
            Stufe ${level + 1}: ${next.note} · ${num(next.cost)} Kredits</button>`
    : '<p class="done">Am Ende der Linie.</p>'}
        </div>`;
  }).join('')}
    </div>`;
}

// --- Chronik --------------------------------------------------------------
export function chronicleHTML(state) {
  const entries = [...state.log].reverse().slice(0, 120);
  return `<div class="chronicle">${entries.map((e) => `
    <div class="chron-entry ${e.kind}">
      <span class="ce-turn">${e.turn}</span>
      <span class="ce-text">${e.text}</span>
    </div>`).join('')}</div>`;
}

export function logFeedHTML(state, count = 7) {
  const entries = [...state.log].reverse().slice(0, count);
  return entries.map((e) => `<div class="feed-line ${e.kind}">${e.text}</div>`).join('');
}

// Aus einer Nachricht der Höfe wird eine Meldung am Bildrand.
export function noticeFromNews(news) {
  if (!news) return '';
  return news.text;
}

// --- Fraktionswahl --------------------------------------------------------
export function factionChoiceHTML(factions, selectedId) {
  return factions.map((f) => {
    const profile = factionProfile(f.id);
    return `
      <button class="fc-card ${selectedId === f.id ? 'on' : ''}" data-faction="${f.id}"
        style="--faction:${profile.color};--faction-dark:${profile.colorDark}">
        <span class="fc-emblem">${emblemSVG(profile.emblem, { size: 54, color: profile.color })}</span>
        <span class="fc-text">
          <strong>${profile.name}</strong>
          <small>${profile.doctrine}</small>
          <em>${profile.strength}</em>
        </span>
      </button>`;
  }).join('');
}

export function scenarioChoiceHTML(scenarios, selectedId) {
  return scenarios.map((s) => `
    <button class="sc-card ${selectedId === s.id ? 'on' : ''}" data-scenario="${s.id}">
      <strong>${s.name}</strong>
      <span class="sc-year">${s.year}</span>
      <small>${s.blurb}</small>
    </button>`).join('');
}

// --- Sieg und Ende --------------------------------------------------------
export function victoryHTML(state, victory) {
  const me = playerFaction(state);
  const profile = factionProfile(me.id);
  const cal = calendarOfTurn(state.turn);
  return `
    <div class="victory ${victory.kind}">
      ${emblemSVG(profile.emblem, { size: 90, color: profile.color })}
      <h2>${victory.kind === 'sieg' ? 'Der Krieg ist entschieden' : 'Das Reich ist gefallen'}</h2>
      <p>${victory.text}</p>
      <div class="vc-stats">
        <div><span>Züge</span><strong>${state.turn}</strong></div>
        <div><span>Jahr</span><strong>${cal.year}</strong></div>
        <div><span>Systeme</span><strong>${systemsOf(state, me.id).length}</strong></div>
        <div><span>Schlachten</span><strong>${me.stats.battles}</strong></div>
        <div><span>gewonnen</span><strong>${me.stats.won}</strong></div>
        <div><span>erobert</span><strong>${me.stats.systemsTaken}</strong></div>
      </div>
      <div class="vc-actions">
        <button data-action="victory-continue">Weiterspielen</button>
        <button data-action="victory-menu">Zurück zum Startbild</button>
      </div>
    </div>`;
}

// Der Lagebericht des Ersten Offiziers zu Beginn eines Feldzugs.
export function briefingHTML(state, scenario) {
  const me = playerFaction(state);
  const profile = factionProfile(me.id);
  const home = capitalOf(state, me.id);
  const foes = state.factions.filter((f) => atWar(state, me.id, f.id));
  return `
    <div class="briefing">
      <div class="bf-head">${emblemSVG(profile.emblem, { size: 40, color: profile.color })}
        <div><strong>${me.ruler.title} ${me.ruler.name}</strong>
        <small>${me.name} · ${scenario.name}, ${scenario.year}</small></div>
      </div>
      <p class="bf-hail">„Ich grüße Sie an Bord. Die Karte liegt auf dem Tisch."</p>
      <p>${scenario.blurb}</p>
      <ul>
        <li>Hauptquartier: <strong>${home ? home.name : '—'}</strong></li>
        <li>Systeme: <strong>${systemsOf(state, me.id).length}</strong>, Flotten: <strong>${fleetsOf(state, me.id).length}</strong></li>
        <li>Im Krieg mit: <strong>${foes.length ? foes.map((f) => f.short).join(', ') : 'niemandem'}</strong></li>
        <li>Doktrin: ${profile.doctrine}</li>
      </ul>
      <p class="bf-word">${scenario.hint}</p>
    </div>`;
}

export const GAME_TITLE = GAME_NAME;

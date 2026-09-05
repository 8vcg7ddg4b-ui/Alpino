// --- Der Feldzug ----------------------------------------------------------
// Hier läuft das Spiel zusammen: Startbild, Fraktionswahl, die Karte, der
// Zug des Spielers, der Zug der anderen. Regeln stehen in `actions.js`,
// Bilder in `scene3d.js`, Text in `ui.js` - dies ist der Draht dazwischen.
import {
  GAME_NAME, GAME_VERSION, calendarOfTurn, playableFactions, factionProfile,
  TACTICS, VICTORY_SYSTEMS, sizeTier,
} from './data.js';
import { SCENARIOS, DEFAULT_SCENARIO_ID, scenarioById } from './scenarios.js';
import {
  createInitialState, playerFaction, factionById, systemAt, systemById, fleetById,
  fleetsAt, fleetsOf, systemsOf, fleetTotalCount, movementMaxFor, capitalOf, logMsg,
  resetIds, hasSeen,
} from './state.js';
import { GRID_COLS, GRID_ROWS } from './starchart.js';
import {
  resetMovement, moveFleet, attackTile, raiseFleet, reinforceFleet, disbandIntoSystem,
  mergeFleets, buildShip, cancelTraining, buyBuilding, buildShield, startResearch,
  besiegeSystem, liftSiege, blockadeSystem, updateSieges, pruneTradeRoutes,
  endOfTurnFor, checkVictory, setTactic, revealAround, computeVisibility,
} from './actions.js';
import { previewBattle } from './combat.js';
import { computeReachable, pathTo, tileKey } from './pathfind.js';
import { aiTakeAllTurns, setAiStance } from './ai.js';
import {
  rulersTakeTurn, expireOffers, takeDiploNews, acceptOffer, rejectOffer,
  offerPeace, declareWar, sendGift, proposeTreaty, renounceTreaty, atWar,
} from './diplomacy.js';
import { rollEvents, spawnRaiders, moveRaiders, nephilimWave, moveNephilim } from './events.js';
import {
  initScene, buildMap, syncEntities, render as drawScene, resize, centerOn,
  centerOnFaction, zoomCamera, setOpeningView, setMapMode, getMapMode, northOnScreen,
  animateFleet, glideTo, isAnimating, setBridgeVisible, setStarsVisible, setGuidesVisible,
  flashTile, captureFrame, tileToScreen, pickTile, setCamera, cameraState,
  setBordersVisible, areBordersVisible,
} from './scene3d.js';
import { playBattle, stopBattle } from './battle3d.js';
import { setupInput } from './input.js';
import {
  topBarHTML, todoHTML, idleYards, helpHTML, hoverCardHTML,
  fleetPanelHTML, systemPanelHTML, tileInfoHTML, empireHTML, diplomacyHTML,
  techHTML, chronicleHTML, logFeedHTML, battleReportHTML, battlePreviewHTML,
  factionChoiceHTML, scenarioChoiceHTML, victoryHTML, briefingHTML, noticeFromNews, num,
} from './ui.js';
import { titleSceneSVG, factionArtSVG } from './titlescene.js';
import {
  initTitleScene, setTitleFaction, stopTitleScene, resumeTitleScene,
  resizeTitleScene, isTitleSceneRunning, setTitleLayout, heroShipName,
} from './titlescene3d.js';
import { emblemSVG, iconSVG } from './emblems.js';
import {
  loadSettings, getSetting, setSetting, resetSettings, settingsHTML,
  AI_STANCE_VALUES, MARCH_SPEED_FACTORS,
} from './settings.js';
import {
  unlockAudio, sfx, startTheme, stopTheme, setMusicEnabled, setSfxEnabled, autostartMusic,
  playFanfare, startEngine, stopEngine, setMusicScene, THEME_TITLE,
} from './audio.js';
import { saveGame, loadGame, clearSaveGame, saveGameSummary } from './savegame.js';

let state = null;
let selection = { kind: null, fleetId: null, systemId: null, tile: null };
let reachCache = { fleetId: null, reach: new Map(), attacks: new Map() };
let hoverPath = null;
let visibility = null;
let sceneReady = false;
let busy = false;
let setup = { factionId: 'confed', scenarioId: DEFAULT_SCENARIO_ID };

const $ = (id) => document.getElementById(id);

// --- Zeichnen -------------------------------------------------------------
function draw() {
  const compass = $('compassRose');
  if (compass) {
    const grad = Math.round((northOnScreen() * 1800) / Math.PI) / 10;
    compass.style.transform = `rotate(${grad}deg)`;
  }
  drawScene();
}

function refreshScene() {
  if (!sceneReady || !state) return;
  visibility = computeVisibility(state, state.playerFactionId);
  syncEntities(state, {
    selectedFleetId: selection.fleetId,
    selectedTile: selection.tile,
    reach: selection.fleetId ? reachCache.reach : null,
    attacks: selection.fleetId ? reachCache.attacks : null,
    path: hoverPath,
    visibleFleets: visibility.fleets,
  });
  draw();
}

function refreshUI() {
  if (!state) return;
  $('topBar').innerHTML = topBarHTML(state, {
    borders: areBordersVisible(),
    mapMode: getMapMode(),
  });
  $('feed').innerHTML = logFeedHTML(state, 6);
  // Die Aufgabenleiste: was in diesem Zug noch offen ist.
  const todo = $('todoBar');
  if (todo) todo.innerHTML = todoHTML(state);
  // Der Knopf sagt, worauf er noch wartet - das erspart den Blick auf die Liste.
  const waiting = fleetsOf(state, state.playerFactionId).filter((f) => f.movement > 0).length;
  const endBtn = $('endTurnBtn');
  if (endBtn) {
    endBtn.textContent = waiting ? `Zug beenden (${waiting})` : 'Zug beenden';
    endBtn.classList.toggle('warten', waiting > 0);
    endBtn.dataset.tip = waiting
      ? `${waiting} ${waiting === 1 ? 'Flotte hat' : 'Flotten haben'} noch Bewegung · Leertaste`
      : 'Alles erledigt – Zug beenden (Leertaste)';
  }
  drawMiniMap();
  renderSelectionPanel();
}

// --- Die Übersichtskarte --------------------------------------------------
// Das ganze Sternenfeld in einem Kasten: Welten in der Farbe ihrer Flagge,
// eigene Verbände als helle Punkte, dazu der Rahmen dessen, was gerade im
// Bild ist. Ein Klick springt hin.
function miniPoint(canvas, col, row) {
  const pad = 6;
  return {
    x: pad + (col / (GRID_COLS - 1)) * (canvas.width - pad * 2),
    y: pad + (row / (GRID_ROWS - 1)) * (canvas.height - pad * 2),
  };
}

function drawMiniMap() {
  const canvas = $('miniMap');
  if (!canvas || !state || canvas.offsetParent === null) return;
  const g = canvas.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = 'rgba(8, 16, 28, 0.9)';
  g.fillRect(0, 0, canvas.width, canvas.height);

  // Der Ausschnitt, den die Kamera gerade zeigt.
  const cam = cameraState();
  const view = miniPoint(canvas, cam.col, cam.row);
  const span = Math.max(8, 34 / Math.max(0.4, cam.zoom));
  const halfW = (span / (GRID_COLS - 1)) * (canvas.width - 12);
  const halfH = (span / (GRID_ROWS - 1)) * (canvas.height - 12) * 0.6;
  g.strokeStyle = 'rgba(140, 190, 255, 0.5)';
  g.lineWidth = 1;
  g.strokeRect(view.x - halfW, view.y - halfH, halfW * 2, halfH * 2);

  for (const sys of state.systems) {
    const p = miniPoint(canvas, sys.col, sys.row);
    const seen = hasSeen(state, sys.col, sys.row) || sys.factionId === state.playerFactionId;
    g.fillStyle = seen ? factionProfile(sys.factionId).color : 'rgba(120, 150, 190, 0.35)';
    const r = sys.capital ? 3.6 : 2.4;
    g.beginPath();
    g.arc(p.x, p.y, r, 0, Math.PI * 2);
    g.fill();
    if (sys.capital && seen) {
      g.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      g.lineWidth = 1;
      g.stroke();
    }
  }
  for (const fleet of state.fleets) {
    if (fleet.factionId !== state.playerFactionId
      && !(visibility && visibility.fleets.has(fleet.id))) continue;
    const p = miniPoint(canvas, fleet.col, fleet.row);
    g.fillStyle = fleet.factionId === state.playerFactionId
      ? '#eaf3ff' : factionProfile(fleet.factionId).color;
    g.fillRect(p.x - 1.6, p.y - 1.6, 3.2, 3.2);
  }
}

// Ein Klick in die Übersicht springt an die Stelle.
function miniMapJump(ev) {
  const canvas = $('miniMap');
  if (!canvas || !state) return;
  const box = canvas.getBoundingClientRect();
  const pad = 6;
  const fx = ((ev.clientX - box.left) / box.width) * canvas.width;
  const fy = ((ev.clientY - box.top) / box.height) * canvas.height;
  const col = ((fx - pad) / (canvas.width - pad * 2)) * (GRID_COLS - 1);
  const row = ((fy - pad) / (canvas.height - pad * 2)) * (GRID_ROWS - 1);
  centerOn(Math.round(col), Math.round(row));
  draw();
  drawMiniMap();
}

function renderSelectionPanel() {
  const panel = $('panelBody');
  if (!panel) return;
  if (selection.kind === 'fleet') {
    const fleet = fleetById(state, selection.fleetId);
    if (fleet) {
      const others = fleetsAt(state, fleet.col, fleet.row)
        .filter((f) => f !== fleet && f.factionId === fleet.factionId);
      panel.innerHTML = fleetPanelHTML(state, fleet, { canMerge: others.length > 0 });
      $('selectionPanel').classList.remove('hidden');
      return;
    }
  }
  if (selection.kind === 'system') {
    const sys = systemById(state, selection.systemId);
    if (sys) {
      panel.innerHTML = systemPanelHTML(state, sys);
      $('selectionPanel').classList.remove('hidden');
      return;
    }
  }
  if (selection.kind === 'tile' && selection.tile) {
    panel.innerHTML = tileInfoHTML(state, selection.tile.col, selection.tile.row);
    $('selectionPanel').classList.remove('hidden');
    return;
  }
  $('selectionPanel').classList.add('hidden');
}

let toastTimer = null;
function toast(text, kind = '') {
  const el = $('toast');
  if (!el) return;
  el.textContent = text;
  el.className = `toast ${kind}`;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 4200);
}

// --- Auswahl --------------------------------------------------------------
function selectFleet(fleet) {
  selection = { kind: 'fleet', fleetId: fleet.id, systemId: null, tile: { col: fleet.col, row: fleet.row } };
  updateReach(fleet);
  sfx.wechsel();
  refreshScene();
  refreshUI();
}

function selectSystem(sys) {
  selection = { kind: 'system', fleetId: null, systemId: sys.id, tile: { col: sys.col, row: sys.row } };
  reachCache = { fleetId: null, reach: new Map(), attacks: new Map() };
  sfx.klick();
  refreshScene();
  refreshUI();
}

function selectTile(tile) {
  selection = { kind: 'tile', fleetId: null, systemId: null, tile };
  reachCache = { fleetId: null, reach: new Map(), attacks: new Map() };
  refreshScene();
  refreshUI();
}

function clearSelection() {
  selection = { kind: null, fleetId: null, systemId: null, tile: null };
  reachCache = { fleetId: null, reach: new Map(), attacks: new Map() };
  hoverPath = null;
  refreshScene();
  refreshUI();
}

function updateReach(fleet) {
  const { reach, attacks } = computeReachable(state, fleet);
  reachCache = { fleetId: fleet.id, reach, attacks };
}

// --- Klick auf die Karte -------------------------------------------------
async function onTileClick(tile, mods = {}) {
  if (!state || busy || isAnimating()) return;
  const { col, row } = tile;
  const key = tileKey(col, row);
  const fleet = selection.fleetId ? fleetById(state, selection.fleetId) : null;

  // Eine eigene Flotte ist gewählt und das Feld ist ein Ziel: angreifen.
  if (fleet && fleet.factionId === state.playerFactionId && reachCache.attacks.has(key)) {
    await doAttack(fleet, col, row);
    return;
  }
  // Erreichbares Feld: fliegen.
  if (fleet && fleet.factionId === state.playerFactionId && reachCache.reach.has(key)
    && !(fleet.col === col && fleet.row === row)) {
    await doMove(fleet, col, row);
    return;
  }

  // Sonst: auswählen, was dort steht. Eigene Flotten haben Vorrang.
  const here = fleetsAt(state, col, row);
  const mine = here.filter((f) => f.factionId === state.playerFactionId);
  const visibleFleet = mine[0] || here.find((f) => visibility && visibility.fleets.has(f.id));
  const sys = systemAt(state, col, row);
  // Ein Klick auf die schon gewählte Flotte wählt sie nicht ab: stehen
  // mehrere auf dem Feld, geht es zur nächsten, sonst bleibt sie gewählt und
  // ihre Reichweite wird neu gerechnet.
  if (visibleFleet && selection.fleetId === visibleFleet.id && mine.length > 1) {
    const idx = mine.findIndex((f) => f.id === selection.fleetId);
    selectFleet(mine[(idx + 1) % mine.length]);
  } else if (visibleFleet) {
    selectFleet(visibleFleet);
  } else if (sys) {
    selectSystem(sys);
  } else {
    selectTile({ col, row });
  }
  if (mods.double) centerOn(col, row);
}

function onTileHover(tile, point = null) {
  showHoverCard(tile, point);
  if (!state || !tile || !selection.fleetId) { hoverPath = null; return; }
  const fleet = fleetById(state, selection.fleetId);
  if (!fleet || fleet.factionId !== state.playerFactionId) return;
  const path = pathTo(reachCache.reach, reachCache.attacks, tile.col, tile.row);
  const changed = JSON.stringify(path) !== JSON.stringify(hoverPath);
  hoverPath = path;
  if (changed) refreshScene();
}

// Die kleine Karte am Zeiger: sie zeigt, was dort liegt, ohne dass man
// klicken muss. Sie weicht dem Rand aus und verschwindet, sobald der Zeiger
// die Karte verlässt.
function showHoverCard(tile, point) {
  const card = $('hoverCard');
  if (!card) return;
  if (!state || !tile || !point) { card.classList.add('hidden'); return; }
  const html = hoverCardHTML(state, tile.col, tile.row, visibility ? visibility.fleets : null);
  if (!html) { card.classList.add('hidden'); return; }
  card.innerHTML = html;
  card.classList.remove('hidden');
  const box = card.getBoundingClientRect();
  const x = Math.min(window.innerWidth - box.width - 12, point.x + 18);
  const y = Math.min(window.innerHeight - box.height - 12, point.y + 16);
  card.style.left = `${Math.max(8, x)}px`;
  card.style.top = `${Math.max(8, y)}px`;
}

async function doMove(fleet, col, row) {
  const path = pathTo(reachCache.reach, reachCache.attacks, col, row);
  if (!path || path.length < 2) return;
  busy = true;
  const speed = MARCH_SPEED_FACTORS[getSetting('flugtempo')] || 1;
  startEngine();
  await animateFleet(fleet.id, path, { speed });
  stopEngine();
  const result = moveFleet(state, fleet, path.slice(1));
  if (path.some((p) => p.jump)) sfx.sprung();
  revealAround(state, fleet.factionId, fleet.col, fleet.row);
  if (state.fleets.includes(fleet)) updateReach(fleet);
  else clearSelection();
  busy = false;
  refreshScene();
  refreshUI();
  if (result.losses) toast(`${result.losses} Maschinen im unruhigen Raum verloren.`, 'warn');
}

async function doAttack(fleet, col, row) {
  const defenderFleets = fleetsAt(state, col, row).filter((f) => f.factionId !== fleet.factionId);
  const sys = systemAt(state, col, row);
  const defender = defenderFleets[0] || sys;
  if (!defender) return;
  const name = defenderFleets[0] ? defenderFleets[0].name : sys.name;
  // Die Vorschau wird bei jeder Wahl der Ordnung neu gerechnet: man sieht
  // sofort, was die Entscheidung wert ist.
  const drawPreview = () => battlePreviewHTML(previewBattle(state, fleet, defender), fleet, name);
  const ok = await confirmModal(
    'Angriff',
    drawPreview(),
    'Angreifen', 'Abbrechen',
    drawPreview,
  );
  if (!ok) return;
  busy = true;
  const result = attackTile(state, fleet, col, row);
  if (!result.ok) {
    busy = false;
    toast(result.text, 'warn');
    return;
  }
  const report = result.report;
  const speed = MARCH_SPEED_FACTORS[getSetting('flugtempo')] || 1;
  // Das Gefecht ist entschieden, ehe es gezeigt wird: die Vorstellung darf
  // den Feldzug also weder aufhalten noch anhalten. Sie läuft in Ruhe ab -
  // wem das zu lang ist, der drückt Esc oder die Schaltfläche. Als letzte
  // Sicherung bricht sie nach anderthalb Minuten ab, und der Bericht kommt
  // trotzdem.
  try {
    await Promise.race([
      playBattle(report, { speed, render: draw }),
      new Promise((resolve) => setTimeout(resolve, 95000)),
    ]);
  } catch (err) {
    console.error('Gefechtsdarstellung abgebrochen:', err);
  } finally {
    stopBattle();
  }
  busy = false;
  showBattleReport(report);
  if (state.fleets.includes(fleet)) updateReach(fleet);
  else clearSelection();
  refreshScene();
  refreshUI();
  checkEnd();
}

// --- Der Zug --------------------------------------------------------------
async function endTurn() {
  if (!state || busy || isAnimating()) return;
  busy = true;
  const banner = $('turnBanner');
  banner.classList.remove('hidden');
  banner.textContent = 'Die anderen Höfe ziehen …';
  await new Promise((r) => setTimeout(r, 30));

  const me = state.playerFactionId;
  endOfTurnFor(state, me);
  rollEvents(state, me);

  // Die anderen: Reiche, Höfe, Freibeuter, der Schwarm.
  aiTakeAllTurns(state);
  rulersTakeTurn(state);
  updateSieges(state);
  pruneTradeRoutes(state);
  expireOffers(state);
  spawnRaiders(state);
  moveRaiders(state);
  nephilimWave(state);
  moveNephilim(state);
  for (const f of state.factions) {
    if (f.isNeutral || f.isPlayer) continue;
    rollEvents(state, f.id);
  }

  state.turn += 1;
  resetMovement(state, me);
  for (const fleet of fleetsOf(state, me)) revealAround(state, me, fleet.col, fleet.row);
  for (const sys of systemsOf(state, me)) revealAround(state, me, sys.col, sys.row);

  const news = takeDiploNews(state);
  banner.classList.add('hidden');
  busy = false;
  if (selection.fleetId) {
    const fleet = fleetById(state, selection.fleetId);
    if (fleet) updateReach(fleet); else clearSelection();
  }
  refreshScene();
  refreshUI();
  sfx.zug();
  const cal = calendarOfTurn(state.turn);
  if (news.length) toast(noticeFromNews(news[news.length - 1]));
  else toast(`${cal.month} ${cal.year}`);
  saveGame(state);
  checkEnd();
}

function checkEnd() {
  const victory = checkVictory(state);
  if (!victory || state.victoryShown === victory.text) return;
  state.victoryShown = victory.text;
  const modal = $('victoryModal');
  $('victoryBody').innerHTML = victoryHTML(state, victory);
  modal.classList.remove('hidden');
  if (victory.kind === 'sieg') sfx.eroberung(); else sfx.verlust();
}

// --- Tafeln ---------------------------------------------------------------
function openSheet(name) {
  const sheet = $('sheet');
  const title = $('sheetTitle');
  const body = $('sheetBody');
  const views = {
    reich: ['Das Reich', () => empireHTML(state)],
    diplomatie: ['Diplomatie', () => diplomacyHTML(state)],
    technik: ['Technik', () => techHTML(state)],
    chronik: ['Chronik', () => chronicleHTML(state)],
    einstellungen: ['Einstellungen', () => settingsHTML()],
    hilfe: ['Steuerung und Hilfe', () => helpHTML()],
  };
  const view = views[name];
  if (!view) return;
  title.textContent = view[0];
  body.innerHTML = view[1]();
  body.dataset.sheet = name;
  sheet.classList.remove('hidden');
  sfx.klick();
}

function closeSheet() {
  $('sheet').classList.add('hidden');
}

function showBattleReport(report) {
  $('battleBody').innerHTML = battleReportHTML(state, report);
  $('battleModal').classList.remove('hidden');
}

// Steht in der Rückfrage etwas, das sich ändern kann - die Schlachtordnung
// vor einem Angriff -, dann liefert `rerender` den neuen Text dafür.
let confirmRerender = null;

function confirmModal(title, html, okText = 'Ja', cancelText = 'Nein', rerender = null) {
  return new Promise((resolve) => {
    const modal = $('confirmModal');
    confirmRerender = rerender;
    $('confirmTitle').textContent = title;
    $('confirmBody').innerHTML = html;
    $('confirmOk').textContent = okText;
    $('confirmCancel').textContent = cancelText;
    modal.classList.remove('hidden');
    const done = (value) => {
      modal.classList.add('hidden');
      confirmRerender = null;
      $('confirmOk').onclick = null;
      $('confirmCancel').onclick = null;
      resolve(value);
    };
    $('confirmOk').onclick = () => { sfx.klick(); done(true); };
    $('confirmCancel').onclick = () => { sfx.klick(); done(false); };
  });
}

// --- Handlungen aus den Tafeln -------------------------------------------
function handleAction(action, el) {
  if (!state) return;
  const fleet = selection.fleetId ? fleetById(state, selection.fleetId) : null;
  const sys = selection.systemId ? systemById(state, selection.systemId) : null;
  const report = (res) => {
    if (!res) return;
    toast(res.text, res.ok ? '' : 'warn');
    if (res.ok) sfx.klick(); else sfx.fehler();
  };

  switch (action) {
    case 'fleet-center':
      if (fleet) centerOn(fleet.col, fleet.row);
      break;
    case 'fleet-reinforce':
      if (fleet) report(reinforceFleet(state, fleet));
      break;
    case 'fleet-disband':
      if (fleet) { report(disbandIntoSystem(state, fleet)); clearSelection(); }
      break;
    case 'fleet-siege':
      if (fleet) report(besiegeSystem(state, fleet));
      break;
    case 'fleet-release':
      if (fleet) report(liftSiege(state, fleet));
      break;
    case 'fleet-merge': {
      if (!fleet) break;
      const other = fleetsAt(state, fleet.col, fleet.row)
        .find((f) => f !== fleet && f.factionId === fleet.factionId);
      if (other) { report(mergeFleets(state, fleet, other)); }
      break;
    }
    case 'fleet-sleep':
      if (fleet) { fleet.movement = 0; clearSelection(); }
      break;
    case 'build-ship':
      if (sys) report(buildShip(state, sys, el.dataset.role));
      break;
    case 'cancel-build':
      if (sys) report(cancelTraining(state, sys, el.dataset.id));
      break;
    case 'buy-building':
      if (sys) report(buyBuilding(state, sys, el.dataset.id));
      break;
    case 'build-shield':
      if (sys) report(buildShield(state, sys));
      break;
    case 'raise-fleet': {
      if (!sys) break;
      const res = raiseFleet(state, sys);
      report(res);
      if (res.ok && res.fleet) selectFleet(res.fleet);
      break;
    }
    case 'research':
      report(startResearch(state, state.playerFactionId, el.dataset.id));
      openSheet('technik');
      break;
    // Die Ordnung wird in der Angriffsvorschau gewählt: setzen, Vorschau neu
    // rechnen, Fenster stehen lassen.
    case 'pick-tactic':
      setTactic(state, state.playerFactionId, el.dataset.kind || 'angriff', el.dataset.id);
      sfx.klick();
      if (confirmRerender) $('confirmBody').innerHTML = confirmRerender();
      break;
    case 'set-tactic':
      report(setTactic(state, state.playerFactionId, el.dataset.kind, el.dataset.id));
      openSheet('reich');
      break;
    case 'goto-system': {
      const target = systemById(state, el.dataset.id);
      if (target) { closeSheet(); selectSystem(target); centerOn(target.col, target.row); }
      break;
    }
    case 'goto-fleet': {
      const target = fleetById(state, el.dataset.id);
      if (target) { closeSheet(); selectFleet(target); centerOn(target.col, target.row); }
      break;
    }
    case 'offer-accept':
      report(acceptOffer(state, el.dataset.id));
      openSheet('diplomatie');
      break;
    case 'offer-reject':
      report(rejectOffer(state, el.dataset.id));
      openSheet('diplomatie');
      break;
    case 'offer-peace':
      report(offerPeace(state, state.playerFactionId, el.dataset.id));
      openSheet('diplomatie');
      break;
    case 'declare-war':
      declareWar(state, state.playerFactionId, el.dataset.id, 'Erklärung des Hofes');
      toast(`Krieg mit ${factionProfile(el.dataset.id).name}.`, 'warn');
      openSheet('diplomatie');
      break;
    case 'send-gift':
      report(sendGift(state, state.playerFactionId, el.dataset.id));
      openSheet('diplomatie');
      break;
    case 'propose-treaty':
      report(proposeTreaty(state, state.playerFactionId, el.dataset.id, el.dataset.type));
      openSheet('diplomatie');
      break;
    case 'renounce-treaty':
      report(renounceTreaty(state, state.playerFactionId, el.dataset.id));
      openSheet('diplomatie');
      break;
    case 'next-fleet':
      nextFleet();
      break;
    case 'next-yard':
      nextYard();
      break;
    case 'help':
      openSheet('hilfe');
      break;
    case 'sheet':
      openSheet(el.dataset.sheet);
      break;
    case 'toggle-borders': {
      const next = !areBordersVisible();
      setBordersVisible(next);
      toast(next ? 'Grenzen der Reiche werden gezeigt.' : 'Grenzen aus.');
      break;
    }
    case 'toggle-mapmode': {
      const next = getMapMode() === 'normal' ? 'besitz' : 'normal';
      setMapMode(next);
      toast(next === 'besitz' ? 'Karte nach Flaggen' : 'Karte nach Welten');
      break;
    }
    case 'to-menu':
      confirmModal('Zurück zum Startbild',
        '<p>Der Feldzug wird gespeichert und du kommst zurück ins Startbild.</p>',
        'Zurück', 'Weiterspielen').then((ok) => {
        if (ok) { saveGame(state); backToTitle(); }
      });
      break;
    case 'victory-continue':
      $('victoryModal').classList.add('hidden');
      break;
    case 'victory-menu':
      $('victoryModal').classList.add('hidden');
      backToTitle();
      break;
    default:
      break;
  }
  refreshScene();
  refreshUI();
}

// --- Startbild ------------------------------------------------------------
// Das Startbild läuft in echtem 3D: derselbe Träger, den man später auf der
// Karte führt, treibt vor dem Nebel. Geht WebGL nicht, bleibt die gezeichnete
// Tafel darunter stehen - sie ist der Rückfall, nicht die Regel.
let titleSceneReady = false;
function paintTitle(factionId = 'confed') {
  const stage = $('titleStage');
  if (!stage) return;
  let svgLayer = stage.querySelector('.title-svg');
  if (!svgLayer) {
    svgLayer = document.createElement('div');
    svgLayer.className = 'title-svg';
    stage.appendChild(svgLayer);
  }
  svgLayer.innerHTML = titleSceneSVG(factionId);
  const shipLine = $('titleShip');
  if (shipLine) shipLine.textContent = heroShipName(factionId);
  if (!titleSceneReady) {
    titleSceneReady = initTitleScene(stage, factionId);
    if (titleSceneReady) svgLayer.classList.add('hidden');
  } else {
    setTitleFaction(factionId);
    resumeTitleScene();
  }
}

function startSheet(name) {
  const title = $('startSheetTitle');
  const body = $('startSheetBody');
  const summary = saveGameSummary();
  const views = {
    anleitung: ['Wie es gespielt wird', () => `
      <div class="rules">
        <p>Die Sternkarte liegt als Hologramm auf dem Kartentisch der Flaggbrücke.
        Ein Zug ist ein Monat. Was du befiehlst, geschieht auf dieser Karte –
        einen zweiten Bildschirm für Gefechte gibt es nicht.</p>
        <h4>Flotten</h4>
        <p>Klicke eine eigene Flotte an: blaue Felder sind erreichbar, rote Rauten
        sind Ziele. Nebel bremst, Trümmer kosten Maschinen, Gravitationsgräben
        sind zu. Sprungpunkte bringen dich in einem Zug quer über die Karte.</p>
        <h4>Welten nehmen</h4>
        <p>Eine Welt fällt erst, wenn drei Dinge zusammenkommen: die Wache ist
        geschlagen, der Planetenschild ist niedergedrückt – dafür braucht es
        Bomber – und du hast Landungstruppen dabei. Wer nichts davon hat, kann
        eine Welt einschließen: Belagerung zehrt Wache und Schild auf.</p>
        <h4>Werften</h4>
        <p>Gebaut wird in Systemen. Korvetten brauchen eine Orbitalwerft,
        Kreuzer Stufe 2, Träger Stufe 3. Fertige Kiele liegen in der Garnison,
        bis du sie als Flotte aufstellst.</p>
        <h4>Sieg</h4>
        <p>Nimm die Hauptwelt deines Erzfeindes – oder halte ${VICTORY_SYSTEMS}
        Systeme. Verlierst du alle, ist der Feldzug vorbei.</p>
        <h4>Tasten</h4>
        <p>Pfeile schwenken, Q/E drehen, +/− zoomen, R stellt die Kamera zurück,
        Leertaste beendet den Zug, N springt zur nächsten Flotte, H nach Hause,
        I/D/T/C öffnen Reich, Diplomatie, Technik, Chronik.</p>
      </div>`],
    feldzug: ['Letzter Feldzug', () => (summary ? `
      <div class="memo">
        ${emblemSVG(factionProfile(summary.factionId).emblem, { size: 60, color: factionProfile(summary.factionId).color })}
        <h4>${summary.factionName}</h4>
        <p>Zug ${summary.turn} · ${calendarOfTurn(summary.turn).month} ${calendarOfTurn(summary.turn).year}</p>
        <p>${summary.systems} Systeme, ${summary.fleets} Flotten, ${num(summary.credits)} Kredits</p>
        <p class="hint">Szenario: ${scenarioById(summary.scenarioId).name}</p>
      </div>` : '<p class="hint">Noch kein Feldzug gespeichert.</p>')],
    einstellungen: ['Einstellungen', () => settingsHTML()],
  };
  const view = views[name];
  if (!view) return;
  title.textContent = view[0];
  body.innerHTML = view[1]();
  body.dataset.sheet = name;
  $('startSheet').classList.remove('hidden');
}

function openSetup() {
  // Das Startbild bleibt stehen, nur seine Schrift geht: hinter der Auswahl
  // treibt weiter der Träger - und er wechselt mit der Flagge, die man
  // anklickt.
  $('startScreen').classList.add('behind');
  $('setupScreen').classList.remove('hidden');
  setTitleLayout('setup');
  renderSetup();
}

function renderSetup() {
  $('factionList').innerHTML = factionChoiceHTML(playableFactions(), setup.factionId);
  $('scenarioList').innerHTML = scenarioChoiceHTML(SCENARIOS, setup.scenarioId);
  const profile = factionProfile(setup.factionId);
  const scenario = scenarioById(setup.scenarioId);
  $('setupPreview').innerHTML = `
    <div class="sp-crest" style="--faction:${profile.color}">
      ${emblemSVG(profile.emblem, { size: 88, color: profile.color })}
      <div>
        <span>${profile.short}</span>
        <strong>${profile.homeSystem ? `Hauptquartier ${profile.homeSystem}` : 'ohne festen Hafen'}</strong>
      </div>
    </div>
    <h3 style="--faction:${profile.color}">${profile.name}</h3>
    <p>${profile.doctrine}</p>
    <p class="sp-strength">${profile.strength}</p>
    <h4>${scenario.name} · ${scenario.year}</h4>
    <p>${scenario.blurb}</p>
    <p class="hint">${scenario.hint}</p>`;
  const shipLine = $('titleShip');
  if (shipLine) shipLine.textContent = heroShipName(setup.factionId);
  if (titleSceneReady) setTitleFaction(setup.factionId);
  else paintTitle(setup.factionId);
}

function backToTitle() {
  stopBattle();
  $('setupScreen').classList.add('hidden');
  $('app').classList.add('hidden');
  $('startScreen').classList.remove('hidden', 'behind');
  paintTitle(setup.factionId);
  setTitleLayout('start');
  setMusicScene('titel');
  if (getSetting('musik')) startTheme();
  const summary = saveGameSummary();
  $('continueGameBtn').classList.toggle('hidden', !summary);
}

// --- Ein Feldzug beginnt --------------------------------------------------
function applySettingsToGame() {
  setAiStance(AI_STANCE_VALUES[getSetting('kiHaltung')] || 1);
  setMusicEnabled(getSetting('musik'));
  setSfxEnabled(getSetting('klang'));
  setBridgeVisible(getSetting('bruecke'));
  setStarsVisible(getSetting('sternenstaub'));
  setGuidesVisible(getSetting('hilfslinien'));
  setBordersVisible(getSetting('grenzen'));
}

async function beginGame(newState, { opening = true } = {}) {
  state = newState;
  window.__blackUniversState = state;
  // Die Musik läuft weiter in den Feldzug hinein - sie tritt nur hinter die
  // Meldungen zurück.
  setMusicScene('feldzug');
  startTheme();
  stopTitleScene();
  $('startScreen').classList.add('hidden');
  $('startScreen').classList.remove('behind');
  $('setupScreen').classList.add('hidden');
  $('app').classList.remove('hidden');

  const canvas = $('gameCanvas');
  if (!sceneReady) {
    initScene(canvas);
    setupInput(canvas, {
      onTileClick,
      onTileHover,
      onEndTurn: endTurn,
      onCancel: goBack,
      onNextFleet: nextFleet,
      onCenterHome: () => {
        const home = capitalOf(state, state.playerFactionId);
        if (home) { centerOn(home.col, home.row); draw(); }
      },
      onSheet: openSheet,
      onToggleBorders: () => { handleAction('toggle-borders'); },
      onToggleMapMode: () => { handleAction('toggle-mapmode'); },
      onToggleMini: () => toggleMiniMap(),
      onRender: (needsResize) => { if (needsResize) resize(); draw(); drawMiniMap(); },
    });
    sceneReady = true;
  }
  applySettingsToGame();
  buildMap(state);
  resize();

  // Der eigene Raum ist bekannt, der Rest ist dunkel.
  for (const sys of systemsOf(state, state.playerFactionId)) {
    revealAround(state, state.playerFactionId, sys.col, sys.row, 8);
  }
  for (const fleet of fleetsOf(state, state.playerFactionId)) {
    revealAround(state, state.playerFactionId, fleet.col, fleet.row);
  }
  resetMovement(state, state.playerFactionId);
  refreshScene();
  refreshUI();

  if (opening) {
    // Die Eröffnungsansicht: erst die Brücke, dann die Karte.
    setOpeningView();
    draw();
    const scenario = scenarioById(state.scenarioId);
    await confirmModal('Lagebericht', briefingHTML(state, scenario), 'An die Karte', 'Später');
    sfx.funk();
    const home = capitalOf(state, state.playerFactionId);
    zoomCamera(1.9);
    if (home) await glideTo(home.col, home.row, 900);
    refreshScene();
  } else {
    centerOnFaction(state);
    draw();
  }
}

// Die Werften ohne Auftrag der Reihe nach: ein Klick, eine Werft, und die
// Bautafel steht schon offen.
let lastYardId = null;
function nextYard() {
  if (!state) return;
  const yards = idleYards(state);
  if (!yards.length) { toast('Alle Werften haben Arbeit.'); return; }
  const idx = yards.findIndex((sys) => sys.id === lastYardId);
  const next = yards[(idx + 1) % yards.length];
  lastYardId = next.id;
  closeSheet();
  selectSystem(next);
  centerOn(next.col, next.row);
  draw();
}

// Ein Zurück, das immer dasselbe tut: erst die offene Tafel schließen, dann
// die Auswahl aufheben. Es hängt an Esc und an der rechten Maustaste.
function goBack() {
  const sheet = $('sheet');
  if (sheet && !sheet.classList.contains('hidden')) { closeSheet(); return; }
  const battle = $('battleModal');
  if (battle && !battle.classList.contains('hidden')) {
    battle.classList.add('hidden');
    return;
  }
  if (selection.kind) { clearSelection(); return; }
  // Nichts offen, nichts gewählt: dann zeigt das Zurück die Hilfe an - besser
  // als gar nichts zu tun.
  toast('Nichts ausgewählt. F1 zeigt die Steuerung.');
}

function nextFleet() {
  if (!state) return;
  const fleets = fleetsOf(state, state.playerFactionId).filter((f) => f.movement > 0);
  if (!fleets.length) { toast('Keine Flotte hat noch Bewegung.'); return; }
  const idx = fleets.findIndex((f) => f.id === selection.fleetId);
  const next = fleets[(idx + 1) % fleets.length];
  selectFleet(next);
  centerOn(next.col, next.row);
  draw();
}

// --- Verdrahtung ----------------------------------------------------------
function wireStartScreen() {
  paintTitle(setup.factionId);
  const summary = saveGameSummary();
  $('continueGameBtn').classList.toggle('hidden', !summary);
  $('startVersion').textContent = `Fassung ${GAME_VERSION}`;

  $('startGameBtn').onclick = () => { unlockAudio(); sfx.klick(); openSetup(); };
  $('continueGameBtn').onclick = () => {
    unlockAudio();
    const saved = loadGame();
    if (!saved) { toast('Kein Spielstand gefunden.', 'warn'); return; }
    resetIds(200000);
    beginGame(saved, { opening: false });
  };
  $('menuRulesBtn').onclick = () => { sfx.klick(); startSheet('anleitung'); };
  $('menuMemoBtn').onclick = () => { sfx.klick(); startSheet('feldzug'); };
  $('menuSettingsBtn').onclick = () => { sfx.klick(); startSheet('einstellungen'); };
  $('startSheetClose').onclick = () => $('startSheet').classList.add('hidden');

  $('setupBack').onclick = () => {
    $('setupScreen').classList.add('hidden');
    $('startScreen').classList.remove('behind');
    setTitleLayout('start');
  };
  $('setupStart').onclick = () => {
    sfx.klick();
    resetIds(1);
    const scenario = scenarioById(setup.scenarioId);
    beginGame(createInitialState(setup.factionId, scenario));
  };
  $('factionList').addEventListener('click', (ev) => {
    const card = ev.target.closest('[data-faction]');
    if (!card) return;
    setup.factionId = card.dataset.faction;
    playFanfare(setup.factionId);
    renderSetup();
  });
  $('scenarioList').addEventListener('click', (ev) => {
    const card = ev.target.closest('[data-scenario]');
    if (!card) return;
    setup.scenarioId = card.dataset.scenario;
    sfx.klick();
    renderSetup();
  });
}

function wireGameChrome() {
  $('endTurnBtn').onclick = endTurn;
  $('nextFleetBtn').onclick = nextFleet;
  $('sheetClose').onclick = closeSheet;
  $('battleClose').onclick = () => $('battleModal').classList.add('hidden');

  // Übersichtskarte: Klick springt hin, der Schalter klappt sie weg.
  const mini = $('miniMap');
  if (mini) mini.onclick = miniMapJump;
  const miniBtn = $('miniToggle');
  if (miniBtn) {
    miniBtn.onclick = () => { toggleMiniMap(); sfx.klick(); };
  }

  // Sprechblasen ohne Wartezeit: alles mit `data-tip` erklärt sich sofort.
  wireTips();

  // Die rechte Maustaste ist überall dasselbe: ein Zurück. Sie schließt die
  // offene Tafel, sonst hebt sie die Auswahl auf - auch über einer Tafel,
  // nicht nur über der Karte.
  document.addEventListener('contextmenu', (ev) => {
    const app = $('app');
    if (!state || !app || app.classList.contains('hidden')) return;
    if (ev.target.closest && ev.target.closest('input, textarea, select')) return;
    ev.preventDefault();
    goBack();
  });

  // Alle Schaltflächen in den Tafeln laufen über einen Draht.
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if (el) { handleAction(el.dataset.action, el); return; }
    // Einstellungen: Schalter und Auswahl.
    const setEl = ev.target.closest('[data-set]');
    if (setEl) {
      const name = setEl.dataset.set;
      if (setEl.dataset.value != null) setSetting(name, setEl.dataset.value);
      else setSetting(name, !getSetting(name));
      applySettingsToGame();
      const body = setEl.closest('[data-sheet]');
      if (body) body.innerHTML = settingsHTML();
      if (state) refreshScene();
      sfx.klick();
      return;
    }
    if (ev.target.id === 'settingsReset') {
      resetSettings();
      applySettingsToGame();
      const body = ev.target.closest('[data-sheet]');
      if (body) body.innerHTML = settingsHTML();
    }
  });
}

// --- Sprechblasen ---------------------------------------------------------
// Der Browser lässt seinen eigenen Tooltip eine Sekunde warten. Das ist eine
// Sekunde zu lang, wenn acht Zeichen nebeneinander in der Leiste stehen.
function wireTips() {
  const tip = $('tipBox');
  if (!tip) return;
  let current = null;
  const place = (ev) => {
    const box = tip.getBoundingClientRect();
    const x = Math.min(window.innerWidth - box.width - 10, ev.clientX + 14);
    const y = ev.clientY + 20 + box.height > window.innerHeight
      ? ev.clientY - box.height - 12 : ev.clientY + 20;
    tip.style.left = `${Math.max(8, x)}px`;
    tip.style.top = `${Math.max(8, y)}px`;
  };
  document.addEventListener('pointerover', (ev) => {
    const el = ev.target.closest ? ev.target.closest('[data-tip]') : null;
    if (!el) {
      if (current) { current = null; tip.classList.add('hidden'); }
      return;
    }
    if (el === current) return;
    current = el;
    tip.textContent = el.dataset.tip;
    tip.classList.remove('hidden');
    place(ev);
  });
  document.addEventListener('pointermove', (ev) => {
    if (current && !tip.classList.contains('hidden')) place(ev);
  });
  document.addEventListener('pointerdown', () => {
    current = null;
    tip.classList.add('hidden');
  });
}

// Die Übersichtskarte lässt sich wegklappen - manche wollen den Blick frei.
function toggleMiniMap(force = null) {
  const wrap = $('miniWrap');
  if (!wrap) return;
  const zu = force == null ? !wrap.classList.contains('zu') : force;
  wrap.classList.toggle('zu', zu);
  if (!zu) drawMiniMap();
}

// --- Der Vorspann ---------------------------------------------------------
// Er läuft vor dem Startbild und ist jederzeit wegzuklicken. Ton gibt es nur,
// wenn der Browser ihn ohne Handlung zulässt - sonst läuft der Film stumm,
// und eine Schaltfläche bietet den Ton an.
let introDone = false;

function playIntro() {
  return new Promise((resolve) => {
    const box = $('intro');
    const video = $('introVideo');
    const skip = $('introSkip');
    const soundBtn = $('introSound');
    if (!box || !video || !getSetting('vorspann')) {
      if (box) box.remove();
      resolve();
      return;
    }

    let finished = false;
    function onKey(ev) {
      if (ev.key === 'Escape' || ev.key === ' ' || ev.key === 'Enter') finish();
    }
    function finish() {
      if (finished) return;
      finished = true;
      box.classList.add('is-leaving');
      try { video.pause(); } catch (err) { /* schon aus */ }
      window.removeEventListener('keydown', onKey);
      setTimeout(() => { box.remove(); resolve(); }, 750);
    }

    skip.onclick = (ev) => { ev.stopPropagation(); finish(); };
    box.onclick = finish;
    video.addEventListener('ended', finish);
    // Geht der Film nicht auf, steht man nicht vor einer schwarzen Wand: das
    // Element meldet den Fehler, die einzelnen Quellen melden ihn auch.
    video.addEventListener('error', finish);
    for (const source of video.querySelectorAll('source')) {
      source.addEventListener('error', () => {
        // Erst wenn keine Quelle mehr übrig ist, ist der Vorspann verloren.
        if (video.networkState === video.NETWORK_NO_SOURCE) finish();
      });
    }
    window.addEventListener('keydown', onKey);
    setTimeout(() => { if (video.readyState === 0) finish(); }, 6000);

    soundBtn.onclick = (ev) => {
      ev.stopPropagation();
      video.muted = false;
      video.volume = 0.9;
      soundBtn.classList.add('hidden');
    };

    // Erst mit Ton versuchen; verbietet der Browser das, läuft der Film stumm
    // weiter, und der Ton wird angeboten.
    video.muted = false;
    video.volume = 0.9;
    const attempt = video.play();
    if (attempt && attempt.catch) {
      attempt.catch(() => {
        video.muted = true;
        soundBtn.classList.remove('hidden');
        const second = video.play();
        if (second && second.catch) second.catch(() => finish());
      });
    }
  });
}

// --- Start ----------------------------------------------------------------
// Die Zeichen im Menü stehen als `data-icon` im HTML - hier bekommen sie
// ihre gezeichnete Form.
function paintIcons() {
  for (const el of document.querySelectorAll('[data-icon]')) {
    el.innerHTML = iconSVG(el.dataset.icon, { size: 22 });
  }
}

function boot() {
  loadSettings();
  paintIcons();
  setMusicEnabled(getSetting('musik'));
  setSfxEnabled(getSetting('klang'));
  document.title = `${GAME_NAME} – Feldzug im Kilrathi-Krieg`;
  wireStartScreen();
  wireGameChrome();
  window.addEventListener('resize', () => {
    if (sceneReady) { resize(); draw(); }
    if (isTitleSceneRunning()) resizeTitleScene();
  });
  // Die Musik besorgt sich ihren Start selbst: ein ausgelöster Klick beim
  // Programmstart, danach ein Pulsschlag und ein Netz aus Lauschern, das die
  // erste echte Handlung abfängt. Solange der Vorspann läuft, bleibt sie aus -
  // der Film bringt seinen eigenen Ton mit.
  autostartMusic(() => introDone && getSetting('musik'));

  // Zuerst der Film, dann das Startbild - und erst danach die Musik: der
  // Vorspann bringt seinen eigenen Ton mit.
  playIntro().then(() => {
    introDone = true;
    unlockAudio();
    if (getSetting('musik')) startTheme();
  });
  // Ein schmaler Zugang für die Prüfläufe: Feld zu Bildschirmpunkt. Er kostet
  // nichts und erspart dem Test das Raten, wo ein Feld liegt.
  window.__bu = {
    tileToScreen,
    centerOn,
    draw,
    refresh: () => { refreshScene(); refreshUI(); },
    pick: (x, y) => pickTile(x, y),
    zoom: (v) => zoomCamera(v),
    camera: (opts) => setCamera(opts),
    cameraNow: () => cameraState(),
    // Womit ein Prüflauf nachsehen kann, was das Spiel gerade denkt.
    debug: () => ({
      selection: { ...selection },
      reach: reachCache.reach.size,
      attacks: [...reachCache.attacks.keys()],
      busy,
    }),
  };
  window.__blackUniversReady = true;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

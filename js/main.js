import { createInitialState, playerFaction, unitTotalCount } from './state.js';
import {
  playableFactions, factionProfile, unitDefs, UNIT_ROLES, ROLE_LABELS,
  CITY_DEFS, STARTING_GOLD, DEFAULT_PLAYER_FACTION, GAME_VERSION,
} from './data.js';
import {
  renderUI, battleReportHTML, battlePreviewHTML, tileInfoHTML, visibleLogCount,
} from './ui.js';
import { setupInput } from './input.js';
import { computeReachable } from './pathfind.js';
import { aiTakeAllTurns } from './ai.js';
import {
  recruitUnit, raiseArmyFromGarrison, reinforceArmy, collectIncome, regenerateGarrisons,
  resetMovement, checkVictory, disbandArmyIntoCity, buyCityWalls,
  advanceWallConstruction, recoverArmies, embarkArmy, applyWeather, advanceWeather,
  buyRoad, advanceRoadConstruction, buyHarbour, advanceHarbourConstruction, buildFleet,
} from './actions.js';
import {
  initScene, buildMap, syncEntities, render, resize, centerOn, zoomCamera,
  isAnimating, rotateCamera, resetCameraOrientation, panCameraRelative,
  setMapMode, getMapMode, setMarchSpeed,
  setWeatherSource, setWeatherReporter, setWeatherVisualsEnabled,
} from './scene3d.js';
import {
  sfx, unlockAudio, toggleMuted, isMuted, stopMarch, startTheme, stopTheme, setMusicEnabled,
} from './audio.js';
import { CHRONICLE, chronicleSVG } from './chronicle.js';
import { factionArt, factionArtSVG } from './factionart.js';
import { emblemSVG } from './emblems.js';
import {
  loadSettings, getSetting, setSetting, resetSettings, settingsHTML,
  MARCH_SPEED_FACTORS, AI_STANCE_THRESHOLDS,
} from './settings.js';
import { setAiStance } from './ai.js';
import { weatherAt, calendarOfTurn } from './weather.js';

const canvas = document.getElementById('gameCanvas');
const appEl = document.getElementById('app');
let state = null;

// --- Einstellungen --------------------------------------------------------
loadSettings();

// Two settings reach into other modules; the rest are read where they matter.
function applySettings() {
  setMarchSpeed(MARCH_SPEED_FACTORS[getSetting('marchSpeed')] ?? 1);
  setAiStance(AI_STANCE_THRESHOLDS[getSetting('aiStance')] ?? 0.5);
  setWeatherVisualsEnabled(getSetting('weatherEffects'));
  setMusicEnabled(getSetting('music'));
}
applySettings();

const settingsOverlay = document.getElementById('settingsOverlay');

function paintSettings() {
  document.getElementById('settingsBody').innerHTML = settingsHTML(!isMuted());
}

function showSettings() {
  paintSettings();
  settingsOverlay.classList.remove('hidden');
}

function hideSettings() {
  settingsOverlay.classList.add('hidden');
}

// One delegated handler for the whole panel: every control carries the key it
// changes, so nothing has to be re-wired when the panel is repainted.
document.getElementById('settingsBody').addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.id === 'settingsReset') {
    resetSettings();
  } else if (button.dataset.key === 'sound') {
    unlockAudio();
    toggleMuted();
  } else if (button.dataset.key) {
    const setting = button.dataset.value !== undefined
      ? button.dataset.value
      : !getSetting(button.dataset.key);
    setSetting(button.dataset.key, setting);
  } else {
    return;
  }
  applySettings();
  paintSettings();
  refreshMuteButton();
  syncMenuMusic();
  if (state) setWeatherSource((col, row) => weatherAt(state, col, row));
  if (!isMuted()) sfx.select();
});

// Die Titelmusik gehört zum Vorspann: sie läuft, solange Startbildschirm oder
// Fraktionswahl zu sehen sind, und schweigt auf der Karte. Wer den Ton oder
// die Musik im Menü wieder einschaltet, soll sie auch wieder hören.
function syncMenuMusic() {
  const inMenu = !document.getElementById('startScreen').classList.contains('hidden')
    || !document.getElementById('factionScreen').classList.contains('hidden');
  if (inMenu && !isMuted() && getSetting('music')) startTheme({ fadeIn: 1.2 });
  else if (!inMenu) stopTheme({ fadeOut: 2 });
}

// Der Blick auf den eigenen Sitz. Ist die Hauptstadt gefallen, tut es die
// nächstbeste eigene Stadt, und wenn auch die fort ist, das letzte Heer -
// sonst führte der Knopf ins Nichts.
function focusOwnCapital() {
  if (!state) return;
  const player = playerFaction(state);
  const own = state.cities.filter((c) => c.factionId === player.id);
  const home = own.find((c) => c.capital) || own[0]
    || state.armies.find((a) => a.factionId === player.id);
  if (home) centerOn(home.col, home.row);
}

// --- Der Empfang im Zelt --------------------------------------------------
// Bevor der erste Zug fällt, meldet sich der Erste Offizier. Die Ansprache
// liegt über der Karte statt vor ihr: man soll das Zelt sehen, in dem sie
// gesprochen wird.

// Wer da spricht, richtet sich nach der Fraktion - ein Legat dient keinem
// Sarmatenfürsten.
const HERALD_TITLES = {
  rom: 'Dein Legat', karthago: 'Dein Suffet', griechen: 'Dein Stratege',
  seleukiden: 'Dein Stratege', ptolemaeer: 'Dein Nomarch',
  gallier: 'Dein Gefolgsmann', germanen: 'Dein Gefolgsmann',
  britannier: 'Dein Gefolgsmann', iberer: 'Dein Gefolgsmann',
  daker: 'Dein Gefolgsmann', illyrer: 'Dein Gefolgsmann',
  sarmaten: 'Dein Reiterführer',
};

const heraldOverlay = document.getElementById('heraldOverlay');
let heraldTimer = null;

function hideHerald() {
  if (!heraldOverlay) return;
  if (heraldTimer !== null) {
    clearTimeout(heraldTimer);
    heraldTimer = null;
  }
  heraldOverlay.classList.add('hidden');
}

function showHerald() {
  if (!heraldOverlay || !state) return;
  const player = playerFaction(state);
  const who = document.getElementById('heraldWho');
  if (who) who.textContent = `${HERALD_TITLES[player.id] || 'Dein Gefolgsmann'} · ${player.name}`;
  heraldOverlay.classList.remove('hidden');
  sfx.raise();
  // Wer weiterlesen will, hat Zeit; wer die Partie kennt, klickt weg.
  heraldTimer = setTimeout(hideHerald, 9000);
}

function setupHerald() {
  if (!heraldOverlay) return;
  const close = document.getElementById('heraldClose');
  if (close) close.addEventListener('click', hideHerald);
  heraldOverlay.addEventListener('click', hideHerald);
}
setupHerald();

function resizeScene() {
  const rect = canvas.parentElement.getBoundingClientRect();
  resize(rect.width, rect.height);
}

// The window resize event misses changes that come from the page itself -
// collapsing the sidebar, or a host resizing the embed - so watch the map
// container directly.
function observeMapSize() {
  if (typeof ResizeObserver !== 'function') return;
  const observer = new ResizeObserver(() => {
    resizeScene();
    render();
  });
  observer.observe(canvas.parentElement);
}

// --- Feldzug beenden ------------------------------------------------------
// Zurück ins Hauptmenü, mit Rückfrage: es gibt keinen Spielstand, der den
// laufenden Feldzug zurückholt.

function showQuitDialog() {
  const overlay = document.getElementById('quitOverlay');
  if (overlay) overlay.classList.remove('hidden');
}

function hideQuitDialog() {
  const overlay = document.getElementById('quitOverlay');
  if (overlay) overlay.classList.add('hidden');
}

function quitToMenu() {
  hideQuitDialog();
  hideHerald();
  hideBattleReport();
  hideBattlePreview();
  hideTileInfo();
  stopMarch();
  // Erst die Szene abmelden, dann den Spielstand loslassen: die Karte fragt
  // das Wetter über einen Rückruf ab, und der griffe sonst ins Leere.
  setWeatherSource(null);
  setWeatherReporter(null);
  state = null;
  undoStack.length = 0;
  appEl.classList.add('hidden');
  document.getElementById('startScreen').classList.remove('hidden');
  startChronicle();
  syncMenuMusic();
}

function setupQuitButton() {
  const button = document.getElementById('quitBtn');
  if (button) button.addEventListener('click', showQuitDialog);
  const confirmBtn = document.getElementById('quitConfirm');
  if (confirmBtn) confirmBtn.addEventListener('click', quitToMenu);
  const cancelBtn = document.getElementById('quitCancel');
  if (cancelBtn) cancelBtn.addEventListener('click', hideQuitDialog);
  const overlay = document.getElementById('quitOverlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) hideQuitDialog(); });
  }
}

// --- Feldauskunft (Rechtsklick) -----------------------------------------
// Ein Fenster am Mauszeiger, das sagt, was auf dem Feld steht. Es ändert
// nichts: keine Auswahl, keine Bewegung, kein Zug.

function hideTileInfo() {
  const box = document.getElementById('tileInfo');
  if (box) box.classList.add('hidden');
}

function showTileInfo(tile, clientX, clientY) {
  const box = document.getElementById('tileInfo');
  const body = document.getElementById('tileInfoBody');
  if (!box || !body || !state || !tile) {
    hideTileInfo();
    return;
  }
  const html = tileInfoHTML(state, tile);
  if (!html.trim()) {
    hideTileInfo();
    return;
  }
  body.innerHTML = html;
  box.classList.remove('hidden');
  // Am Zeiger, aber immer ganz im Bild: sonst steht die Hälfte außerhalb,
  // wenn man am rechten oder unteren Rand nachschlägt.
  const wrap = document.getElementById('mapWrap').getBoundingClientRect();
  const width = box.offsetWidth;
  const height = box.offsetHeight;
  const left = Math.min(Math.max(8, clientX - wrap.left + 14), wrap.width - width - 8);
  const top = Math.min(Math.max(8, clientY - wrap.top + 14), wrap.height - height - 8);
  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
}

function setupTileInfo() {
  const close = document.getElementById('tileInfoClose');
  if (close) close.addEventListener('click', hideTileInfo);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTileInfo(); });
  // Ein Klick auf die Karte oder daneben schließt es wieder.
  document.addEventListener('pointerdown', (e) => {
    const box = document.getElementById('tileInfo');
    if (!box || box.classList.contains('hidden')) return;
    if (box.contains(e.target)) return;
    if (e.button === 2) return;
    hideTileInfo();
  }, true);
}

// --- Reiter in der Seitenleiste -----------------------------------------
// Auswahl, Fraktionen und Protokoll teilen sich denselben Platz. Wer etwas
// anklickt, will die Auswahl sehen - dorthin springt die Leiste von selbst;
// neue Ereignisse melden sich stattdessen mit einer Zahl am Reiter.

let activeTab = 'selection';
let seenLogLength = 0;

function showSidebarTab(tab) {
  activeTab = tab;
  document.querySelectorAll('#sidebarTabs .tab-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  document.querySelectorAll('#sidebar > section').forEach((section) => {
    section.hidden = section.dataset.panel !== tab;
  });
  if (tab === 'log' && state) {
    seenLogLength = visibleLogCount(state);
    paintLogBadge();
  }
}

function paintLogBadge() {
  const badge = document.querySelector('#sidebarTabs .tab-badge');
  if (!badge || !state) return;
  const unseen = activeTab === 'log' ? 0 : Math.max(0, visibleLogCount(state) - seenLogLength);
  badge.textContent = unseen > 9 ? '9+' : String(unseen);
  badge.classList.toggle('hidden', unseen === 0);
}

function setupSidebarTabs() {
  document.querySelectorAll('#sidebarTabs .tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
      sfx.select();
      showSidebarTab(button.dataset.tab);
    });
  });
  showSidebarTab('selection');
}

function setupSidebarToggle() {
  const button = document.getElementById('sidebarBtn');
  if (!button) return;
  button.addEventListener('click', () => {
    const collapsed = appEl.classList.toggle('sidebar-collapsed');
    button.classList.toggle('active', collapsed);
    button.textContent = collapsed ? '⇤' : '⇥';
    // ResizeObserver picks the new size up, but resize now so the very next
    // frame is already correct.
    resizeScene();
    render();
  });
}

// The tactical view is a way of looking at the same map, so the button says
// which way you are looking at it right now.
// Names the weather where the player is actually looking, with what it costs.
function paintWeatherLabel(weather) {
  // A tint over the whole map, which reads at any camera angle - the scene's
  // own fog only bites at a distance, and a sandstorm has to be felt up close.
  const veil = document.getElementById('weatherVeil');
  if (veil) {
    veil.dataset.effect = getSetting('weatherEffects') ? (weather.effect || 'clear') : 'clear';
  }
  const label = document.getElementById('weatherLabel');
  if (!label || !state) return;
  const { season } = calendarOfTurn(state.turn);
  const price = [];
  if (weather.moveCost) price.push(`+${weather.moveCost} Bew.`);
  if (weather.wear) price.push(`+${weather.wear} Ersch.`);
  label.textContent = `${weather.icon} ${weather.name}${price.length ? ` · ${price.join(' · ')}` : ''}`;
  label.title = `${season.name}: ${weather.note || 'Kein besonderes Wetter.'}`;
  label.classList.toggle('weather-harsh', !!weather.moveCost);
}

function refreshMapModeButton() {
  const button = document.getElementById('mapModeBtn');
  if (!button) return;
  const tactical = getMapMode() === 'tactical';
  button.classList.toggle('active', tactical);
  button.textContent = tactical ? '🏔️' : '🗺';
  button.title = tactical
    ? 'Zurück zur Geländekarte'
    : 'Taktische Sicht: Gebiete nach Fraktionen';
}

// --- Chronik im Startbildschirm ------------------------------------------
// Zwei übereinanderliegende Ebenen, von denen immer eine sichtbar ist: das
// nächste Bild wird unsichtbar aufgebaut und dann eingeblendet, damit der
// Wechsel nie stockt.
const CHRONICLE_INTERVAL = 11000;
let chronicleIndex = 0;
let chronicleSlot = 0;
let chronicleTimer = null;

function paintChronicle(index, { animate = true } = {}) {
  const stage = document.getElementById('chronicleStage');
  if (!stage || !CHRONICLE.length) return;
  chronicleIndex = ((index % CHRONICLE.length) + CHRONICLE.length) % CHRONICLE.length;
  const scene = CHRONICLE[chronicleIndex];
  const layers = stage.querySelectorAll('.chron-layer');
  const next = layers[chronicleSlot ^ 1];
  const current = layers[chronicleSlot];

  next.innerHTML = chronicleSVG(scene);
  next.classList.toggle('chron-still', !animate);
  // Restarting the slow drift means taking the element out of the animation
  // and putting it back; without the reflow the browser keeps the old one.
  next.style.animation = 'none';
  void next.offsetWidth;
  next.style.animation = '';
  next.classList.add('visible');
  current.classList.remove('visible');
  chronicleSlot ^= 1;

  document.querySelector('.chron-year').textContent = scene.year;
  document.querySelector('.chron-title').textContent = scene.title;
  document.querySelector('.chron-text').textContent = scene.text;
  document.querySelectorAll('#chronDots button').forEach((dot, i) => {
    dot.classList.toggle('active', i === chronicleIndex);
    dot.setAttribute('aria-current', i === chronicleIndex ? 'true' : 'false');
  });
}

function scheduleChronicle() {
  clearTimeout(chronicleTimer);
  if (!getSetting('chronicle')) return;
  chronicleTimer = setTimeout(() => {
    paintChronicle(chronicleIndex + 1);
    scheduleChronicle();
  }, CHRONICLE_INTERVAL);
}

function stepChronicle(delta) {
  paintChronicle(chronicleIndex + delta);
  scheduleChronicle();
}

function startChronicle() {
  const dots = document.getElementById('chronDots');
  if (!dots) return;
  dots.innerHTML = CHRONICLE.map((scene, i) =>
    `<button data-index="${i}" title="${scene.year} – ${scene.title}"
      aria-label="${scene.year} – ${scene.title}"></button>`).join('');
  dots.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    paintChronicle(Number(button.dataset.index));
    scheduleChronicle();
  });
  document.getElementById('chronPrev').addEventListener('click', () => stepChronicle(-1));
  document.getElementById('chronNext').addEventListener('click', () => stepChronicle(1));
  // Start somewhere in the story rather than always at the founding.
  paintChronicle(Math.floor(Math.random() * CHRONICLE.length), { animate: false });
  scheduleChronicle();
}

function stopChronicle() {
  clearTimeout(chronicleTimer);
  chronicleTimer = null;
}

function setupMapModeButton() {
  const button = document.getElementById('mapModeBtn');
  if (!button) return;
  button.addEventListener('click', () => {
    if (!state) return;
    setMapMode(getMapMode() === 'tactical' ? 'terrain' : 'tactical', state);
    refreshMapModeButton();
    sfx.select();
    render();
  });
  refreshMapModeButton();
}

function refreshMuteButton() {
  const button = document.getElementById('muteBtn');
  if (!button) return;
  button.textContent = isMuted() ? '🔇' : '🔊';
  button.classList.toggle('active', !isMuted());
}

function setupMuteButton() {
  const button = document.getElementById('muteBtn');
  if (!button) return;
  refreshMuteButton();
  button.addEventListener('click', () => {
    unlockAudio();
    toggleMuted();
    refreshMuteButton();
    syncMenuMusic();
    if (!isMuted()) sfx.select();
  });
}

function syncSelection() {
  if (!state) return;
  if (state.selectedArmyId) {
    const army = state.armies.find((a) => a.id === state.selectedArmyId);
    if (army) {
      state.reachable = computeReachable(state, army);
    } else {
      state.selectedArmyId = null;
      state.reachable = null;
    }
  }
  if (state.selectedCityId && !state.cities.find((c) => c.id === state.selectedCityId)) {
    state.selectedCityId = null;
  }
}

const reportOverlay = document.getElementById('battleReport');
const undoBtn = document.getElementById('undoBtn');

const UNDO_LIMIT = 25;
const undoStack = [];

// The generated map never changes after startup, so snapshots share it by
// reference instead of copying 1200 tiles per action.
function snapshotState() {
  const { map, reachable, ...rest } = state;
  const copy = typeof structuredClone === 'function'
    ? structuredClone(rest)
    : JSON.parse(JSON.stringify(rest));
  return copy;
}

function pushUndo() {
  if (!state) return;
  undoStack.push(snapshotState());
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
}

function undoLastAction() {
  if (!state || !undoStack.length || isAnimating()) return;
  const previous = undoStack.pop();
  state = { ...previous, map: state.map, reachable: null };
  stopMarch();
  sfx.undo();
  hideBattlePreview();
  hideBattleReport();
  refresh();
}

function showBattleReport(reportOrId) {
  if (!state) return;
  const report = typeof reportOrId === 'string'
    ? state.battleReports.find((r) => r.id === reportOrId)
    : reportOrId;
  if (!report) return;
  document.getElementById('reportBody').innerHTML = battleReportHTML(state, report);
  reportOverlay.classList.remove('hidden');
}

function hideBattleReport() {
  reportOverlay.classList.add('hidden');
}

const previewOverlay = document.getElementById('battlePreview');
let pendingAttack = null;

function hideBattlePreview() {
  previewOverlay.classList.add('hidden');
  pendingAttack = null;
}

// The forecast, and the decision it exists for. Nothing has happened yet when
// this opens: cancelling leaves the army exactly where it stood.
function showBattlePreview(preview, confirm) {
  if (!state) return;
  // Turned off, the attack simply happens - the forecast was a courtesy, not
  // a gate.
  if (!getSetting('battlePreview')) {
    confirm();
    return;
  }
  document.getElementById('previewBody').innerHTML = battlePreviewHTML(state, preview);
  const attackBtn = document.getElementById('previewAttack');
  attackBtn.textContent = preview.unopposed ? '🚩 Einnehmen' : '⚔️ Angreifen';
  pendingAttack = confirm;
  previewOverlay.classList.remove('hidden');
  attackBtn.focus();
}

function confirmPendingAttack() {
  const run = pendingAttack;
  hideBattlePreview();
  if (run) run();
}

// Was zuletzt angewählt war - wechselt es, springt die Leiste auf die Auswahl.
let lastSelectionKey = '';

function refresh() {
  if (!state) return;
  syncSelection();
  const selectionKey = [state.selectedArmyId, state.selectedCityId,
    state.inspectedTile && `${state.inspectedTile.col},${state.inspectedTile.row}`].join('|');
  if (selectionKey !== lastSelectionKey) {
    lastSelectionKey = selectionKey;
    if (state.selectedArmyId || state.selectedCityId || state.inspectedTile) {
      showSidebarTab('selection');
    }
  }
  syncEntities(state);
  render();
  renderUI(state, {
    onRecruit: (cityId, unitKey) => {
      pushUndo();
      const ok = recruitUnit(state, cityId, unitKey).ok;
      (ok ? sfx.recruit : sfx.denied)();
      refresh();
    },
    onRaise: (cityId) => {
      pushUndo();
      const ok = raiseArmyFromGarrison(state, cityId).ok;
      (ok ? sfx.raise : sfx.denied)();
      refresh();
    },
    onReinforce: (armyId, unitKey) => {
      pushUndo();
      const ok = reinforceArmy(state, armyId, unitKey).ok;
      (ok ? sfx.recruit : sfx.denied)();
      refresh();
    },
    onDisband: (armyId) => {
      pushUndo();
      const result = disbandArmyIntoCity(state, armyId);
      if (result.ok) state.selectedCityId = result.cityId;
      (result.ok ? sfx.disband : sfx.denied)();
      refresh();
    },
    onBuyWalls: (cityId) => {
      pushUndo();
      const ok = buyCityWalls(state, cityId).ok;
      (ok ? sfx.wallBuy : sfx.denied)();
      refresh();
    },
    onBuyHarbour: (cityId) => {
      pushUndo();
      const ok = buyHarbour(state, cityId).ok;
      (ok ? sfx.wallBuy : sfx.denied)();
      refresh();
    },
    onBuildFleet: (cityId) => {
      pushUndo();
      const result = buildFleet(state, cityId);
      if (result.ok) state.selectedArmyId = result.armyId;
      (result.ok ? sfx.embark : sfx.denied)();
      refresh();
    },
    onBuildRoad: (cityId, targetId) => {
      pushUndo();
      const ok = buyRoad(state, cityId, targetId).ok;
      (ok ? sfx.wallBuy : sfx.denied)();
      refresh();
    },
    onEmbark: (armyId) => {
      pushUndo();
      const ok = embarkArmy(state, armyId).ok;
      (ok ? sfx.embark : sfx.denied)();
      refresh();
    },
    onShowReport: showBattleReport,
    onRefresh: refresh,
  });

  undoBtn.disabled = undoStack.length === 0;
  paintLogBadge();
}

function endTurn() {
  // Ending the turn mid-march would let the AI move while the player's army is
  // still visibly walking, and the resulting sync would teleport it.
  if (!state || state.gameOver || isAnimating()) return;
  hideBattlePreview();
  pushUndo();
  sfx.endTurn();
  const wallsBuilding = state.cities.filter((c) => c.wallBuilding).length;
  // Identify new reports by the previous head, not by length: the list is
  // capped, so once it is full its length stops growing.
  const previousHead = state.battleReports.length ? state.battleReports[0].id : null;

  aiTakeAllTurns(state);
  collectIncome(state);
  regenerateGarrisons(state);
  advanceWallConstruction(state);
  const roadsDone = advanceRoadConstruction(state);
  const harboursDone = advanceHarbourConstruction(state);
  // The season that just passed is what wore the armies down; the next one is
  // rolled once the turn has actually turned.
  applyWeather(state);
  checkVictory(state);
  state.turn += 1;
  advanceWeather(state);
  // Recovery is judged on the turn that just ended - an army that never spent
  // a movement point rested - so it runs before movement is replenished.
  recoverArmies(state);
  resetMovement(state);
  // A new season means new weather; the scene has to be asked again.
  setWeatherSource((col, row) => weatherAt(state, col, row));
  refresh();

  // AI turns can produce a whole string of battles. Surface only the most
  // recent one Rome was part of, so the player sees what happened to them
  // without a stack of modals for wars between other factions.
  let mine = null;
  for (const report of state.battleReports) {
    if (report.id === previousHead) break;
    if (report.involvesPlayer) { mine = report; break; }
  }
  if (mine && !state.gameOver) showBattleReport(mine);

  if (roadsDone.length || harboursDone.length
    || (wallsBuilding && state.cities.filter((c) => c.wallBuilding).length < wallsBuilding)) {
    sfx.wallDone();
  }
  if (state.gameOver) (state.gameOver.result === 'victory' ? sfx.victory : sfx.defeat)();
}

let toastTimer = null;
function showToast(message, ms = 6000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), ms);
}

// When the page is embedded cross-origin without an explicit fullscreen
// permission, the browser refuses outright: document.fullscreenEnabled is
// false and the request throws a permissions-policy error. Detect that up
// front rather than swallowing the rejection and leaving a dead button.
function fullscreenAllowed() {
  const root = document.documentElement;
  return !!document.fullscreenEnabled && !!(root.requestFullscreen || root.webkitRequestFullscreen);
}

// Fullscreen is the intended way to play, so the game asks for it at the
// start and treats losing it as something to put right - unless the player
// was the one who left.
let wantsFullscreen = true;
let restoreArmed = false;

function requestAppFullscreen({ explain = false } = {}) {
  if (!fullscreenAllowed()) {
    if (explain) {
      showToast('Vollbild ist in dieser eingebetteten Ansicht gesperrt. '
        + 'Öffne das Spiel in einem eigenen Browser-Tab oder als Desktop-App – dort geht es. '
        + 'Mit ⇥ blendest du die Seitenleiste aus und gewinnst hier Platz.', 9000);
    }
    return false;
  }
  if (document.fullscreenElement) return true;
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  Promise.resolve(request.call(root)).catch(() => {
    if (explain) showToast('Der Browser hat den Vollbildmodus abgelehnt.', 5000);
  });
  return true;
}

// A browser only grants fullscreen from inside a user gesture, so a swipe that
// drops out of it cannot be undone on the spot. The next touch or key press
// puts it back instead - which is the next thing the player does anyway.
function armFullscreenRestore() {
  if (restoreArmed || !fullscreenAllowed()) return;
  restoreArmed = true;
  const restore = () => {
    window.removeEventListener('pointerdown', restore, true);
    window.removeEventListener('keydown', restore, true);
    restoreArmed = false;
    if (wantsFullscreen && !document.fullscreenElement) requestAppFullscreen();
  };
  window.addEventListener('pointerdown', restore, true);
  window.addEventListener('keydown', restore, true);
}

function setupFullscreenButton(button) {
  button.addEventListener('click', () => {
    if (document.fullscreenElement) {
      // Leaving by the button is a decision, and it sticks.
      wantsFullscreen = false;
      document.exitFullscreen();
    } else {
      wantsFullscreen = true;
      requestAppFullscreen({ explain: true });
    }
  });
  document.addEventListener('fullscreenchange', () => {
    button.classList.toggle('active', !!document.fullscreenElement);
    setTimeout(resizeScene, 60);
    if (!document.fullscreenElement && wantsFullscreen) armFullscreenRestore();
  });
}

function reflectFullscreenAvailability() {
  const allowed = fullscreenAllowed();
  for (const id of ['fullscreenBtn', 'menuFullscreenBtn']) {
    const button = document.getElementById(id);
    if (!button) continue;
    button.classList.toggle('unavailable', !allowed);
    button.title = allowed
      ? 'Vollbildmodus'
      : 'Vollbild ist in dieser eingebetteten Ansicht gesperrt – in eigenem Tab öffnen';
  }
}

function setupDpad() {
  const STEP = 1.6;
  document.querySelectorAll('[data-pan]').forEach((btn) => {
    const [dc, dr] = btn.dataset.pan.split(',').map(Number);
    btn.addEventListener('click', () => {
      // Screen-relative: once the map is turned, "up" must still mean away
      // from the viewer rather than north on the tile grid.
      panCameraRelative(dc * STEP, dr * STEP);
      render();
    });
  });
  document.querySelectorAll('[data-zoom]').forEach((btn) => {
    const factor = Number(btn.dataset.zoom);
    btn.addEventListener('click', () => {
      zoomCamera(factor);
      render();
    });
  });
  document.querySelectorAll('[data-rotate]').forEach((btn) => {
    const amount = Number(btn.dataset.rotate);
    btn.addEventListener('click', () => {
      rotateCamera(amount);
      render();
    });
  });
  const resetBtn = document.getElementById('resetViewBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetCameraOrientation();
      focusOwnCapital();
      render();
    });
  }
}

// Without a WebGL context three.js throws while constructing the renderer.
// Say so plainly instead of leaving the player on a blank map - on desktop
// this is usually an outdated graphics driver or a VM without acceleration.
function showGraphicsError() {
  document.getElementById('startScreen').classList.remove('hidden');
  appEl.classList.add('hidden');
  const box = document.querySelector('.start-help');
  if (!box || box.querySelector('.start-error')) return;
  const note = document.createElement('p');
  note.className = 'start-error';
  note.textContent = 'Die 3D-Darstellung konnte nicht gestartet werden: Dieser Rechner '
    + 'stellt kein WebGL bereit. Bitte den Grafiktreiber aktualisieren oder die '
    + 'Hardwarebeschleunigung im Browser aktivieren.';
  box.prepend(note);
}

// --- Fraktionswahl -------------------------------------------------------
// Alle Fraktionen außer den Unabhängigen sind spielbar. Der Bildschirm zeigt
// zu jeder ihr eigenes Bild, ihre Startlage und ihre drei Einheiten - was man
// braucht, um die Wahl zu treffen, bevor die Karte steht.

let chosenFaction = DEFAULT_PLAYER_FACTION;
let factionArtSlot = 0;

function factionFacts(faction) {
  const own = CITY_DEFS.filter((c) => c.factionId === faction.id);
  const capital = own.find((c) => c.capital);
  const sizes = { large: 0, city: 0, village: 0 };
  for (const c of own) sizes[c.size || 'city'] += 1;
  const rosters = faction.startingArmies || [faction.startingArmy
    || { infantry: 300, cavalry: 120, ranged: 120 }];
  const men = rosters.reduce((sum, r) => sum + unitTotalCount(r), 0);
  return {
    capital: capital ? capital.name : '—',
    settlements: own.length,
    sizes,
    armies: rosters.length,
    men,
  };
}

function factionDetailHTML(faction) {
  const profile = factionProfile(faction.id) || {};
  const art = factionArt(faction.id);
  const facts = factionFacts(faction);
  const defs = unitDefs(faction.id);
  const tiers = [
    facts.sizes.large ? `${facts.sizes.large}× Große Stadt` : '',
    facts.sizes.city ? `${facts.sizes.city}× Stadt` : '',
    facts.sizes.village ? `${facts.sizes.village}× Dorf` : '',
  ].filter(Boolean).join(' · ');

  return `
    <h3><span class="fd-emblem">${emblemSVG(faction.id, { size: 44, color: faction.color })}</span>
      ${faction.name}</h3>
    <p class="fd-motto">„${art.motto}"</p>
    <p class="fd-blurb">${profile.blurb || ''}</p>
    <div class="fd-facts">
      <div class="fd-fact"><span>Hauptstadt</span><strong>${facts.capital}</strong></div>
      <div class="fd-fact"><span>Siedlungen</span><strong>${facts.settlements}</strong></div>
      <div class="fd-fact"><span>Startheer</span><strong>${facts.men} Mann${
  facts.armies > 1 ? ` in ${facts.armies} Heeren` : ''}</strong></div>
      <div class="fd-fact"><span>Startgold</span><strong>${STARTING_GOLD}</strong></div>
    </div>
    <p class="fd-line"><b>Orte:</b> ${tiers}</p>
    <div class="fd-units">
      ${UNIT_ROLES.map((role) => `<div class="fd-unit">${defs[role].icon}
        <strong>${defs[role].name}</strong>
        <em>${ROLE_LABELS[role]} · ${defs[role].attack}/${defs[role].defense} · ${defs[role].cost} Gold</em>
      </div>`).join('')}
    </div>
    <p class="fd-line"><b>Stärke:</b> ${profile.strength || ''}</p>
    <p class="fd-line"><b>Schwäche:</b> ${profile.weakness || ''}</p>
    <p class="fd-line"><b>Schwierigkeit:</b> ${profile.difficulty || 'mittel'}</p>`;
}

// Das Bild wird übergeblendet statt ausgetauscht: zwei Ebenen, abwechselnd.
function paintFactionArt(factionId) {
  const stage = document.getElementById('factionArt');
  if (!stage) return;
  const layers = stage.querySelectorAll('.fa-layer');
  const next = layers[factionArtSlot % layers.length];
  const previous = layers[(factionArtSlot + 1) % layers.length];
  next.innerHTML = factionArtSVG(factionId);
  next.classList.add('visible');
  if (previous !== next) previous.classList.remove('visible');
  factionArtSlot += 1;
}

function selectFaction(factionId) {
  chosenFaction = factionId;
  const faction = playableFactions().find((f) => f.id === factionId);
  if (!faction) return;
  document.querySelectorAll('.faction-choice').forEach((button) => {
    button.classList.toggle('active', button.dataset.faction === factionId);
    button.setAttribute('aria-selected', button.dataset.faction === factionId ? 'true' : 'false');
  });
  document.getElementById('factionDetail').innerHTML = factionDetailHTML(faction);
  paintFactionArt(factionId);
  const startBtn = document.getElementById('factionStartBtn');
  if (startBtn) startBtn.textContent = `Als ${faction.name} beginnen ▶`;
}

function buildFactionChoices() {
  const list = document.getElementById('factionChoices');
  if (!list) return;
  list.innerHTML = playableFactions().map((faction) => {
    const profile = factionProfile(faction.id) || {};
    return `<button class="faction-choice" data-faction="${faction.id}" role="option"
      aria-selected="false" style="--dot:${faction.color}">
      <span class="fc-emblem">${emblemSVG(faction.id, { size: 26, color: faction.color })}</span>
      ${faction.name}
      <span class="fc-diff">${profile.difficulty || ''}</span>
    </button>`;
  }).join('');
  list.querySelectorAll('.faction-choice').forEach((button) => {
    button.addEventListener('click', () => {
      sfx.select();
      selectFaction(button.dataset.faction);
    });
  });
}

function showFactionScreen() {
  unlockAudio();
  // Der Klick auf "Neues Spiel" ist die Geste, die der Browser für Vollbild
  // verlangt - also hier schon danach fragen, nicht erst auf der Karte.
  wantsFullscreen = true;
  requestAppFullscreen({ explain: true });
  stopChronicle();
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('factionScreen').classList.remove('hidden');
  buildFactionChoices();
  selectFaction(chosenFaction);
}

function hideFactionScreen() {
  document.getElementById('factionScreen').classList.add('hidden');
}

function backToMenu() {
  hideFactionScreen();
  document.getElementById('startScreen').classList.remove('hidden');
  startChronicle();
}

function startNewGame(factionId = chosenFaction) {
  unlockAudio();
  stopChronicle();
  // Starting a game is a click, which is the gesture fullscreen needs.
  wantsFullscreen = true;
  requestAppFullscreen({ explain: true });
  document.getElementById('startScreen').classList.add('hidden');
  hideFactionScreen();
  appEl.classList.remove('hidden');

  state = createInitialState(factionId);
  try {
    initScene(canvas);
    resizeScene();
    buildMap(state);
  } catch (err) {
    console.error('3D-Initialisierung fehlgeschlagen:', err);
    state = null;
    showGraphicsError();
    return;
  }

  if (getSetting('startMapMode') === 'tactical') setMapMode('tactical', state);
  refreshMapModeButton();

  // The scene asks the game what the weather is wherever the camera looks, and
  // reports back so the topbar can name it.
  setWeatherReporter(paintWeatherLabel);
  setWeatherSource((col, row) => weatherAt(state, col, row));

  focusOwnCapital();
  // Auf der Karte wird es still: die Musik gehört zum Vorspann, nicht zum Zug.
  stopTheme({ fadeOut: 4 });
  showHerald();

  // Input holds no reference to `state` itself, so it reads through a getter -
  // undo swaps the object wholesale.
  setupInput(canvas, () => state, refresh, showBattleReport, pushUndo, showBattlePreview,
    showTileInfo);
  document.getElementById('endTurnBtn').addEventListener('click', endTurn);
  undoBtn.addEventListener('click', undoLastAction);
  observeMapSize();
  refresh();
}

window.addEventListener('resize', () => {
  resizeScene();
  render();
});

setupFullscreenButton(document.getElementById('fullscreenBtn'));
setupFullscreenButton(document.getElementById('menuFullscreenBtn'));
reflectFullscreenAvailability();
setupSidebarToggle();
setupSidebarTabs();
setupTileInfo();
setupQuitButton();
setupMuteButton();
setupMapModeButton();
setupDpad();

document.getElementById('reportClose').addEventListener('click', hideBattleReport);
reportOverlay.addEventListener('click', (e) => {
  if (e.target === reportOverlay) hideBattleReport();
});

document.getElementById('previewAttack').addEventListener('click', confirmPendingAttack);
document.getElementById('previewCancel').addEventListener('click', hideBattlePreview);
document.getElementById('previewClose').addEventListener('click', hideBattlePreview);
previewOverlay.addEventListener('click', (e) => {
  if (e.target === previewOverlay) hideBattlePreview();
});

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  // Escape backs out of the decision without attacking. With nothing open it
  // is the browser's own way out of fullscreen, and that is a decision too.
  if (heraldOverlay && !heraldOverlay.classList.contains('hidden')) hideHerald();
  else if (!settingsOverlay.classList.contains('hidden')) hideSettings();
  else if (!previewOverlay.classList.contains('hidden')) hideBattlePreview();
  else if (!reportOverlay.classList.contains('hidden')) hideBattleReport();
  else if (document.fullscreenElement) wantsFullscreen = false;
});

document.getElementById('settingsClose').addEventListener('click', hideSettings);
settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) hideSettings();
});
for (const id of ['settingsBtn', 'menuSettingsBtn']) {
  const button = document.getElementById(id);
  if (button) button.addEventListener('click', showSettings);
}

const helpButton = document.getElementById('menuHelpBtn');
if (helpButton) {
  helpButton.addEventListener('click', () => {
    const help = document.getElementById('startHelp');
    const shown = help.classList.toggle('hidden');
    helpButton.classList.toggle('active', !shown);
  });
}

// Die Version steht im Startbildschirm - eine Wahrheit aus data.js, damit sie
// nicht zwischen Auslieferung und Anzeige auseinanderläuft.
const versionLabel = document.getElementById('versionLabel');
if (versionLabel) versionLabel.textContent = GAME_VERSION;

// Musik darf erst nach einer echten Geste des Spielers losgehen - das schreibt
// der Browser vor. Jede Taste im Startbildschirm ist so eine Geste, also hängt
// der Anstoß an allen, nicht nur am Startknopf.
function beginMenuMusic() {
  unlockAudio();
  startTheme();
}
for (const id of ['startGameBtn', 'menuSettingsBtn', 'menuHelpBtn', 'menuFullscreenBtn']) {
  const button = document.getElementById(id);
  if (button) button.addEventListener('click', beginMenuMusic);
}

startChronicle();
// Der Weg ins Spiel führt über die Fraktionswahl.
document.getElementById('startGameBtn').addEventListener('click', showFactionScreen);
document.getElementById('factionBackBtn').addEventListener('click', backToMenu);
document.getElementById('factionStartBtn').addEventListener('click', () => startNewGame());

// The boot watchdog in index.html looks for this: reaching it means the whole
// script parsed and the start button is wired.
window.__spqrReady = true;

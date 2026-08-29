import { createInitialState, playerFaction, unitTotalCount, factionById, logMsg } from './state.js';
import {
  playableFactions, factionProfile, unitDefs, UNIT_ROLES, ROLE_LABELS,
  CITY_DEFS, STARTING_GOLD, DEFAULT_PLAYER_FACTION, GAME_VERSION, MINE_NAME,
} from './data.js';
import {
  renderUI, battleReportHTML, battlePreviewHTML, tileInfoHTML, visibleLogCount, empireHTML,
  diplomacyHTML, setDiploTab,
} from './ui.js';
import { setupInput } from './input.js';
import { computeReachable } from './pathfind.js';
import { aiTakeAllTurns } from './ai.js';
import { pirateFleets } from './piraten.js';
import { hordes } from './staemme.js';
import {
  recruitUnit, raiseArmyFromGarrison, reinforceArmy, collectIncome, regenerateGarrisons,
  resetMovement, checkVictory, disbandArmyIntoCity, buyCityWalls,
  advanceWallConstruction, recoverArmies, embarkArmy, applyWeather, advanceWeather,
  buyRoad, advanceRoadConstruction, buyHarbour, advanceHarbourConstruction, buildFleet,
  buyMine, advanceMineConstruction, mineIncomeOf,
  buyShipyard, advanceShipyardConstruction,
  buyBarracks, buyForum, advanceCivicConstruction,
  openTradeRoute, closeTradeRoute, pruneTradeRoutes, growPopulations,
} from './actions.js';
import {
  offerPeace, declareWar, sendGift, rulersTakeTurn, rulerOf, GIFT_COST,
  takeDiploNews, updateKnowledge, knowsFaction,
  acceptOffer, rejectOffer, expireOffers,
} from './diplomacy.js';
import { rulerFor, TRAITS, TRAIT_NAMES, traitLabel } from './rulers.js';
import {
  initScene, buildMap, syncEntities, render, resize, centerOn, zoomCamera,
  isAnimating, rotateCamera, resetCameraOrientation, panCameraRelative,
  setMapMode, getMapMode, setMarchSpeed, setOpeningView,
  setBordersVisible, areBordersVisible,
  setWeatherSource, setWeatherReporter, setWeatherVisualsEnabled,
} from './scene3d.js';
import {
  sfx, unlockAudio, toggleMuted, isMuted, stopMarch, startTheme, stopTheme, setMusicEnabled,
  startAnthem, stopAnthem,
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
import { rollEvents } from './events.js';

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
  const erlaubt = !isMuted() && getSetting('music');
  if (inMenu) {
    stopAnthem({ fadeOut: 1.5 });
    if (erlaubt) startTheme({ fadeIn: 1.2 });
    return;
  }
  stopTheme({ fadeOut: 2 });
  // Auf der Karte klingt die eigene Fraktion. Wer die Musik in den
  // Einstellungen wieder einschaltet, hört sie ab dem nächsten Takt.
  if (erlaubt && state) startAnthem(playerFaction(state).id, { fadeIn: 2 });
  else if (!erlaubt) stopAnthem({ fadeOut: 1.5 });
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
  numidien: 'Dein Reiterfürst',
  parther: 'Dein Satrap',
  armenien: 'Dein Nacharar',
  pontus: 'Dein Stratege',
};

const heraldOverlay = document.getElementById('heraldOverlay');
let heraldTimer = null;

function hideHerald() {
  if (!heraldOverlay) return;
  const wasOpen = !heraldOverlay.classList.contains('hidden');
  if (heraldTimer !== null) {
    clearTimeout(heraldTimer);
    heraldTimer = null;
  }
  heraldOverlay.classList.add('hidden');
  // „Lass uns die Schlachtkarte betrachten": die Kamera geht vom Zelt
  // hinunter auf den eigenen Sitz.
  if (wasOpen && state) {
    resetCameraOrientation();
    focusOwnCapital();
    render();
  }
}

function showHerald() {
  if (!heraldOverlay || !state) return;
  const player = playerFaction(state);
  const who = document.getElementById('heraldWho');
  if (who) who.textContent = `${HERALD_TITLES[player.id] || 'Dein Gefolgsmann'} · ${player.name}`;
  // Der Spieler ist nicht "der Herr" im Allgemeinen, sondern dieser eine Mann.
  // Der Herold spricht ihn deshalb mit seinem Namen an.
  const line = document.getElementById('heraldLine');
  const ruler = rulerOf(state, player.id);
  if (line && ruler) {
    // Manche Namen enden schon auf einen Punkt ("Antiochos I."), und zwei
    // hintereinander sehen aus wie ein Tippfehler.
    const anrede = ruler.name.endsWith('.') ? ruler.name : `${ruler.name}.`;
    line.textContent = `„Ich grüße dich, ${anrede} Lass uns die Schlachtkarte betrachten."`;
  }
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

// --- Zufallsereignisse ----------------------------------------------------
// Was der Spieler nicht befohlen hat, bekommt er trotzdem zu sehen: ein
// eigenes Fenster, damit eine Seuche nicht zwischen zwei Wetterzeilen im
// Protokoll untergeht. Was den anderen Fraktionen zustößt, steht nur dort.

const eventOverlay = document.getElementById('eventOverlay');

function hideEvent() {
  if (eventOverlay) eventOverlay.classList.add('hidden');
}

function showEvent(event) {
  if (!eventOverlay || !event) return;
  const box = eventOverlay.querySelector('.event-box');
  box.classList.toggle('good', !!event.good);
  box.classList.toggle('bad', !event.good);
  document.getElementById('eventIcon').textContent = event.icon;
  document.getElementById('eventKind').textContent = event.good ? 'Ein guter Tag' : 'Ein schwerer Tag';
  document.getElementById('eventTitle').textContent = event.title;
  document.getElementById('eventText').textContent = event.text;
  document.getElementById('eventEffect').textContent = event.effect;
  eventOverlay.classList.remove('hidden');
  (event.good ? sfx.wallDone : sfx.denied)();
}

function setupEventWindow() {
  if (!eventOverlay) return;
  const close = document.getElementById('eventClose');
  if (close) close.addEventListener('click', hideEvent);
  eventOverlay.addEventListener('click', (e) => {
    if (e.target === eventOverlay) hideEvent();
  });
}
setupEventWindow();

// --- Reichsübersicht ------------------------------------------------------
// Ein Fenster über den ganzen Besitz: jeder Ort mit seinen Einnahmen, die
// Summe darunter, dazu Heere, Flotten und der Sold, der davon abgeht.

const empireOverlay = document.getElementById('empireOverlay');

function hideEmpire() {
  if (empireOverlay) empireOverlay.classList.add('hidden');
}

function showEmpire() {
  if (!empireOverlay || !state) return;
  document.getElementById('empireBody').innerHTML = empireHTML(state);
  empireOverlay.classList.remove('hidden');
  sfx.select();
}

// --- Werkzeugleiste --------------------------------------------------------
// Ein Knopf trägt sein Zeichen und, wenn die Leiste aufgeklappt ist, seinen
// Namen daneben. Wechselt das Zeichen - vom Lautsprecher zum durchgestrichenen,
// von der Karte zum Gebirge -, darf die Beschriftung nicht mitverschwinden.
function setButtonIcon(button, icon) {
  const span = button.querySelector('.btn-icon');
  if (span) span.textContent = icon;
  else button.textContent = icon;
}

// Hinter dem ☰ liegt, was man selten braucht - und auf schmalem Schirm auch
// das, wofür die Leiste keinen Platz mehr hat. Verschoben werden dabei die
// Knöpfe selbst, nicht Kopien davon: ihre Klickbehandlung reist mit.
const toolbarEl = document.getElementById('toolbar');
const toolMenuEl = document.getElementById('toolMenu');
const menuToggleEl = document.getElementById('menuBtn');
// Die vier, die offen in der Leiste stehen, solange sie hineinpassen.
const PRIMARY_TOOLS = ['undoBtn', 'empireBtn', 'diploBtn', 'mapModeBtn'];
const wideBar = window.matchMedia('(min-width: 1151px)');

function setToolMenuOpen(open) {
  if (!toolMenuEl || !menuToggleEl) return;
  toolMenuEl.classList.toggle('open', open);
  menuToggleEl.classList.toggle('active', open);
  menuToggleEl.setAttribute('aria-expanded', open ? 'true' : 'false');
}

// Räumt die vier Hauptwerkzeuge dorthin, wo sie hingehören: in die Leiste,
// solange sie breit genug ist, sonst an den Anfang der Klappliste.
function arrangeTools() {
  if (!toolbarEl || !toolMenuEl) return;
  const inDerLeiste = wideBar.matches;
  const knoepfe = PRIMARY_TOOLS.map((id) => document.getElementById(id)).filter(Boolean);
  if (inDerLeiste) {
    for (const button of knoepfe) toolbarEl.appendChild(button);
  } else {
    // Rückwärts einfügen, damit die Reihenfolge stimmt.
    for (const button of [...knoepfe].reverse()) {
      toolMenuEl.insertBefore(button, toolMenuEl.firstChild);
    }
  }
}

function setupToolbar() {
  if (!toolMenuEl || !menuToggleEl) return;
  arrangeTools();
  if (wideBar.addEventListener) wideBar.addEventListener('change', arrangeTools);
  else if (wideBar.addListener) wideBar.addListener(arrangeTools);
  menuToggleEl.addEventListener('click', (e) => {
    e.stopPropagation();
    setToolMenuOpen(!toolMenuEl.classList.contains('open'));
    sfx.select();
  });
  // Ein Werkzeug gewählt: die Liste geht zu, damit man sieht, was es tat.
  toolMenuEl.addEventListener('click', (e) => {
    if (e.target.closest('.icon-btn')) setToolMenuOpen(false);
  });
  document.addEventListener('click', (e) => {
    if (!toolMenuEl.classList.contains('open')) return;
    if (e.target.closest('#toolMenu') || e.target.closest('#menuBtn')) return;
    setToolMenuOpen(false);
  });
}
setupToolbar();

// --- Nachrichten aus der Diplomatie ----------------------------------------
// Wenn ein Herrscher dir den Krieg erklärt, sollst du es nicht im Protokoll
// entdecken, sondern gesagt bekommen. Meldungen, die andere betreffen, stehen
// im Protokoll; nur was dich angeht, hält die Runde an.
const diploNewsOverlay = document.getElementById('diploNewsOverlay');
let diploNewsQueue = [];

function hideDiploNews() {
  if (diploNewsOverlay) diploNewsOverlay.classList.add('hidden');
  if (diploNewsQueue.length) {
    // Mehrere Meldungen in einer Runde kommen eine nach der anderen.
    setTimeout(showNextDiploNews, 120);
  }
}

// Eine fertige Meldung: Zeichen, Zeile, Überschrift, Text, Folge - und, wenn
// ein Schlachtbericht dahinterliegt, ein Knopf dorthin.
function showNotice(meldung) {
  if (!diploNewsOverlay) return;
  const icon = document.getElementById('diploNewsIcon');
  const kind = document.getElementById('diploNewsKind');
  const title = document.getElementById('diploNewsTitle');
  const text = document.getElementById('diploNewsText');
  const effect = document.getElementById('diploNewsEffect');
  const close = document.getElementById('diploNewsClose');
  if (icon) icon.textContent = meldung.icon;
  if (kind) kind.textContent = meldung.kind;
  if (title) title.textContent = meldung.title;
  if (text) text.textContent = meldung.text;
  if (effect) effect.textContent = meldung.effect || '';
  // Der Bericht liegt hinter einem eigenen Knopf: wer ihn sehen will, klickt.
  const alt = document.getElementById('diploNewsReport');
  if (alt) alt.remove();
  if (meldung.reportId && close) {
    const button = document.createElement('button');
    button.id = 'diploNewsReport';
    button.className = 'event-btn';
    button.textContent = '📜 Bericht ansehen';
    button.addEventListener('click', () => {
      const id = meldung.reportId;
      hideDiploNews();
      showBattleReport(id);
    });
    close.parentNode.insertBefore(button, close);
  }
  diploNewsOverlay.classList.remove('hidden');
  sfx.raise();
}

function showNextDiploNews() {
  if (!diploNewsOverlay || !diploNewsQueue.length || !state) return;
  const meldung = diploNewsQueue.shift();
  // Fertig ausformulierte Meldungen gehen direkt durch.
  if (meldung.icon) { showNotice(meldung); return; }
  const krieg = meldung.kind === 'krieg';
  const angebot = meldung.kind === 'angebot';
  const gegner = factionById(state, meldung.von === playerFaction(state).id
    ? meldung.gegen : meldung.von);
  const icon = document.getElementById('diploNewsIcon');
  const kind = document.getElementById('diploNewsKind');
  const title = document.getElementById('diploNewsTitle');
  const text = document.getElementById('diploNewsText');
  const effect = document.getElementById('diploNewsEffect');
  // Ein Gesandter, der auf Antwort wartet: die Entscheidung fällt nicht hier,
  // sondern im Diplomatiefenster - hier steht nur, dass er da ist.
  if (angebot) {
    if (icon) icon.textContent = '🕊';
    if (kind) kind.textContent = `Ein Gesandter${gegner ? ` · ${gegner.name}` : ''}`;
    if (title) title.textContent = `${meldung.ruler} bietet dir Frieden an`;
    if (text) {
      text.textContent = `${meldung.ruler}, ${meldung.titel}, lässt fragen, ob der `
        + `Krieg zwischen euch nicht genug sei – ${meldung.grund}.`
        + (meldung.tribut > 0
          ? ` Er legt ${meldung.tribut.toLocaleString('de-DE')} Gold dazu.` : '');
    }
    if (effect) {
      effect.textContent = 'Der Gesandte wartet drei Runden. Im Diplomatiefenster '
        + 'nimmst du an oder schickst ihn nach Hause.';
    }
    diploNewsOverlay.classList.remove('hidden');
    sfx.raise();
    return;
  }
  if (icon) icon.textContent = krieg ? '⚔' : '🕊';
  // Der Name der Fraktion steht in der Zeile darüber, nicht im Satz: "ein
  // Herold aus Illyrer" wäre kein Deutsch, und die Namen sind teils Völker,
  // teils Orte - eine Wendung, die für beide passt, gibt es nicht.
  if (kind) {
    kind.textContent = `${krieg ? 'Eine Kriegserklärung' : 'Ein Friedensschluss'}${
      gegner ? ` · ${gegner.name}` : ''}`;
  }
  if (title) title.textContent = krieg
    ? `${meldung.ruler} erklärt dir den Krieg`
    : `${meldung.ruler} schließt Frieden`;
  if (text) {
    text.textContent = krieg
      ? `Ein Herold steht im Zelt: ${meldung.ruler}, ${meldung.titel}, `
        + `kündigt den Frieden auf – ${meldung.grund}.`
      : `${meldung.ruler}, ${meldung.titel}, lässt ausrichten, dass zwischen euch `
        + `wieder Friede sein soll – ${meldung.grund}.`;
  }
  if (effect) {
    effect.textContent = krieg
      ? 'Seine Heere können deine Orte ab dieser Runde angreifen. Im Diplomatiefenster '
        + 'steht, was ihn ein neuer Friede kosten würde.'
      : 'Eure Heere gehen einander wieder aus dem Weg.';
  }
  diploNewsOverlay.classList.remove('hidden');
  sfx.raise();
}

// Nimmt entgegen, was die Herrscher in dieser Runde beschlossen haben: was den
// Spieler angeht, kommt ins Fenster, alles andere ins Protokoll - aber nur,
// wenn er die Beteiligten überhaupt kennt.
function collectDiploNews() {
  if (!state) return;
  const me = playerFaction(state).id;
  for (const meldung of takeDiploNews(state)) {
    if (meldung.von === me || meldung.gegen === me) {
      diploNewsQueue.push(meldung);
      continue;
    }
    if (!knowsFaction(state, me, meldung.von) || !knowsFaction(state, me, meldung.gegen)) continue;
    const von = factionById(state, meldung.von);
    const gegen = factionById(state, meldung.gegen);
    if (!von || !gegen) continue;
    logMsg(state, meldung.kind === 'krieg'
      ? `${meldung.ruler} von ${von.name} erklärt ${gegen.name} den Krieg – ${meldung.grund}.`
      : `${von.name} und ${gegen.name} schließen Frieden.`);
  }
}

// --- Was in dieser Runde mit dir geschehen ist ----------------------------
// Nach dem Zug der Gegner wird zusammengetragen, was die eigene Fraktion
// betrifft: jede Schlacht, jeder verlorene und gewonnene Ort, jedes
// vernichtete Heer. Vorher stand davon nur die letzte Schlacht in einem
// Fenster, alles andere im Protokoll - und wer eine Stadt verlor, erfuhr es
// erst, wenn er hinsah.
function snapshotOwn() {
  if (!state) return { orte: new Set(), heere: new Map(), piraten: new Set() };
  const me = playerFaction(state).id;
  return {
    orte: new Set(state.cities.filter((c) => c.factionId === me).map((c) => c.id)),
    heere: new Map(state.armies.filter((a) => a.factionId === me).map((a) => [a.id, a.name])),
    // Welche Seeräuber schon unterwegs waren - ein neues Segel vor der eigenen
    // Küste ist eine Meldung wert, eines am anderen Ende der Welt nicht.
    piraten: new Set(pirateFleets(state).map((p) => p.id)),
    // Und welche Züge aus dem Osten. Die sind immer eine Meldung wert: ein
    // Volk in Bewegung geht die ganze Welt an, nicht nur den, gegen den es zieht.
    staemme: new Set(hordes(state).map((h) => h.id)),
  };
}

// Wie nah ein Segel sein muss, damit es die eigene Küste angeht.
const PIRATE_ALARM_RANGE = 9;

function collectOwnNews(vorher, previousHead) {
  if (!state) return;
  const me = playerFaction(state).id;

  // Schlachten: jede, an der die eigene Fraktion beteiligt war.
  const schlachten = [];
  for (const report of state.battleReports) {
    if (report.id === previousHead) break;
    if (report.involvesPlayer) schlachten.push(report);
  }
  for (const report of schlachten.reverse()) {
    const angreifer = report.attackerFactionId === me;
    const gewonnen = angreifer === (report.outcome === 'attacker');
    const zurSee = !!report.naval;
    const wo = report.cityName ? report.cityName : `${report.col},${report.row}`;
    diploNewsQueue.push({
      icon: zurSee ? '⛵' : report.kind === 'city' ? '🏰' : '⚔',
      kind: zurSee ? 'Eine Seeschlacht' : report.kind === 'city' ? 'Eine Belagerung' : 'Eine Feldschlacht',
      title: `${gewonnen ? 'Sieg' : 'Niederlage'} ${zurSee ? 'zur See' : 'bei'} ${
        zurSee && !report.cityName ? 'auf offener See' : wo}`,
      text: angreifer
        ? `Dein Angriff ${gewonnen ? 'hat sich durchgesetzt' : 'ist zurückgeschlagen worden'}.`
        : `${(factionById(state, report.attackerFactionId) || {}).name || 'Ein Feind'} hat dich angegriffen und ${
          gewonnen ? 'ist gescheitert' : 'sich durchgesetzt'}.`,
      effect: zurSee
        ? 'Zur See kämpft nur, was schwimmt: geschlagene Schiffe sind verloren.'
        : 'Der Bericht nennt Verluste, Gelände und den Verlauf.',
      reportId: report.id,
    });
  }

  // Orte, die den Besitzer gewechselt haben.
  const jetzt = new Set(state.cities.filter((c) => c.factionId === me).map((c) => c.id));
  for (const id of vorher.orte) {
    if (jetzt.has(id)) continue;
    const city = state.cities.find((c) => c.id === id);
    if (!city) continue;
    const sieger = factionById(state, city.factionId);
    diploNewsQueue.push({
      icon: '🏳', kind: 'Ein Ort ist gefallen',
      title: `${city.name} ist verloren`,
      text: `${sieger ? sieger.name : 'Ein Feind'} hält ${city.name}.`
        + ' Was der Ort trug, trägt er für einen anderen.',
      effect: 'Einnahmen, Garnison und Handelswege des Orts sind damit fort.',
    });
  }
  for (const city of state.cities) {
    if (city.factionId !== me || vorher.orte.has(city.id)) continue;
    diploNewsQueue.push({
      icon: '🏛', kind: 'Ein Ort ist gewonnen',
      title: `${city.name} ist dein`,
      text: `${city.name} steht unter deiner Herrschaft.`,
      effect: 'Der Ort trägt ab der nächsten Abrechnung zu deinen Einnahmen bei.',
    });
  }

  // Ein Volk, das sich in Bewegung gesetzt hat. Das steht im Fenster, gleich
  // ob es gegen den Spieler zieht oder gegen einen anderen: wer es zuerst
  // trifft, ist eine Frage von Runden.
  for (const zug of hordes(state)) {
    if (vorher.staemme.has(zug.id)) continue;
    const gegner = factionById(state, zug.gegen);
    const gegenMich = zug.gegen === me;
    const staerke = unitTotalCount(zug.units).toLocaleString('de-DE');
    diploNewsQueue.push({
      icon: '🐎', kind: 'Ein Volk in Bewegung',
      title: `${zug.name} zieht aus dem Osten heran`,
      text: `${staerke} wehrhafte Männer, dazu Weiber, Kinder, Karren und Herden. `
        + (gegenMich
          ? 'Der Zug geht gegen dich.'
          : `Der Zug geht gegen ${gegner ? gegner.name : 'ein Reich im Westen'}.`),
      effect: gegenMich
        ? 'Sie überrennen, was im Weg steht. Nehmen sie einen deiner Orte, bleiben '
          + 'sie dort – und der Ort ist für dich verloren.'
        : 'Was sie unterwegs nehmen, gehört von da an niemandem mehr. Ihr Weg führt '
          + 'quer durch die Reiche des Ostens.',
    });
  }

  // Seeräuber, die neu vor der eigenen Küste aufgetaucht sind.
  const meineOrte = state.cities.filter((c) => c.factionId === me);
  for (const raeuber of pirateFleets(state)) {
    if (vorher.piraten.has(raeuber.id)) continue;
    let nah = null;
    let beste = Infinity;
    for (const city of meineOrte) {
      const d = Math.abs(city.col - raeuber.col) + Math.abs(city.row - raeuber.row);
      if (d < beste) { beste = d; nah = city; }
    }
    if (!nah || beste > PIRATE_ALARM_RANGE) continue;
    diploNewsQueue.push({
      icon: '🏴', kind: 'Seeräuber',
      title: `Schwarze Segel vor ${nah.name}`,
      text: `${raeuber.name} kreuzt ${beste} Felder vor ${nah.name}. `
        + 'Sie halten keine Stadt und nehmen keine – sie nehmen, was fährt.',
      effect: 'Solange sie dort liegen, trägt jeder Seehandelsweg der Gegend nur die '
        + 'Hälfte. Wer sie versenkt, findet ihre Beute an Bord.',
    });
  }

  // Eigene Heere, die es nicht mehr gibt. Im Zug der Gegner kann ein Heer nur
  // vernichtet worden sein - vereinigen kann es sich nur, wenn man selbst zieht.
  const heereJetzt = new Set(state.armies.filter((a) => a.factionId === me).map((a) => a.id));
  for (const [id, name] of vorher.heere) {
    if (heereJetzt.has(id)) continue;
    diploNewsQueue.push({
      icon: '💀', kind: 'Ein Heer ist gefallen',
      title: `${name} besteht nicht mehr`,
      text: `Von ${name} ist nichts übrig, das noch marschieren könnte.`,
      effect: 'Der Sold für dieses Heer entfällt – und mit ihm sein Schutz.',
    });
  }
}

function setupDiploNews() {
  const close = document.getElementById('diploNewsClose');
  if (close) close.addEventListener('click', hideDiploNews);
  if (diploNewsOverlay) {
    diploNewsOverlay.addEventListener('click', (e) => {
      if (e.target === diploNewsOverlay) hideDiploNews();
    });
  }
}
setupDiploNews();

// --- Diplomatie ------------------------------------------------------------
// Ein eigenes Fenster, weil hier nichts auf der Karte passiert: hier wird
// geredet. Was gesagt wurde, steht als Antwort über der Liste, bis das
// Fenster wieder zugeht.
const diploOverlay = document.getElementById('diploOverlay');
let diploNote = '';

function hideDiplomacy() {
  if (diploOverlay) diploOverlay.classList.add('hidden');
  diploNote = '';
}

function renderDiplomacy() {
  const body = document.getElementById('diploBody');
  if (!body || !state) return;
  body.innerHTML = diplomacyHTML(state, diploNote);
  body.querySelectorAll('[data-diplotab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setDiploTab(btn.dataset.diplotab);
      sfx.select();
      renderDiplomacy();
    });
  });
  body.querySelectorAll('.diplo-btn:not([disabled])').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.faction;
      const me = playerFaction(state).id;
      pushUndo();
      let answer = null;
      if (btn.dataset.act === 'peace') {
        const tribute = Number(btn.dataset.tribute) || 0;
        const result = offerPeace(state, me, target, tribute);
        answer = result.text;
        (result.ok ? sfx.wallBuy : sfx.denied)();
      } else if (btn.dataset.act === 'war') {
        const ruler = rulerOf(state, target);
        const result = declareWar(state, me, target, 'die Boten sind zurückgeschickt');
        answer = result.ok
          ? `Die Herolde sind unterwegs. ${ruler.name} weiß es vor der nächsten Runde.`
          : (result.lock ? result.lock.text : 'Dafür ist es zu früh.');
        sfx.denied();
      } else if (btn.dataset.act === 'gift') {
        const result = sendGift(state, me, target, GIFT_COST);
        answer = result.text;
        (result.ok ? sfx.wallBuy : sfx.denied)();
      } else if (btn.dataset.act === 'accept') {
        const result = acceptOffer(state, target, me);
        answer = result.text;
        (result.ok ? sfx.wallBuy : sfx.denied)();
      } else if (btn.dataset.act === 'reject') {
        const result = rejectOffer(state, target, me);
        answer = result.text;
        sfx.denied();
      }
      diploNote = answer || '';
      refresh();
      renderDiplomacy();
    });
  });
}

function showDiplomacy() {
  if (!diploOverlay || !state) return;
  diploNote = '';
  renderDiplomacy();
  diploOverlay.classList.remove('hidden');
  sfx.select();
}

function setupDiplomacyButton() {
  const button = document.getElementById('diploBtn');
  if (button) button.addEventListener('click', showDiplomacy);
  const close = document.getElementById('diploClose');
  if (close) close.addEventListener('click', hideDiplomacy);
  if (diploOverlay) {
    diploOverlay.addEventListener('click', (e) => {
      if (e.target === diploOverlay) hideDiplomacy();
    });
  }
}
setupDiplomacyButton();

function setupEmpireButton() {
  const button = document.getElementById('empireBtn');
  if (button) button.addEventListener('click', showEmpire);
  const close = document.getElementById('empireClose');
  if (close) close.addEventListener('click', hideEmpire);
  if (empireOverlay) {
    empireOverlay.addEventListener('click', (e) => {
      if (e.target === empireOverlay) hideEmpire();
    });
  }
}
setupEmpireButton();

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
  hideEmpire();
  hideEvent();
  hideBattleReport();
  hideBattlePreview();
  hideTileInfo();
  stopMarch();
  // Der Feldzug endet, die Musik seiner Fraktion mit ihm.
  stopAnthem({ fadeOut: 2 });
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

// Auf einem schmalen Schirm legt sich die Seitenleiste über die Karte statt
// neben sie - offen bliebe von der Karte kaum etwas übrig. Sie beginnt deshalb
// dort eingeklappt; ⇥ im Menü holt sie hervor.
const NARROW_SCREEN = 620;

function setSidebarCollapsed(collapsed) {
  const button = document.getElementById('sidebarBtn');
  appEl.classList.toggle('sidebar-collapsed', collapsed);
  if (button) {
    button.classList.toggle('active', collapsed);
    // Nur das Zeichen wechselt - die Beschriftung daneben bleibt stehen.
    setButtonIcon(button, collapsed ? '⇤' : '⇥');
  }
  // ResizeObserver picks the new size up, but resize now so the very next
  // frame is already correct.
  resizeScene();
  render();
}

function setupSidebarToggle() {
  const button = document.getElementById('sidebarBtn');
  if (!button) return;
  button.addEventListener('click', () => {
    setSidebarCollapsed(!appEl.classList.contains('sidebar-collapsed'));
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
  setButtonIcon(button, tactical ? '🏔️' : '🗺');
  button.title = tactical
    ? 'Zurück zur Geländekarte (3)'
    : 'Taktische Sicht: Gebiete nach Fraktionen (3)';
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

// --- Grenzen -------------------------------------------------------------
// Die Herrschaftsgebiete als Linie auf der Geländekarte. Ein eigener Knopf,
// weil es eine andere Frage ist als die taktische Sicht: dort geht es darum,
// wem was gehört, hier darum, wo das eine Land aufhört und das nächste
// anfängt - und das will man auch sehen, während man die Karte selbst liest.
function refreshBorderButton() {
  const button = document.getElementById('borderBtn');
  if (!button) return;
  const an = areBordersVisible();
  button.classList.toggle('active', an);
  button.title = an
    ? 'Grenzen ausblenden (4)'
    : 'Grenzen der Herrschaftsgebiete einblenden (4)';
}

function setupBorderButton() {
  const button = document.getElementById('borderBtn');
  if (!button) return;
  refreshBorderButton();
  button.addEventListener('click', () => {
    setBordersVisible(!areBordersVisible(), state);
    refreshBorderButton();
    sfx.select();
    render();
  });
}

function refreshMuteButton() {
  const button = document.getElementById('muteBtn');
  if (!button) return;
  setButtonIcon(button, isMuted() ? '🔇' : '🔊');
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
    onBuyMine: (cityId) => {
      pushUndo();
      const ok = buyMine(state, cityId).ok;
      (ok ? sfx.wallBuy : sfx.denied)();
      refresh();
    },
    onBuyShipyard: (cityId) => {
      pushUndo();
      const ok = buyShipyard(state, cityId).ok;
      (ok ? sfx.wallBuy : sfx.denied)();
      refresh();
    },
    onBuyBarracks: (cityId) => {
      pushUndo();
      const ok = buyBarracks(state, cityId).ok;
      (ok ? sfx.wallBuy : sfx.denied)();
      refresh();
    },
    onBuyForum: (cityId) => {
      pushUndo();
      const ok = buyForum(state, cityId).ok;
      (ok ? sfx.wallBuy : sfx.denied)();
      refresh();
    },
    onBuildFleet: (cityId, kind) => {
      pushUndo();
      const result = buildFleet(state, cityId, kind || null);
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
    onOpenTrade: (cityId, targetId) => {
      pushUndo();
      const ok = openTradeRoute(state, cityId, targetId).ok;
      (ok ? sfx.wallBuy : sfx.denied)();
      refresh();
    },
    onCloseTrade: (routeId) => {
      pushUndo();
      closeTradeRoute(state, routeId);
      sfx.select();
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
  // Womit die Runde begann - daran wird nachher gemessen, was dir geschehen ist.
  const vorher = snapshotOwn();

  // Erst reden, dann marschieren: was die Herrscher in dieser Runde
  // beschließen, gilt für die Züge, die gleich folgen. Wessen Gesandter zu
  // lange gewartet hat, reist vorher ab.
  expireOffers(state);
  rulersTakeTurn(state);
  aiTakeAllTurns(state);
  // Wer inzwischen einem fremden Heer begegnet ist, kennt es jetzt.
  updateKnowledge(state, playerFaction(state).id);
  // Was die Herolde bringen, ehe die neue Runde beginnt.
  collectDiploNews();
  // Eroberungen der KI können Handelswege gekappt haben - das muss stehen,
  // bevor abgerechnet wird, sonst zahlt ein Weg, den es nicht mehr gibt.
  pruneTradeRoutes(state);
  collectIncome(state);
  // Erst die Abrechnung, dann das Schicksal: ein Ereignis greift in denselben
  // Schatz, den die Runde gerade gefüllt hat.
  const myEvent = rollEvents(state);
  // Die Menschen werden mehr, ehe die Wache aus ihnen nachgestellt wird.
  growPopulations(state);
  regenerateGarrisons(state);
  advanceWallConstruction(state);
  const roadsDone = advanceRoadConstruction(state);
  const harboursDone = advanceHarbourConstruction(state);
  const minesDone = advanceMineConstruction(state);
  const yardsDone = advanceShipyardConstruction(state);
  const civicDone = advanceCivicConstruction(state);
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

  // Alles, was die eigene Fraktion in dieser Runde betroffen hat, kommt der
  // Reihe nach ins Meldefenster - Schlachten, Orte, Heere. Die Herolde der
  // Diplomatie stehen schon in derselben Schlange.
  if (!state.gameOver) {
    const me = playerFaction(state).id;
    for (const city of minesDone) {
      if (city.factionId !== me) continue;
      diploNewsQueue.push({
        icon: '⛏️', kind: 'Ein Bergwerk fördert',
        title: `Das ${MINE_NAME} von ${city.name} ist offen`,
        text: `Die Stollen sind angeschlagen, die Karren rollen. `
          + `${city.name} fördert von dieser Runde an Erz.`,
        effect: `+${mineIncomeOf(state, city)} Gold je Runde – unabhängig von Größe, `
          + 'Einwohnern und Handel des Orts.',
      });
    }
    collectOwnNews(vorher, previousHead);
    if (diploNewsQueue.length) showNextDiploNews();
    else if (myEvent) showEvent(myEvent);
  }

  if (roadsDone.length || harboursDone.length || minesDone.length || yardsDone.length
    || civicDone.length
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
//
// Gehört wird auf alles, was als Geste zählt: touchstart kommt auf dem Handy
// vor pointerdown, und manche Browser rechnen erst das Loslassen als
// Bestätigung. Wer den Vollbildmodus über den Knopf verlässt, hat entschieden -
// dann ist wantsFullscreen aus und hier passiert nichts.
const RESTORE_EVENTS = ['touchstart', 'pointerdown', 'pointerup', 'keydown'];

function armFullscreenRestore() {
  if (restoreArmed || !fullscreenAllowed()) return;
  restoreArmed = true;
  const restore = () => {
    for (const type of RESTORE_EVENTS) window.removeEventListener(type, restore, true);
    restoreArmed = false;
    if (wantsFullscreen && !document.fullscreenElement) requestAppFullscreen();
  };
  for (const type of RESTORE_EVENTS) window.addEventListener(type, restore, true);
}

// Ein Wisch nach unten soll die Karte bewegen und nicht die Seite. Alles, was
// nicht in einer scrollbaren Leiste beginnt, wird deshalb hier abgefangen -
// sonst zieht die Geste am Browserfenster, und das wirft das Spiel aus dem
// Vollbild. Was der Browser selbst vom Bildschirmrand aus abfängt, kann eine
// Seite nicht verhindern; dafür gibt es das Wiederherstellen oben.
const SCROLLABLE = '#sidebar, .report-box, #settingsBody, #tileInfo, .empire-box, .start-box, #startHelp, #factionScreen';

function blockPageGestures() {
  document.addEventListener('touchmove', (event) => {
    if (event.touches.length > 1) return;
    const target = event.target;
    if (target && target.closest && target.closest(SCROLLABLE)) return;
    if (event.cancelable) event.preventDefault();
  }, { passive: false });
}
blockPageGestures();

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
  // Auch wer die Seite kurz verlässt, findet sie im Vollbild wieder vor.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && wantsFullscreen && !document.fullscreenElement) {
      armFullscreenRestore();
    }
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
  // Ein Starteintrag ist entweder die Truppenliste selbst oder ein Paar aus
  // Liste und Standort - Karthagos zweites Heer nennt seinen Ort. Ohne das
  // Auspacken zählte die Übersicht ein Objekt statt Männer.
  const men = rosters.reduce((sum, r) => sum + unitTotalCount(r.units || r), 0);
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
  // Wer diese Fraktion wählt, wählt diesen Mann: seine Eigenschaften stehen
  // hier, ehe der erste Zug fällt.
  const ruler = rulerFor(faction.id);
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
    <div class="fd-ruler">
      <strong>${ruler.name}</strong>, ${ruler.titel}
      <div class="fd-traits">${TRAITS.map((t) =>
    `<span>${TRAIT_NAMES[t]} ${ruler[t]} · ${traitLabel(t, ruler[t])}</span>`).join('')}</div>
      <p class="fd-blurb">${ruler.wort}</p>
    </div>
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
  // Auf dem Telefon fängt die Karte mit voller Breite an.
  if (window.innerWidth <= NARROW_SCREEN) setSidebarCollapsed(true);

  // The scene asks the game what the weather is wherever the camera looks, and
  // reports back so the topbar can name it.
  setWeatherReporter(paintWeatherLabel);
  setWeatherSource((col, row) => weatherAt(state, col, row));

  // Der Feldzug beginnt nicht auf der Karte, sondern im Zelt: erst der Tisch
  // mit der Karte darauf und der Thron dahinter, dann - wenn der Spieler die
  // Ansprache wegklickt - der Blick auf die eigene Hauptstadt.
  setOpeningView();
  // Mit dem Zelt wechselt die Musik: die Titelmusik gehört zum Vorspann, von
  // hier an klingt die eigene Fraktion.
  stopTheme({ fadeOut: 2 });
  if (!isMuted() && getSetting('music')) {
    startAnthem(playerFaction(state).id, { fadeIn: 3.5 });
  }
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
setupBorderButton();
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
  else if (eventOverlay && !eventOverlay.classList.contains('hidden')) hideEvent();
  else if (diploNewsOverlay && !diploNewsOverlay.classList.contains('hidden')) hideDiploNews();
  else if (empireOverlay && !empireOverlay.classList.contains('hidden')) hideEmpire();
  // Das Diplomatiefenster fehlte hier: es ließ sich nur über sein ✕ schließen,
  // und solange es offen stand, ging kein Tastenkürzel mehr.
  else if (diploOverlay && !diploOverlay.classList.contains('hidden')) hideDiplomacy();
  else if (!settingsOverlay.classList.contains('hidden')) hideSettings();
  else if (!previewOverlay.classList.contains('hidden')) hideBattlePreview();
  else if (!reportOverlay.classList.contains('hidden')) hideBattleReport();
  else if (!document.getElementById('quitOverlay').classList.contains('hidden')) {
    hideQuitDialog();
  }
  else if (document.fullscreenElement) wantsFullscreen = false;
});

// --- Tastenkürzel ----------------------------------------------------------
// Wer einen Feldzug führt, klickt sonst jede Runde dieselben vier Knöpfe. Die
// Zifferntasten öffnen die Fenster, die Leertaste beendet die Runde. Q/E
// drehen die Karte und WASD schiebt sie - das macht input.js, deshalb bleiben
// diese Buchstaben hier unberührt.
const SHORTCUT_BUTTONS = {
  1: 'empireBtn',
  2: 'diploBtn',
  3: 'mapModeBtn',
  4: 'borderBtn',
  5: 'settingsBtn',
  u: 'undoBtn',
  m: 'muteBtn',
};

// Steht ein Fenster offen, gehört die Tastatur ihm.
const OVERLAY_IDS = [
  'heraldOverlay', 'eventOverlay', 'empireOverlay', 'diploOverlay',
  'diploNewsOverlay', 'settingsOverlay', 'battlePreview', 'battleReport',
  'quitOverlay', 'gameOverOverlay',
];

function anyOverlayOpen() {
  return OVERLAY_IDS.some((id) => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden');
  });
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  // Nur auf der Karte, und nur wenn nichts darüber liegt.
  if (appEl.classList.contains('hidden') || anyOverlayOpen()) return;

  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();
    endTurn();
    return;
  }
  const id = SHORTCUT_BUTTONS[e.key.toLowerCase()];
  if (!id) return;
  const button = document.getElementById(id);
  if (!button || button.disabled) return;
  e.preventDefault();
  button.click();
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

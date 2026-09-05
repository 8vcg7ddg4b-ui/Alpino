// --- Steuerung ------------------------------------------------------------
// Maus, Finger und Tastatur. Die linke Taste zieht die Karte und wählt aus,
// das gedrückte Mausrad dreht den Blick frei, die rechte Taste nimmt zurück:
// Auswahl weg, Tafel zu. Alles Weitere entscheidet `main.js`.
import { pickTile, zoomCamera, rotateCamera, panCameraRelative, resetCameraOrientation } from './scene3d.js';

export function setupInput(canvas, handlers = {}) {
  const H = {
    onTileClick: () => {}, onTileHover: () => {},
    onEndTurn: () => {}, onCancel: () => {}, onNextFleet: () => {},
    onCenterHome: () => {}, onSheet: () => {}, onRender: () => {},
    onToggleBorders: () => {}, onToggleMapMode: () => {}, onToggleMini: () => {},
    ...handlers,
  };

  let dragging = null;
  let moved = 0;
  let lastPointer = { x: 0, y: 0 };
  const touches = new Map();
  let pinchDistance = 0;
  let pinchAngle = 0;

  function pointerDown(ev) {
    canvas.setPointerCapture(ev.pointerId);
    touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      pinchAngle = Math.atan2(b.y - a.y, b.x - a.x);
      dragging = 'pinch';
      return;
    }
    moved = 0;
    lastPointer = { x: ev.clientX, y: ev.clientY };
    // Das gedrückte Mausrad dreht den Blick frei, die linke Taste zieht die
    // Karte. Die rechte bewegt nichts - sie nimmt zurück, und das hängt
    // dokumentweit am Kontextmenü, damit es auch über einer Tafel gilt.
    if (ev.button === 1 || ev.ctrlKey) dragging = 'rotate';
    else if (ev.button === 2) dragging = null;
    else dragging = 'pan';
  }

  function pointerMove(ev) {
    if (touches.has(ev.pointerId)) touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (dragging === 'pinch' && touches.size === 2) {
      const [a, b] = [...touches.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      if (pinchDistance > 0) zoomCamera(dist / pinchDistance);
      rotateCamera((angle - pinchAngle) * 0.8, 0);
      pinchDistance = dist;
      pinchAngle = angle;
      H.onRender();
      return;
    }
    if (!dragging) {
      // Die Stelle wandert mit: die Karte am Zeiger soll dort stehen, wo der
      // Zeiger ist, nicht dort, wo er einmal war.
      const tile = pickTile(ev.clientX, ev.clientY);
      H.onTileHover(tile, { x: ev.clientX, y: ev.clientY });
      return;
    }
    const dx = ev.clientX - lastPointer.x;
    const dy = ev.clientY - lastPointer.y;
    lastPointer = { x: ev.clientX, y: ev.clientY };
    moved += Math.abs(dx) + Math.abs(dy);
    if (dragging === 'rotate') {
      // Die Maus nach unten zieht den Blick hinunter auf das Deck: erst die
      // Karte von oben, dann die Brücke ringsum.
      rotateCamera(-dx * 0.006, dy * 0.004);
    } else {
      panCameraRelative(-dx * 0.6, -dy * 0.6);
    }
    H.onRender();
  }

  function pointerUp(ev) {
    touches.delete(ev.pointerId);
    if (touches.size < 2 && dragging === 'pinch') dragging = null;
    if (dragging === 'pan' && moved < 6) {
      const tile = pickTile(ev.clientX, ev.clientY);
      if (tile) H.onTileClick(tile, { shift: ev.shiftKey, alt: ev.altKey });
    }
    if (touches.size === 0) dragging = null;
  }

  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('pointerleave', () => { H.onTileHover(null, null); });
  // Das Menü des Browsers steht der rechten Taste im Weg.
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  // Das gedrückte Mausrad darf die Seite nicht scrollen.
  canvas.addEventListener('auxclick', (ev) => { if (ev.button === 1) ev.preventDefault(); });
  canvas.addEventListener('mousedown', (ev) => { if (ev.button === 1) ev.preventDefault(); });
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    zoomCamera(ev.deltaY < 0 ? 1.12 : 1 / 1.12);
    H.onRender();
  }, { passive: false });

  // Doppelklick zentriert - der schnellste Weg quer über die Karte.
  canvas.addEventListener('dblclick', (ev) => {
    const tile = pickTile(ev.clientX, ev.clientY);
    if (tile) H.onTileClick(tile, { double: true });
  });

  window.addEventListener('keydown', (ev) => {
    if (ev.target && /input|textarea/i.test(ev.target.tagName)) return;
    const step = ev.shiftKey ? 40 : 16;
    switch (ev.key) {
      case 'ArrowLeft': panCameraRelative(-step, 0); H.onRender(); break;
      case 'ArrowRight': panCameraRelative(step, 0); H.onRender(); break;
      case 'ArrowUp': panCameraRelative(0, -step); H.onRender(); break;
      case 'ArrowDown': panCameraRelative(0, step); H.onRender(); break;
      case '+': case '=': zoomCamera(1.15); H.onRender(); break;
      case '-': case '_': zoomCamera(1 / 1.15); H.onRender(); break;
      case 'q': case 'Q': rotateCamera(-0.12, 0); H.onRender(); break;
      case 'e': case 'E': rotateCamera(0.12, 0); H.onRender(); break;
      case 'r': case 'R': resetCameraOrientation(); H.onRender(); break;
      case ' ': ev.preventDefault(); H.onEndTurn(); break;
      case 'Enter': H.onEndTurn(); break;
      case 'Escape': H.onCancel(); break;
      case 'n': case 'N': H.onNextFleet(); break;
      case 'h': case 'H': H.onCenterHome(); break;
      case 'i': case 'I': H.onSheet('reich'); break;
      case 'd': case 'D': H.onSheet('diplomatie'); break;
      case 't': case 'T': H.onSheet('technik'); break;
      case 'c': case 'C': H.onSheet('chronik'); break;
      case 'b': case 'B': H.onToggleBorders(); break;
      case 'm': case 'M': H.onToggleMapMode(); break;
      case 'ü': case 'Ü': H.onToggleMini(); break;
      // Die Hilfe liegt auf der Taste, auf der sie jeder sucht.
      case 'F1': ev.preventDefault(); H.onSheet('hilfe'); break;
      case '?': H.onSheet('hilfe'); break;
      default: break;
    }
  });

  window.addEventListener('resize', () => H.onRender(true));
  return {
    destroy() {
      canvas.replaceWith(canvas.cloneNode(true));
    },
  };
}

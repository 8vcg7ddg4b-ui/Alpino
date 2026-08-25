# SPQR – Rundenstrategie in 2.5D

Ein rundenbasiertes Browserspiel im Stil von *Total War: Rome*. Die Kampagnenkarte
wird in isometrischer 2.5D-Ansicht dargestellt; Bewegung, Belagerungen und Kämpfe
finden direkt auf dieser Karte statt – es gibt keinen separaten Schlachtbildschirm.

## Starten

Kein Build-Schritt, keine Abhängigkeiten. Einfach einen kleinen Webserver starten
(ES-Module benötigen `http://`, kein `file://`):

```bash
node server.js
# oder
npm start
```

Dann `http://localhost:8080` im Browser öffnen.

Alternativ funktioniert auch `python3 -m http.server 8080` im Projektordner.

## Spielprinzip

- Du spielst **Rom** gegen die KI-Fraktionen **Karthago** und die **Gallier**,
  außerdem gibt es die unabhängige Stadt Massilia.
- Jede Runde: Armeen anklicken und auf ein grün markiertes Feld bewegen
  (freie Bewegung) oder auf ein rot markiertes Feld (löst sofort einen Kampf
  auf der Karte aus – Feldschlacht oder Belagerung).
- Städte anklicken, um Einheiten zu rekrutieren (Legionäre, Kavallerie,
  Bogenschützen) und Garnisonen zu Feldarmeen auszuheben.
- „Runde beenden" lässt die KI-Fraktionen ziehen, kassiert Einkommen und lässt
  Garnisonen langsam nachwachsen.
- Sieg: alle gegnerischen Fraktionen ausschalten. Niederlage: Rom verliert
  alle Städte und Armeen.

## Struktur

- `js/data.js` – Einheiten-, Gelände- und Fraktionsdefinitionen
- `js/mapgen.js` / `js/state.js` – Kartengenerierung & Spielzustand
- `js/pathfind.js` – Bewegungsreichweite (Dijkstra) inkl. Kampf-Zielfelder
- `js/combat.js` – Kampfauflösung (mehrere Runden, Fernkampf-Bonus, Moral)
- `js/actions.js` – Bewegen, Rekrutieren, Armee ausheben, Rundenwechsel
- `js/ai.js` – einfache KI (Wirtschaft + Angriffsverhalten)
- `js/render.js` – isometrisches Canvas-Rendering
- `js/ui.js`, `js/input.js`, `js/main.js` – Seitenleiste, Eingabe, Bootstrap

# SPQR – Rundenstrategie in 3D

Ein rundenbasiertes Strategiespiel im Stil von *Total War: Rome*. Die Kampagnenkarte
umfasst Europa und das Mittelmeer und wird in echtem 3D (Three.js/WebGL) aus einer
isometrischen Kameraperspektive dargestellt; Bewegung, Belagerungen und Kämpfe
finden direkt auf dieser Karte statt – es gibt keinen separaten Schlachtbildschirm.

Das Spiel läuft wahlweise **im Browser** oder als **eigenständige Desktop-Anwendung**
(Windows/macOS/Linux) mit eigenem Fenster, eigenem Icon und ohne sichtbaren Browser.

## Als Desktop-Programm starten

```bash
npm install      # einmalig: lädt Electron
npm run desktop  # startet SPQR als Desktop-App
```

### Installationsdatei bauen

Erzeugt ein weitergebbares Installationspaket im Ordner `dist/`. Gebaut wird immer
für das System, auf dem der Befehl läuft – für eine `.exe` also unter Windows:

```bash
npm run dist:win     # Windows: SPQR Setup.exe (NSIS-Installer)
npm run dist:mac     # macOS:   SPQR.dmg
npm run dist:linux   # Linux:   SPQR.AppImage
```

Tastatur in der Desktop-Version: **F11** Vollbild, **Strg/Cmd + N** neues Spiel.

## Im Browser starten

Kein Build-Schritt, keine npm-Abhängigkeiten (Three.js liegt fertig gebaut unter
`js/vendor/three.min.js`). Einfach einen kleinen Webserver starten (ES-Module
benötigen `http://`, kein `file://`):

```bash
node server.js
# oder
npm start
```

Dann `http://localhost:8080` im Browser öffnen. Auf dem Startbildschirm „Neues
Spiel starten" klicken.

Alternativ funktioniert auch `python3 -m http.server 8080` im Projektordner.

## Bedienung

- **Armee bewegen**: anklicken, dann ein grün markiertes Feld (freie Bewegung)
  oder ein rot markiertes Feld (Angriff) wählen. Die Armee marschiert sichtbar
  die gefundene Route entlang.
- **Kampfvorschau**: Vor jedem Angriff öffnet sich eine Vorschau mit Siegchance,
  erwarteten Verlusten auf beiden Seiten und allen Modifikatoren (Gelände,
  Stadtmauer, Landung vom Meer). „Abbrechen" lässt die Armee unverändert
  stehen. Die Schätzung entsteht aus 60 durchgerechneten Schlachten und
  verändert den späteren echten Kampf nicht.
- **Schiffe**: In einer eigenen Hafenstadt kann eine Armee für 250 Gold
  **in See stechen**. Auf dem Wasser hat sie 10 Bewegungspunkte statt 6; gelb
  markierte Felder sind Landungen und beenden die Fahrt. Angriffe direkt vom
  Schiff kosten 30 % Angriffskraft, auf offener See verteidigt es sich 25 %
  schlechter. Nur so sind die Inseln (Caralis, Rhodos, Knossos) zu erreichen.
- **Schlachtberichte**: Nach jedem Kampf öffnet sich ein Bericht mit Verlusten
  pro Einheitentyp, Geländevorteil und Rundenverlauf. Ältere Kämpfe lassen sich
  jederzeit über die Einträge in der Ereignisliste wieder öffnen (Esc schließt).
- **Karte verschieben**: Ziehen mit Maus oder einem Finger, Pfeiltasten/WASD,
  oder das Steuerkreuz unten links.
- **Drehen und Zoomen**: Auf dem Touchscreen zwei Finger – auseinander/zusammen
  zoomt, Verdrehen dreht die Karte. Am Rechner: Mausrad zoomt, Umschalt+Mausrad
  bzw. **Q**/**E** dreht. Die Knöpfe ↺ ↻ drehen, ⌂ setzt die Ansicht zurück.
  Nach dem Drehen bleiben Steuerkreuz und Pfeiltasten bildschirmbezogen.
- **Städte**: anklicken, um Einheiten zu rekrutieren (Legionäre, Kavallerie,
  Bogenschützen) und Garnisonen zu Feldarmeen auszuheben.
- **Moral und Erschöpfung**: Jede Armee führt beide Werte mit; sie gehen direkt
  in die Kampfkraft ein. Märsche und Schlachten zehren, Rasten erholt – am
  schnellsten in einer eigenen Stadt. Beides steht im Armee-Panel.
- **Armee auflösen**: Steht eine Armee in einer eigenen Stadt, kann sie sich
  auflösen; ihre Soldaten treten der Garnison bei.
- **Stadtmauern**: Hauptstädte besitzen von Beginn an eine Mauer. Jede andere
  eigene Stadt kann eine kaufen; sie wird in 5 Runden errichtet und gibt den
  Verteidigern danach einen deutlichen Bonus.
- **Rückgängig** (↩ oben rechts): macht die letzte Aktion zurück – Zug,
  Rekrutierung, Mauerkauf, Auflösen oder ganzen Rundenwechsel.
- **Ton**: 🔊 schaltet die Klänge um (Marsch, Schlacht, Rekrutierung, Mauerbau,
  Rundenwechsel …). Alle Geräusche werden zur Laufzeit synthetisiert – keine
  Audiodateien, funktioniert offline.
- **Vollbildmodus**: Button oben rechts (⛶) bzw. auf dem Startbildschirm.
  In einer eingebetteten Ansicht (iframe) verbietet der Browser Vollbild per
  Permissions-Policy; das Spiel sagt das dann und der Knopf ⇥ blendet
  stattdessen die Seitenleiste aus, um der Karte den Platz zu geben.
- „Runde beenden" lässt die KI-Fraktionen ziehen, kassiert Einkommen und lässt
  Garnisonen langsam nachwachsen.

## Spielprinzip

- Du spielst **Rom** gegen die KI-Fraktionen **Karthago**, die **Gallier**, die
  **Griechen** und die **Germanen**, verteilt über eine stilisierte Europa-/
  Mittelmeerkarte (Iberische Halbinsel, Alpen/Pyrenäen, italienischer Stiefel,
  Sizilien, Griechenland, Nordafrika, Nordsee und Germanien).
- Die **Germanen** sitzen nördlich der Alpen in einem Waldgürtel, der jeden
  Vormarsch verlangsamt. Sie führen keine stehende Armee, sondern einen
  fußlastigen Heerhaufen – dafür stellt jede ihrer Siedlungen eine deutlich
  größere Levy (Faktor 1,2 auf die Garnisonsstärke).
- **31 Siedlungen in drei Größen**: **Große Stadt** (viel Bevölkerung, starke
  Garnison, 1,7-faches Grundeinkommen), **Stadt** (Normalmaß) und **Dorf**
  (klein, halbes Grundeinkommen – leicht zu nehmen und gute Sprungbretter).
  Zwölf davon gehören niemandem und sind frei zu erobern; drei liegen auf
  Inseln und sind nur mit Schiffen erreichbar.
- Die KI rechnet vor jedem Angriff dieselbe Vorschau wie du und lässt sich auf
  einen Kampf nur ein, wenn sie ihn voraussichtlich gewinnt.
- Sieg: alle gegnerischen Fraktionen ausschalten. Niederlage: Rom verliert
  alle Städte und Armeen.

## Struktur

- `js/data.js` – Einheiten-, Gelände- und Fraktionsdefinitionen, Kartengröße
- `js/mapgen.js` / `js/state.js` – Europa-Küstenlinie & Kartengenerierung, Spielzustand
- `js/pathfind.js` – Bewegungsreichweite (Dijkstra) inkl. Kampf-Zielfeldern
  und Seewegen für eingeschiffte Armeen
- `js/combat.js` – Kampfauflösung (mehrere Runden, Fernkampf-Bonus, Moral) und
  die Vorschau-Simulation mit eigenem Zufallsstrom
- `js/actions.js` – Bewegen, Einschiffen, Rekrutieren, Armee ausheben,
  Rundenwechsel, Kampfvorschau
- `js/ai.js` – einfache KI (Wirtschaft + Angriffsverhalten)
- `js/scene3d.js` – Three.js-Szene: instanziertes 3D-Gelände, Städte/Armeen als
  3D-Objekte, isometrische Kamera (Pan/Zoom), Raycasting-Feldauswahl
- `js/vendor/three.min.js` – lokal eingebundenes Three.js (MIT-Lizenz, r149)
- `js/ui.js`, `js/input.js`, `js/main.js` – Seitenleiste, Eingabe, Startbildschirm, Bootstrap

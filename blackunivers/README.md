# Black Univers – Rundenstrategie im Kilrathi-Krieg

Ein rundenbasiertes Strategiespiel im Wing-Commander-Universum, gebaut nach dem
Vorbild von *Pax Aeterna*, das in diesem Verzeichnis nebenan liegt: dieselbe
Bauweise, dieselbe Handschrift – aber statt der Legionen des Mittelmeers führt
man Trägerkampfgruppen zwischen Sol und Kilrah.

Die Sternkarte des bekannten Raums wird in echtem 3D (Three.js/WebGL) aus einer
isometrischen Kameraperspektive dargestellt. Bewegung, Sprungpunkte,
Belagerungen und Gefechte finden **direkt auf dieser Karte** statt – es gibt
keinen zweiten Bildschirm für Schlachten.

## Die Karte liegt auf der Brücke

Der Feldzug wird nicht auf einer Karte gespielt, sondern **an einem
Kartentisch**: Die Sternkarte ist ein Hologramm auf dem Tisch der Flaggbrücke
eines Trägers. Ringsum ein Konsolenring, dahinter die Schotten mit ihren
Lichtbändern, dem Betrachter gegenüber der Kommandosessel auf seinem Podest,
links und rechts die Feldzeichen mit dem **Wappen der eigenen Flagge**. Wer die
Kamera tief stellt, sieht die Brücke; wer von oben schaut, sieht die Karte.

Auf einem eigenen Ständer steht der **Fluganzug** – das eine Stück auf der
Brücke, an dem man sieht, wessen Flotte man führt. Und an der Stirnseite liegt
das **Panoramafenster**: Was dahinter steht, richtet sich nach dem Umland der
eigenen Hauptwelt – eine Nebelbank, ein Gasriese mit Ring, ein Trümmerfeld,
zwei Sonnen, oder das eigene Flugdeck mit Landebahn und Positionslichtern.

Bevor der erste Zug fällt, meldet sich der Erste Offizier:
**„Ich grüße Sie an Bord. Die Karte liegt auf dem Tisch."**

## Der Raum

Die Karte ist **echte Wing-Commander-Geografie**, gerastert auf 76 × 42 Felder:
Sol im Westen, Kilrah im Osten, dazwischen der Vega-Sektor, der Enigma-Sektor,
die Grenzwelten, der Gemini-Sektor, das Landreich und der Firekka-Rand –
**66 Sternsysteme** von Sol, Proxima und Vega über McAuliffe, Kurasawa, Enigma
und Ghorah Khar bis Vukar Tag, Baka Kar und Kilrah.

Ein Feld ist nicht wie das andere:

| Feld | Wirkung |
| --- | --- |
| **Offener Raum** | Flugkosten 1 |
| **Nebelbank** | Kosten 2, verbirgt Flotten – im Nebel sieht man nur, wer daneben steht |
| **Asteroidenfeld** | Kosten 3, kostet Maschinen beim Durchflug |
| **Strahlungszone** | Kosten 2, frisst Panzerung |
| **Gravitationsgraben** | Unpassierbar. Die Gebirge dieser Karte |

Durch die Gräben führen **Sprungpunkte**: acht feste Paare, die in einem
Bewegungspunkt quer über die Karte bringen – der Enigma-Sprung nach K'tithrak
Mang, der Grabensprung von Tyr zum Höllenloch, der Firekka-Sprung. Sie
entscheiden, wo Feldzüge stattfinden.

## Was man führt

Fünf spielbare Flaggen, jede mit eigener Doktrin, eigenen Schiffsnamen und
eigenem Oberkommandierenden:

| Flagge | Herrscher | Doktrin |
| --- | --- | --- |
| **Terranische Konföderation** | Admiral Geoffrey Tolwyn | Träger sind billiger, Jäger starten erfahren |
| **Kilrathi-Imperium** | Kronprinz Thrakhath nar Kiranka | Jäger und Klauenkrieger schlagen härter, Rückzug kostet Moral |
| **Union der Grenzwelten** | Admiral Jacob Manley | Mehr Bewegung, geringerer Unterhalt |
| **Freie Republik Landreich** | Präsident Max Kruger | Mehr Beute aus Gefecht und Eroberung |
| **Firekkanische Konföderation** | Königin Rikik | Sehr billige Jäger, starke Planetenverteidigung |

Dazu der **Nephilim-Schwarm**, der nach vielen Zügen durch ein Tor am Rand der
Karte kommt und nicht verhandelt, sowie **Retros, Mandarine und Freibeuter**,
die aus Nebelbänken auftauchen und plündern.

### Verbände

Sechs Rollen, die einander im Kreis schlagen: **Jäger** fangen **Bomber**,
Bomber knacken **Kreuzer** und **Korvetten**, Großkampfschiffe zerfetzen Jäger.
**Träger** tragen keine Waffe, die zählt – sie machen die Jäger neben sich
stärker. **Landungstruppen** nehmen Welten; ohne sie fällt keine.

Die Namen richten sich nach der Werft: Rapier, Broadsword, Tallahassee und
Bengal bei der Konföderation, Dralthi, Paktahn, Kamekh, Fralthi und Snakeir
beim Imperium, Banshee und Kormoran bei den Grenzwelten, Sabre und Longbow beim
Landreich.

### Asse

Eine Flotte kann ein **Ass** tragen – Christopher „Maverick" Blair, „Maniac"
Marshall, „Angel" Devereaux, „Hunter", „Iceman", „Paladin", auf der anderen
Seite Ralgha „Hobbes" nar Hhallas, Baron Jukaga, „Blutklaue" Kur'utak. Ein Ass
verstärkt seine Rolle, hebt die Moral oder gibt einen Bewegungspunkt. Fällt die
Flotte, kann das Ass mit ihr fallen – dann steht sein Name in der Chronik und
nie wieder auf der Karte.

## Wie eine Welt fällt

Eine Welt fällt erst, wenn drei Dinge zusammenkommen:

1. Die **Planetenwache** ist geschlagen,
2. der **Planetenschild** ist niedergedrückt – dafür braucht es Bomber,
3. und es sind **Landungstruppen** dabei.

Wer nichts davon hat, kann eine Welt **einschließen**: Die Belagerung zehrt
Wache und Schild auf, bis die Welt von selbst fällt. Oder man **blockiert** sie:
Dann bleiben ihre Kassen leer.

Fünf Schildstufen vom Deflektornetz bis zum Zitadellenschild, sieben Ausbauten
(Orbitalwerft, Bergbauring, Handelsstation, Sensorphalanx, Geschützplattformen,
Flugakademie, Terraformer), drei Techniklinien (Triebwerke, Waffen, Schilde) mit
je drei Stufen und acht Schlachtordnungen – vom Zangenangriff über den
Torpedolauf bis zum Nebelhinterhalt, den es nur in der Bank gibt.

## Sechs Große Werke

Sie liegen fest auf der Karte und gehören dem, der das System hält: das
**Sprungtor von Sol** (+1 Bewegung), die **Werften von Vega** (kürzere
Bauzeiten), der **Große Basar** von New Detroit (Kredits), die **Klauenhalle**
von Kilrah (+15 % Angriff), der **Nesthort** von Firekka (Moral) und der
**Horchposten Enigma** (Sicht).

## Drei Ausgangslagen

* **Der Vega-Feldzug (2654)** – das Imperium hat McAuliffe überrannt.
* **Enigma 2667** – K'tithrak Mang ist gefallen, die Grenzwelten trauen niemandem.
* **Der Grenzkrieg (2673)** – Kilrah ist gefallen, der Krieg läuft zwischen Menschen.

Die Karte, die Flaggen und die Regeln bleiben gleich; was sich unterscheidet,
ist der erste Tag.

## Sieg

Nimm die Hauptwelt deines Erzfeindes – oder halte 28 Systeme. Verlierst du alle,
ist der Feldzug vorbei.

## Starten

Im Browser:

```bash
node server.js       # http://localhost:8090
```

Als Desktop-Anwendung (eigenes Fenster, eigenes Icon):

```bash
npm install
npm run desktop      # Electron
npm run dist:linux   # AppImage bauen (analog dist:win, dist:mac)
```

Der kleine Server wird gebraucht, weil Chromium ES-Module nicht von einer
`file://`-Adresse lädt.

## Als Artefakt

Das ganze Spiel passt in eine einzige HTML-Datei: der Bündler legt die zwanzig
Module, die Formatvorlage und Three.js zusammen.

```bash
npm run artifact     # dist/black-univers.html, rund 900 KB, ohne Nachladen
```

Die Datei läuft per Doppelklick im Browser und lässt sich als Artefakt
veröffentlichen. Der Spielstand liegt dann im Speicher des Browsers, in dem sie
geöffnet wurde.

## Steuerung

| Eingabe | Wirkung |
| --- | --- |
| Linke Maustaste ziehen | Karte schwenken |
| Rechte Maustaste ziehen | Kamera drehen und neigen (nach unten: hinunter zur Brücke) |
| Mausrad, `+` / `−` | Zoomen |
| Klick auf eigene Flotte | Auswählen – blaue Felder sind erreichbar, rote Rauten sind Ziele |
| Klick auf blaues Feld | Hinfliegen |
| Klick auf rotes Feld | Angreifen (mit Vorschau, bevor es ernst wird) |
| Pfeiltasten | Schwenken · `Q`/`E` drehen · `R` Kamera zurücksetzen |
| Leertaste / Eingabe | Zug beenden |
| `N` | Nächste Flotte mit Bewegung · `H` nach Hause |
| `I` / `D` / `T` / `C` | Reich · Diplomatie · Technik · Chronik |
| `Esc` | Auswahl aufheben, Tafel schließen |

## Aufbau des Codes

Reine ES-Module, keine Bauwerkzeuge, keine Abhängigkeiten außer Three.js
(mitgeliefert unter `js/vendor/`). Der Klang wird gerechnet, nicht geladen: Funk,
Triebwerke, Laser, Einschläge und das Titelstück „Schwarzes Feuer" entstehen im
Browser aus Oszillatoren.

| Datei | Inhalt |
| --- | --- |
| `js/data.js` | Alle Zahlen: Flaggen, Rollen, Schiffe, Systeme, Ausbauten, Technik |
| `js/starchart.js` | Der Kartenausschnitt: Sektoren, Nebel, Trümmer, Gräben |
| `js/mapgen.js` | Aus den Zonen wird das Raster, dazu die Sprungpunkte |
| `js/state.js` | Der Weltzustand – ein Feldzug ist ein Objekt |
| `js/pathfind.js` | Wegfinder über Felder und Sprungpunkte |
| `js/combat.js` | Die Gefechtsrechnung, Runde für Runde |
| `js/actions.js` | Alle Züge: fliegen, angreifen, bauen, forschen, belagern, kassieren |
| `js/ai.js` | Die anderen Reiche – gleiche Regeln, keine Abkürzungen |
| `js/diplomacy.js` | Beziehungen, Verträge, Kriege, Angebote |
| `js/events.js` | Ereignisse, Freibeuter, der Schwarm |
| `js/pilots.js` | Herrscher, Eigenschaften, Asse |
| `js/scene3d.js` | Die Darstellung: Holotisch, Brücke, Karte, Flotten, Nebel des Krieges |
| `js/battle3d.js` | Das Gefecht auf der Karte |
| `js/ui.js` | Kopfleiste, Tafeln, Berichte |
| `js/input.js` | Maus, Finger, Tastatur |
| `js/main.js` | Startbild, Auswahl, Zugschleife – der Draht dazwischen |

## Prüfläufe

```bash
node test/smoke.mjs 80          # 80 Züge ohne Bildschirm, alle Regeln, alle Prüfungen
node test/smoke.mjs 60 enigma   # anderes Szenario
node test/browser.mjs           # echtes Chromium: klicken, fliegen, kämpfen, fotografieren
```

Der erste Lauf spielt einen ganzen Feldzug mit der KI auf allen Seiten und prüft
nach jedem Zug, ob die Welt in sich stimmt: keine Flotte im Graben, keine
negativen Kassen, keine leeren Verbände. Der zweite startet das Spiel in einem
echten Browser, klickt sich durch Fraktionswahl, Karte, Flug, Gefecht und fünf
Züge und meldet jeden Fehler in der Konsole.

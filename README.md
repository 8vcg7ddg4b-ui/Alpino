# SPQR – Rundenstrategie in 3D

Ein rundenbasiertes Strategiespiel im Stil von *Total War: Rome*. Die Kampagnenkarte
umfasst Europa, das Mittelmeer und Nordafrika und wird in echtem 3D (Three.js/WebGL)
aus einer isometrischen Kameraperspektive dargestellt; Bewegung, Seefahrt,
Belagerungen und Kämpfe finden direkt auf dieser Karte statt – es gibt keinen
separaten Schlachtbildschirm.

Die Karte ist **echte Geografie**: Küstenlinien, Gebirgszüge und Siedlungen sind in
Längen- und Breitengraden hinterlegt (`js/geodata.js`) und werden auf ein Raster von
80 × 52 Feldern gerastert – ein Feld entspricht rund 55 km. Roma liegt auf 12,5° O /
41,9° N, weil Rom dort liegt.

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

## Jahreszeiten und Wetter

Vier Runden sind ein Jahr; das Spiel beginnt im **Frühling 264 v. Chr.**, dem
Jahr, in dem der Erste Punische Krieg ausbricht. Die Kopfzeile zeigt Jahreszeit
und Jahr, daneben das Wetter dort, wo die Kamera gerade hinsieht.

Weil die Karte von der Nordsee bis in die Sahara reicht, gibt es kein einziges
Wetter für alles: Vier Klimazonen (Nordeuropa, Mitteleuropa, Mittelmeerraum,
Wüstengürtel), jeweils für Land und See getrennt, würfeln jede Runde ihr eigenes
Wetter aus einer jahreszeitlichen Verteilung – und behalten es gerne eine Weile.
Es kann also über Germanien schneien, während in Africa die Hitze steht.

Jeder Wettertyp hat Regelwirkung; **klar** und **bewölkt** sind die beiden, die
absichtlich nichts tun, damit die anderen etwas bedeuten:

| Wetter | Bewegung | Erschöpfung | Kampf |
| --- | --- | --- | --- |
| 🌧️ Regen | +1 je Feld | +4 | Kavallerie −15 %, Bogen −30 %, kein Fernkampf-Auftakt |
| 🌊 Sturm (See) | +1 je Feld | +6 | Kavallerie −15 %, Bogen −40 %; **kein Auslaufen aus dem Hafen** |
| ❄️ Schnee | +2 je Feld | +7, Moral −3 | Kavallerie und Bogen −20 % |
| 🌫️ Nebel | – | – | Bogen −20 %, kein Fernkampf-Auftakt |
| 🔥 Gluthitze | +1 je Feld | +9 | Legionäre −8 % |
| 🌪️ Sandsturm | +2 je Feld | +7, Moral −2 | Bogen −50 %, kein Fernkampf-Auftakt |

In einer eigenen Stadt zehrt das Wetter nur zu 40 %. Die KI kämpft mit
denselben Bedingungen – sie rechnet ihre Angriffe mit demselben Wetter durch
wie du.

Sichtbar ist das Ganze als Regen- und Sturmschlieren, Schneeflocken, Sandkörnern
und Hitzeflimmern über der Karte, dazu Licht, Nebel und ein Dunstschleier je
Wetter. Gezeigt wird immer das Wetter dort, wo die Kamera steht – fährt man im
Winter nach Norden, fängt es an zu schneien. Die Optik lässt sich in den
Einstellungen abschalten; die Regeln gelten weiter.

## Startbildschirm

Das Menü führt ins Spiel, zu den **Einstellungen** (Ton, Kampfvorschau,
Marschgeschwindigkeit, Kartensicht beim Start, Verhalten der Gegner,
Wettereffekte, Bildwechsel)
und zu den Spielregeln. Alle Einstellungen wirken sofort und werden im Browser
gespeichert; die KI-Haltung legt fest, wie sicher sich die KI ihres Sieges sein
muss, bevor sie einen Kampf überhaupt eingeht.

Im Hintergrund läuft eine **Chronik der römischen Republik** in acht Bildern –
von der Vertreibung der Könige 509 v. Chr. über Hannibals Alpenübergang und den
Fall Karthagos bis Actium 31 v. Chr. Die Bilder sind vollständig als SVG
gezeichnet (keine Bilddateien, funktioniert offline) und lassen sich mit ‹ › oder
den Punkten durchblättern.

## Bedienung

- **Armee bewegen**: anklicken, dann ein grün markiertes Feld (freie Bewegung)
  oder ein rot markiertes Feld (Angriff) wählen. Die Armee marschiert sichtbar
  die gefundene Route entlang.
- **Kontrollzonen**: Jede Armee hält die vier Felder um sich herum. Orange
  markiert heißt: Der Feind hält dieses Feld. Hineinzuziehen kostet 2
  Bewegungspunkte extra, und aus einem gehaltenen Feld heraus geht es nur ins
  Freie oder in den Angriff – seitlich an einer Armee vorbeizuschleichen ist
  nicht möglich. Eine Flotte hält Wasserfelder, ein Landheer Landfelder.
- **Kampfvorschau**: Vor jedem Angriff öffnet sich eine Vorschau mit Siegchance,
  erwarteten Verlusten auf beiden Seiten und allen Modifikatoren (Gelände,
  Stadtmauer, Landung vom Meer). „Abbrechen" lässt die Armee unverändert
  stehen. Die Schätzung entsteht aus 60 durchgerechneten Schlachten und
  verändert den späteren echten Kampf nicht.
- **Schiffe**: In einer eigenen Stadt **mit Hafen** kann eine Armee für 250 Gold
  **in See stechen** – ohne Hafen geht sie nirgends an Bord, auch nicht in
  einer Stadt direkt am Wasser. Auf dem Wasser hat sie 15 Bewegungspunkte; gelb
  markierte Felder sind Landungen und beenden die Fahrt. Angriffe direkt vom
  Schiff kosten 30 % Angriffskraft, auf offener See verteidigt es sich 25 %
  schlechter. Nur so sind die Inseln (Caralis, Rhodos, Knossos) zu erreichen.
- **Schlachtberichte**: Nach jedem Kampf öffnet sich ein Bericht mit Verlusten
  pro Einheitentyp, Geländevorteil und Rundenverlauf. Ältere Kämpfe lassen sich
  jederzeit über die Einträge in der Ereignisliste wieder öffnen (Esc schließt).
- **Taktische Sicht** (🗺 oben rechts): schaltet die Karte in die Farben der
  Fraktionen um. Jedes begehbare Feld nimmt die Farbe der Fraktion an, deren
  Siedlung ihm am nächsten liegt; Gebirge bleiben dunkel, Wälder, Straßen und
  Requisiten treten zurück, das Relief bleibt. Damit ist auf einen Blick zu
  sehen, wer wo steht und wo die Grenzen verlaufen.
- **Gelände ansehen**: Ein Klick auf ein beliebiges Feld zeigt in der
  Seitenleiste Geländeart, Bewegungskosten, Verteidigungsbonus, Höhe über dem
  Meer und die geografische Lage – dazu, was auf dem Feld steht.
- **Seitenleiste**: drei Reiter – **Auswahl**, **Fraktionen**, **Ereignisse**.
  Es liegt immer nur einer offen; wer etwas anklickt, landet von selbst auf der
  Auswahl, und neue Ereignisse melden sich mit einer Zahl am Reiter. Das
  Protokoll führt Schlachten, Eroberungen und Jahreszeiten aller Fraktionen,
  aber Rekrutierung, Straßen und Häfen nur für die eigene – sonst geht die
  eigene Schlacht in der Buchhaltung von neun KI-Fraktionen unter.
- **Armeen sind an ihrer Größe zu erkennen**: das Lager wächst mit der Stärke,
  von einem einzelnen Zelt bei einer Handvoll Männern bis zum Zeltring mit
  Führungszelt bei einem vollen Heer.
- **Karte verschieben**: Ziehen mit Maus oder einem Finger, **Mausrad gedrückt
  halten** und die Sicht frei bewegen (das geht auch dort, wo unter dem Zeiger
  kein Boden liegt), Pfeiltasten/WASD oder das Steuerkreuz unten links.
  **Umschalt + Mausrad gedrückt** dreht und neigt die Kamera.
- **Drehen und Zoomen**: Auf dem Touchscreen zwei Finger – auseinander/zusammen
  zoomt, Verdrehen dreht die Karte. Am Rechner: Mausrad zoomt, Umschalt+Mausrad
  bzw. **Q**/**E** dreht. Die Knöpfe ↺ ↻ drehen, ⌂ setzt die Ansicht zurück.
  Nach dem Drehen bleiben Steuerkreuz und Pfeiltasten bildschirmbezogen.
- **Städte**: anklicken, um Einheiten zu rekrutieren und Garnisonen zu
  Feldarmeen auszuheben. Welche drei Einheiten zur Wahl stehen, hängt von der
  Fraktion ab, der die Stadt gehört – Rom hebt Legionäre aus, ein dakisches
  Dorf Falxträger.
- **Erfahrung**: Jede Armee sammelt im Feld Erfahrung – ein Stern nach etwa
  zwei Schlachten, drei Sterne nach rund sieben. Jeder Stern bringt **+12 %
  Kampfkraft**, und die Sterne stehen im Armee-Panel, auf der Karte am
  Truppenzähler und in Bericht und Kampfvorschau. Frisch ausgehobene Armeen
  beginnen bei null; nimmt eine Armee Rekruten auf, verdünnt das ihre Erfahrung
  im Verhältnis der Männer. Löst sie sich in eine Garnison auf, ist die
  Erfahrung verloren.
- **Moral und Erschöpfung**: Jede Armee führt beide Werte mit; sie gehen direkt
  in die Kampfkraft ein. Märsche und Schlachten zehren, Rasten erholt – am
  schnellsten in einer eigenen Stadt. Beides steht im Armee-Panel.
- **Armee auflösen**: Steht eine Armee in einer eigenen Stadt, kann sie sich
  auflösen; ihre Soldaten treten der Garnison bei.
- **Befestigungen in drei Stufen**: **Holzpalisade** (200 Gold, 3 Runden,
  +30 % Verteidigung), **Große Holzpalisade** (450 Gold, 4 Runden, +60 %) und
  **Steinmauer** (900 Gold, 6 Runden, +100 %). Gekauft wird immer nur die
  nächste Stufe, und immer nur eine zur Zeit. Hauptstädte starten mit der
  Großen Holzpalisade – die Steinmauer bleibt auch ihnen zu bauen. Jede Stufe
  sieht anders aus: angespitzte Stämme, hölzerner Wehrgang mit Türmen,
  Quadermauer mit Rundtürmen.
- **Hafenbau**: Ohne Hafen kann in einer Stadt keine Armee an Bord gehen –
  am Meer zu liegen genügt nicht. Der Hafen kostet **300 Gold** und **3
  Runden**; Hauptstädte und Große Städte am Meer bringen ihn mit, jede andere
  Küstenstadt muss ihn bauen. Erobert man eine Stadt, übernimmt man ihren
  Hafen. Am Ufer steht dann ein Steg mit vertäutem Boot, damit man von weitem
  sieht, wo eine Flotte auslaufen kann.
- **Straßenbau**: Jede eigene Stadt bietet die nächstgelegenen eigenen Orte
  an, zu denen noch keine Straße führt – mit Preis (30 Gold je Feld), Länge und
  Bauzeit. Auf fertiger Straße kostet jedes Feld nur **einen** Bewegungspunkt,
  egal ob Wald, Hügel oder Wüste darunter liegt; das Wetter kostet weiter
  extra. Gebaut wird eine Verbindung als Ganzes und immer nur eine je Stadt;
  neue Straßen legen sich an das bestehende Netz an. Zu Spielbeginn hängen die
  Städte jeder Fraktion an ihrer Hauptstadt, die Dörfer noch nicht. Fällt einer
  der beiden Orte an den Feind, wird der Bau abgebrochen.
- **Rückgängig** (↩ oben rechts): macht die letzte Aktion zurück – Zug,
  Rekrutierung, Mauer- oder Straßenkauf, Auflösen oder ganzen Rundenwechsel.
- **Bewegtes Meer**: Über die Wasserfläche läuft eine Dünung. In den
  Einstellungen abschaltbar, wenn das Gerät die Bilder lieber spart.
- **Ton**: 🔊 schaltet die Klänge um (Marsch, Schlacht, Rekrutierung, Mauerbau,
  Rundenwechsel …). Alle Geräusche werden zur Laufzeit synthetisiert – keine
  Audiodateien, funktioniert offline.
- **Vollbildmodus**: ist der Normalfall – das Spiel geht beim Start hinein.
  Reißt eine Wischgeste oder die umgebende Seite das Vollbild ab, stellt der
  nächste Klick oder Tastendruck es wieder her (früher geht es nicht: ein
  Browser gewährt Vollbild nur innerhalb einer Nutzergeste). Wer per ⛶ oder
  Esc herausgeht, bleibt draußen, bis er ⛶ erneut drückt.
  In einer eingebetteten Ansicht (iframe) verbietet der Browser Vollbild per
  Permissions-Policy; das Spiel sagt das dann und der Knopf ⇥ blendet
  stattdessen die Seitenleiste aus, um der Karte den Platz zu geben.
- „Runde beenden" lässt die KI-Fraktionen ziehen, kassiert Einkommen und lässt
  Garnisonen langsam nachwachsen.

## Spielprinzip

- **Alle zehn Fraktionen sind spielbar.** Nach „Neues Spiel starten" kommt ein
  eigener Auswahlbildschirm: links die Fraktionen mit ihrer Schwierigkeit,
  rechts Hauptstadt, Siedlungen, Startheer, die drei eigenen Einheiten sowie
  Stärke und Schwäche – und im Hintergrund ein Bild, das mit der Auswahl
  wechselt: der Tempel und der Adler für Rom, die Hafenmauer mit Elefant für
  Karthago, der Herkynische Wald für die Germanen, Pyramiden und Palmen für die
  Ptolemäer. Wer nicht gewählt wird, wird von der KI geführt.
- Zur Wahl stehen **Rom**, **Karthago**, die **Gallier**, die **Griechen**, die
  **Germanen**, die **Britannier**, die **Iberer**, die **Daker**, die
  **Seleukiden** und die **Ptolemäer** – verteilt über Europa, das Mittelmeer,
  Nordafrika und den Vorderen Orient. Alle beginnen mit demselben Startgold und
  (bis auf die zwei Heere der Seleukiden) demselben Heer: der Unterschied liegt
  in der Lage, den Nachbarn und den eigenen Einheiten.
- **Jede Fraktion hat ihre eigenen Einheiten.** Drei Waffengattungen gibt es
  überall – Fußvolk, Reiterei, Fernkampf –, aber jede Fraktion füllt sie anders
  aus, mit eigenem Namen, eigenen Werten und eigenem Preis:

  | Fraktion | Fußvolk | Reiterei | Fernkampf |
  | --- | --- | --- | --- |
  | Rom | Legionär (Schild und Gladius, sehr zäh) | Equites | Veliten |
  | Karthago | Libysche Speerträger | Numidische Reiter (schnellste Reiterei) | Balearische Schleuderer |
  | Gallier | Schwertkämpfer (harter Angriff) | Edle Reiter | Bogenschützen |
  | Griechen | Hopliten (beste Verteidigung) | Thessalische Reiter | Peltasten |
  | Germanen | Speerträger | Gefolgschaftsreiter | Wurfspeerträger |
  | Britannier | Keltenkrieger | Streitwagen (härtester Angriff) | Schleuderer |
  | Iberer | Scutarii | Iberische Reiter | Caetrati |
  | Daker | Falxträger (Sichelschwert, roher Angriff) | Sarmatische Panzerreiter | Dakische Bogenschützen |
  | Seleukiden | Silberschilde (Phalanx) | Kriegselefanten (statt Reiterei) | Kretische Bogenschützen |
  | Ptolemäer | Machimoi (billige Masse) | Ptolemäische Reiter | Nubische Bogenschützen (beste Bogen) |

  Im Kampf rechnet jede Seite mit ihren eigenen Werten – ein Legionär hält
  anders stand als ein Falxträger, auch wenn beide „Fußvolk" heißen.
- **Gallien und die Seleukiden beginnen mit zwei Heeren** statt einem: beide
  stehen zwischen mehreren Nachbarn, und ein einziges Heer kann nur an einer
  Front stehen. Alle anderen führen ein Heer von 540 Mann.
- Jede Fraktion stellt ihr Heer auch anders auf: Gallier und Germanen setzen auf
  die Masse des Fußvolks, die Britannier auf den Streitwagen, die Iberer auf
  Schleuderer und Speerwerfer, die Daker auf Falx und Panzerreiter. Rom,
  Karthago und die Griechen kämpfen ausgewogen.
- Die **Britannier** sitzen auf ihrer Insel und kommen ohne Schiffe nirgendwo
  hin – ihre erste Landung an der gallischen Küste fällt meist in die ersten
  Spielrunden.
- Die **Germanen** sitzen zwischen Rhein, Nordsee und Elbe im Herkynischen
  Wald, der jeden Vormarsch verlangsamt. Sie führen keine stehende Armee,
  sondern einen fußlastigen Heerhaufen.
- Die **Seleukiden** halten Syrien, Kilikien und das Zweistromland um
  Antiochia. Als größtes Diadochenreich stellen sie zwei Heere auf – sie
  brauchen beide, denn sie stehen zwischen Griechen und Ptolemäern.
- Die **Ptolemäer** sitzen auf Ägypten, Zypern, Koilesyrien und der Kyrenaika.
  Das Niltal trägt viel Fußvolk, ihre nubischen Bogen sind die besten der
  Karte, an Reiterei fehlt es ihnen.
- Die **Daker** halten die Karpaten um Sarmizegetusa – Bergland, das sich gut
  verteidigen lässt, mit der Donau als Sprungbrett nach Süden.
- **71 Siedlungen in drei Größen**: **Große Stadt** (viel Bevölkerung, starke
  Garnison, 1,7-faches Grundeinkommen), **Stadt** (Normalmaß) und **Dorf**
  (klein, halbes Grundeinkommen – leicht zu nehmen und gute Sprungbretter).
  22 davon gehören niemandem und sind frei zu erobern – von Olisipo bis
  Chersonesos. Sizilien, Sardinien, Kreta, Zypern, Rhodos, die Balearen und
  Britannien sind nur mit Schiffen erreichbar.
- **Gelände**: Ebene, Wald und Hügel wie bisher, dazu die **Wüste** – die
  Sahara und das arabische Binnenland sind zäh zu durchqueren und halten den
  Krieg in Afrika an der Küste.
- Die KI rechnet vor jedem Angriff dieselbe Vorschau wie du und lässt sich auf
  einen Kampf nur ein, wenn sie ihn voraussichtlich gewinnt.
- Sieg: alle gegnerischen Fraktionen ausschalten. Niederlage: die eigene
  Fraktion verliert alle Städte und Armeen.

## Struktur

- `js/geodata.js` – die Geografie in Grad: Küstenlinien, Inseln, Binnenmeere,
  Meerengen, Gebirgsrücken und Wälder, dazu die Umrechnung Grad ↔ Feld
- `js/data.js` – Einheiten-, Gelände- und Fraktionsdefinitionen samt
  Fraktionsprofilen für die Auswahl, Siedlungen mit ihren echten Koordinaten
- `js/factionart.js` – die SVG-Bilder des Auswahlbildschirms, eines je Fraktion
- `js/mapgen.js` / `js/state.js` – Rasterung der Geografie zu Gelände,
  Spielzustand
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
- `js/weather.js` – Kalender, Klimazonen, Wettertypen und ihre Regelwirkung
- `js/settings.js` – Einstellungen: Schema, Speicherung, Einstellungsfenster
- `js/chronicle.js` – die acht Chronikbilder als SVG-Silhouetten
- `js/ui.js`, `js/input.js`, `js/main.js` – Seitenleiste, Eingabe, Startbildschirm, Bootstrap

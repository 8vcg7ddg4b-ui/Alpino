# Pax Aeterna – Rundenstrategie in 3D

Ein rundenbasiertes Strategiespiel im Stil von *Total War: Rome*. Die Kampagnenkarte
umfasst Europa, das Mittelmeer und Nordafrika und wird in echtem 3D (Three.js/WebGL)
aus einer isometrischen Kameraperspektive dargestellt; Bewegung, Seefahrt,
Belagerungen und Kämpfe finden direkt auf dieser Karte statt – es gibt keinen
separaten Schlachtbildschirm.

Die Kampagne spielt auf einer Karte, die **auf dem Tisch im eigenen Feldherrnzelt
liegt**: Holzrahmen ringsum, Zeltbahnen darüber, Fahnen in den Farben der
gewählten Fraktion an den Wänden – mit ihrem **Wappen** darauf: der Legionsadler
für Rom, das Tanit-Zeichen für Karthago, die Eule Athenes für die Griechen, der
Anker der Seleukiden, die Tamga der Sarmaten. Dieselben Zeichen stehen in der
Fraktionsliste und im Auswahlbildschirm. Wer die Kamera tief stellt, sieht das Zelt,
wer von oben schaut, sieht die Karte.

Das Zelt hat einen **Ausgang**: an einer Seite sind die Bahnen zurückgeschlagen
und mit Stricken an zwei Pfosten gebunden, dahinter der Himmel, der Boden des
Lagers und die Spitzen der Nachbarzelte. Hinaus geht es nicht – der Feldzug
wird an diesem Tisch geführt, und die Kamera bleibt im Zelt und über der Karte.

Das Wetter gehört zur Karte, nicht zum Zelt: Regen und Schnee fallen als
flache Schicht über der Tischplatte und werden an ihren Kanten beschnitten.

Der Feldzug beginnt deshalb auch nicht auf der Karte, sondern im Zelt: die
**Eröffnungsansicht** steht weit genug zurück, dass der ganze Tisch mit der
Karte darauf im Bild liegt und dahinter der Thron. Erst wenn die Ansprache
weggeklickt ist, geht die Kamera hinunter auf die eigene Hauptstadt.

Dem Betrachter gegenüber steht der **Feldherrnsitz**: der Thron auf seinem
Podest, links und rechts die Feldzeichen mit dem Wappen, daneben zwei Stücke
Ausstattung, die zur Fraktion passen. Rom hat den kurulischen Stuhl aus
Elfenbein zwischen Schildbock und Speerbock, Karthago Elefantenzähne und
Amphoren, die Ptolemäer einen steinernen Sitz mit Palme, die Germanen einen
geschnitzten Hochsitz mit Fellen. Und bevor der erste Zug fällt, meldet sich
der Erste Offizier: **„Ich grüße dich, Herr. Lass uns die Schlachtkarte
betrachten."**

Die Karte ist **echte Geografie**: Küstenlinien, Gebirgszüge und Siedlungen sind in
Längen- und Breitengraden hinterlegt (`js/geodata.js`) und werden auf ein Raster von
94 × 52 Feldern gerastert – ein Feld entspricht rund 55 km. Roma liegt auf 12,5° O /
41,9° N, weil Rom dort liegt. Der Ausschnitt reicht vom Atlantik bis auf die
**iranische Hochebene** (10,5° W bis 52,3° O): Babylon, Susa und Ekbatana liegen
darauf, dazu das Kaspische Meer, der Nordzipfel des Persischen Golfs, Zagros und
Elburs sowie Euphrat und Tigris.

Das Spiel läuft wahlweise **im Browser** oder als **eigenständige Desktop-Anwendung**
(Windows/macOS/Linux) mit eigenem Fenster, eigenem Icon und ohne sichtbaren Browser.

## Als Desktop-Programm starten

```bash
npm install      # einmalig: lädt Electron
npm run desktop  # startet Pax Aeterna als Desktop-App
```

### Installationsdatei bauen

Erzeugt ein weitergebbares Installationspaket im Ordner `dist/`. Gebaut wird immer
für das System, auf dem der Befehl läuft – für eine `.exe` also unter Windows:

```bash
npm run dist:win     # Windows: Pax Aeterna Setup.exe (NSIS-Installer)
npm run dist:mac     # macOS:   Pax Aeterna.dmg
npm run dist:linux   # Linux:   Pax Aeterna.AppImage
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

**Eine Runde ist ein Monat.** Drei Monate sind eine Jahreszeit, vier
Jahreszeiten ein Jahr – ein Feldzugsjahr sind also zwölf Runden. Das Spiel
beginnt im **Martius 264 v. Chr.**, dem Jahr, in dem der Erste Punische Krieg
ausbricht. Die Monate tragen ihre römischen Namen, und das Jahr fängt wie
damals im März an; Quintilis und Sextilis heißen noch nach ihrer Zahl, denn
Caesar und Augustus, nach denen sie später benannt werden, sind noch nicht
geboren. Die Kopfzeile zeigt Monat und Jahr (`🌱 Aprilis 264 v. Chr.`) – weil
der Monat mit jeder Runde wechselt, sagt er von selbst, wie weit die Jahreszeit
ist; Jahreszeit und Rundenzahl stehen im Tooltip. Daneben das Wetter dort, wo
die Kamera gerade hinsieht.

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

Unter dem Menü steht die **Spielversion**; sie kommt aus `GAME_VERSION` in
`js/data.js` und wird mit `package.json` gleichgehalten, damit Anzeige und
Auslieferung nicht auseinanderlaufen.

Sobald der Spieler die erste Taste drückt, setzt die **Titelmusik** ein – ein
Stück in d-Moll, das sich Takt für Takt selbst weiterschreibt: Bass und Blech
tragen die Harmonie, ein Streicherteppich hält sie zusammen, die Kriegstrommel
gibt den Schritt, und im zweiten Durchgang kommt die Melodie dazu. Sie läuft
durch die Fraktionswahl. Früher kann sie nicht anfangen: ein Browser lässt Ton
erst nach einer echten Geste des Spielers zu.

**Mit dem Betreten des Zeltes** übernimmt die Musik der eigenen Fraktion. Jede
der sechzehn hat ihr eigenes Stück – wieder keine Aufnahme, sondern eine
Partitur (`js/anthems.js`), die der Klangsatz Takt für Takt spielt. Der
Unterschied steckt in der Leiter und in der Besetzung: der **Hidschas** mit
seiner übermäßigen Sekunde trägt Karthago, Numidien, die Parther, die
Seleukiden und Ägypten; **Mixolydisch** ohne Leitton den keltischen Norden;
**Nikriz** den Balkan; eine **fünftönige** Leiter die Steppe der Sarmaten; und
was die Griechen selbst dorisch nannten, klingt für uns phrygisch. Dazu drei
Stimmen, die jeweils die Melodie führen können – Blech (Cornu, Carnyx, Lure),
Doppelrohrblatt (Aulos, Duduk, Zurna) oder gezupfte Saite (Kithara, Laute,
Santur, Harfe) – und zwei Trommeln: die Kriegstrommel für den Marsch, die
Rahmentrommel für den Süden und Osten. Das Tempo reicht von 58 (Armenien: eine
Duduk über einem liegenden Ton, ohne jedes Schlagwerk) bis 112 (Numidien im
Reitertempo), und Daker und Illyrer zählen im Siebentakt. Jedes Stück läuft
abwechselnd einen lauten Durchgang mit Melodie und einen leisen ohne.

Das Menü führt ins Spiel, zu den **Einstellungen** (Ton, Kampfvorschau,
Marschgeschwindigkeit, Kartensicht beim Start, Verhalten der Gegner,
Wettereffekte, Titelmusik, Bildwechsel)
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
- **Vier Schiffsarten, bis zu drei je Fraktion**: die **Quinquereme** mit Turm
  und Enterbrücke (50/52, 220 Gold) – schwer und im Rammstoß überlegen; die
  **Triere**, das Arbeitspferd jeder Flotte (46/45, 190 Gold) – wendig genug zum
  Rammen, stark genug für die Linie; der illyrische **Lembos** (44/36, 150 Gold)
  – schnell und billig, aber dünnwandig; und das **Segelschiff** mit
  hochbordigem Eichenrumpf und Ledersegel (36/54, 195 Gold) – schwer zu rammen,
  schwach im Angriff. Welche eine Fraktion bauen kann, sagt ihre Küste: Rom,
  Karthago, Pontus und die Ptolemäer haben alle drei Ruderbauarten, die Griechen
  ebenso (mit der Triere als Hauptbauart), Illyrer, Iberer und Numidien den
  Lembos und die Triere, die Stämme des Nordens das Segelschiff und den Lembos.
  Jede Bauart hat ihr eigenes Modell auf der Karte.
- **Flotten bauen**: Jede eigene Stadt mit Hafen hat eine Werft, und die
  Werft baut, was man ihr sagt: für jede Bauart der Fraktion ein eigener Knopf
  mit Preis und Eigenart, **60 Schiffe** je Bautrupp. Sie laufen als eigene
  **Flotte** aus – ein Verband, der das Meer hält, statt ein Heer überzusetzen.
  **Die Bauart bleibt an der Flotte**: sie kämpft und sieht aus wie das, womit
  sie vom Stapel lief, auch wenn die Werft längst etwas anderes baut, und ein
  neuer Bautrupp verstärkt nur ein Geschwader **derselben** Bauart – was
  zusammen fährt, fährt gleich schnell. Eine Flotte fährt 30 Punkte weit,
  geht nie an Land und greift an, was auf dem Wasser fährt.
- **Seeräuber**: Wo Handel fährt, fährt bald auch, wer ihn nimmt. Ab Runde 8
  laufen bis zu **drei Geschwader** aus – dort, wo ein Hafen liegt und keine
  Kriegsflotte kreuzt. Sie fahren die **Hemiolia**, den Anderthalbruderer
  (52/30): das schnellste Schiff der See mit 36 Bewegungspunkten und im offenen
  Kampf das schwächste. Sie sind keine Macht, mit der man verhandelt – kein
  Herrscher, keine Stadt, kein Vertrag, kein Sieg –, sondern das Risiko, das auf
  dem Wasser liegt: sie jagen Heere auf Transportern, gehen einer stärkeren
  Flotte aus dem Weg und legen sich sonst vor den nächsten Hafen. **Solange ein
  Geschwader in Reichweite eines Hafens liegt, trägt jeder Seehandelsweg dorthin
  nur die Hälfte** – die Handelsansicht sagt es mit einer schwarzen Flagge. Wer
  eines versenkt, findet in den Laderäumen bis zu **140 Gold Beute**. Ein
  Geschwader vor der eigenen Küste meldet ein Fenster.
- **Kampf zur See**: Auf dem Wasser zählt das Schiff, nicht der Mann. Fußvolk
  an Bord kämpft mit halber Kraft, Reiterei mit 40 %, Bogenschützen mit 80 % –
  Kriegsschiffe zu voller. 60 Kriegsschiffe versenken deshalb ein
  übergesetztes Heer von 540 Mann (20 % eigene Verluste), 30 reichen dafür
  nicht. Wer eine Landung erwartet, hält seine Flotte davor.
- **Heere vereinigen**: Zieht man ein Heer auf ein eigenes (blau markiertes
  Feld), werden beide eines. Erfahrung, Moral und Erschöpfung mitteln sich nach
  Kopfzahl. Auch die KI legt zusammen, statt mit zwei halben Heeren vor einer
  Stadt zu warten, die keines von beiden nehmen kann.
- **Transportschiffe**: Ein Heer fährt nicht auf seinen Kriegsschiffen – die
  Ruderbänke sind besetzt, und wer rudert, kämpft nicht. In einer eigenen Stadt
  **mit Hafen** wird es für 250 Gold **auf Transporter verladen**: breite,
  bauchige Segler ohne Rammsporn, wie sie sonst Getreide und Öl fahren. Wie
  viele es sind, sagt die Stärke des Heeres – fünfzig Mann samt Gepäck gehen auf
  einen Rumpf, und die Seitenleiste nennt die Zahl. Ohne Hafen geht niemand an
  Bord, auch nicht in einer Stadt direkt am Wasser. Auf dem Wasser hat der
  Geleitzug 30 Bewegungspunkte; gelb markierte Felder sind Landungen und beenden
  die Fahrt. Auf der Karte ist der Unterschied zu sehen: ein Landheer zur See
  ist ein Zug aus drei Transportern, eine Flotte fährt ihre eigene Bauart. Angriffe direkt vom
  Schiff kosten 30 % Angriffskraft, auf offener See verteidigt es sich 25 %
  schlechter. Nur so sind die Inseln (Caralis, Rhodos, Knossos) zu erreichen.
- **Frontbreite**: Eine Schlacht wird an einer Linie geschlagen, nicht als
  Haufen. Höchstens 900 Mann je Seite kommen gleichzeitig ins Gefecht, im Wald
  30 % und in den Hügeln 20 % weniger; wer stürmt, wird zusätzlich von der
  Mauer eingeengt, denn an Tor und Bresche ist kein Platz für ein ganzes Heer.
  Was nicht hineinpasst, steht dahinter und rückt nach, sobald vorne eine Lücke
  entsteht. Übermacht bleibt damit ein Vorteil, ist aber kein Freibrief mehr –
  Vorschau und Bericht schreiben in einer eigenen Zeile hin, wie viele Mann
  überhaupt zum Zug kommen.
- **Meldungen zur eigenen Sache**: Was in der Runde der Gegner mit der eigenen
  Fraktion geschehen ist, kommt der Reihe nach in ein Fenster – jede Schlacht
  (Feldschlacht, Belagerung, **Seeschlacht**), jeder verlorene und gewonnene
  Ort, jedes vernichtete eigene Heer, dazu die Herolde der Diplomatie. Hinter
  einer Schlacht steht ein Knopf zum vollen Bericht. Vorher stand davon nur die
  letzte Schlacht in einem Fenster und alles andere im Protokoll – wer eine
  Stadt verlor, erfuhr es erst, wenn er hinsah.
- **Seeschlachten**: Zwei Flotten auf offener See fechten wie zwei Heere, nur
  zählt zur See allein, was das Schiff kann: Landtruppen an Bord kämpfen mit
  halber Kraft und verlieren gegen eine Kriegsflotte fast immer. Vorschau und
  Bericht weisen den Kampf als Seegefecht aus, und der Zusammenstoß auf dem
  Wasser wirft Gischt statt Funken.
- **Schlachtberichte**: Nach jedem Kampf öffnet sich ein Bericht mit Verlusten
  pro Einheitentyp, Geländevorteil und Rundenverlauf. Ältere Kämpfe lassen sich
  jederzeit über die Einträge in der Ereignisliste wieder öffnen (Esc schließt).
- **Taktische Sicht** (🗺 oben rechts): schaltet die Karte in die Farben der
  Fraktionen um. Jedes begehbare Feld nimmt die Farbe der Fraktion an, deren
  Siedlung ihm am nächsten liegt; Gebirge bleiben dunkel, Wälder und Requisiten
  treten zurück, das Relief bleibt. **Die Straßen bleiben sichtbar** – sie
  gehören zum politischen Bild, denn sie sagen, wie schnell wo ein Heer steht. Damit ist auf einen Blick zu
  sehen, wer wo steht und wo die Grenzen verlaufen.
- **Gelände ansehen**: Ein Klick auf ein beliebiges Feld zeigt in der
  Seitenleiste Geländeart, Bewegungskosten, Verteidigungsbonus, Höhe über dem
  Meer und die geografische Lage – dazu, was auf dem Feld steht.
- **Seitenleiste**: drei Reiter – **Auswahl**, **Fraktionen**, **Ereignisse**.
  Es liegt immer nur einer offen; wer etwas anklickt, landet von selbst auf der
  Auswahl, und neue Ereignisse melden sich mit einer Zahl am Reiter.
- **Das Protokoll zeigt standardmäßig nur eigene Ereignisse**: die eigenen
  Schlachten, Eroberungen, Aushebungen, Straßen und Häfen – dazu Jahreszeit und
  Wetter, die für alle gelten. Zwölf Fraktionen führen zwölf Kriege; ungefiltert
  geht der eigene darin unter. Der Knopf **Alle Fraktionen** über dem Protokoll
  zeigt bei Bedarf auch die Kriege der anderen.
- **Armeen sind an ihrer Größe zu erkennen**: das Lager wächst mit der Stärke,
  von einem einzelnen Zelt bei einer Handvoll Männern bis zum Zeltring mit
  Führungszelt bei einem vollen Heer.
- **Karte verschieben**: Ziehen mit Maus oder einem Finger, Pfeiltasten/WASD
  oder das Steuerkreuz unten links. **Umschalt + Mausrad gedrückt** verschiebt
  ebenfalls – auch dort, wo unter dem Zeiger kein Boden liegt und das Ziehen
  deshalb nicht greift.
- **Kamera schwenken**: **Mausrad gedrückt halten** – seitlich dreht die Kamera
  um die Bildmitte, nach oben und unten neigt sie sich.
- **Feld nachschlagen**: **Rechtsklick** auf ein beliebiges Feld öffnet ein
  Fenster am Zeiger mit Stadt, Armee und Gelände – Garnison und Stadtwache,
  Stärke, Moral und Erfahrung der Armee, Bewegungskosten, Verteidigung, Höhe,
  Lage und Wetter. Es ändert nichts: keine Auswahl, keine Bewegung. Esc oder
  ein Klick daneben schließt es wieder.
- **Drehen und Zoomen**: Auf dem Touchscreen zwei Finger – auseinander/zusammen
  zoomt, Verdrehen dreht die Karte. Am Rechner: Mausrad zoomt, Umschalt+Mausrad
  bzw. **Q**/**E** dreht. Die Knöpfe ↺ ↻ drehen; **⌂** setzt Blickwinkel,
  Neigung und Zoom zurück und holt die eigene **Hauptstadt** in die Mitte
  (ist sie gefallen, die nächste eigene Stadt, sonst das letzte Heer).
  Nach dem Drehen bleiben Steuerkreuz und Pfeiltasten bildschirmbezogen.
- **Städte**: anklicken, um Einheiten zu rekrutieren und Garnisonen zu
  Feldarmeen auszuheben. Welche drei Einheiten zur Wahl stehen, hängt von der
  Fraktion ab, der die Stadt gehört – Rom hebt Legionäre aus, ein dakisches
  Dorf Falxträger.
- **Stadtwache**: Jede Siedlung hat von sich aus eine Wache – die
  Standardgarnison, die niemand aushebt und die nie ausrückt. Ihre Sollstärke
  ist ein Sechzehntel der Bevölkerung (Roma 400 Mann, ein Dorf 88), und sie
  stellt sich nach jedem Sturm langsam wieder her: etwa 5 % der Sollstärke je
  Runde. Auf der Mauer taugt sie (Verteidigung 8), im Angriff wäre sie nichts –
  weshalb sie auch nicht mitmarschieren kann. Wer ein Heer aufstellen will,
  hebt dafür Truppen aus; die Wache bleibt.
- **Armeen in der Stadt verstärken**: Steht eine eigene Armee in einer eigenen
  Stadt, kann sie dort direkt Truppen kaufen – je 100 Mann, die sofort in die
  Armee eintreten, statt den Umweg über die Garnison zu nehmen. Wie bei jeder
  Aushebung verdünnen die Neuen die Erfahrung der Armee.
- **Erfahrung**: Jede Armee sammelt im Feld Erfahrung – ein Stern nach etwa
  zwei Schlachten, drei Sterne nach rund sieben. Jeder Stern bringt **+12 %
  Kampfkraft**, und die Sterne stehen im Armee-Panel, auf der Karte am
  Truppenzähler und in Bericht und Kampfvorschau. Frisch ausgehobene Armeen
  beginnen bei null; nimmt eine Armee Rekruten auf, verdünnt das ihre Erfahrung
  im Verhältnis der Männer. Löst sie sich in eine Garnison auf, ist die
  Erfahrung verloren.
- **Moral und Erschöpfung**: Jede Armee führt beide Werte mit; sie gehen direkt
  in die Kampfkraft ein. Beides steht im Armee-Panel. Erschöpfung wird je
  Bewegungspunkt berechnet (1,2), nicht je Feld – auf der Straße kommt ein Heer
  für denselben Preis weiter als querfeldein. Ein voller Tagesmarsch kostet
  damit 22, eine Schlacht weitere 8. Gerastet wird im Verhältnis der Bewegung,
  die stehen geblieben ist: −8 je Runde im Feld, −15 in einer eigenen Stadt,
  jeweils anteilig. Ein kurzer Marsch trägt sich so selbst, zwei Gewaltmärsche
  hintereinander laugen ein Heer aus. Die Zahlen wirken klein, wiegen aber
  schwer: gegen einen frischen, gleich starken Gegner gewinnt ein ausgeruhtes
  Heer 86 von 100 Schlachten, nach einem halben Tagesmarsch 65, nach einem
  vollen 37 und nach zweien 3.
- **Armee auflösen**: Steht eine Armee in einer eigenen Stadt, kann sie sich
  auflösen; ihre Soldaten treten der Garnison bei.
- **Befestigungen in drei Stufen** (ein **Dorf** legt seinen Wall als Ring um
  die Häuser, eine Stadt baut geradeaus und mit Ecken): **Holzpalisade** (200 Gold, 3 Runden,
  +30 % Verteidigung), **Große Holzpalisade** (450 Gold, 4 Runden, +60 %) und
  **Steinmauer** (900 Gold, 6 Runden, +100 %). Gekauft wird immer nur die
  nächste Stufe, und immer nur eine zur Zeit. **Kein Ort steht offen in der
  Landschaft**: jede Siedlung einer Fraktion beginnt mit der Holzpalisade,
  Hauptstädte mit der Großen – die Steinmauer bleibt auch ihnen zu bauen. Die
  **unabhängigen Städte** haben ebenfalls die Große: sie haben niemanden über
  sich und müssen sich selbst verteidigen. Ihre Dörfer kommen wie alle anderen
  mit der einfachen aus. Jede Stufe
  sieht anders aus: angespitzte Stämme, hölzerner Wehrgang mit Türmen,
  Quadermauer mit Rundtürmen.
- **Hafenbau**: Ohne Hafen kann in einer Stadt keine Armee an Bord gehen –
  am Meer zu liegen genügt nicht. Der Hafen kostet **300 Gold** und **3
  Runden**; Hauptstädte und Große Städte am Meer bringen ihn mit, jede andere
  Küstenstadt muss ihn bauen. Erobert man eine Stadt, übernimmt man ihren
  Hafen. Am Ufer steht dann ein Steg mit vertäutem Boot, damit man von weitem
  sieht, wo eine Flotte auslaufen kann.
- **Herrscher und Diplomatie**: Jede Fraktion wird von einem Herrscher geführt,
  und wer eine Fraktion wählt, ist dieser Mann – der Herold im Zelt spricht ihn
  mit seinem Namen an. Drei Eigenschaften von 0 bis 100 machen ihn aus:
  **Angriffslust** (wie bereitwillig er Krieg führt), **Ehre** (wie verlässlich
  er ein Wort hält) und **Habgier** (wie schwer Gold für ihn wiegt). Sie stehen
  im Fraktionsschirm, bevor die erste Entscheidung fällt, und sie wirken:
  ein angriffslustiger Herrscher lässt wenig Gold in der Truhe und hebt aus, ein
  zurückhaltender baut Mauern, ein habgieriger greift nach jedem Handelsweg.
  **Der Normalfall ist der Friede.** Niemand beginnt einen Feldzug im Krieg mit
  aller Welt; Kriege werden erklärt, und wer sie erklärt, entscheidet sein
  Charakter. Jede Runde wägt jeder Herrscher seine Nachbarn ab: Angriffslust
  zieht ihn zum Schwert, Ehre hält ihn zurück, und die Gelegenheit – wie schwach
  der andere gerade dasteht, wie nah er sitzt, was zwischen ihnen steht – gibt
  den Ausschlag. Ambigatus (82/46) findet fast immer einen Grund, Orontes
  (34/76) so gut wie nie. Ein frisch geschlossener Friede hält mindestens sechs
  Runden. Erklärt dir jemand den Krieg, sagt es dir ein **Herold in einem
  eigenen Fenster**, mit Namen, Titel und Grund; was zwischen anderen geschieht,
  steht im Protokoll – aber nur, wenn du beide kennst.
  **Bekannte und unbekannte Reiche** sind getrennt: zu Beginn kennt jede
  Fraktion nur ihre Nachbarn (Rom weiß von Karthago, Numidien und den Illyrern,
  nicht von den Parthern). Wer einem fremden Heer oder einer fremden Stadt auf
  acht Felder nahe kommt, lernt sie kennen. Mit einem Unbekannten lässt sich
  nicht verhandeln, und er erklärt auch keinen Krieg – im Diplomatiefenster
  stehen sie hinter einem eigenen Reiter, mit nichts als einer Himmelsrichtung.
  Der Knopf 🕊 öffnet die **Diplomatie**: zwei Reiter (**Bekannt** und
  **Unbekannt**), für jeden bekannten Herrscher eine Karte mit
  seinen Eigenschaften, seinem Ansehen von dir, wie lange Krieg oder Friede
  schon dauert, und dem, was zu tun ist –
  **Frieden anbieten**, **Frieden mit Tribut** (der Knopf nennt die Summe, die
  gerade dieser Mann verlangt: Orontes von Armenien nimmt sofort an, Segimer
  will 750 Gold, mancher ist für kein Gold zu haben), **Geschenk senden** oder,
  im Frieden, **Krieg erklären**. Ein Friede sperrt beiden Seiten die Waffen:
  die Heere gehen aneinander vorbei, ihre Kontrollzonen greifen nicht mehr, und
  Städte lassen sich nicht angreifen. Ansehen bewegt sich mit dem, was geschieht –
  eine Schlacht −7, eine genommene Stadt −22, ein Geschenk +12, ein gehaltener
  Friede +1 je Runde.
- **Bedenkzeit**: Diplomatie ist kein Knopf, den man zweimal drückt. Jede
  Handlung legt eine Frist auf das Verhältnis, und erst wenn sie abgelaufen ist,
  steht wieder alles offen: nach einer **Kriegserklärung acht Runden kein
  Frieden** – für keine Seite, auch nicht zwischen zwei Herrschern, die es beide
  wollten –, nach einem **Friedensschluss sechs Runden keine Kriegserklärung**,
  nach einem **abgewiesenen Gesandten vier Runden kein neues Angebot**, nach
  einem **Geschenk drei Runden kein zweites**. Was gesperrt ist, steht
  ausgegraut im Diplomatiefenster und sagt, warum und wie lange noch.
- **Ruf als Kriegstreiber**: Ein Herold spricht vor Zeugen. Wer den Krieg
  erklärt, verliert **bei jedem, der ihn kennt**, sechs Punkte Ansehen – nicht
  nur bei dem, dem die Erklärung gilt. Dreimal im Jahr, und man ist einer, mit
  dem kein Vertrag hält und niemand mehr Frieden schließt.
- **Gesandte**: Über den Frieden des Spielers entscheidet weiterhin niemand
  außer ihm selbst – aber ein Gegner, der den Krieg satt hat, kann das jetzt
  sagen. Nach acht Runden Krieg schickt er einen **Gesandten**: ein Fenster
  meldet ihn, im Diplomatiefenster steht sein Angebot mit **Annehmen** und
  **Ausschlagen**. Wer im Feld klar unterliegt, legt Gold dazu – bis zu 800.
  Der Gesandte wartet **drei Runden**, dann reist er ab; wer ihn ausschlägt,
  kostet sich acht Punkte Ansehen und sieht so bald keinen zweiten.
- **Das Aufgebot der freien Orte**: Eine unabhängige Stadt hat keinen Herrn,
  der ihr ein Heer schickt. Steht ein Feind vor dem Tor, greift sie zu dem, was
  sie hat: **6 % ihrer Einwohner** treten unter die Waffen (höchstens 420, unter
  40 gar nicht) und kämpfen als Stadtwache auf der eigenen Mauer mit – Massilia
  bringt so 216 Bürger auf, ein Dorf 54. Die Kampfvorschau nennt sie, damit ein
  Angreifer nicht überrascht wird, und die Aufklärung eines freien Orts weist
  sie aus. Nach der Schlacht gehen die Überlebenden zurück in die Gassen: auf
  der Mauer bleibt nur die eigene Stadtwache, und **die gefallenen Bürger
  fehlen dem Ort danach wirklich** – seine Einwohnerzahl sinkt.
- **Orte wachsen**: In jedem Monat werden mehr Kinder geboren als Menschen
  sterben. Der Satz ist klein (0,35 % je Runde), aber er summiert sich: über ein
  Jahr gut vier Prozent, über zehn Jahre die Hälfte. Im Frühjahr und Sommer
  wächst ein Ort schneller als im Winter, und **steht ein feindliches Heer vor
  dem Tor, wächst gar nichts** – die Felder liegen brach. Über die Obergrenze
  seines Rangs kommt kein Ort hinaus: ein Dorf bleibt ein Dorf. Das Wachstum
  wirkt sich aus, denn die Einwohner tragen zu den Einnahmen bei, stellen die
  Stadtwache nach und bestimmen, wie groß eine Garnison sein darf.
- **Straßenanschluss steht im Ort**: Die Stadtansicht sagt, ob der Ort am
  Straßennetz hängt und womit er verbunden ist – eine Straße auf der Karte ist
  unter den Dächern schwer zu sehen, hier steht sie als Satz.
- **Handel**: Jeder Ort bringt hervor, was sein Land hergibt – Salz aus der
  Wüste, Holz aus dem Wald, Erz aus den Hügeln, Pferde aus der Steppe des
  Ostens, Öl von der afrikanischen Küste, Wein aus Italien und Anatolien,
  Getreide aus dem Norden, und wo nichts davon wächst, lebt eine Küstenstadt
  vom Meer. Die Ware hängt allein an Gelände und Lage, nicht am Zufall.
  Der Reiter **Handel** in der Stadtansicht zeigt sie an und bietet an, einen
  **Handelsweg** zu einem anderen eigenen Ort zu eröffnen: einmalig 200 Gold,
  danach trägt er **beiden Enden** Runde für Runde. Verschiedene Waren tragen
  mehr als gleiche – Salz gegen Wein lohnt, Getreide gegen Getreide kaum –, und
  große Städte schlagen mehr um als Dörfer. Verbunden sein heißt: eine
  durchgehende Straße, oder auf beiden Seiten ein Hafen; weiter als 14 Felder
  reicht kein Weg, und mehr als zwei trägt ein Ort nicht. Fällt ein Ende an den
  Feind oder reißt die Verbindung, endet der Weg. Die Reichsübersicht führt den
  Handel als eigene Spalte, und die KI handelt ebenfalls.
- **Straßenbau**: Jede eigene Stadt bietet die nächstgelegenen eigenen Orte
  an, zu denen noch keine Straße führt – mit Preis (30 Gold je Feld), Länge und
  Bauzeit. Angeboten werden **die zwei nächstgelegenen** eigenen Orte, zu denen
  noch keine Straße führt – weiter reicht der Straßenbau von einem Ort aus
  nicht; eine Fernstraße entsteht Stück für Stück über die Orte dazwischen. Die
  Regel steht nicht bloß in der Seitenleiste: ein Bauauftrag zu einem anderen
  Ziel wird abgelehnt. Eine fertige Straße kostet **zwei Drittel dessen, was
  offene Ebene kostet** – zwei Punkte statt drei, durch Wald, Hügel und Wüste ein
  Drittel. Ein Heer kommt auf der Straße die Hälfte weiter als über freies Feld:
  neun Felder statt sechs, und weil Erschöpfung je Punkt anfällt, zehrt ein
  Straßenfeld auch weniger als ein Feld Ebene. Das Wetter kostet weiter extra. Gebaut wird eine Verbindung
  als Ganzes und immer nur eine je Stadt;
  Gezeichnet wird eine Straße in Stücken statt als ein Band über das ganze
  Feld: als eine Fläche zwischen zwei Feldmitten schnitt sie in hügeligem Land
  in den Boden, und der Weg sah aus, als wäre er unterbrochen – dasselbe
  Mittel, das schon die Flüsse durchgängig macht.
  Neue Straßen legen sich an das bestehende Netz an. Drei Regeln fassen sie
  zusammen: ein vorhandenes Straßenfeld ist der billigste Schritt (die neue
  Verbindung schwenkt auf die alte Trasse ein), **neben** einer Straße
  herzulaufen kostet drei Punkte extra (keine zweite Trasse ein Feld daneben),
  und ein **Flussübergang** kostet acht – ein bestehender nichts, so dass eine
  Straße lieber am Ufer entlangzieht als ein zweites Mal überzusetzen.
  **Wo eine Straße am Rand einer Stadt über den Fluss geht, steht kein
  Brückenbogen** – der Weg führt durch den Ort, die Stadt ist der Übergang; für
  die Bewegung zählt er trotzdem. Fällt einer der beiden Orte an den Feind,
  wird der Bau abgebrochen.

  **Das Startnetz ist bewusst dünn**: gepflastert ist nur, was **nahe
  beieinanderliegt und kein Meer dazwischen hat** – der kurze Weg von der
  Hauptstadt jeder Fraktion zu ihren eigenen **Städten**, höchstens acht Felder
  lang (gut 440 km) und nur auf derselben Landmasse. Keine Straße zwischen zwei
  Städten, die nicht über die Hauptstadt liefe; **kein Dorf** ist angebunden
  und **kein unabhängiger Ort** – dorthin ist die erste Straße Sache dessen,
  der sie will. Gemessen wird der gelaufene Weg, nicht die Luftlinie: zwischen
  Athen und Pergamon liegen acht Felder und die halbe Ägäis, zwischen Ekbatana
  und Susa sechs Felder und der Zagros – beide bleiben ohne Straße. Damit eine
  Trasse nicht nebenbei ein Dorf anschließt, meidet die Wegsuche beim Aufbau
  die Felder fremder Orte: sie sind nicht gesperrt, nur teuer. In Zahlen:
  23 von 32 Städten hängen an ihrer Hauptstadt, 0 von 32 Dörfern und 0 von 18
  unabhängigen Orten haben eine Straße; 118 Straßenfelder liegen auf der Karte.
- **Bewegung wird in Punkten gerechnet, nicht in Feldern**: offene Ebene kostet
  3, gebrochenes Gelände – Wald, Hügel, Wüste – das Doppelte, eine gepflasterte
  Straße 2, und ein Heer hat 18 Punkte je Runde. Das sind sechs Felder Ebene,
  drei Felder Wald – und neun Felder Straße.
- **Gebirge und Pässe**: Ein Gebirge ist nicht mehr pauschal gesperrt. **Bis
  2000 Meter führt ein Pass hindurch** – mühsam, aber begehbar: 12
  Bewegungspunkte je Feld, das Doppelte von gebrochenem Gelände, und weil
  Erschöpfung je Punkt anfällt, kommt ein Heer entsprechend mitgenommen auf der
  anderen Seite an. Was höher liegt, ist Fels und Eis und bleibt für ein Heer
  unpassierbar. Von 122 Gebirgsfeldern der Karte sind damit 48 begehbar; die
  Geländeauskunft sagt für jedes, woran man ist. Hannibal zog über den
  Alpenhauptkamm auf ungefähr dieser Höhe.
- **Kartentisch**: Die Karte liegt auf einem Tisch mit Rahmen, Platte und vier
  gedrechselten Beinen, die auf dem Zeltboden stehen. Das Meer reicht bis unter
  den Rahmen – vorher endete es kurz hinter dem letzten Feld, und dazwischen
  sah man auf die Tischplatte.
- **Grenzen auf der Karte**: Der Knopf ◫ blendet die **Grenzen der
  Herrschaftsgebiete** ein – ein schmales Band in der Farbe der Fraktion,
  überall dort, wo ihr Einflussbereich an einen fremden stößt, gezeichnet auf
  die Geländekarte statt in einer eigenen Ansicht. Gerechnet wird derselbe
  Einflussbereich wie in der taktischen Sicht (jedes Feld gehört zum nächsten
  Ort), und er zieht mit, wenn eine Stadt den Besitzer wechselt. **Das Gebirge
  gehört niemandem** – weder der Fels noch der Pass darunter: ein Pass ist ein
  Weg hindurch, kein Land, das eine Stadt verwaltet. Die Grenze endet deshalb
  am Fuß des Kamms, statt quer über ihn zu laufen.
- **Flüsse und Brücken**: Fünfzehn große Ströme liegen auf der Karte, in echten
  Koordinaten wie alles Geografische – Rhein und Donau, Rhône, Po und Tiber,
  Seine und Loire, Ebro, Tejo und Guadalquivir, Elbe und Weichsel, Mariza, Nil
  und der obere Euphrat. Ein Fluss besetzt kein Feld, er **trennt zwei**: er
  folgt den Grenzen des Rasters, und wer hinüberzieht, zahlt
  **6 Bewegungspunkte zusätzlich** – zwei Felder Ebene, jedes Mal.

  Eine **Brücke** entsteht dort, wo eine Straße über den Fluss führt: liegt auf
  beiden Ufern Pflaster, steht dort eine Brücke, und das Übersetzen kostet
  nichts mehr. Bezahlt wird sie mit der Straße, gebaut wird sie mit ihr, und auf
  der Karte steht sie als **gerade Holzbrücke**: ein flacher Bohlenbelag auf
  zwei Querbalken, Geländer mit Pfosten auf beiden Seiten, Pfähle ins Flussbett
  gerammt – was ein Trupp Pioniere an einem Tag hinbekommt. Zu Spielbeginn tragen die
  Startstraßen acht solcher Übergänge. Ein Rechtsklick sagt für jedes Feld, auf
  welchen Seiten ein Fluss liegt und wo eine Brücke hinüberführt.
- **Einnahmen jedes Orts** stehen in seiner Anzeige, aufgeschlüsselt nach dem,
  was die Siedlung selbst abwirft (40 Gold, mal 1,7 für eine Große Stadt, mal
  0,5 für ein Dorf), was ihre Einwohner darüber hinaus tragen (je 200 Einwohner
  ein Gold) und was ein Weltwunder vor ihren Toren einbringt. Dieselbe Rechnung
  läuft in der Rundenabrechnung – es gibt nur eine Wahrheit darüber, was eine
  Stadt wert ist.
- **Das Stadtfenster hat drei Reiter**: **Infos** – Rang, Bevölkerung,
  Einnahmen, Stadtwache, Bauwerke, Befestigung, Garnison –, **Bauen**:
  Mauern, Hafen, Flotte, Straßen, Rekrutierung und Aushebung – und **Handel**:
  die eigene Ware, die bestehenden Handelswege und die Orte, mit denen sich
  noch einer eröffnen ließe. In **Bauen** und **Handel** bleibt die
  Geländeauskunft aus – dort geht es darum, was man tun
  kann, und die Knöpfe sollen nicht unter einer Wand aus Höhenangaben
  verschwinden. Ungetrennt stand
  der Mauerbau zwischen Bevölkerung und Garnison, und wer nur nachsehen wollte,
  was ein Ort trägt, scrollte an drei Bauknöpfen vorbei. Die Wahl bleibt
  stehen: wer baut, baut meist mehrmals hintereinander.
- **Zufallsereignisse**: Was niemand befohlen hat, geschieht trotzdem. Ab der
  zehnten Runde trifft es jede Fraktion mit zehn Prozent Wahrscheinlichkeit je
  Runde – eine Seuche, eine Dürre, ein Erdbeben, ein Aufruhr, ein Brand, ein
  Sturm über der Flotte; oder ein Jahr voller Korn, ein guter Handelszug, die
  Getreideflotte, Söldner vor dem Tor, ein Feldherr von Ruf, günstige
  Vorzeichen. Vierzehn Ereignisse, jedes mit einer Bedingung: eine Flotte kann
  nur verlieren, wer eine hat. Was die eigene Fraktion trifft, kommt in einem
  **eigenen Fenster** – mit Bild, Begebenheit und der Zeile, was es gekostet
  oder gebracht hat. Was den anderen zustößt, steht nur im Protokoll.
- **Reichsübersicht** (🏛 in der Kopfzeile): ein Fenster über den ganzen
  Besitz – Schatz, Einnahmen, Sold und Bilanz, dazu Orte, Heere, Flotten und
  Stadtwachen, und darunter jeder eigene Ort mit seinen Einnahmen einzeln
  aufgeschlüsselt und der Gesamtsumme in der Fußzeile. Gerechnet wird mit
  denselben Funktionen wie beim Rundenwechsel – die Übersicht zeigt keine
  Schätzung, sondern die Abrechnung selbst.
- **Von fremden Orten sieht man nur, was von außen zu sehen ist**: Rang,
  Besitzer, ob sie Mauern und einen Hafen haben, und wie stark sie besetzt
  scheinen („gut besetzt"). Kopfzahlen, Bevölkerung und Einnahmen kennt nur,
  wer den Ort hält. Wer ein eigenes Heer bis auf zwei Felder heranführt – oder
  eine eigene Stadt in der Nähe hat –, bekommt eine Schätzung („etwa 350 Mann").
  Was genau hinter den Mauern steht, sagt erst die Kampfvorschau.
- **Unabhängige Orte sind nicht wehrlos**: ab und an stellt einer von ihnen eine
  **Miliz** auf – bewaffnete Bürgerschaft mit einem Kern aus der Stadtwache. Sie
  bleibt in der Nähe ihrer Stadt und greift nur zu, wenn ein schwacher Nachbarort
  in Reichweite liegt. Nimmt sie einem Staat einen Ort ab und steht ihre
  Heimatstadt noch, dann **rufen die Unabhängigen der Gegend ihr eigenes Reich
  aus**: aus zwei Orten und einem Heer wird eine neue Fraktion, die von da an
  mitspielt wie jede andere. **Sie heißt nach dem Ort, aus dem sie sich erhoben
  hat** – Massilia, Aquileia, Byzantion –, denn so nennen sich Bürger, die sich
  selbst regieren; aus der Farbliste kommt nur noch die Farbe. Sie kämpft mit den Waffen ihres nächsten Nachbarn,
  weil man kämpft, wie man es gelernt hat. Höchstens zwei solcher Reiche können
  entstehen, und die Hälfte von ihnen übersteht das erste Jahrzehnt nicht.
- **Rückgängig** (↩ oben rechts): macht die letzte Aktion zurück – Zug,
  Rekrutierung, Mauer- oder Straßenkauf, Auflösen oder ganzen Rundenwechsel.
- **Feldzug beenden**: 🏳 in der Kopfzeile führt nach Rückfrage zurück ins
  Hauptmenü.
- **Ton**: 🔊 schaltet alles ab, was zu hören ist – Titelmusik, Fraktionsmusik,
  Marschtritt,
  Zusammenstoß, Hornruf, Steinarbeit, Kriegstrommel. Nichts davon ist eine
  Audiodatei: alles entsteht zur Laufzeit aus Oszillatoren und Rauschen und
  läuft über eine gemeinsame Kette aus Hall und Kompressor, damit die Klänge
  in einem Raum stehen und sich nicht gegenseitig übersteuern. Eine Auswahl
  ist bewusst nur ein trockener Klick, kein Ton – bei jedem zweiten Handgriff
  wäre ein Piepser eine Belästigung. Die Musik lässt sich in den
  Einstellungen getrennt abschalten – Titelmusik wie Fraktionsmusik.
- **Vollbildmodus**: ist der Normalfall – das Spiel geht beim Start hinein.
  Ein Wisch über die Karte zieht nicht mehr am Browserfenster: alles, was nicht
  in einer scrollbaren Leiste beginnt, wird abgefangen, damit ein Streichen nach
  unten die Karte bewegt und nicht die Seite. Was der Browser vom Bildschirmrand
  aus selbst abfängt, kann eine Seite nicht verhindern – reißt eine solche Geste
  oder die umgebende Seite das Vollbild ab, stellt die nächste Berührung, der
  nächste Klick oder Tastendruck es wieder her, und auch die Rückkehr aus dem
  Hintergrund. Früher geht es nicht: ein Browser gewährt Vollbild nur innerhalb
  einer Nutzergeste. Wer per ⛶ oder Esc herausgeht, bleibt draußen, bis er ⛶
  erneut drückt.
  In einer eingebetteten Ansicht (iframe) verbietet der Browser Vollbild per
  Permissions-Policy; das Spiel sagt das dann und der Knopf ⇥ blendet
  stattdessen die Seitenleiste aus, um der Karte den Platz zu geben.
- „Runde beenden" lässt die KI-Fraktionen ziehen, kassiert Einkommen und lässt
  Garnisonen langsam nachwachsen.

## Spielprinzip

- **Alle sechzehn Fraktionen sind spielbar.** Nach „Neues Spiel starten" kommt ein
  eigener Auswahlbildschirm: links die Fraktionen mit ihrer Schwierigkeit,
  rechts Hauptstadt, Siedlungen, Startheer, die drei eigenen Einheiten sowie
  Stärke und Schwäche – und im Hintergrund ein Bild, das mit der Auswahl
  wechselt: der Tempel und der Adler für Rom, die Hafenmauer mit Elefant für
  Karthago, der Herkynische Wald für die Germanen, Pyramiden und Palmen für die
  Ptolemäer. Wer nicht gewählt wird, wird von der KI geführt.
- Zur Wahl stehen **Rom**, **Karthago**, die **Gallier**, **Numidien**, die
  **Parther**, **Armenien**, **Pontus**, die **Griechen**, die **Germanen**,
  die **Britannier**, die **Iberer**, die **Daker**, die **Seleukiden**, die
  **Ptolemäer**, die **Illyrer** und die **Sarmaten** –
  verteilt über Europa, das Mittelmeer, Nordafrika, den Vorderen Orient und die
  Steppe nördlich des Schwarzen Meeres. Alle beginnen mit demselben Startgold und
  (bis auf die zwei Heere der Seleukiden) demselben Heer: der Unterschied liegt
  in der Lage, den Nachbarn und den eigenen Einheiten.
- **Jede Fraktion hat ihre eigenen Einheiten.** Drei Waffengattungen gibt es
  überall – Fußvolk, Reiterei, Fernkampf –, aber jede Fraktion füllt sie anders
  aus, mit eigenem Namen, eigenen Werten und eigenem Preis:

  | Fraktion | Fußvolk | Reiterei | Fernkampf |
  | --- | --- | --- | --- |
  | Rom | Legionär (Schild und Gladius, sehr zäh) | Equites | Veliten |
  | Karthago | Libysche Speerträger | Punische Reiterei | Balearische Schleuderer |
  | Numidien | Numidische Speerträger (leicht, billig) | Numidische Reiter (beste leichte Reiterei) | Numidische Speerwerfer |
  | Parther | Persisches Fußvolk (hält nur) | Kataphrakten (Panzerreiter, härteste Reiterei) | Berittene Bogenschützen |
  | Armenien | Armenische Speerträger (zäh in den Pässen) | Armenische Kataphrakten | Armenische Bogenschützen |
  | Pontus | Pontische Phalangiten (zweitbeste Verteidigung) | Pontische Reiter | Chalybische Bogenschützen |
  | Gallier | Schwertkämpfer (harter Angriff) | Edle Reiter | Bogenschützen |
  | Griechen | Hopliten (beste Verteidigung) | Thessalische Reiter | Peltasten |
  | Germanen | Speerträger | Gefolgschaftsreiter | Wurfspeerträger |
  | Britannier | Keltenkrieger | Streitwagen (härtester Angriff) | Schleuderer |
  | Iberer | Scutarii | Iberische Reiter | Caetrati |
  | Daker | Falxträger (Sichelschwert, roher Angriff) | Sarmatische Panzerreiter | Dakische Bogenschützen |
  | Seleukiden | Silberschilde (Phalanx) | Kriegselefanten (statt Reiterei) | Kretische Bogenschützen |
  | Ptolemäer | Machimoi (billige Masse) | Ptolemäische Reiter | Nubische Bogenschützen (beste Bogen) |
  | Illyrer | Sicaträger (billige Räuber) | Illyrische Reiter | Illyrische Schleuderer |
  | Sarmaten | Fußgefolge (Beiwerk) | Kataphrakten (beste Reiterei) | Berittene Bogenschützen |

  Im Kampf rechnet jede Seite mit ihren eigenen Werten – ein Legionär hält
  anders stand als ein Falxträger, auch wenn beide „Fußvolk" heißen.
- **Die Weltwunder der Antike stehen auf der Karte**, jedes an seinem echten
  Ort. Von den klassischen sieben liegen sechs im Kartenausschnitt: die
  **Pyramiden von Gizeh**, der **Leuchtturm von Alexandria**, der **Koloss von
  Rhodos**, das **Mausoleum von Halikarnassos**, der **Artemistempel von
  Ephesos** und die **Zeusstatue von Olympia**. Die Hängenden Gärten von
  Babylon lägen bei 44,4° O – gut zwei Grad östlich des Kartenrands; sie an den
  Rand zu rücken wäre geografisch falsch, deshalb fehlen sie. Dazu kommen fünf
  weitere Wahrzeichen: der **Parthenon** auf der Akropolis, das **Orakel von
  Delphi**, der **Tempel des Jupiter Optimus Maximus** auf dem Kapitol, die
  **Säulen des Herakles** an der Meerenge von Gibraltar und der **Steinkreis von
  Stonehenge**.

  Gebaut werden sie nicht – sie standen schon. Wer den nächstgelegenen Ort hält,
  hält das Bauwerk: ein Weltwunder bringt 15 Gold je Runde, ein Wahrzeichen 6.
  Fällt die Stadt, fällt das Bauwerk mit ihr, und das Protokoll sagt es beiden
  Seiten. Ein Rechtsklick auf das Feld nennt Bauwerk, Bauzeit und Besitzer.
- **Karthago hält Karthago Nova in Iberien** – die Stadt an der spanischen
  Südostküste mit den Silberminen im Rücken, und dort steht ein eigenes Heer
  von 270 Mann: von Afrika aus wäre der Brückenkopf nicht zu halten.
- **Die Parther** stehen auf der iranischen Hochebene: Ekbatana als Sitz, dazu
  Susa, Rhagae, Ktesiphon und Arbela, der Zagros als Wall nach Westen. Ihr
  Fußvolk hält nur die Linie – die Entscheidung fällt zwischen Kataphrakten und
  berittenen Bogenschützen, dem besten Reiterheer der Karte. Teuer ist es auch.
- **Pontus** liegt an der Südküste des Schwarzen Meeres: Amaseia im Bergland,
  dazu die Häfen Sinope, Amisos und Trapezus sowie Kabeira. Phalangiten mit der
  zweitbesten Verteidigung im Spiel und Quinqueremen im Schwarzen Meer – aber
  eine schmale Küste zwischen Bergen und Wasser. Für Pontus hat auch die
  Geografie nachgebessert: die Südküste des Schwarzen Meeres folgt jetzt der
  wirklichen Linie Anatoliens, vorher schnitt der Umriss von Paphlagonien
  gleich zur Krim durch.
- **Armenien** hält das Hochland um den Ararat: Artaxata als Sitz, dazu
  Tigranokerta, Tushpa, Arsamosata und Naxuana. Anders als bei den Parthern
  hält sein Fußvolk die Pässe wirklich – dafür hat es kein Meer, keinen Hafen
  und Seleukiden wie Parther als Nachbarn.
- **Numidien** steht westlich von Karthago: Cirta als Sitz, dazu Zama Regia,
  Icosium und Siga. Sein Fußvolk deckt nur die Reiter – die numidische
  Reiterei ist die schnellste und härteste leichte Reiterei der Karte, und
  Karthago, das sie jahrhundertelang anwarb, muss sie sich nun vom Leib halten.
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
- Die **Illyrer** sitzen an der Adria und an der Save, eingeklemmt zwischen den
  Dinariden und dem Meer – wenig Land, aber lauter Häfen.
- Die **Sarmaten** ziehen mit ihren Kataphrakten durch die Steppe nördlich des
  Schwarzen Meeres. Weite Wege, kaum Nachbarn, kaum Einkommen.
- Die **Daker** halten die Karpaten um Sarmizegetusa – Bergland, das sich gut
  verteidigen lässt, mit der Donau als Sprungbrett nach Süden.
- **98 Siedlungen in drei Größen**: **Große Stadt** (viel Bevölkerung, starke
  Garnison, 1,7-faches Grundeinkommen), **Stadt** (Normalmaß) und **Dorf**
  (klein, halbes Grundeinkommen – leicht zu nehmen und gute Sprungbretter).
  **Jede Fraktion beginnt mit denselben fünf Orten**: der Hauptstadt als Große
  Stadt, zwei Städten und zwei Dörfern. Wo einer sitzt, sagt die Geschichte; wie
  viel er hat, sagt diese Regel – kein Reich beginnt reicher als das andere.
  18 Orte gehören niemandem und sind frei zu erobern – von Gades bis Ankyra. Sizilien, Sardinien, Kreta, Zypern, Rhodos, die Balearen und
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
  Meerengen, Gebirgsrücken, Wälder und Flussläufe, dazu die Umrechnung
  Grad ↔ Feld
- `js/data.js` – Einheiten-, Gelände- und Fraktionsdefinitionen samt
  Fraktionsprofilen für die Auswahl, Siedlungen mit ihren echten Koordinaten
- `js/factionart.js` – die SVG-Bilder des Auswahlbildschirms, eines je Fraktion
- `js/wonders.js` – die Weltwunder und Wahrzeichen der Alten Welt in Grad,
  ihre Zuordnung zum nächsten Ort und was sie einbringen
- `js/mapgen.js` / `js/state.js` – Rasterung der Geografie zu Gelände,
  Spielzustand
- `js/pathfind.js` – Bewegungsreichweite (Dijkstra) inkl. Kampf-Zielfeldern
  und Seewegen für eingeschiffte Armeen
- `js/combat.js` – Kampfauflösung (mehrere Runden, Fernkampf-Bonus, Moral) und
  die Vorschau-Simulation mit eigenem Zufallsstrom
- `js/actions.js` – Bewegen, Einschiffen, Rekrutieren, Armee ausheben,
  Rundenwechsel, Kampfvorschau
- `js/rulers.js` – die Herrscher der Fraktionen mit ihren drei Eigenschaften
- `js/diplomacy.js` – Krieg, Frieden und Ansehen; die Fristen zwischen zwei
  Handlungen, die Gesandten und was die Herrscher von sich aus beschließen
- `js/piraten.js` – die Seeräuber: wo sie auslaufen, was sie jagen, was sie dem
  Seehandel kosten und was sie im Laderaum haben
- `js/ai.js` – einfache KI (Wirtschaft + Angriffsverhalten)
- `js/scene3d.js` – Three.js-Szene: instanziertes 3D-Gelände, Städte/Armeen als
  3D-Objekte, isometrische Kamera (Pan/Zoom), Raycasting-Feldauswahl
- `js/vendor/three.min.js` – lokal eingebundenes Three.js (MIT-Lizenz, r149)
- `js/weather.js` – Kalender, Klimazonen, Wettertypen und ihre Regelwirkung
- `js/anthems.js` – die Partituren der sechzehn Fraktionen: Leitern, Grundtöne,
  Motive und Besetzung
- `js/audio.js` – der ganze Ton: Hall- und Kompressorkette, die einzelnen
  Klangereignisse, der Marschtritt, die Titelmusik und der Spieler für die
  Fraktionsmusik
- `js/settings.js` – Einstellungen: Schema, Speicherung, Einstellungsfenster
- `js/events.js` – die Zufallsereignisse: Bedingung, Wirkung und der Satz,
  der sie erzählt
- `js/chronicle.js` – die acht Chronikbilder als SVG-Silhouetten
- `js/ui.js`, `js/input.js`, `js/main.js` – Seitenleiste, Eingabe, Startbildschirm, Bootstrap

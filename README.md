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
durch die Fraktionswahl.

**Sie fängt mit dem Programm an.** Im Desktop-Programm läuft sie sofort – dort
gibt es keinen fremden Reiter, den eine Tonspur überraschen könnte, und die
Autoplay-Sperre ist entsprechend gesetzt. Im Browser darf vor der ersten Geste
kein Ton erklingen; dort merkt sich das Spiel den Wunsch und holt ihn bei der
**allerersten Geste nach – gleich welcher**: ein Klick irgendwohin, eine Taste,
eine Berührung. Vorher hing der Anstoß an vier bestimmten Knöpfen, und wer
stattdessen neben sie klickte, hörte den ganzen Vorspann über nichts: die
Takte waren in einen schlafenden Klangapparat geplant worden, und genau dieser
Griff hielt jeden neuen Versuch ab.

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

- **Die Kopfzeile**: links Titel, Runde, Wetter und Schatz, rechts der Knopf
  „Runde beenden". Dazwischen stehen die vier Werkzeuge, die man jede Runde
  braucht – ↩ **Rückgängig**, 🏛 **Reich**, 🕊 **Diplomatie**, 🗺 **Taktische
  Sicht** –, und dahinter ☰ mit dem Rest: ◫ Grenzen, ⇥ Seitenleiste,
  ⛶ Vollbild, 🔊 Ton, ⚙ Einstellungen, 🏳 Feldzug beenden. In der Klappliste
  trägt jedes Werkzeug seinen Namen; was gerade an ist, steht in Gold.
  **Wird der Schirm schmal (unter 1150 Punkten), wandern auch die vier in die
  Liste** – verschoben werden dabei die Knöpfe selbst, nicht Kopien von ihnen.
  So bleibt „Runde beenden" auf jeder Breite sichtbar; vorher schob die
  Werkzeugreihe ihn unter 980 Punkten aus dem Bild.
- **Tastenkürzel**: <kbd>Leertaste</kbd> beendet die Runde, <kbd>1</kbd> öffnet
  das Reich, <kbd>2</kbd> die Diplomatie, <kbd>3</kbd> schaltet die taktische
  Sicht um, <kbd>4</kbd> die Grenzen, <kbd>5</kbd> die Einstellungen,
  <kbd>U</kbd> macht rückgängig, <kbd>M</kbd> schaltet den Ton.
  <kbd>W A S D</kbd> und die Pfeiltasten schieben die Karte, <kbd>Q</kbd> und
  <kbd>E</kbd> drehen sie, <kbd>Esc</kbd> schließt das oberste Fenster. Solange
  ein Fenster offen steht, gehört ihm die Tastatur – die Leertaste beendet dann
  keine Runde.
- **Auf dem Telefon**: Die Kopfzeile bricht in zwei Zeilen um, statt etwas
  abzuschneiden, und die Seitenleiste legt sich über die Karte statt neben sie.
  Sie beginnt dort eingeklappt – ⇥ im Menü holt sie hervor. Vorher nahm sie von
  430 Punkten Breite 260 für sich.
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
- **Der Schlacht zusehen** (erste, bewusst einfache Fassung): Vor jedem
  Angriff steht die Frage. In der Kampfvorschau stehen dafür **zwei Knöpfe**
  nebeneinander – *„⚔️ Angreifen"* und *„🎬 Angreifen und zusehen"* –, und wer
  die Vorschau abgeschaltet hat, bekommt die Frage allein in einem kleinen
  Fenster. In den Einstellungen lässt sich das festlegen: **jedes Mal fragen**
  (Vorgabe), **immer zusehen** oder **nie**.
  Wer zusieht, bekommt ein eigenes Fenster mit einer eigenen 3D-Ansicht: der
  Boden in der Farbe des Geländes, auf dem wirklich gefochten wird, links die
  Angreifer in ihrer Fraktionsfarbe, rechts die Verteidiger, dazwischen bei
  einem Sturm auf einen Ort die **Palisade oder Mauer**. Jeder Klotz steht für
  **15 Mann**, seine Form für die Waffengattung (Fußvolk breit, Reiter hoch,
  Schützen schmal). Die beiden Linien marschieren auf, prallen Runde für Runde
  aufeinander, und **mit jeder Runde fallen genau die Klötze, die der Bericht
  ausweist** – von der Front her, nicht aus der Mitte. Über dem Bild stehen die
  Namen und Stärken, in der Mitte „Runde 3 von 7", darunter, wie viele auf
  jeder Seite noch stehen. Am Ende weicht der Verlierer vom Feld, und der Satz
  darunter nennt Sieger und Grund („Sieger: Sarmaten · Moral gebrochen").
  **Das Schaubild entscheidet nichts.** Die Schlacht ist ausgefochten, ehe das
  Fenster aufgeht; gezeigt wird nur, was `combat.js` bereits ausgerechnet hat.
  *„Überspringen"* oder Esc bricht ab, *„📜 Zum Bericht"* führt weiter zum
  gewohnten Schlachtbericht. Das Fenster hat seinen eigenen Renderer und räumt
  ihn beim Schließen wieder ab.
  Die **zweite Ausbaustufe** hat vier Dinge dazugelegt:
  - **Die Eröffnungssalve ist zu sehen**: Wo Schützen stehen, geht in der
    ersten Runde eine Wolke von Pfeilen im Bogen hinüber – von jeder Seite, die
    welche hat. Sie trifft niemanden; was sie anrichtet, steht im Bericht.
  - **Fahnen mit dem Wappen**: Über jeder Aufstellung steht das Feldzeichen
    ihres Reichs – dieselben Wappen wie im Zelt und in der Rangliste. Am Ende
    **senkt sich die Fahne des Geschlagenen**.
  - **Seeschlachten sehen aus wie Seeschlachten**: Auf dem Wasser fahren
    **Schiffe** statt Klötze – Rumpf, Bug, Mast und Segel –, sie schaukeln im
    Seegang, und ein versenktes legt sich auf die Seite und geht unter. Ein
    Modell steht für vier Schiffe.
  - **Gefallene bleiben liegen**: Ein Block, der fällt, kippt zur Seite und
    sinkt ein, statt einfach zu verschwinden. Am Ende liegt auf dem Feld, was
    die Schlacht gekostet hat.
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
- **Gestürmt wird zu Fuß**: Wer auf eine Befestigung losgeht, kommt zu Pferde
  nicht über die Leiter, nicht durch die Bresche und nicht durchs Tor. Vor
  einer Mauer zählt die **Reiterei** deshalb nur noch einen Bruchteil ihres
  Angriffswerts – **45 % vor der Holzpalisade, 34 % vor der großen, 20 % vor
  der Steinmauer** –, die **Bogenschützen** 85 bis 75 % (sie beschießen den
  Wehrgang, auch wenn sie ihn nicht nehmen), das **Fußvolk** seinen vollen
  Wert. Im offenen Feld ändert sich nichts: dort ist die Reiterei die stärkste
  Waffe, die es gibt.
  Vorher trug ein reines Reiterheer jede Mauer im Sturm – es war das beste
  Belagerungsmittel des Spiels, und das war der deutlichste Fehler in der
  Kampfrechnung. Jetzt schafft dasselbe Heer, das im Feld gewinnt, vor einer
  Palisade **9 %** der Stürme, wo Fußvolk gleicher Stärke **100 %** schafft.
  Vorschau und Bericht nennen den Abschlag in einer eigenen Zeile.
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
- **Eine Aushebung kostet Einwohner**: Ein Soldat kommt nicht aus der
  Schatzkammer, sondern aus der Stadt. Wer **100 Mann** aushebt, hat danach
  **100 Einwohner weniger** – Mann für Mann. Das ist die zweite Rechnung neben
  dem Gold und die härtere: Einwohner wachsen mit **0,35 % je Runde** nach,
  Gold kommt jede Runde neu herein. Und es kostet mehr als Köpfe: weniger
  Einwohner heißt weniger **Steuer** (ein Gold je 80), eine kleinere
  **Stadtwache** (sie stellt sich aus ihnen nach) und eine niedrigere
  **Garnisonsgrenze** (ein Mann je 8 Einwohner). Unter **300 Einwohner** hebt
  niemand mehr aus – der Knopf ist dann ausgegraut und sagt, warum. Auf jedem
  Aushebungsknopf steht beides: `120 Gold · −100 Einw.`
  Über 120 Runden gemessen hält das die Karte im Gleichgewicht: die
  Gesamtbevölkerung steht die erste Spielhälfte still und wächst danach wieder.
- **Armeen in der Stadt verstärken**: Steht eine eigene Armee in einer eigenen
  Stadt, kann sie dort direkt Truppen kaufen – je 100 Mann, die sofort in die
  Armee eintreten, statt den Umweg über die Garnison zu nehmen. Wie bei jeder
  Aushebung verdünnen die Neuen die Erfahrung der Armee – **und sie kostet
  denselben Preis an Einwohnern**: sonst wäre die Verstärkung im Feld das
  Schlupfloch, durch das man die Aushebung umgeht.
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
  nächste Stufe, und immer nur eine zur Zeit. **Die Dörfer der Reiche stehen
  offen**: Höfe, ein Speicher, kein Wall – wer sie halten will, baut die
  Palisade selbst, und das ist die erste Entscheidung an jeder Grenze (32 von
  107 Orten beginnen so). Städte einer Fraktion haben die **Holzpalisade**,
  Hauptstädte die **Große** – die Steinmauer bleibt auch ihnen zu bauen. Die
  **unabhängigen Städte** haben ebenfalls die Große und ihre **Dörfer die
  einfache**: sie haben keinen Herrn, der ihnen ein Heer schickt, und stehen
  für sich. Ein freies Dorf ist damit von Anfang an härter zu nehmen als das
  Grenzdorf eines Reichs. Jede Stufe
  sieht anders aus: angespitzte Stämme, hölzerner Wehrgang mit Türmen,
  Quadermauer mit Rundtürmen.
- **Hafenbau**: Ohne Hafen kann in einer Stadt keine Armee an Bord gehen –
  am Meer zu liegen genügt nicht. Der Hafen kostet **300 Gold** und **3
  Runden**; Hauptstädte und Große Städte am Meer bringen ihn mit, jede andere
  Küstenstadt muss ihn bauen. Erobert man eine Stadt, übernimmt man ihren
  Hafen. Am Ufer steht dann ein Steg mit vertäutem Boot, damit man von weitem
  sieht, wo eine Flotte auslaufen kann.
- **Der Bauen-Reiter zeigt nur, was gilt**: was in diesem Ort steht, was
  gerade gebaut wird, und was sich hier und jetzt bauen ließe. Ein Bauwerk,
  dessen Voraussetzung fehlt – der Kornspeicher ohne Farm, das Viadukt ohne
  Verwaltung, die Werft ohne Hafen –, erscheint **gar nicht**. Zu Spielbeginn
  stehen deshalb genau fünf Dinge zur Wahl: **Kaserne, Farm, Forum, Straßenbau**
  und, am Meer, der **Hafen**. Alle Bauwerke stehen in einer Tabelle
  (`BUILDINGS` in `js/data.js`) und laufen durch einen einzigen Knopf, eine
  Kaufregel und eine Bauschleife – ein neues Bauwerk ist ein Eintrag, keine
  neue Funktion.
- **Das Bauamt meldet**: Ein Bauauftrag läuft über mehrere Runden, und wenn er
  fertig wird, ist der Spieler längst woanders. Deshalb hält die Runde jetzt an
  und sagt es: Sobald ein **Bauwerk**, eine **Befestigung** oder eine
  **Straße** fertig geworden ist, kommt ein **Meldefenster** – mit dem Zeichen
  des Werks, seinem Namen samt Ort und dem, was es von dieser Runde an trägt
  („50 % mehr Zuwachs", „+20 Gold je Runde", „+60 % Verteidigung"). Sind in
  derselben Runde **mehrere** fertig geworden, stehen sie **in einem Fenster
  untereinander** statt in fünf hintereinander. Eine ausgebesserte Mauer und
  ein aus den Trümmern wieder aufgebautes Bauwerk sagen das dazu.
- **Kaserne und Verwaltung**: Ein Reich baut nicht aus dem Nichts. Wer Truppen
  aushebt, braucht einen Ort, an dem sie ausgebildet und untergebracht werden;
  wer Wasserleitungen und Stollen anlegt, braucht eine Verwaltung, die
  Vermessung, Fronarbeit und Abrechnung ordnet.
  Die **Kaserne** kostet **250 Gold** und **3 Runden** und ist Bedingung für
  **jede Aushebung, jede Verstärkung im Feld und jedes neu aufgestellte Heer**.
  Zu Spielbeginn steht sie **nur in den sechzehn Hauptstädten**; jeder andere
  Ort – auch jeder eroberte – muss eine bauen, ehe er Truppen stellt.
  Die **Verwaltung** kostet **300 Gold** und **3 Runden** und ist Bedingung für
  **Viadukt und Bergwerk**. **Niemand beginnt mit einer.**
  Beide heißen nicht überall gleich. Was in Rom das **Castra** und das **Forum**
  ist, ist bei den Griechen das **Gymnasion** und die **Agora**, bei Karthago
  das **Söldnerlager** und das **Suffetenhaus**, bei den Germanen die
  **Gefolgschaftshalle** und der **Thingplatz**, bei den Ptolemäern das
  **Kleruchenland** und die **Kanzlei** und bei den Sarmaten, die nicht wohnen,
  das **Reiterlager** und das **Fürstenzelt** – sechzehn Namenspaare, für jede
  Fraktion eines.
- **Farm und Kornspeicher**: Ein Ort lebt von dem, was um ihn herum wächst.
  Die **Farm** (**180 Gold**, **2 Runden**) legt das Ackerland an: **50 % mehr
  Zuwachs** je Runde. **Auf der Karte liegen ihre Äcker neben der Stadt**: drei
  Schläge in Grün und Reifegelb, die Furchen dazwischen, am Rand der Schuppen –
  auf dem flachsten Nachbarfeld, während das Fördergerüst des Bergwerks auf dem
  höchsten steht. **Auf Wasser und Fels wird nichts gebaut**: In einer
  Hafenstadt ist das flachste Nachbarfeld das Meer, und dort lagen die Äcker
  bis zuletzt – mitten auf dem Hafen. Jetzt kommen nur Landfelder infrage, und
  Farm, Viadukt und Bergwerk gehen einander aus dem Weg; hat ein Ort gar kein
  freies Nachbarfeld (eine Insel, ein Ort zwischen Fels und Wasser), rückt das
  Bauwerk an den Ort selbst heran. Der **Kornspeicher** (**260 Gold**, **3 Runden**) setzt
  die Farm voraus und bewahrt die Ernte über den Winter – er hebt die
  **Obergrenze der Einwohner um 25 %**. Da die Schatzkammer allein von der
  Kopfsteuer lebt, ist beides bares Geld, nur später.
- **Viadukt**: Wasser über das Tal, auf Bögen, über Meilen. Es kostet **480
  Gold** und **5 Runden**, setzt eine **Verwaltung** voraus und bringt **25 %
  mehr Zuwachs** und eine um **ein Fünftel größere Garnison** – Wasser ist das,
  woran eine Belagerung zuerst scheitert.
  **Auf der Karte steht es da**: fünf Pfeiler mit Bögen dazwischen und der
  Rinne obendrauf, in der das Wasser läuft, vom höchsten Nachbarfeld auf die
  Stadt zu – dort liegt die Quelle, und dorthin gehören die Bögen. Das
  Fördergerüst eines Bergwerks weicht ihm auf das zweithöchste Feld aus.
- **Werft**: Ein Hafen ist ein Kai, an dem etwas anlegt – ein Kriegsschiff
  entsteht dort nicht. Dafür braucht es eine Helling, Bauholz, Pech, Werg und
  Leute, die es können: die **Werft** kostet **350 Gold** und **3 Runden**,
  setzt einen Hafen voraus und ist **Bedingung für jedes Kriegsschiff**.
  Niemand beginnt mit einer. Ein Heer auf gecharterten Transportern geht
  weiterhin an jedem Hafen an Bord – die Werft braucht nur, wer eine eigene
  Flotte bauen will. Ohne sie zeigt der Bauen-Reiter statt der Bauarten den
  Werftbau; steht sie, erscheinen die bis zu drei Bauarten der Fraktion. Die
  Arbeitsteilung ist damit klar: **der Hafen trägt Handelsschiffe und
  Truppentransporte, die Werft die Kriegsschiffe**.
- **Bergwerk**: Die beste Einnahmequelle, die ein Ort haben kann – und die
  einzige, die weder an seiner Größe noch an seinen Einwohnern hängt, sondern
  allein an dem, was im Berg liegt. Gerechnet wird über ein Quadrat von **zwei
  Feldern** um den Ort: ein Gebirgsfeld zählt **2**, ein Hügelfeld **1**, alles
  andere nichts. Ab **3 Erz** lohnt ein Stollen, je Punkt bringt er **4 Gold je
  Runde**, bei 12 Punkten ist Schluss – also **12 bis 48 Gold**, gegen **400
  Gold** und **4 Runden** Bauzeit, und es setzt eine **Verwaltung** im Ort
  voraus. Wo im Umland kein Erz liegt, steht der Knopf gar nicht erst da.
  **Und man sieht es**: auf jedem Gebirgs- und Hügelfeld, das für ein mögliches
  Bergwerk zählt, liegt ein aufgebrochener Fels mit heller Ader – 143 Felder
  auf der ganzen Karte, nicht mehr. Das Feldfenster nennt dazu die Zahl und den
  Ort, dem das Erz zufällt: „⛏️ Erz – 2 Punkte für ein Bergwerk in Roma (5 Erz
  im Umland)". Von 107 Orten haben 32 genug Erz; der Knopf
  nennt vor dem Bau, was er tragen wird. Neben der Stadt steht danach ein
  Fördergerüst mit Schacht und Halde, in der Übersicht hat das Bergwerk eine
  eigene Spalte, und die KI schlägt eines an, bevor sie die nächste Mauer baut.
- **Wandernde Stämme**: Der Osten ist nicht der Rand der Welt, sondern ihre
  Tür. Ab Runde 18 setzt sich dahinter mit einer Wahrscheinlichkeit von 10 % je
  Runde ein Volk in Bewegung – **520 bis 980 wehrhafte Männer**, dazu Weiber,
  Kinder, Karren und Herden, unter einem Namen aus den Quellen (Roxolanen,
  Alanen, Massageten, Jazygen …). Höchstens zwei sind gleichzeitig unterwegs.
  Ein solcher Zug führt keinen Feldzug: er hat eine Richtung und ein Ziel, das
  Reich, dessen nächster Ort ihm am nächsten liegt, und er zieht **21
  Bewegungspunkte** weit, weiter als jedes Heer marschiert. Was im Weg steht,
  überrennt er. **Nimmt er einen Ort, ist der Zug zu Ende**: das Volk bleibt,
  der Ort wird unabhängig, seine Einwohnerzahl wächst um die Neuankömmlinge und
  ein Teil von ihnen steht von da an als Stadtwache auf der Mauer. Jeder
  Aufbruch meldet sich in einem **Infofenster** – gleich, ob der Zug gegen dich
  geht oder gegen einen anderen: wer ihn zuerst trifft, ist eine Frage von
  Runden.
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
- **Der Herrscher führt auch im Feld**: Seine Eigenschaften entscheiden nicht
  nur, mit wem er Krieg führt, sondern **wie seine Heere ihn führen**. Aus
  Angriffslust und Habgier folgen vier Zahlen, nach denen seine Feldherren
  entscheiden:
  - **Wie sicher er sich sein will, ehe er stürmt.** Segimer (88 Angriffslust)
    greift bei **32 %** Siegchance an, Orontes (34) erst bei **58 %** – mit
    denselben Truppen auf demselben Feld. Die Einstellung *Verhalten der
    Gegner* verschiebt alle zugleich (vorsichtig +18, draufgängerisch −18
    Punkte), der Herrscher sich selbst.
  - **Wann er jemanden zu Hause lässt.** Ein Kriegslüsterner deckt seine Orte
    erst, wenn der Feind auf **sechs Felder** heran ist, und schickt bis dahin
    alles nach vorn; ein Zurückhaltender lässt von **vierzehn Feldern** an ein
    Heer daheim.
  - **Was ihn lockt.** Einem Habgierigen ist eine reiche Stadt einen Umweg wert
    (Ptolemaios rechnet tausend Einwohner gegen **drei Felder** Marsch auf,
    Areus gegen **keins**) – er zieht am Feldheer vorbei zur Kasse.
  - **Woraus er aushebt.** Der Angreifer will Reiter (bis 27 %), der
    Verteidiger Schützen auf der Mauer (bis 23 %). Steht der Feind vor dem Tor,
    hebt jeder Schützen aus – da ist kein Platz für Geschmack.
  Was daraus wird, ist nicht einfach „aggressiv gewinnt": über fünf Läufe zu
  sechzig Runden stehen die stürmischsten Reiche nicht oben – wer bei einem
  Drittel Siegchance angreift, verliert eben auch zwei von drei Schlachten.
  **Ehre** bleibt, wo sie hingehört: bei Wort und Vertrag.
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
- **Die Lage jedes Reiches in einer Zeile**: Unter den Eigenschaften jedes
  Herrschers steht, wie sein Reich zur übrigen Welt steht – **mit wem es Krieg
  führt, mit wem es verbündet ist, mit wem ein Pakt gilt**. Genannt wird nur,
  was man selbst wissen kann: ein Reich, das man nur vom Hörensagen kennt,
  taucht auch in fremden Kriegen nicht auf. Vorher stand in der Karte nur, wie
  dieses Reich zu einem selbst steht – wer wissen wollte, ob sein Gegner noch
  andere Feinde hat, musste raten. Und der Knopf „Krieg erklären" ist
  ausgegraut, solange ein Pakt oder ein Bündnis die Hand bindet; er sagt auch,
  welches.
- **Bedenkzeit**: Diplomatie ist kein Knopf, den man zweimal drückt. Jede
  Handlung legt eine Frist auf das Verhältnis, und erst wenn sie abgelaufen ist,
  steht wieder alles offen: nach einer **Kriegserklärung acht Runden kein
  Frieden** – für keine Seite, auch nicht zwischen zwei Herrschern, die es beide
  wollten –, nach einem **Friedensschluss sechs Runden keine Kriegserklärung**,
  nach einem **abgewiesenen Gesandten vier Runden kein neues Angebot**, nach
  einem **Geschenk drei Runden kein zweites**. Was gesperrt ist, steht
  ausgegraut im Diplomatiefenster und sagt, warum und wie lange noch.
- **Grenzen sind eine Regel, keine Farbe**: Jedes bestellbare Feld gehört dem
  Ort, der ihm über Land am nächsten liegt (Meer und Gebirge gehören niemandem).
  Wer mit einem Heer **ohne Betretungsrecht über diese Linie marschiert,
  erklärt damit den Krieg** – die Herolde brauchen keine Runde dafür, und eine
  **Landung** vom Schiff auf fremdem Boden ist derselbe Schritt.
  Damit das niemandem aus Versehen passiert: die Felder jenseits der Grenze
  sind in der Marschauswahl **violett** statt grün, das Feldfenster nennt unter
  „Land" das Reich und den Satz dazu, und vor dem Schritt fragt ein Fenster
  nach. Steht ein **Nichtangriffspakt** oder ein **Bündnis** dazwischen, geht
  der Schritt gar nicht: das Heer bleibt stehen, statt ein Wort zu brechen,
  das man erst aufkündigen muss.
  Die KI hält sich an dieselbe Regel – ihre Heere planen keinen Weg, der
  fremdes Land schneidet, und stolpern damit in keinen Krieg, den ihr Herrscher
  nicht erklärt hat.
- **Der erste Schlag ist die Kriegserklärung**: Ein Angriff auf ein **Heer**,
  eine **Flotte** oder einen **Ort** einer anderen Fraktion bedeutet Krieg –
  auch dann, wenn zwischen euch bis zu diesem Moment Friede herrschte. Erklärt
  wird er im selben Augenblick, in dem das Heer losschlägt: alle Verträge
  zwischen euch fallen, die Verbündeten des Angegriffenen treten sofort ein,
  und das Ansehen sinkt bei allen, die davon hören. Damit das niemandem aus
  Versehen passiert, sind solche Ziele in der Marschauswahl **violett** statt
  rot – dieselbe Farbe wie eine Grenzverletzung –, und die **Kampfvorschau
  sagt es in der ersten Zeile**: „Das bedeutet Krieg mit …". Der Knopf darunter
  heißt dann *„Angreifen – und den Krieg erklären"*. Diese eine Vorschau
  erscheint auch, wenn die Kampfvorschau in den Einstellungen abgeschaltet ist:
  abschalten lässt sich eine Prognose, keine Kriegserklärung.
  Wo ein gegebenes Wort dazwischensteht – ein **Bündnis**, ein
  **Nichtangriffspakt** oder ein Friede, der zu frisch ist –, ist das Feld
  überhaupt nicht anwählbar: erst den Vertrag im Diplomatiefenster aufkündigen,
  dann marschieren. Und die KI greift von sich aus nie ein Reich an, mit dem
  ihr Herrscher im Frieden steht – über Krieg entscheidet der Herrscher, nicht
  der Feldherr.
- **Verträge**: Zwischen Krieg und Frieden liegt mehr als nichts. Vier
  Verträge lassen sich schließen; alle vier setzen den Frieden voraus, und alle
  vier fallen mit ihm.
  Das **🚩 Betretungsrecht** (ab **40 Ansehen**, **25 Runden**) ist der
  leichteste: eure Heere dürfen einander das Land betreten, ohne dass es Krieg
  bedeutet. Ohne ihn ist jede Grenze eine Wand.
  Der **🤝 Nichtangriffspakt** (ab **45 Ansehen**, **20 Runden**) bindet beiden
  Seiten die Hand: solange er läuft, kann keiner dem anderen den Krieg
  erklären – auch die KI plant dann keinen Feldzug gegen ihn. Danach läuft er
  aus.
  Das **⚖️ Handelsabkommen** (ab **55 Ansehen**, **30 Runden**) öffnet die
  Grenze für Waren: **beide Seiten dürfen Handelswege in die Städte des anderen
  legen**, und jede verdient an ihrem Ende. Von da an zählen die Orte des
  Partners im Handel-Reiter wie eigene – es gelten dieselben Bedingungen wie
  daheim (eine durchgehende **Straße**, oder auf **beiden Seiten ein Hafen** am
  selben Meer, höchstens 26 Felder). Fremde Orte tragen dort den Namen ihres
  Reichs, und über den Partnern steht, mit wem ein Abkommen gilt; ohne Abkommen
  sagt dieselbe Zeile, was eines brächte. Fällt das Abkommen, fallen die Wege.
  Das **🛡️ Bündnis** (ab **70 Ansehen**, ohne Frist) schließt das
  Betretungsrecht ein – Verbündete marschieren durcheinander hindurch, sonst
  wären sie keine. Es setzt einen Pakt voraus,
  der schon **zehn Runden** gehalten hat – ein Bündnis ist kein Handschlag unter
  Fremden. Es bindet wie ein Pakt und bringt den **Bündnisfall**: wer deinen
  Verbündeten angreift, **steht damit auch mit dir im Krieg**. Das gilt für dich
  wie für alle anderen; der Knopf sagt es, ehe du unterschreibst. Nur wen sein
  eigenes Wort an den Angreifer bindet, der bleibt draußen.
  Aufkündigen lässt sich jeder Vertrag. Beim Pakt und beim Abkommen kostet das
  acht Punkte Ansehen, beim **Bündnis dreißig – und acht bei jedem, der davon
  hört**: wer seinen Verbündeten sitzen lässt, ist keiner.
  Die Herrscher schließen auch untereinander Verträge, und ein angriffslustiger
  Mann von wenig Ehre **kündigt sein Wort wieder auf**, wenn ihn die Gelegenheit
  lockt – dann steht die Kriegserklärung meist ein paar Runden später da.
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
  sie hat: **12,5 % ihrer Einwohner** treten unter die Waffen (höchstens 900,
  unter 40 gar nicht) und kämpfen als Stadtwache auf der eigenen Mauer mit –
  Massilia bringt so 450 Bürger auf, ein Dorf 113. Die 27 freien Orte stellen
  zusammen über 4.200 Mann: ein Handstreich gegen eine unabhängige Stadt kostet
  jetzt wirklich Legionen. Die Kampfvorschau nennt sie, damit ein
  Angreifer nicht überrascht wird, und die Aufklärung eines freien Orts weist
  sie aus. Nach der Schlacht gehen die Überlebenden zurück in die Gassen: auf
  der Mauer bleibt nur die eigene Stadtwache, und **die gefallenen Bürger
  fehlen dem Ort danach wirklich** – seine Einwohnerzahl sinkt.
- **Eine Belagerung führt ein Reich, nicht zwei**: Stehen die Heere zweier
  Fraktionen vor demselben Tor, dann belagert nur **eines** von beiden – das,
  das angefangen hat, solange es davorsteht, und sonst das stärkere. Das andere
  steht daneben: es schneidet nichts ab, hungert niemanden aus und bekommt den
  Ort auch nicht durch Warten. Wer ihn will, muss den Belagerer zuerst vom Feld
  schlagen. Die Ortsanzeige nennt beide – den Belagerer und den, der „ebenfalls
  davorsteht, die Belagerung aber nicht führt". Zieht der Belagerer ab und ein
  zweiter steht schon da, **beginnt die Belagerung von vorn**: die Frist bis
  zum Hunger läuft für den Neuen neu, er hat die Stadt ja nicht ausgehungert.
- **Was eine Eroberung anrichtet**: Eine Stadt, die im Sturm genommen wird, ist
  danach keine heile Stadt. Die **Mauer verliert eine Stufe** – eine Bresche ist
  keine Mauer –, und **jedes Bauwerk liegt mit 50 % Wahrscheinlichkeit in
  Trümmern**: Kaserne, Farm, Speicher, Verwaltung, Viadukt, Bergwerk, Hafen,
  Werft. Der neue Herr erbt eine Baustelle, keine Werkbank.
  Aufgebaut wird über den Trümmern **zum halben Preis und in der halben Zeit** –
  die Grundmauern stehen noch: eine Kaserne kostet statt 250 Gold und drei
  Runden noch 130 und zwei, eine Steinmauer wird ausgebessert statt neu
  aufgezogen. Der Bauen-Reiter sagt „🏚️ wieder aufbauen", der Info-Reiter führt
  auf, was in Trümmern liegt, und das Protokoll nennt nach jeder Eroberung, was
  der Sturm gekostet hat.
- **Das Lager**: Ein römisches Heer schlug jeden Abend ein Lager auf – Graben,
  Wall, Palisade, die Zelte in festen Gassen dahinter. Im Spiel kostet es
  **90 Gold** und **den Rest des Tages** (alle verbliebenen Bewegungspunkte)
  und gibt dafür dreierlei:
  **+40 % Verteidigung**, wenn das Heer im Lager angegriffen wird;
  **Rast wie in der eigenen Stadt** (Moral und Erschöpfung erholen sich
  schneller) und **halbes Wetter** – Schnee und Gluthitze zehren nur zur
  Hälfte;
  und, vor einer fremden Stadt aufgeschlagen, **die Belagerung selbst**.
  Wer abmarschiert, lässt Wall und Palisade stehen: das Lager gilt dann nicht
  mehr. Auf See und in einer eigenen Stadt gibt es keines – die Stadt ist eines.
  Der Wall ist kein Freibrief: gegen ein anderthalbfach überlegenes Heer fällt
  auch ein Lager. Er entscheidet den Kampf unter Gleichen.
  Auf der Karte steht dann ein Erdwall mit angespitzten Stämmen um die Zelte.
- **Das Belagerungslager**: Ein Lager **auf einem Feld neben einer feindlichen
  Stadt** löst die Belagerung aus, **ohne dass ein Sturm nötig wäre**: der Ort
  ist abgeschnitten, und der Hunger beginnt schon **nach einer Runde** statt
  nach dreien und zehrt stärker – **10 % der Besatzung** und **2 % der
  Einwohner** je Runde statt 6 % und 1,2 %. Damit gibt es zwei Wege über eine
  Mauer: den Sturm, der Männer kostet, und das Lager, das Zeit kostet.
  Auch die KI kennt ihn: was sie nicht stürmen kann, gräbt sie sich davor ein –
  über vierzig Runden gemessen liegen ihre Heere achtmal so oft vor einer
  fremden Stadt wie vorher, statt vergeblich gegen dasselbe Tor zu laufen.
- **Belagerung**: Steht ein feindliches Heer **unmittelbar neben einem Ort**,
  ist er belagert – und ein Hafenort auch dann, wenn eine feindliche **Flotte
  vor ihm kreuzt**. Es braucht keinen eigenen Befehl dafür: wer sich davorstellt,
  belagert. Eine Belagerung nimmt dem Ort alles, was von draußen kommt:
  **keine Steuer, kein Handel, kein Erz, kein Zuwachs**, die **Stadtwache stellt
  sich nicht nach**, und **jede Baustelle ruht** – neue lassen sich gar nicht
  erst eröffnen, auch kein Straßenbau. Ist der Hafen gesperrt, geht dort
  außerdem **kein Heer an Bord und läuft kein Schiff vom Stapel**.
  Nach **drei Runden** beginnt der Hunger: jede weitere Runde kostet **6 % der
  Besatzung** und gut ein Prozent der Einwohner – aus einem **Belagerungslager**
  heraus schon nach einer Runde und mit 10 %. Wer eine Mauer nicht stürmen
  will, muss sie also nicht stürmen – er muss nur warten.
  **Ausheben darf ein belagerter Ort weiterhin**: die Stadt soll sich wehren
  können, solange ihre Kaserne steht und der Schatz es hergibt.
  Die Seeräuber sind ausgenommen; sie haben ihre eigene Regel und sollen einem
  Reich nicht mit einem einzigen Segel die Steuer nehmen.
  Die Stadtansicht sagt es in einer roten Zeile über allem anderen – wer
  belagert, mit wie vielen Mann, seit wann und wann der Hunger beginnt –, die
  Reichsübersicht setzt ein ⚔️ vor den Ort und färbt seine Zeile, und wer eine
  eigene Stadt eingeschlossen bekommt, erfährt es im Meldefenster.
- **Orte wachsen**: In jedem Monat werden mehr Kinder geboren als Menschen
  sterben. Der Satz ist klein (0,35 % je Runde), aber er summiert sich: über ein
  Jahr gut vier Prozent, über zehn Jahre die Hälfte. Im Frühjahr und Sommer
  wächst ein Ort schneller als im Winter, und **steht ein feindliches Heer vor
  dem Tor, wächst gar nichts** – die Felder liegen brach. Über die Obergrenze
  seines Rangs kommt kein Ort hinaus: ein Dorf bleibt ein Dorf – es sei denn,
  ein **Kornspeicher** hebt sie. **Farm** und **Viadukt** beschleunigen den
  Zuwachs um die Hälfte beziehungsweise ein Viertel. Das Wachstum
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
  durchgehende Straße, oder auf beiden Seiten ein Hafen **am selben Meer** –
  vom Kaspischen fährt kein Schiff ins Mittelmeer, so nah die beiden auf der
  Karte auch aussehen.
  **Der Seehandel ist der große Handel**: ein Karren kommt **14 Felder** weit,
  ein Schiff **26**, und was über See kommt, trägt **40 % mehr**. Roma und
  Ravenna liegen an zwei verschiedenen Meeren und ohne Straße dazwischen – der
  Weg um den Stiefel herum bringt jeder Seite **11 Gold je Runde**, die
  Landstraße nach Capua vier. Dafür lohnt sich der Hafen, und dafür lohnt es
  sich, ihn zu schützen: Seeräuber vor einem der beiden Häfen nehmen die Hälfte.
  Auf der Karte liegt ein Seeweg als **Kette heller Bojen** über dem Wasser,
  genau auf dem Kurs, den die Händler wirklich fahren, mit einem Schiffszug in
  der Mitte. Mehr als zwei Wege trägt ein Ort nicht. Fällt ein Ende an den
  Feind oder reißt die Verbindung, endet der Weg. Die Reichsübersicht führt den
  Handel als eigene Spalte, und die KI handelt ebenfalls.
- **Ausbau zur Steinstraße**: Was Rom von einem Weg unterscheidet, ist der
  Unterbau: Schotter, Wölbung, Gräben zu beiden Seiten, oben Basaltplatten.
  Eine bestehende Verbindung lässt sich deshalb **ausbauen** – **45 Gold je
  Feld**, eine halbe Runde je Feld, und danach kostet ein Feld nur noch
  **einen** Bewegungspunkt statt zwei: ein Heer marschiert auf der Steinstraße
  **doppelt so weit** wie auf dem gefahrenen Weg, achtzehn Felder je Runde
  statt neun. Ausgebaut wird nur, was schon liegt, und nur von einem Ort mit
  **Verwaltung** aus – eine Steinstraße ist Vermessung, Fronarbeit und
  Abrechnung, kein Trampelpfad. Auf der Karte liegt sie als **helles
  Basaltband** statt als erdfarbener Weg, und das Feldfenster nennt die Stufe.
  Die KI baut aus, sobald ihr Netz steht und Gold übrig ist.
- **Straßenbau**: Von Anfang an möglich – jede eigene
  Stadt bietet die nächstgelegenen eigenen Orte
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

  **Das Startnetz ist eine einzige Straße je Fraktion**: die kürzeste, die von
  der Hauptstadt zu einer eigenen **Stadt** führt – höchstens acht Felder lang
  (gut 440 km), auf derselben Landmasse und ohne Meer dazwischen. Was sonst
  noch nahe liegt, verbindet der Spieler selbst; eine zweite Trasse ist eine
  Entscheidung, kein Erbe. **Kein Dorf** ist angebunden und **kein
  unabhängiger Ort**. Gemessen wird der gelaufene Weg, nicht die Luftlinie:
  zwischen Athen und Pergamon liegen acht Felder und die halbe Ägäis, zwischen
  Ekbatana und Susa sechs Felder und der Zagros. Damit eine Trasse nicht
  nebenbei ein Dorf anschließt, meidet die Wegsuche beim Aufbau die Felder
  fremder Orte: sie sind nicht gesperrt, nur teuer. In Zahlen: 15 der 16
  Fraktionen beginnen mit genau einer Straße (den Sarmaten liegt keine eigene
  Stadt nahe genug), kein Dorf und kein unabhängiger Ort hängt daran, und auf
  der ganzen Karte liegen **73 Straßenfelder**.
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
  gedrechselten Beinen, die auf dem Zeltboden stehen. **Zwischen dem letzten
  Feld und dem Rahmen ist kein Meer, sondern Papier** – das Blatt, auf das die
  Karte gezeichnet ist. Das Meer endet dort, wo die Felder enden; ein Ring aus
  vier Streifen in Pergamentfarbe füllt den Rand, mit derselben Faserung wie
  das Gelände darüber. Vorher lief das Wasser bis unter den Rahmen und man
  segelte am Rand über ein Meer, das es nicht gab.
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
- **Die Schatzkammer lebt von den Menschen, nicht von den Mauern**: Ein Ort
  wirft nichts dafür ab, dass es ihn gibt. Was er trägt, ist die **Steuer
  seiner Einwohner – ein Gold je 80 Einwohner und Runde**; dazu kommt, was ein
  Weltwunder vor seinen Toren, ein Handelsweg von ihm aus und ein Bergwerk in
  seinem Umland einbringen. Eine Große Stadt mit 6400 Einwohnern trägt damit
  80 Gold, ein Dorf mit 1400 siebzehn – und wer seine Orte wachsen lässt,
  verdient daran. Vorher gab es dieselbe Abgabe je Ort, gleich wie viele darin
  lebten; ein Reich nahm zu Beginn 274 Gold je Runde ein, jetzt 206.
  Dieselbe Rechnung läuft in der Rundenabrechnung – es gibt nur eine Wahrheit
  darüber, was eine Stadt wert ist.
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
- **Die Rangliste der Reiche** (Reiter **Fraktionen** in der Seitenleiste):
  Wer ist der **Mächtigste**, wer der **militärisch Stärkste**, wer der
  **Reichste**? Drei Knöpfe sortieren danach, und das Ergebnis ist eine
  **Rangliste, keine Akte**: je Reich der **Platz**, das Wappen, der Name, die
  Zahl, nach der sortiert wird, ein Balken im Verhältnis zum Ersten – und
  darunter **eine** knappe Zeile: `🏛️ Orte · ⚔️ Mann · 💰 Schatz` und die
  **Bilanz** (Einnahmen minus Sold je Runde) in Grün oder Rot. Sechzehn Reiche
  stehen so auf zwei Bildschirmlängen statt auf vier.
  Wer es genauer wissen will, hält den Zeiger auf eine Zeile: der **Tooltip**
  schlüsselt sie auf – Orte, Heere, Mann im Feld, Mann auf den Mauern,
  Einnahmen minus Sold.
  **Gezählt wird nur, was du kennst.** Ein Reich, dem noch keiner deiner Männer
  begegnet ist, steht nicht in der Rangliste – es hätte dort einen Platz, und
  schon der wäre eine Auskunft, die niemand hat. Es steht darunter, gestrichelt
  und ohne Zahlen: **„Ein unbekanntes Reich"** und eine Himmelsrichtung. Die
  Fußnote sagt, wie viele es noch sind. Wer einem fremden Heer oder einer
  fremden Stadt nahe kommt, lernt sie kennen – und von da an steht das Reich
  mit allem in der Liste.
  **Macht** ist dabei keine einzelne Zahl, sondern die Summe dreier: **zehn
  Punkte je Ort, einer je hundert Mann, einer je dreihundert Gold** – Land
  wiegt am schwersten, denn es trägt alles andere.
  Die Übersicht rechnet mit dem, was auf der Karte steht: sie ist der
  strategische Blick von oben. Was ein Herrscher vom anderen *weiß*, steht im
  Diplomatiefenster.
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
- **Rückgängig** (↩ oben rechts): nimmt **einen** Schritt zurück – Zug,
  Rekrutierung, Mauer- oder Straßenkauf, Auflösen oder ganzen Rundenwechsel.
  **Nur einen**: der Knopf ist da, damit ein Fehlklick nichts kostet, nicht
  damit man den Zug der Gegner mehrfach durchprobiert und sich die günstigste
  Fassung aussucht. Danach ist er ausgegraut, bis wieder etwas geschehen ist.
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
  Vier Regeln halten den Klang sauber, statt ihn lauter zu machen:
  - **Nichts doppelt sich selbst.** Jeder Klang hat eine eigene Sperrfrist
    (der Klick 70 ms, der Zusammenstoß eine halbe Sekunde). Zwanzig Klicks im
    Stakkato erzeugen so **zehn** Klänge statt zwanzig übereinander.
  - **Höchstens fünf auf einmal.** Fällt mehr zusammen, wird der Rest
    verworfen, ehe der erste Oszillator entsteht – das erspart dem Browser die
    Arbeit an dem, was ohnehin im Brei unterginge.
  - **Die Musik tritt beiseite.** Ein Zusammenstoß, ein Trommelschlag zum
    Rundenende, ein Hornruf senken die Musik für einen Augenblick um 30 bis
    50 % und heben sie danach wieder – so ist das Ereignis deutlich zu hören,
    ohne dass irgendetwas näher an die Übersteuerung rückt (gemessene Spitze
    am Ausgang: **0,22** von 1,0).
  - **Jeder Anschlag ein wenig anders.** Ein paar Cent Streuung je Ton und
    Trommelschlag, sonst klingen zwei Schläge wie einer, der zweimal abgespielt
    wurde.
  Und wenn eine Weile nichts zu hören ist, **hält sich der Tonapparat selbst
  an** und wacht beim nächsten Klang wieder auf – ein schlafender Kontext
  kostet keinen Strom.
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
- **107 Siedlungen in drei Größen**: **Große Stadt** (viel Bevölkerung, starke
  Garnison), **Stadt** (Normalmaß) und **Dorf** (klein – leicht zu nehmen und
  gute Sprungbretter). Was ein Ort trägt, hängt an seinen Einwohnern, nicht an
  seinem Rang. **Jede Fraktion beginnt mit denselben fünf Orten**: der
  Hauptstadt als Große Stadt, zwei Städten und zwei Dörfern. Wo einer sitzt,
  sagt die Geschichte; wie viel er hat, sagt diese Regel – kein Reich beginnt
  reicher als das andere. **27 Orte gehören niemandem** und sind frei zu
  erobern – von Gades bis Exopolis. Neun davon liegen im **Nordosten**, wo die
  Karte bisher leer war: Kremnoi am Maiotischen See, Azagarion und Karrodounon
  im Binnenland, Naubaris und Exopolis im asiatischen Sarmatien, Rha an dem
  Strom, der bei Ptolemaios so heißt, und Pityus, Phasis und Harmozica in
  Kolchis und Iberien – Namen aus Herodot, Strabon und Ptolemaios, wie Amadoka
  und Tanais auch. Sizilien, Sardinien, Kreta, Zypern, Rhodos, die Balearen und
  Britannien sind nur mit Schiffen erreichbar.
- **Gelände**: Ebene, Wald und Hügel wie bisher, dazu die **Wüste** – die
  Sahara und das arabische Binnenland sind zäh zu durchqueren und halten den
  Krieg in Afrika an der Küste.
- Die KI rechnet vor jedem Angriff dieselbe Vorschau wie du und lässt sich auf
  einen Kampf nur ein, wenn sie ihn voraussichtlich gewinnt.
- **Sie geht dorthin, wo noch niemand steht.** Ein Ziel, um das schon fremde
  Heere herumstehen, erscheint ihr um sieben Felder weiter entfernt, als es
  ist – je Heer im Umkreis von vier Feldern. Ohne diese Rechnung marschierten
  alle Reiche auf denselben unabhängigen Ort: er ist schwach, er liegt in der
  Mitte, und für jeden einzelnen Feldherrn war er die richtige Wahl. Am Ende
  ballten sich Heere aus vier Reichen um ein Dorf, während anderswo nichts
  geschah. Gemessen über die ersten 25 Runden drängen sich seither ein Drittel
  weniger Reiche vor denselben freien Ort.
- Sieg: alle gegnerischen Fraktionen ausschalten. Niederlage: die eigene
  Fraktion verliert alle Städte und Armeen.

## Struktur

- `js/geodata.js` – die Geografie in Grad: Küstenlinien, Inseln, Binnenmeere,
  Meerengen, Gebirgsrücken, Wälder und Flussläufe, dazu die Umrechnung
  Grad ↔ Feld
- `js/data.js` – Einheiten-, Gelände- und Fraktionsdefinitionen samt
  Fraktionsprofilen für die Auswahl, Siedlungen mit ihren echten Koordinaten
- `js/factionart.js` – die SVG-Bilder des Auswahlbildschirms, eines je Fraktion
- `js/territory.js` – wem welches Feld gehört: die Einflusssphäre der Orte,
  aus der Grenzlinien, taktische Sicht und die Grenzverletzung folgen
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
- `js/staemme.js` – die Züge aus dem Osten: wo sie aufbrechen, wogegen sie
  ziehen und was geschieht, wenn sie Land finden
- `js/ai.js` – einfache KI (Wirtschaft + Angriffsverhalten)
- `js/scene3d.js` – Three.js-Szene: instanziertes 3D-Gelände, Städte/Armeen als
  3D-Objekte, isometrische Kamera (Pan/Zoom), Raycasting-Feldauswahl
- `js/battle3d.js` – das Schaubild der Schlacht: eigene Szene, eigener
  Renderer, Klötze statt Modelle. Spielt Runde für Runde nach, was der
  Schlachtbericht schon enthält, und würfelt nichts eigenes
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

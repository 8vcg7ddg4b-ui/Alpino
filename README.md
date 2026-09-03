# Pax Aeterna – Rundenstrategie in 3D

Ein rundenbasiertes Strategiespiel im Stil von *Total War: Rome*. Die Kampagnenkarte
umfasst Europa, das Mittelmeer und Nordafrika und wird in echtem 3D (Three.js/WebGL)
aus einer isometrischen Kameraperspektive dargestellt; Bewegung, Seefahrt,
Belagerungen und Kämpfe finden direkt auf dieser Karte statt – es gibt keinen
separaten Schlachtbildschirm.

Die Kampagne spielt auf einer Karte, die **auf dem Tisch im eigenen Feldherrnzelt
liegt**: Holzrahmen ringsum, Zeltbahnen darüber, Fahnen in den Farben der
gewählten Fraktion an den Wänden – mit ihrem **Wappen** darauf: der Legionsadler
für Rom, das Tanit-Zeichen für Karthago, die Eule Athenes für Athen, der
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
geschnitzten Hochsitz mit Fellen.

Links davon steht auf einem eigenen Podest die **Rüstung des Reiches** auf
ihrem **Rüstungsständer**: dreibeiniger Fuß, gedrechselte Säule mit Wulst,
darüber eine hölzerne Büste – Brustform, zwei Schulterstücke, Halsklotz. Darauf
sitzt der Panzer, auf dem Halsklotz der Helm, daneben lehnen der Schild mit dem
Wappen und der Speer. Sie steht **einen Kopf größer** als vorher und ein Stück
weiter vorn: aus der Eröffnungsansicht war sie ein Fleck neben dem Feldzeichen,
jetzt liest man den Panzer, ohne heranzugehen. Es ist das eine Stück im Zelt,
an dem man sieht, wessen Heer man führt – der Thron sagt es nur über den Stil, das Feldzeichen nur über das
Wappen. Fünf Rüstungen, nach dem, was die Völker wirklich trugen: die
**gegliederte Schiene** Roms mit Schulterplatten und dem Querbusch des
Zenturio, der **Bronzepanzer** der hellenistischen Höfe mit hohem Helmbusch und
Nasenschutz, der **Leinenpanzer** des Westens mit Schulterlaschen, Zaddelsaum
und Kegelhelm, das **Kettenhemd** des Nordens mit Eisenkappe und Nackenschutz,
der **Schuppenpanzer** der Reiter aus der Steppe mit der Spitzhaube. Und auch
der Schild richtet sich danach: Rom trägt den langen Scutum, der Norden den
ovalen, Süden und Osten den runden.

**Draußen vor dem Zelt liegt die Landschaft, in der das Heer steht.** Der
Ausgang zeigte bisher überall dieselbe helle Fläche mit vier Zeltspitzen davor.
Jetzt richtet sich das Bild nach dem Umland der eigenen Hauptstadt: Rom sieht
auf das **Meer** mit einem Segel und einen Strand, die Germanen auf einen
dichten **Nadelwald** über einem grünen Rücken, die Parther auf die
**schneebedeckten Berge** Mediens, andere auf **Hügel**, **Dünen** oder eine
Baumreihe in der **Ebene**. Gezählt werden die Felder im Umkreis von vier, und
nicht jedes zählt gleich viel: Ebene ist der Regelfall und sagt am wenigsten,
ein Gebirge oder das Meer vor dem Zelt sagt alles. Vor der Landschaft stehen
die Zelte des eigenen Lagers und zwei **Wachen** in der Farbe des Reichs. Alles
ist auf den Türausschnitt beschnitten – ein Berg ist breiter als eine Tür – und
wird ohne den Dunst des Zeltinneren gezeichnet: draußen ist Tag.

Und bevor der erste Zug fällt, meldet sich der Erste Offizier: **„Ich grüße
dich, Herr. Lass uns die Schlachtkarte betrachten."**

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

In der Leiste unten steht die **Spielversion**; sie kommt aus `GAME_VERSION`
in `js/data.js` und wird mit `package.json` gleichgehalten, damit Anzeige und
Auslieferung nicht auseinanderlaufen.

Sobald der Spieler die erste Taste drückt, setzt die **Titelmusik** ein:
**„Aureate Legion"**, knapp drei Minuten, im Kreis. Sie läuft durch die
Fraktionswahl und verstummt, wenn das Zelt steht.

**Sie ist die einzige Aufnahme im Spiel.** Alles andere – Schritte, Schwerter,
Fanfaren und die neunzehn Fraktionshymnen – entsteht zur Laufzeit aus
Oszillatoren; das Titelstück liegt als Datei bei (`audio/aureate-legion.mp3`).
Abgespielt wird es als Medienelement, nicht als entschlüsselter Puffer: acht
Minuten Musik in den Klangzusammenhang zu entschlüsseln kostete zweihundert
Megabyte Arbeitsspeicher, ein Element streamt sie. Eingehängt wird es in
**dieselbe Signalkette** wie alles andere, und deshalb gilt für die Aufnahme
unverändert, was für die synthetischen Klänge gilt: Stummschalten, Ein- und
Ausblenden, und das kurze Beiseiteschieben, wenn ein Zusammenstoß dazwischen
kommt. Im gebündelten Artefakt steckt sie als Datenadresse in der HTML-Datei –
auch dort wird nichts nachgeladen, die Datei wächst dadurch von 1,9 auf 7,0 MB.

Lässt der Browser die Aufnahme nicht zu, springt das **frühere Titelstück**
ein: ein Stück in d-Moll, das sich Takt für Takt selbst weiterschreibt – Bass
und Blech tragen die Harmonie, ein Streicherteppich hält sie zusammen, die
Kriegstrommel gibt den Schritt, und im zweiten Durchgang kommt die Melodie
dazu. Lieber die alte Fassung als Stille.

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
der neunzehn hat ihr eigenes Stück – wieder keine Aufnahme, sondern eine
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

### Der Startbildschirm: der Feldherrnblick

Das Startbild ist **ein Bild**, das den ganzen Schirm füllt, und darüber liegt
alles Übrige. Man sieht einen Mann in rotem Mantel auf einer Terrasse über
einer Hafenstadt am Meer: dahinter die Berge, unter ihm der Kai mit den
Schiffen, neben ihm das Feldzeichen, vor ihm der Tisch mit Karte und Helm. Es
ist der Augenblick vor dem Feldzug.

Vorher standen hier **drei Tafeln nebeneinander** wie ein Altarbild – Chronik
links, Titel und Menü in der Mitte, Merktafel rechts. Das war ordentlich, aber
es war ein Inhaltsverzeichnis, kein Titelbild: man sah zuerst drei Kästen und
erst danach, worum es geht. Jetzt sieht man zuerst das Land, um das gespielt
wird.

- **Der Titel** steht oben links: Lorbeer und Adler, **PAX AETERNA** in zwei
  Zeilen aus Gold, darunter das Jahr **264 v. Chr.** zwischen zwei Strichen und
  die Zeile *Rundenbasiert. Strategisch. Zeitlos.*
- **Das Menü** darunter, in derselben Spalte: eine **Tafel je Eintrag**, mit dem
  Zeichen in einem eigenen Feld, dem Namen in Kapitälchen und einem Beisatz
  darunter. Der hervorgehobene Eintrag trägt Rot – er ist der, um den es geht.
  Sechs feste Einträge: **Neues Spiel**, **Chronik**, **Letzter Feldzug**,
  **Spielregeln**, **Einstellungen**, **Vollbild** – und ein siebter,
  **Fortsetzen**, der nur erscheint, wenn ein Feldzug wartet (siehe
  „Spielstand" weiter unten); erscheint er, trägt er das Rot, nicht mehr
  Neues Spiel.
  Kranz und Zeichen waren zunächst Emoji (🌿🦅🏛️📜⚱️📖⚙️⛶) – bequem, aber nicht
  im Bild: ein Emoji sieht auf jedem Betriebssystem anders aus, in eigenen
  Farben, mit eigenem Strichgewicht. Jetzt sind es **gezeichnete Linien**
  (`js/ornaments.js`), in demselben Gold wie der Rahmen der Tafeln – ein
  Lorbeerzweig auf jeder Seite, dazwischen derselbe Legionsadler, der auch auf
  der Fahne im Zelt steht (`emblems.js`), und sechs Zeichen im selben
  Strichgewicht statt sechs verschiedener Schriftarten.
  Mit **Pfeil hoch/runter** springt der Fokus durch die sechs Tafeln, mit
  **Enter** wird die fokussierte gedrückt, **Escape** schließt eine
  aufgeschlagene Tafel wieder – und ein eigener goldener Ring um die Tafel
  zeigt, wo die Tastatur gerade steht, getrennt vom Leuchten unter der Maus.
- **Die Tafel rechts** tritt hervor, wenn Chronik, Andenken oder Regeln
  aufgeschlagen werden, und verschwindet wieder. Sie ist so hoch wie ihr
  Inhalt, nicht so hoch wie der Schirm.
- **Der Blick in die Chronik**: solange keine Tafel aufgeschlagen ist und der
  Schirm breit und hoch genug dafür ist, steht rechts unten eine kleine Karte
  mit Jahr und Titel einer Chronik-Geschichte, alle sieben Sekunden eine
  andere. Ein Klick öffnet die Chronik genau dort, statt irgendwo zufällig.
  Auf schmalem oder flachem Schirm bleibt sie ganz weg – dort fehlt der Platz,
  den `.title-left` und `#titleSheet` schon für sich beanspruchen.
- **Die Leiste unten** trägt links die **Spielversion**, daneben drei
  Merkmale. Zwei davon sind Türen zur Tafel, keine reine Zierde: „Zeitalter
  der Reiche" öffnet die Chronik, „Rundenbasiertes Strategiespiel" die
  Spielregeln – dieselbe Tafel, nur ein zweiter Weg dorthin.

**Was in der Tafel steht:**

- **Die Chronik** – acht Bilder der römischen Republik, von der Vertreibung der
  Könige 509 v. Chr. über die Via Appia und Hannibals Alpenübergang bis Actium
  31 v. Chr., mit ‹ › und Punkten zum Blättern. Sie läuft **nur, solange die
  Tafel offen ist**: ein Bild, das niemand sieht, muss auch niemand zeichnen.
- **Der letzte Feldzug** – Reich, Ausgang, Jahr, Runden, Orte, Mann im Feld,
  Schatz und die letzte Schlacht. Aufgeschrieben wird er, wenn ein Feldzug
  **entschieden** ist, gewonnen oder verloren; er liegt im Browser. Wer noch
  nie gespielt hat, liest dort stattdessen in drei Sätzen, worum es geht.
  Ein Feldzug, der nur **unterbrochen** wurde, steht hier nicht – der wartet
  als Spielstand auf die Kachel „Fortsetzen".
- **Die Spielregeln** – die Bedienung in einem Dutzend Sätzen.

**Das Bild ist gezeichnet, nicht fotografiert.** Wie alles Bildliche hier ist
es **reines SVG** (`js/titlescene.js`), zur Laufzeit zusammengesetzt aus
geschichteten Silhouetten – dieselbe Bildsprache wie die Chronik, nur dichter
gestaffelt, weil dieses eine Bild stehen bleibt statt weiterzuziehen. Keine
Bilddatei: das Spiel läuft als einzelne HTML-Datei und ohne Netz. Es wandert
sehr langsam, damit es nicht ganz stillsteht, und ein Schleier dunkelt die
linke Seite ab, damit die Schrift darauf steht statt darin zu schwimmen.

Drei kleine Bewegungen halten es zusätzlich am Leben, jede für sich unauffällig:
das **Feuer im Leuchtturm** flackert, das **Tuch am Feldzeichen** schwingt
leicht im Wind, während Stange und Kranz starr bleiben, und das **Glitzern auf
dem Wasser** blinkt Punkt für Punkt mit eigener Verzögerung statt im
Gleichtakt. Alles reines CSS (`.tscn-flame`, `.tscn-cloth`, `.tscn-sparkle` in
`css/style.css`), und alles steht still, wenn das Betriebssystem reduzierte
Bewegung verlangt.

**Wird es schmal**, rückt zuerst die Tafel über das ganze Bild; unter 700
Punkten stehen Titel, Menü und Leiste untereinander, das Bild bleibt dahinter,
und die Leiste wird nach unten gedrückt.

### Der Spielstand

Ein Feldzug, der über das Menü verlassen wird, ist nicht zu Ende – er wartet
(`js/savegame.js`). Gespeichert wird im Browser, bei jedem Rundenwechsel und
noch einmal beim Verlassen über das Menü, damit auch das, was seit der letzten
Runde geschehen ist, nicht verloren geht. Die Karte selbst gehört nicht zur
Ablage: sie entsteht aus einer festen Startzahl byte-gleich neu, sobald sie
gebraucht wird, und nur was sich seither verändert hat – Städte, Heere,
Fraktionen, Beziehungen, das Protokoll – wird tatsächlich weggeschrieben.

Ist ein Spielstand da, erscheint im Hauptmenü die Kachel **Fortsetzen** und
übernimmt das Rot von Neues Spiel; ein Klick geht ohne Fraktionswahl und ohne
Ansprache im Zelt direkt auf die Karte, an die Stelle, an der der Feldzug
verlassen wurde. Ein **entschiedener** Feldzug – gewonnen oder verloren –
räumt seinen Spielstand dagegen ab: er bekommt sein Andenken auf der
Merktafel, aber nichts mehr, das „Fortsetzen" zurückholen könnte.

### Die Ausgangslage

Auf der Fraktionswahl steht über der Fraktionsliste eine zweite Wahl: in
welchem Jahr der Feldzug beginnt (`js/scenarios.js`). Karte, Fraktionen und
Regeln bleiben für jede Ausgangslage dieselben - was sich ändert, ist nur die
Lage am ersten Tag:

- **264 v. Chr. – Der Erste Punische Krieg**: die Ausgangslage, die es schon
  immer gab. Rom und Karthago stehen noch nicht im Krieg miteinander.
- **218 v. Chr. – Hannibals Krieg**: der Krieg ist schon erklärt. Karthago
  hält mit Karthago Nova seinen spanischen Brückenkopf, den es 264 v. Chr.
  noch nicht gab, und steht von der ersten Runde an mit Rom im Krieg - über
  dieselbe Kriegserklärung, die auch die KI und der Spieler mitten im Spiel
  benutzen, mit denselben Folgen für Meinung und Bündnisfall.

Der Kalender selbst zählt in jeder Ausgangslage gleich (`calendarOfTurn` in
`js/weather.js` nimmt das Startjahr als Parameter); nur die Zahl, von der er
herunterzählt, ist eine andere, und die steht von da an überall, wo ein Jahr
angezeigt wird. Ein Szenario kann außerdem einzelne Orte einer anderen
Fraktion geben, als sie ihn sonst hätte (`cityOverrides`) - wo welches Heer
steht und wie stark es ist, ergibt sich wie immer allein aus den
Hauptstädten, nicht aus eigens gesetzten Truppen.

## Bedienung

- **Die Rundenbilanz**: Was sich mit dem Rundenwechsel am eigenen Reich
  verändert hat, steht als schmaler Streifen unter der Kopfzeile – „💰 Schatz
  +172 · 👥 Einwohner +73 · 🛡️ Stadtwache +4". Er hält niemanden auf: kein
  Fenster, kein Knopf, nach neun Sekunden geht er von selbst wieder. **Nur was
  sich bewegt hat, steht darin** – eine Tafel voller Nullen sagt nichts, und
  wenn sich gar nichts bewegt hat, kommt sie überhaupt nicht. Gezählt werden
  Schatz, Einwohner, Orte, Mann im Feld, Heere, Stadtwache und Schiffe.
  Dieselbe Zahl steht **neben dem Schatz in der Kopfzeile** (grün, wenn er
  wächst, rot, wenn er schrumpft), und **jeder Ort zeigt seinen eigenen
  Zuwachs** neben der Einwohnerzahl – in der Feldauskunft wie in der
  Reichsübersicht: „6.429 +29". Eine Zahl allein sagt nicht, ob sie steigt oder
  fällt, und genau das ist das, was man von ihr wissen will.
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
- **Schlachtordnung**: Vor jeder Schlacht steht eine Entscheidung, die nichts
  mit der Zahl der Männer zu tun hat: **wie sie stehen**. **Sechs Ordnungen für
  den Angriff, sechs für die Verteidigung**, und jede hat ihren Preis.

  | Angriff | was sie tut | wofür sie taugt |
  | --- | --- | --- |
  | 🔻 **Keil** | schlägt +9 % härter zu, fängt +6 % härter ein | wenn das ganze Heer ohnehin ins Gefecht kommt |
  | 🪝 **Umfassung** | +7 % Frontbreite, +4 % Kraft **mit** einem Fünftel Reiterei (−3 % ohne), dafür +5 % Treffer | bei Übermacht, die sonst hinten steht |
  | 🏹 **Beschuss** | Eröffnung wiegt +30 %, Handgemenge −3 %, Gegner −2 % | mit vielen Schützen; kostet die wenigsten Männer |
  | 📐 **Schiefe Schlachtordnung** | +13 % Schlagkraft, aber −10 % Frontbreite und +10 % Treffer | für ein kleines, hartes Heer, das an *einer* Stelle gewinnen will |
  | 💨 **Sturmlauf** | +11 % Schlagkraft, +12 % Treffer, Eröffnungssalve −40 %, **+6 Erschöpfung** | gegen eine wankende Linie, wenn es heute entschieden sein muss |
  | 🎭 **Scheinflucht** | +2 % Schlagkraft, Gegner −10 %, Front −5 %; **+9 % mit einem Drittel Reiterei, −12 % ohne** | mit einem Reiterheer; kostet von allen Angriffsordnungen die wenigsten Männer |

  | Verteidigung | was sie tut | wofür sie taugt |
  | --- | --- | --- |
  | 🛡️ **Schildwall** | Angreifer −5 %, eigener Schlag −3 %, Front −2 % | wenn es nur ums Aushalten geht |
  | 📏 **Breite Front** | +8 % Frontbreite, eigener Schlag −2 %, Angreifer +1,5 % | bei großer Garnison oder Übermacht |
  | ⚡ **Gegenstoß** | +6 % Schlagkraft, Angreifer +3 % | wenn die Entscheidung schnell fallen soll |
  | 🦔 **Igel** | Angreifer −14 %, eigener Schlag −10 %, Front −8 % | umzingelt, gegen Reiterei; schont die eigenen Reihen |
  | ⛰️ **Höhenstellung** | Salve ×1,35, Angreifer −7 %; **im Wald, Hügel- und Bergland zusätzlich −10 %, in der Ebene +4 %** | mit Schützen auf dem Berg – in der Ebene die falsche Wahl |
  | 🏳️ **Rückzugsgefecht** | Angreifer −12 %, eigener Schlag −18 %; **halbe eigene Verluste, aber das Feld ist verloren** | wenn das Heer wichtiger ist als der Ort |

  Keine ist immer richtig, und das ist der Sinn. Gemessen über je 6 000
  durchgerechnete Schlachten – zehn Kräfteverhältnisse von Gleichstand bis zur
  zweieinhalbfachen Übermacht, je 600 Würfe:

  | Lage | beste Ordnung | gegen |
  | --- | --- | --- |
  | Angriff im offenen Feld | Keil / Beschuss / Sturmlauf 70 % | Umfassung 68 % |
  | Angriff mit 45 % Reiterei | **Scheinflucht 90 %** | alle anderen 80 % |
  | Verteidigung im Gebirge | **Höhenstellung 51 %** | Schildwall 48 %, Breite Front 44 % |
  | Verteidigung in der Ebene | Schildwall / Gegenstoß / Igel 30 % | Höhenstellung 27 % |

  Und die Kosten trennen sie noch deutlicher als die Erfolge: im offenen Feld
  kostet der Sturmlauf 361 Mann, der Keil 349, die Scheinflucht 326 – und wer
  sich verteidigt, zahlt mit dem Gegenstoß 380, mit dem Igel 339 und mit dem
  **Rückzugsgefecht 191**. Das Rückzugsgefecht **gewinnt in keiner einzigen
  Lage** (0 %): nach der sechsten Runde setzt sich ab, wer so ficht, und das
  Feld – auch die eigene Stadt – gehört dem Gegner. Dafür kommt gut die Hälfte
  der Männer heim, die jede andere Ordnung dort gelassen hätte. Es ist die
  einzige Ordnung, die man wählt, um zu verlieren.

  **Gewählt wird an zwei Stellen.** Die **Angriffsordnung** steht in der
  Kampfvorschau, als sechs Knöpfe über der Prognose – und die Prognose darunter
  rechnet sofort mit der gewählten neu. Die gewählte bleibt als Vorgabe für den
  nächsten Angriff stehen. Die **Verteidigungsordnung** ist ein **stehender
  Befehl** und steht im Reichsfenster (🏛): wer angegriffen wird, wird nicht
  gefragt – ein fremdes Heer steht vor dem Tor, und der Befehl muss vorher
  gegeben sein.
  Die **KI wählt nach dem, was sie mitbringt**: ein Drittel Reiterei unter
  einem Draufgänger reitet die **Scheinflucht**, ein Fünftel Reiterei in großen
  Heeren **umfasst**, wer viele Schützen hat, lässt sie zuerst arbeiten, wer
  weder das eine noch das andere hat und keine Geduld, geht im **Sturmlauf**
  vor, ein kleines hartes Heer schlägt **schief**, und sonst steht der Keil.
  Verteidigt wird nach dem Wesen ihres Herrschers – der Draufgänger stößt
  entgegen, der ganz Vorsichtige stellt den **Igel**, der Schützenreiche sucht
  die **Höhe**. Das **Rückzugsgefecht wählt die KI nie**: sie gibt keine Stadt
  freiwillig auf. Es bleibt die Ordnung des Spielers, der weiß, wann ein Heer
  mehr wert ist als ein Ort.
  Der **Schlachtbericht nennt beide Ordnungen**.
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
  gewohnten Schlachtbericht.
  **Auch eine Schlacht, in der man nicht selbst angegriffen hat, lässt sich
  ansehen.** Ein fremder Angriff auf die eigenen Orte wird gefochten, während
  man anderswo ist – die Meldung darüber kommt erst beim Rundenwechsel. Unter
  **jedem** Schlachtbericht steht deshalb der Knopf *„🎬 Die Schlacht
  ansehen"*: er zeigt dieselbe 3D-Ansicht und kehrt danach zum Bericht zurück.
  So kommt man von der Meldung „Eine Feldschlacht – Niederlage bei Capua" über
  den Bericht zu dem Bild, das dazugehört. Das Fenster hat seinen eigenen Renderer und räumt
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

  Die **dritte Ausbaustufe** macht aus dem Schaubild eine Schlacht:
  - **Gestalten statt Klötze**: Auf dem Feld steht keine Reihe von Quadern
    mehr, sondern eine Reihe von Männern – Fußvolk mit Schild und Speer,
    Schützen mit dem Bogen, die Stadtwache hinter dem großen Schild, Reiter zu
    Pferd mit der Lanze. Keiner steht wie der andere: Platz, Drehung und Größe
    schwanken ein wenig. Wer ficht, stößt zu; wer fällt, kippt zur Seite. Damit
    das bezahlbar bleibt, wird jede Gattung aus ihren Teilen zu **einer**
    Geometrie verschmolzen und als Instanzenwolke gezeichnet – hundert
    Fußsoldaten kosten einen Zeichenaufruf.
  - **Die Linien berühren sich**: Der Abstand, in dem die Fronten
    zusammentreffen, ist von 3,6 auf 1,6 zusammengezogen. Zwischen Quadern
    durfte eine Lücke bleiben, Männer, die sich mit dem Speer erreichen sollen,
    müssen dicht aneinanderstehen.
  - **Das Gelände steht da**: Bisher war das Schlachtfeld eine eingefärbte
    Fläche. Jetzt steht im **Wald** der Wald, in den **Hügeln** ziehen sich
    Kuppen hinter der Linie hin, in der **Wüste** liegen Dünen und Steine, im
    **Gebirge** stehen Felsen, in der **Ebene** Büsche und ein einzelner Baum.
    Alles bleibt am Rand – hinter den Linien und weit auf den Flanken –, denn
    was zählt, ist, wer noch steht, und davor darf kein Baum stehen. Das
    Gelände ist für dieselbe Schlacht immer dasselbe.
  - **Das Wetter des Feldzugs steht über der Schlacht**: Sagt der Bericht, es
    habe geregnet und deshalb keine Salve gegeben, dann regnet es hier auch.
    Regen, Sturm, Schnee, Sandsturm und Gluthitze bringen ihre Tropfen, Flocken
    und Böen mit, färben den Himmel und ziehen den Dunst näher heran; Nebel und
    Wolken tun das ohne Niederschlag. Bei klarem Wetter steht ein dunstiger
    Tageshimmel über dem Feld, in den die Ebene am Horizont übergeht.
  - **Der Sturm auf die Mauer**: Aus dem Riegel aus Kästen ist eine
    Befestigung geworden – die **Palisade** eine Reihe gespitzter Stämme, die
    **Stadtmauer** ein durchgehender Quaderriegel mit Zinnenkranz, zwei Türmen
    und einem Tor aus Bohlen. Der Angreifer läuft nicht mehr gegen die Männer
    dahinter an, sondern **gegen die Mauer**, und legt seine **Leitern** an,
    sobald das Handgemenge beginnt. Der Verteidiger marschiert nicht auf: er
    steht schon, und zwar auf dem **Wehrgang** hinter der Brüstung, sichtbar
    über der Mauer. Wer dort fällt, stürzt hinunter; wer flieht, kommt herab.
  - **Die Kamera geht mit**: Beim Aufmarsch steht sie weit weg und zeigt beide
    Linien, beim Zusammenprall **rückt sie heran** – nah genug, dass man die
    Gestalten unterscheidet –, und wenn der Verlierer flieht, weicht sie
    zurück, damit man sieht, wohin. Vor einer Mauer tritt sie auf die Seite des
    Angreifers und höher, sonst liefe die Mauer als Zaun in den Vordergrund und
    stünde vor allem, was dahinter geschieht.
  - **Schiffe mit Rammsporn und Riemen**: Zur See haben die Modelle Heck,
    Steuerruder, sieben Riemen je Seite, eine Rah am Mast und den **Rammsporn**
    dicht über der Wasserlinie, mit dem die meisten Seeschlachten dieser Zeit
    endeten.
  - **Die Gefallenen bleiben liegen, wo sie gefallen sind.** Sie hingen an
    derselben Aufstellung wie die Lebenden – und die weicht am Ende vom Feld.
    Mit dem geschlagenen Heer zog sich deshalb auch sein Leichenfeld zurück,
    und am Ende lag auf dem Schlachtfeld niemand mehr. Jetzt merkt sich jeder
    Gefallene die Stelle, an der er gefallen ist: die Überlebenden fliehen, die
    Toten bleiben, und was zwischen den beiden Linien liegt, ist das, was die
    Schlacht gekostet hat.
  - **Wo kein zweites 3D-Fenster zu haben ist, bleibt das Schaubild zu.** Es
    braucht einen zweiten WebGL-Zusammenhang neben dem der Karte, und den gibt
    nicht jedes Gerät her – manche Browser, allen voran Safari auf dem Telefon,
    halten nur einen einzigen offen. Der zweite wurde stillschweigend
    verweigert, three.js stolperte über die erste Abfrage an ihm
    (*„null is not an object … getShaderPrecisionFormat"*), und der Fehler riss
    das ganze Spiel mit: die Tafel **„Pax Aeterna konnte nicht starten"** stand
    mitten im laufenden Feldzug, nur weil ein Angriff angesehen werden sollte.
    Jetzt wird erst geprüft und dann gebaut, und beides in einem Netz: geht es
    nicht, sagt eine Zeile am Bildrand Bescheid und der Angriff läuft ohne
    Schaubild weiter. Dazu behält das Schaubild seinen **einen** Zusammenhang
    über alle Schlachten hinweg – vorher legte jede angesehene Schlacht einen
    neuen an, und ein Browser gibt nur eine Handvoll her. Und ein Fehler, der
    im laufenden Spiel auftritt, zeigt nicht mehr die Starttafel: das Spiel
    läuft weiter, und eine Zeile am unteren Rand sagt, was war.
  - **Ein verladenes Heer fährt auf Transportern.** Wo ein Heer über See
    angegriffen wird, standen bisher dieselben Kriegsschiffe wie in einer
    Seeschlacht – Rammsporne und Riemenreihen, wo bauchige Getreidesegler
    liegen. Jetzt erkennt das Schaubild den Fall am Bericht (keine Schiffe,
    aber Mannschaft) und zeigt **so viele Transporter, wie das Heer braucht** –
    fünfzig Mann auf einen Rumpf –, mit breitem Rahsegel und den Schilden des
    Heeres an der Reling.

  Die **vierte Ausbaustufe** gibt der Schlacht Bewegung, Boden und Gerät:
  - **Die Gestalten sind gegliedert**: Eine Gestalt ist nicht mehr ein Stück,
    sondern vier – Rumpf, linkes Bein, rechtes Bein, Waffenarm –, jedes um
    seinen Drehpunkt gebaut (Hüfte, Schulter) und mit seiner eigenen
    Instanzenwolke. Damit **gehen** sie im Aufmarsch, statt zu gleiten: die
    Beine schwingen im Tritt, die Reiterei in ihrem eigenen, schnelleren Takt.
    Wer ficht, **stößt mit dem Speer zu** und zieht ihn zurück; wer gefallen
    ist, liegt still. Das kostet vier Zeichenaufrufe je Gattung statt einem –
    bei zweihundert Gestalten ist das nichts.
  - **Die Front zerfasert im Handgemenge**: Bisher schoben sich zwei
    geschlossene Blöcke ineinander. Jetzt **tritt die vorderste Reihe heraus**,
    sobald es zum Schlagen kommt, und sucht sich ihren Gegner; dahinter bleibt
    die Ordnung stehen. Aus zwei Rechtecken wird eine Kampflinie, die sich
    verhakt.
  - **Die gewählte Schlachtordnung steht auf dem Feld**: Was vor dem Angriff
    ausgesucht wurde, sieht man auch. Der **Keil** läuft spitz zu und wird nach
    hinten breiter. Die **Umfassung** stellt sich flacher und schickt die
    Reiterei auf die **Flügel**. Der **Beschuss** schiebt die Schützen als
    lockere Plänklerlinie nach vorn. Der **Schildwall** steht tiefer, enger und
    hält den Schild vor sich, statt zuzustoßen. Die **breite Front** zieht sich
    über die ganze Breite des Feldes. Der **Gegenstoß** wartet nicht: er geht
    dem Angreifer weiter entgegen als jede andere Ordnung.
  - **Der Boden ist nicht mehr eben**: Das Feld hat ein **Höhenprofil** – ein
    Hang, wenn eine Seite die Höhe hält, dazu eine flache Welle. Jede Gestalt,
    jede Fahne, jede Mauer und jedes Gerät steht auf der Höhe, die an ihrer
    Stelle gilt; wer marschiert, geht mit dem Boden auf und ab. Das Profil ist
    für dieselbe Schlacht immer dasselbe.
  - **Ein ganzer Ort, nicht eine Wand**: Bisher stand vor dem Angreifer eine
    einzelne Mauer und dahinter nichts – man stürmte gegen eine Kulisse. Jetzt
    steht dort der **Ort selbst**: **vier Mauerläufe** im Geviert, jeder mit
    seinem **Tor** aus zwei Flügeln unter einem Sturz, **sechs Türme** – an
    jeder Ecke einer und zwei, die das Haupttor flankieren –, und dazwischen
    **zwölf Häuser** in drei Reihen, jedes mit vierseitigem Dach in der Farbe
    des Verteidigers. Bei der **Palisade** sind es gespitzte Stämme und ein
    Torbau aus Bohlen, bei der **Stadtmauer** Quader mit Zinnenkranz und
    runden Türmen. Der Wehrgang liegt, wo er lag, und alles, was auf die Mauer
    zielt – Leiter, Widder, Belagerungsturm, die Bresche –, rechnet
    unverändert gegen die **vordere** Mauer: der Ort ist dahinter gewachsen,
    nicht davor.
  - **Sturmgerät vor der Mauer**: Zu Leitern und Wehrgang kommt, was eine
    Belagerung wirklich brauchte. Der **Widder** rollt unter seinem Satteldach
    an das Tor und schlägt zu – bei jedem Schlag bebt das Tor. Vor einer
    **Stadtmauer** (nicht vor einer Palisade) schiebt sich ein
    **Belagerungsturm** mit halb heruntergelassener Fallbrücke an die Brüstung.
    Und hinter der eigenen Linie steht auf der Flanke ein **Katapult**, dessen
    Arm ausholt und vorschnellt.
  - **Staub über der Kampflinie**: Solange gefochten wird, steht eine Wolke
    aufgewirbelten Bodens über den Köpfen – in der Farbe des Geländes, auf dem
    gefochten wird, aber heller, wie Staub, der in der Luft hängt. Sie steigt,
    verweht und verschwindet, sobald die Linien sich lösen.
  - **Pfeile, die nach Pfeilen aussehen**: Der Schaft war zwölf Zentimeter
    dick – neben gegliederten Gestalten sah eine Salve aus wie ein Regen
    geworfener Balken. Jetzt hat ein Pfeil Schaft, Spitze und Fiederung, ist so
    dünn, wie ein Schaft ist, und trägt nur einen Hauch der Feldzeichenfarbe im
    dunklen Holz. Es fliegen **sechzig** statt vierunddreißig.
  - **Je Runde ein Klang**: Fliegt eine Salve, hört man erst den **Hagel** –
    das Sirren der Sehnen, den Flug, das Prasseln auf Schilde und Boden –, dann
    den **Zusammenprall**. In jeder weiteren Runde nur den Zusammenprall, kurz
    und leiser als der erste: in voller Stärke wäre er nach drei Runden nicht
    mehr auszuhalten. Der **Widder** schlägt in seinem eigenen Takt gegen das
    Tor, und wenn es entschieden ist, geht das **Horn** über das Feld.
- **Vier Schiffsarten, bis zu drei je Fraktion**: die **Quinquereme** mit Turm
  und Enterbrücke (50/52, 220 Gold) – schwer und im Rammstoß überlegen; die
  **Triere**, das Arbeitspferd jeder Flotte (46/45, 190 Gold) – wendig genug zum
  Rammen, stark genug für die Linie; der illyrische **Lembos** (44/36, 150 Gold)
  – schnell und billig, aber dünnwandig; und das **Segelschiff** mit
  hochbordigem Eichenrumpf und Ledersegel (36/54, 195 Gold) – schwer zu rammen,
  schwach im Angriff. Welche eine Fraktion bauen kann, sagt ihre Küste: Rom,
  Karthago, Pontus und die Ptolemäer haben alle drei Ruderbauarten, Athen und
  Syrakus ebenso (Athen mit der Triere als Hauptbauart, Syrakus mit der
  Quinquereme), Sparta nur Triere und Lembos, Illyrer, Iberer und Numidien den
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
  **Dasselbe gilt beim Zusammenlegen.** Zwei eigene Flotten verschiedener
  Bauart legen sich **nicht** zusammen: das Feld der einen ist für die andere
  kein Ziel. Vorher ging es – und danach fuhr der ganze Verband die Bauart
  derjenigen, auf die man gezogen war: eine Flotte Trieren, die dreißig
  Quinqueremen aufnahm, hatte danach sechzig Trieren, und dreißig schwere
  Rümpfe hatten sich stillschweigend in leichte verwandelt. Flotten
  **derselben** Bauart legen sich weiterhin zusammen, und ein Heer auf
  Transportern kennt die Frage ohnehin nicht.
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
- **Angeklickt wird, was man sieht.** Der Klick sucht sich sein Feld lange nur
  am **Boden**: der Strahl ging durch Mauern, Dächer und Zelte hindurch und traf
  die Erde *dahinter*. Bei einem Dorf fiel das kaum auf; bei einer Großen Stadt
  lagen zwischen dem, was man anklickte, und dem, was ausgewählt wurde, **ein
  bis zwei Felder**. Wer als Athen sein Heer in die Stadt zog, klickte danach
  auf ein Modell, das gar nichts auswählte – das Heer war nur noch über den
  schmalen Streifen Boden davor zu erreichen, und wirkte darum unerreichbar.

  Jetzt zählen **Ort und Heer selbst** als Ziel: ein Klick auf Mauer, Dach oder
  Zelt wählt das, was dort steht. Mit einer Einschränkung, die ebenso wichtig
  ist – **ein Modell nimmt einen Klick nur an sich, wenn dahinter freies Land
  liegt.** Sonst nähme eine hohe Stadt jedem Heer, das hinter ihr steht, den
  Klick weg, und der Fehler wäre bloß umgezogen. Wer auf ein Feld zielt, auf dem
  selbst etwas steht, meint das, was dort steht.
- **Stehen Heer und Ort auf demselben Feld**, wechselt jeder weitere Klick
  zwischen beiden: erst das Heer, dann der Ort, dann wieder das Heer. Bei einem
  Stadtstaat wie Athen ist das der Regelfall – dort hat das Heer nur diesen
  einen Ort.
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
- **Die Windrose**: In der **unteren linken Ecke der Karte**, über den
  Steuerknöpfen, steht eine goldene Windrose. Sie dreht sich mit der Kamera:
  die helle Spitze und das **N** zeigen immer nach Norden, gleich wohin der
  Blick geschwenkt ist – in der Grundansicht also nach oben rechts. Wer die
  Karte gedreht hat und nicht mehr weiß, wo Gallien liegt, sieht es dort. Sie
  ist eine Auskunft und kein Knopf: Klicks gehen durch sie hindurch auf die
  Karte.
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
  Aushebungsknopf steht alles: `120 Gold · −100 Einw. · ⏳ 2 Runden`.
  Über 120 Runden gemessen hält das die Karte im Gleichgewicht: die
  Gesamtbevölkerung steht die erste Spielhälfte still und wächst danach wieder.
- **Eine Aushebung kostet Zeit**: Und das ist die dritte Rechnung, die härteste
  von allen. Eine Aushebung war lange ein Kauf: Gold hin, hundert Mann her, in
  derselben Runde in der Wache und in der nächsten schon im Feld. Wer Gold
  hatte, hatte binnen drei Runden ein Heer, und die einzige Grenze war die
  Truhe. Ein Legionär entsteht aber nicht auf dem Markt, sondern auf dem
  Exerzierplatz.

  **Zwei Bremsen greifen ineinander.** Die erste ist die **Ausbildungszeit**:

  | | Runden |
  | --- | --- |
  | Fußvolk | 2 |
  | Schützen | 3 |
  | Reiterei | 4 |

  Ein Bauer bekommt in zwei Runden Schild und Speer in die Hand; ein
  Bogenschütze muss treffen lernen; ein Reiter muss erst ein Pferd haben und
  dann darauf kämpfen können. **Gold und Einwohner sind sofort weg**, die
  Männer treten erst am Ende an – wer aushebt, geht in Vorleistung.

  Die zweite ist der **Platz auf dem Exerzierplatz**: eine **Große Stadt bildet
  drei Trupps gleichzeitig aus, eine Stadt zwei, ein Dorf einen**. Der Rang des
  Ortes ist die Größe seines Exerzierplatzes – und damit auch die Grenze
  dessen, was je Runde überhaupt ausgehoben werden kann. Ist kein Platz frei,
  ist der Knopf ausgegraut und sagt, warum.

  **Was noch übt, zählt auf die Garnisonsgrenze mit**: sonst hebt man drei
  Trupps für eine Wache aus, die nur einen fasst.
  **Unter Belagerung ruht der Exerzierplatz** – wie jede Baustelle.
  **Fällt der Ort, laufen die Rekruten auseinander**: der Eroberer erbt sie
  nicht.
  Eine laufende Ausbildung lässt sich mit `✕` **abbrechen**; dann kommt **die
  Hälfte des Goldes** zurück. Die Männer nicht – die sind längst aus der Stadt
  heraus.

  Im Ortsfenster steht darüber der **Exerzierplatz**: eine Zeile je Trupp, mit
  einem Balken für den Fortschritt und der Zahl der Runden, die noch fehlen.
  Was fertig wird, meldet das Meldefenster am Rundenende.
- **Armeen in der Stadt verstärken**: Steht eine eigene Armee in einer eigenen
  Stadt, kann sie dort Truppen ausheben – je 100 Mann, die zur Armee stoßen
  statt in die Garnison zu gehen. Wie bei jeder Aushebung verdünnen die Neuen
  die Erfahrung der Armee, **sie kostet denselben Preis an Einwohnern und
  dieselbe Ausbildungszeit**: sonst wäre die Verstärkung im Feld das
  Schlupfloch, durch das man beides umgeht. Gemerkt wird nur, **für wen** sie
  gedacht war – steht das Heer bei der Musterung noch im Ort, tritt sie bei ihm
  an; ist es abmarschiert, geht sie in die Wache.
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
  Palisade selbst, und das ist die erste Entscheidung an jeder Grenze (16 von
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
- **Ein Hafen lässt sich sperren**: Liegen feindliche Schiffe – eine Flotte
  oder ein Heer auf Transportern – **im Hafen oder vor seiner Einfahrt**, dann
  läuft dort nichts mehr aus: keine Werft, keine Überfahrt, und die
  **Seehandelswege dieses Hafens tragen nichts**, solange die Rümpfe dort
  liegen. Der Weg selbst bleibt bestehen und trägt wieder, sobald sie fort
  sind. Gemessen wird über die **Reichweite des Hafens** – zwei Felder, so weit
  wie seine Liegeplätze reichen – und nicht mehr über die einer Belagerung:
  vorher zählte nur das unmittelbare Nachbarfeld, und ein feindliches
  Geschwader, das mitten im Hafen ankerte, störte niemanden. Eine Sperre ist
  keine Belagerung: aushungern kann nur, wer sie erklärt hat. Ein Meldefenster
  sagt es, wenn ein eigener Hafen gesperrt wird; in der Ortsansicht steht dann
  „⚓ vorhanden · ⛔ gesperrt", und der betroffene Handelsweg trägt das Zeichen
  ⛔ statt ⛵.
- **Der Bauen-Reiter zeigt nur, was gilt**: was in diesem Ort steht, was
  gerade gebaut wird, und was sich hier und jetzt bauen ließe. Ein Bauwerk,
  dessen Voraussetzung fehlt – der Kornspeicher ohne Farm, das Viadukt ohne
  Verwaltung, die Werft ohne Hafen –, erscheint **gar nicht**. Zu Spielbeginn
  stehen deshalb genau fünf Dinge zur Wahl: **Kaserne, Farm, Forum, Straßenbau**
  und, am Meer, der **Hafen**. Alle Bauwerke stehen in einer Tabelle
  (`BUILDINGS` in `js/data.js`) und laufen durch einen einzigen Knopf, eine
  Kaufregel und eine Bauschleife – ein neues Bauwerk ist ein Eintrag, keine
  neue Funktion.
- **Jedes gebaute Werk steht auf der Karte.** Was ein Ort besitzt, soll man ihm
  ansehen können, ohne ein Fenster zu öffnen. Acker, Viadukt, Fördergerüst und
  Hafensteg standen schon da; **Kaserne, Kornspeicher, Verwaltung und Werft**
  waren bis dahin nur Zeilen in der Ortsansicht. Jetzt steht **alles, was sich
  bauen lässt, auch im Gelände** – im Ort oder davor, je nachdem, wohin es
  gehört:

  | Bauwerk | wo es steht | woran man es erkennt |
  | --- | --- | --- |
  | Kaserne | eigenes Feld vor dem Ort | lange Halle, Exerzierplatz mit Zaun und Übungspfählen |
  | Farm | flachstes Nachbarfeld | drei Schläge mit Furchen, Schuppen am Rain |
  | Kornspeicher | **auf dem Acker selbst** | Speicher auf Stelzen mit Rampe am Feldrand |
  | Verwaltung | eigenes Feld am Ortsrand | gepflasterter Platz, Säulenreihen, Rednerbühne |
  | Viadukt | höchstes Nachbarfeld | Pfeiler, Bögen, Wasserrinne zur Stadt hin |
  | Bergwerk | zweithöchstes Nachbarfeld | Fördergerüst mit Schacht und Halde |
  | Fischerei | am Ufer, neben dem Steg | Hütte mit Schilfdach, Netzgestelle, Kahn am Strand |
  | Jagdhütte | Waldrand im Umland | Blockhaus mit Schindeldach, Trockengestell, Holzstapel |
  | Hafen | am Ufer zum offenen Wasser | Steg mit vertäutem Boot |
  | Werft | **am Steg selbst** | Helling neben dem Steg, darauf Kiel und Spanten |

  **Was zusammengehört, steht auch zusammen.** Kornspeicher und Werft sind
  keine eigenen Anlagen irgendwo neben dem Ort, sondern Teil dessen, was sie
  ergänzen: der Speicher steht am Rand des Ackers, dessen Ernte er hält, die
  Helling neben dem Steg, von dem aus ausläuft, was auf ihr entsteht. Auf der
  Karte gibt es dadurch vier Bilder statt zwei – **Acker** und **Acker mit
  Speicher**, **Hafen** und **Hafen mit Werft** –, und man sieht einem Ort an,
  ob er nur einen Kai hat oder eine Werft dazu.

  Jedes andere Werk sucht sich sein eigenes Nachbarfeld und geht den schon
  vergebenen aus dem Weg; auf Wasser, Fels und Straße wird nichts gebaut. Alle stehen
  außerdem **genau auf dem Boden**: die Höhe wird an der Stelle genommen, an
  der das Bauwerk wirklich steht, und nicht mehr aus der Höhe des
  Nachbarfelds geschätzt – vorher stand ein Werk am Ortsrand deshalb schon
  einmal im Hang oder knietief im Wasser.
  **Und jedes steht auf einem Fundament.** Nicht nur der Ort selbst: auch
  Acker, Kaserne, Verwaltung und Fördergerüst stehen auf der Höhe ihrer
  Feldmitte, und auch unter ihnen fällt das Gelände – eine Ecke stand in der
  Luft, die andere im Boden. Jedes bekommt jetzt seine eigene kleine Terrasse.
  Ihre Grundfläche wird nicht abgezählt, sondern gemessen: die Hülle über
  alles, was zu dem Bauwerk gehört, plus ein Rand. Wie tief sie reicht,
  entscheidet der Boden an genau ihrer Stelle. **Und sie trägt höher.** Eine
  Terrasse, die genau bis zur Grasnarbe reicht, sieht man nicht – aus der
  Vogelperspektive stand das Werk wieder scheinbar im Boden. Jedes Werk
  außerhalb der Mauern steht deshalb auf einem **Sockel**, der ein Stück über
  das Gelände hinausragt; der Unterbau wächst um dasselbe Maß nach unten mit,
  damit er am Hang nicht die Bodenhaftung verliert. Aus der Ferne ist es eine
  helle Kante, aus der Nähe ein aufgeschütteter Grund – so, wie ein Gehöft
  wirklich auf seinem Platz sitzt. Ohne Fundament bleiben die zwei,
  die keines haben dürfen: das **Viadukt** steht auf Bögen – es überbrückt das
  Tal, statt es zuzuschütten –, und **Steg und Helling** stehen auf Pfählen im
  Wasser.

  **Und keine zwei Werke mehr auf demselben Feld.** Jedes Bauwerk führte seine
  eigene Liste der schon vergebenen Nachbarfelder, und die waren nicht
  vollständig: das Viadukt kannte die Kaserne nicht, der Stollen das Forum
  nicht – zwei Werke standen ineinander. Jetzt gibt es **einen** Merkzettel für
  alle Werke eines Orts, und wer nach einem Feld fragt, bekommt eines, das noch
  frei ist.
- **Vier Tore in allen Himmelsrichtungen.** Eine Befestigung ohne Tor ist ein
  Sack: Palisade wie Mauer liefen bisher geschlossen um den Ort, und die
  Heere, die man hinein- und hinausziehen sah, gingen durch die Wand. Jede
  Anlage hat jetzt **vier Tore**, je eines nach Norden, Osten, Süden und Westen
  – so, wie ein römisches Lager gebaut war: *porta praetoria*, *principalis
  dextra* und *sinistra*, *decumana*. Jedes besteht aus zwei Pfosten, einem
  **Sturz** darüber und zwei **Torflügeln** aus dunklem Holz dazwischen.
  Dahinter endet die Befestigung wirklich: beim Dorf läuft der Ring als **vier
  Bögen** zwischen den Toren, und wo ein Tor steht, steht kein Stamm; bei der
  Palisade im Geviert und bei der Mauer teilt sich jede Seite in **zwei Läufe**
  links und rechts der Öffnung. Nur der **Wehrgang** läuft über der gemauerten
  Anlage durch – über einem Tor stand er auch wirklich, und dort standen die
  besten Schützen.

  **Ein Dorf hat ein Tor, keine vier.** Vier Tore sind eine Anlage, die gebaut
  wurde, damit Truppen nach jeder Seite hinauskönnen; ein Dorf hat einen Weg
  hinein, und mehr Stämme, als der Wald hergibt, hat es ohnehin nicht. Sein
  Ring läuft deshalb als **ein einziger Bogen** herum, mit einer Lücke nach
  vorn, und dort steht das Tor. Baut es sich später eine Palisade im Geviert
  oder eine Mauer, bleibt es dabei: drei Seiten stehen geschlossen, die vierte
  hat das Tor. Erst eine Stadt bekommt vier.
- **Jeder Ort steht auf einem Fundament.** Die Häuser eines Orts stehen alle
  auf der Höhe seiner Feldmitte – das Gelände darunter nicht. Am Hang stand
  deshalb die halbe Siedlung in der Luft oder steckte im Boden. Jetzt trägt sie
  eine **Terrasse**: ein gestampfter Unterbau, der so tief reicht, wie der
  Boden unter der Siedlung fällt, mit der Oberkante auf der Höhe des Orts. Sie
  ist rund, wo der Ort einen Ring zieht (ein Dorf), und im Geviert, wo er eine
  Mauer hat. In der Ebene sieht man von ihr fast nichts; am Hang trägt sie den
  ganzen Ort.
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
  Zu Spielbeginn steht sie **nur in den neunzehn Hauptstädten**; jeder andere
  Ort – auch jeder eroberte – muss eine bauen, ehe er Truppen stellt.
  Die **Verwaltung** kostet **300 Gold** und **3 Runden** und ist Bedingung für
  **Viadukt und Bergwerk**. **Niemand beginnt mit einer.**
  Beide heißen nicht überall gleich. Was in Rom das **Castra** und das **Forum**
  ist, ist in Athen das **Gymnasion** und die **Agora**, in Sparta die **Agoge**
  und die **Gerusia**, bei Karthago
  das **Söldnerlager** und das **Suffetenhaus**, bei den Germanen die
  **Gefolgschaftshalle** und der **Thingplatz**, bei den Ptolemäern das
  **Kleruchenland** und die **Kanzlei** und bei den Sarmaten, die nicht wohnen,
  das **Reiterlager** und das **Fürstenzelt** – neunzehn Namenspaare, für jede
  Fraktion eines.
  **Beide stehen auf der Karte.** Die Kaserne liegt **vor dem Ort**: eine lange
  Halle mit Satteldach, davor der Exerzierplatz mit Pfahlzaun und zwei
  Übungspfählen – zwischen die Häuser gehört kein Exerzierplatz. Die Verwaltung
  steht auf ihrem eigenen Feld daneben, und zwar als das, was sie ist: ein
  **großes Säulengebäude**. Vorher stand dort eine niedrige Kolonnade um eine
  Rednerbühne, und aus der Feldherrnperspektive sah das aus wie ein Zaun. Jetzt
  ist es eine Basilika – zwei Stufen, ein geschlossener Kern, Säulen ringsum,
  Gebälk und ein Satteldach mit Giebel.
- **Farm und Kornspeicher**: Ein Ort lebt von dem, was um ihn herum wächst.
  Die **Farm** (**180 Gold**, **2 Runden**) legt das Ackerland an: **50 % mehr
  Zuwachs** je Runde. **Auf der Karte liegen ihre Äcker neben der Stadt**: drei
  Schläge in Grün und Reifegelb, die Furchen dazwischen, am Rand der Schuppen –
  auf dem flachsten Nachbarfeld, während das Fördergerüst des Bergwerks auf dem
  höchsten steht. **Die Schläge liegen gerade im Feldraster**: ein Acker ist
  ein Viereck, und ein Viereck, das schräg im Gelände liegt, sieht aus, als
  hätte es jemand fallen lassen. Liegt der Acker auf einem Eckfeld, wird seine
  Ausrichtung auf den rechten Winkel gerundet, sodass seine Kanten parallel zu
  den Feldgrenzen und zu den Häusern laufen. **Auf Wasser und Fels wird nichts gebaut**: In einer
  Hafenstadt ist das flachste Nachbarfeld das Meer, und dort lagen die Äcker
  bis zuletzt – mitten auf dem Hafen. Jetzt kommen nur Landfelder infrage, und
  Farm, Viadukt und Bergwerk gehen einander aus dem Weg. **Auch die Straße
  bleibt frei**: ein Acker quer über den gepflasterten Weg sieht aus wie ein
  Versehen, und eines wäre es auch. Hat ein Ort gar kein freies Nachbarfeld
  (eine Insel, ein Ort zwischen Fels, Wasser und Straße), rückt das Bauwerk an
  den Ort selbst heran. Der **Kornspeicher** (**260 Gold**, **3 Runden**) setzt
  die Farm voraus und bewahrt die Ernte über den Winter – er hebt die
  **Obergrenze der Einwohner um 25 %**. Er gehört zum Acker und steht **auf
  ihm**, am Feldrand gegenüber dem Schuppen: ein Bau auf Stelzen, damit weder
  Nässe noch Ratten hinkommen, mit Satteldach und Rampe – so stand ein
  Horreum. Ein Acker und ein Acker mit Speicher sehen deshalb verschieden aus. Da die Schatzkammer allein von der
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
  **Auf der Karte gehört sie zum Hafen**: die **Helling** liegt neben dem
  äußeren Teil des Stegs, auf Pfählen wie er, darauf der halbfertige Rumpf –
  Kiel und Spanten, noch keine Beplankung –, daneben der Kranbaum. Ein Hafen
  ohne sie ist ein Kai; ein Hafen mit ihr ist ein Ort, an dem Kriegsschiffe
  entstehen, und das soll man auf der Karte unterscheiden können. An der
  Wurzel des Stegs hätte sie keinen Platz: dort steht die Palisade des Orts,
  und aus der Feldherrnperspektive verschwände sie dahinter.
- **Bergwerk**: Die beste Einnahmequelle, die ein Ort haben kann – und die
  einzige, die weder an seiner Größe noch an seinen Einwohnern hängt, sondern
  allein an dem, was im Berg liegt. Gerechnet wird über ein Quadrat von **zwei
  Feldern** um den Ort: ein Gebirgsfeld zählt **2**, ein Hügelfeld **1**, alles
  andere nichts. Ab **3 Erz** lohnt ein Stollen, je Punkt bringt er **4 Gold je
  Runde**, bei 12 Punkten ist Schluss – also **12 bis 48 Gold**, gegen **400
  Gold** und **4 Runden** Bauzeit, und es setzt eine **Verwaltung** im Ort
  voraus. Wo im Umland kein Erz liegt, steht der Knopf gar nicht erst da.
  **Und man sieht es**: auf jedem Gebirgs- und Hügelfeld, das für ein mögliches
  Bergwerk zählt, liegt ein **Erzhaufen** – eine Halde aus gebrochenem Gestein,
  ein paar größere Brocken am Fuß, und obenauf glänzt, worauf es ankommt.
  Vorher lag dort ein aufgebrochener Fels mit einer hellen Ader darin; aus der
  Feldherrnperspektive war das ein Stein wie jeder andere. Gemeint ist das, was
  gefördert wird, und das liegt auf Halde. Es sind 143 Felder
  auf der ganzen Karte, nicht mehr. Das Feldfenster nennt dazu die Zahl und den
  Ort, dem das Erz zufällt: „⛏️ Erz – 2 Punkte für ein Bergwerk in Roma (5 Erz
  im Umland)". Von 107 Orten haben 33 genug Erz; der Knopf
  nennt vor dem Bau, was er tragen wird. Neben der Stadt steht danach ein
  Fördergerüst mit Schacht und Halde, in der Übersicht hat das Bergwerk eine
  eigene Spalte, und die KI schlägt eines an, bevor sie die nächste Mauer baut.
- **Fischerei und Jagdhütte**: Nicht jeder Ort lebt vom Acker. Wer am Wasser
  liegt, lebt vom Fang; wer am Wald liegt, vom Wild. Beide sind billiger und
  kleiner als die Farm und tragen zweierlei – Nahrung, an der der Ort wächst,
  und ein wenig Geld aus dem, was übrig bleibt.
  Die **Fischerei** (160 Gold, 2 Runden) steht überall, wo offenes Wasser in
  Hafenreichweite liegt – ein Hafen ist dafür nicht nötig, ein Strand genügt.
  Sie bringt **30 % mehr Zuwachs** und **14 Gold je Runde**. Auf der Karte
  steht sie am Ufer neben dem Steg: eine Hütte mit Schilfdach, davor die
  Gestelle, an denen die Netze trocknen, und ein Kahn, halb an Land gezogen.
  Die **Jagdhütte** (140 Gold, 2 Runden) rechnet wie das Bergwerk über ein
  Quadrat von **zwei Feldern** um den Ort: ein Waldfeld zählt **2**, ein
  Hügelfeld **1**, alles andere nichts. Ab **3 Wild** lohnt sie, je Punkt
  bringt sie **2 Gold je Runde**, bei 8 Punkten ist Schluss – also **6 bis 16
  Gold** –, dazu **20 % mehr Zuwachs**. Wo kein Wald im Umland steht, erscheint
  der Knopf gar nicht. Auf der Karte steht sie am Waldrand: ein Blockhaus mit
  Schindeldach, davor das Gestell, an dem der Fang hängt, daneben der
  Holzstapel.
  Beide schließen einander und die Farm nicht aus. Ein Ort mit Acker, Fang und
  Jagd wächst schnell – er hat es dreifach bezahlt, und **seine Obergrenze
  bleibt dieselbe**: schneller wachsen heißt früher an der Grenze stehen, nicht
  über sie hinaus. In der Reichsübersicht stehen beide zusammen in der Spalte
  **„Fang & Jagd"**, und die KI baut sie gleich nach dem Acker.
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
  **Sie erscheint jetzt auch dann, wenn der Weg dorthin über eine dritte
  Grenze führt.** Ein solcher Zug ist zweimal Krieg – einmal gegen den, dessen
  Land man durchquert, einmal gegen den, den man am Ende schlägt –, und bisher
  kam dafür nur das Grenzfenster hoch: die Vorschau wurde übersprungen, und von
  dem zweiten Krieg stand nirgends etwas. Jetzt steht beides in derselben
  Vorschau, die Kriegserklärung an den Angegriffenen und darunter die an den,
  dessen Grenze der Marsch verletzt. (Sperrt ein Vertrag den Weg, hält
  weiterhin das Grenzfenster den Zug an – dann gibt es nichts vorzurechnen.)
  **Und die Herolde bringen ihren Text mit.** Meldungen, die einen Krieg
  betreffen, ohne dass man selbst zuschlägt – der **Bündnisfall**, ein
  **gebrochenes Wort**, ein neuer **Vertrag** –, kamen als Fenster ohne
  Überschrift und ohne Text: sie tragen sowohl ein Zeichen als auch eine
  eigene Zeile, und das Fenster fragte in der falschen Reihenfolge danach.
  Wer über sein Bündnis in einen fremden Krieg gezogen wurde, erfuhr deshalb
  nicht, warum. Das entscheidet jetzt eine eigene kleine Funktion
  (`noticeFromNews` in `js/ui.js`), und eine Prüfung geht alle fünf Fälle
  durch.
  Wo ein gegebenes Wort dazwischensteht – ein **Bündnis**, ein
  **Nichtangriffspakt** oder ein Friede, der zu frisch ist –, ist das Feld
  überhaupt nicht anwählbar: erst den Vertrag im Diplomatiefenster aufkündigen,
  dann marschieren. Und die KI greift von sich aus nie ein Reich an, mit dem
  ihr Herrscher im Frieden steht – über Krieg entscheidet der Herrscher, nicht
  der Feldherr.
- **Wer im fremden Land zurückbleibt, wird heimgeleitet**: Ein Friede, der
  geschlossen wird, während das eigene Heer noch im Land des anderen steht,
  oder ein Betretungsrecht, das ausläuft – und ein Heer steht mitten in fremdem
  Gebiet, wo **jeder Schritt eine Kriegserklärung wäre**. Der Feldherr hätte
  die Wahl zwischen Krieg und Stillstand, und beides ist keine. Deshalb gibt
  der Herrscher, in dessen Land es steht, ihm **Geleit bis zur Grenze**: es
  steht in der nächsten Runde im nächstgelegenen eigenen Ort, erschöpft vom
  Marsch und ohne Bewegungspunkte. Geprüft wird die Lage, nicht die Absicht –
  heimgeleitet wird nur, wer wirklich feststeckt: wer irgendein Feld erreichen
  kann, ohne eine Grenze zu verletzen, marschiert selbst. Ein Meldefenster
  sagt es, wenn es ein eigenes Heer betrifft. Über einen ganzen Feldzug von 150
  Runden geschieht das in der ganzen Welt rund **zwanzigmal** – es ist eine
  Rettung, keine Regel, die den Feldzug bestimmt.
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
- **Eine Belagerung wird erklärt, nicht versehentlich ausgelöst**: Wer einen
  Ort einschließen will, **greift ihn an und wählt statt des Sturms die
  Belagerung**. In der Kampfvorschau steht dafür ein eigener Knopf – *„⛺
  Einschließen"* – neben *„⚔️ Angreifen"*, und darüber ein Satz, was er
  bedeutet: das Heer marschiert bis vor den Ort und legt sich davor, statt über
  die Mauer zu gehen. Steht ein Heer schon davor, findet es denselben Knopf in
  seiner eigenen Anzeige. Für eine **Flotte vor einem Hafen** gilt dasselbe: sie
  erklärt die Einschließung, statt sie durch bloßes Danebenliegen auszulösen.
  Vorher genügte es, ein Feld neben einer Stadt stehen zu bleiben – jeder
  Durchmarsch würgte nebenbei eine fremde Stadt ab, ohne dass es jemand
  entschieden hätte.
  **Auf der Karte ist die Belagerung zu sehen**: Um den eingeschlossenen Ort
  stehen **Sturmpfähle und die Zelte des Belagerers**, die Zelte in seiner
  Farbe – man sieht auf einen Blick, wer davorliegt. Marschiert das Heer ab, ist
  die Belagerung aufgehoben und der Ring verschwindet.
  Eine **Hafensperre** ist davon getrennt: Sobald feindliche Schiffe vor der
  Einfahrt kreuzen, läuft kein Schiff aus und geht kein Heer an Bord – dafür
  braucht es keine Erklärung. Aushungern kann nur, wer die Belagerung erklärt
  hat.
- **Eine Belagerung führt ein Reich, nicht zwei**: Stehen die Heere zweier
  Fraktionen vor demselben Tor, dann belagert nur **eines** von beiden – das,
  das sie erklärt hat, solange es davorsteht. Das andere steht daneben: es
  schneidet nichts ab, hungert niemanden aus und bekommt den Ort auch nicht
  durch Warten. Wer ihn will, muss den Belagerer zuerst vom Feld schlagen oder
  warten, bis er abzieht – dann kann er selbst einschließen. Die Ortsanzeige
  nennt beide – den Belagerer und den, der „ebenfalls davorsteht, die
  Belagerung aber nicht führt". Übernimmt ein anderer, **beginnt die Frist bis
  zum Hunger von vorn**: er hat die Stadt ja nicht ausgehungert.
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
- **Der Hinterhalt**: Das Gegenstück zum Lager. Wo das Lager ein Heer sichtbar
  festsetzt, macht der Hinterhalt es **unsichtbar**. Ein Heer legt sich
  **kostenlos, aber für den Rest des Tages** (alle verbliebenen Bewegungspunkte)
  in **Wald, Hügelland oder Gebirge** auf die Lauer – in der Ebene, im Sumpf,
  in der Wüste und am Strand gibt es nichts, hinter dem man liegen könnte, und
  auf See und in einer eigenen Stadt erst recht nicht.

  Was das bewirkt, ist dreierlei:
  **Der Feind sieht es nicht.** Ein lauerndes Heer verschwindet für alle anderen
  Fraktionen von der Karte – auch für die KI, deren Zielsuche und
  Bedrohungsrechnung es schlicht nicht mehr enthalten. Die eigene Seite sieht
  es weiter, und sie sieht auch, *dass* es lauert: um die Zelte legt sich ein
  Kranz niedriger Sträucher, so wie sich um ein Lager ein Wall legt.
  **Wer daran vorbeigeht, wird überfallen.** Zieht ein feindliches Heer, mit dem
  man im Krieg steht, auf ein Feld **neben** dem Versteck, bricht der
  Hinterhalt sofort los: das Opfer verliert **22 Moral**, und der Lauernde
  greift mit **+35 % Schlagkraft** an – mehr, als eine Landung vom Meer je
  kostet. Der Bericht nennt den Hinterhalt als eigenen Modifikator.
  **Danach ist er verbraucht.** Wer zugeschlagen hat, steht wieder offen im
  Gelände und hat für diese Runde keine Bewegung mehr. Und wer sich selbst in
  Bewegung setzt, gibt den Hinterhalt auf, ehe er ihn nutzen konnte.

  Auch die **KI legt Hinterhalte** – aber nicht wahllos: nur, wenn sie auf
  taugliches Gelände kommt, in drei Feldern Umkreis ein feindliches Heer weiß
  und dieses Heer **nicht mehr als ein Viertel stärker** ist als sie selbst.
  Ein Wachheer, das nichts zu bewachen hat, und ein Heer, das kein Ziel in
  Sicht hat, legen sich hin statt herumzustehen. Wer durch germanische Wälder
  marschiert, sollte das wissen.
- **Das Belagerungslager**: Ein Lager **auf einem Feld neben einer feindlichen
  Stadt, die man eingeschlossen hat**, verschärft die Belagerung: der Hunger
  beginnt schon **nach einer Runde** statt
  nach dreien und zehrt stärker – **10 % der Besatzung** und **2 % der
  Einwohner** je Runde statt 6 % und 1,2 %. Damit gibt es zwei Wege über eine
  Mauer: den Sturm, der Männer kostet, und das Lager, das Zeit kostet.
  Auch die KI kennt ihn: was sie nicht stürmen kann, gräbt sie sich davor ein –
  über vierzig Runden gemessen liegen ihre Heere achtmal so oft vor einer
  fremden Stadt wie vorher, statt vergeblich gegen dasselbe Tor zu laufen.
- **Belagerung**: Ein Ort ist belagert, wenn ein feindliches Heer
  **unmittelbar neben ihm steht und die Belagerung erklärt hat** – bei einem
  Hafenort auch eine Flotte vor der Einfahrt. Erklärt wird sie über den Angriff
  (Knopf *„⛺ Einschließen"* in der Kampfvorschau) oder, wenn das Heer schon
  davorsteht, in seiner eigenen Anzeige. Eine Belagerung nimmt dem Ort alles,
  was von draußen kommt:
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
- **Marschierende Heere ziehen als Kolonne**: Ein Heer, das auf der Karte
  steht, ist ein Lager aus Zelten. Setzt es sich in Bewegung, **treten die
  Zelte ab und eine Kolonne tritt an**: eine Reihe von Gestalten hintereinander,
  zu zweit nebeneinander wie eine Marschordnung, das Feldzeichen vorneweg. Sie
  ist so lang, wie das Heer stark ist (vier bis zwölf Glieder), jeder Mann
  federt für sich im Tritt – im Gleichschritt sähe die Reihe aus wie ein Brett
  – und die Kolonne dreht sich in die Richtung, in die es geht. Am Ziel schlägt
  sie wieder ihr Lager auf.
  **Und die Waffengattungen sind zu unterscheiden.** Vorher marschierte eine
  Reihe gleicher Kegel: ein Heer aus dreihundert Reitern sah aus wie eines aus
  dreihundert Bogenschützen. Jetzt hat jede Gattung ihre Gestalt – das
  **Fußvolk** breit, mit Schild an der Seite und aufgesetztem Speer, die
  **Reiterei** hoch zu Pferd mit der Lanze, die **Schützen** schmal, ohne
  Schild, den Bogen quer über dem Rücken und den Köcher an der Hüfte. Wie viele
  Plätze jede Gattung bekommt, sagt die wirkliche Zusammensetzung des Heeres;
  jede vorhandene bekommt mindestens einen, sonst verschwänden dreißig Reiter
  neben achthundert Mann Fußvolk. Und sie marschieren in der Ordnung, die in
  jedem Handbuch steht: **die Reiterei voraus, dahinter das Fußvolk, die
  Schützen zuletzt.** Damit man das sieht, steht die Kolonne anderthalbmal so
  groß da wie das Lager – an einem Zelt ist nichts zu erkennen, an einer
  Gestalt schon.
- **Belagerungsgerät**: Eine Steinmauer verdoppelt die Kraft dessen, der
  dahintersteht. Dagegen half bisher nur, mehr Männer davorzustellen – und
  genau so wurden Belagerungen gewonnen: mit Masse. So war es nicht. Wer eine
  Mauer nehmen wollte, baute Gerät.
  In einer eigenen Stadt mit **Kaserne** zimmert das Heer, das dort steht,
  zweierlei: den **Widder** (240 Gold, 5 Sold) – ein eisenbeschlagener Balken
  unter einem Schutzdach, der gegen das Tor geht – und das **Katapult**
  (300 Gold, 7 Sold), das Steine über die Brüstung wirft. Jeder Widder nimmt
  einer Mauer **20 %** ihrer Wirkung, jedes Katapult **12 %**; zusammen
  höchstens **60 %**, denn auch die beste Belagerung macht aus einer
  Quadermauer kein offenes Feld. Aus einer Steinmauer (+100 % Verteidigung)
  werden mit zwei Widdern und einem Katapult **+48 %**. Katapulte schießen
  außerdem in der **ersten Runde** mit, auch wenn kein Bogenschütze im Heer
  steht.
  Das kostet mehr als Gold: **sechs Stücke** trägt ein Heer höchstens, es
  **marschiert ein Fünftel langsamer**, solange es Gerät mitführt, das Zimmern
  kostet den Tag (das Heer zieht in dieser Runde nicht mehr), und im **Sturm
  geht ein Teil zu Bruch** – gewonnen im Schnitt jedes dritte Stück, verloren
  mehr als zwei von dreien. Vereinigen sich zwei Heere, zieht das Gerät bis
  zur Obergrenze mit.
  **Syrakus zahlt weniger**: die Stadt, in der das Torsionsgeschütz erfunden
  wurde, bekommt jedes Stück zum Viertelpreis-Nachlass (Widder 180, Katapult
  225). Der Preis steht an einer Stelle – Knopf, Abrechnung und KI fragen
  dieselbe Rechnung, damit es nicht zwei Wahrheiten darüber gibt, was ein
  Widder kostet.
  **Man sieht es**: die Armee nennt, was sie mitführt, die Kampfvorschau
  rechnet vor, was von der Mauer übrig bleibt, und im Schaubild rollen genau
  so viele Widder an das Tor und stehen so viele Katapulte auf der Flanke, wie
  das Heer wirklich hat – wer ohne Widder gegen ein Tor läuft, sieht das auch.
  Der Belagerungsturm kommt erst dazu, wenn wenigstens zwei Stücke Gerät
  davorstehen. Die KI zimmert Gerät, sobald ein Heer von ihr in einer Stadt
  mit Kaserne steht und eine befestigte fremde Stadt in Reichweite liegt.
- **Feindliche Heere sind auf einen Blick zu erkennen**: Die Fraktionsfarbe
  sagt, wer da steht, aber nicht, ob er auf dich schießt – zwischen einem
  Verbündeten und einem Feind lag bisher nur die Erinnerung an das
  Diplomatiefenster. Jedes Heer und jede Flotte einer Fraktion, mit der du im
  **Krieg** stehst, bekommt deshalb einen **roten Ring um die Füße** und zwei
  gekreuzte Klingen vor der Stärke auf dem Schild: **⚔ 540**. Die Zahl selbst
  steht in Rot statt in Weiß. Der Ring wächst mit dem Heer und liegt unter dem
  goldenen Auswahlring, sodass beide nebeneinander zu sehen sind.
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
  **Gezeichnet wird eine Straße in Kurven, nicht im Schachbrett.** Sie wurde
  lange Feld für Feld gezeichnet – ein Kreuz je Feld und ein gerades Stück zum
  Nachbarn –, und dabei kam heraus, was dabei herauskommen muss: rechte Winkel.
  Eine römische Straße ist zwar berühmt gerade, aber sie knickt nicht alle
  55 km um neunzig Grad. Jetzt wird derselbe Weg gegangen wie beim Fluss: aus
  den Straßenfeldern wird ein Graph, daraus werden **durchgehende Züge**, deren
  Knicke mit einer **Bézierkurve ausgerundet** werden, und darauf liegt **ein**
  Band – getrennt nach Ausbaustufe, damit das Pflaster dort endet, wo der
  Ausbau endet. Der Querschnitt liegt dabei waagerecht auf der höchsten Stelle
  darunter: so schneidet die Trasse in hügeligem Land nicht in den Boden, und
  der Weg reißt nicht ab. Es ist dieselbe Maschinerie, die die Flüsse rund
  laufen lässt – sie war nur bisher den Flüssen vorbehalten.
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
  **Bilanz** (Einnahmen minus Sold je Runde) in Grün oder Rot. Neunzehn Reiche
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

- **Alle neunzehn Fraktionen sind spielbar.** Nach „Neues Spiel starten" kommt ein
  eigener Auswahlbildschirm: links die Fraktionen mit ihrer Schwierigkeit,
  rechts Hauptstadt, Siedlungen, Startheer, die drei eigenen Einheiten sowie
  Stärke und Schwäche – und im Hintergrund ein Bild, das mit der Auswahl
  wechselt: der Tempel und der Adler für Rom, die Hafenmauer mit Elefant für
  Karthago, der Herkynische Wald für die Germanen, Pyramiden und Palmen für die
  Ptolemäer. Wer nicht gewählt wird, wird von der KI geführt.
- Zur Wahl stehen **Rom**, **Karthago**, die **Gallier**, **Numidien**, die
  **Parther**, **Armenien**, **Pontus**, **Makedonien**, **Syrakus**,
  **Athen**, **Sparta**, die **Germanen**,
  die **Britannier**, die **Iberer**, die **Daker**, die **Seleukiden**, die
  **Ptolemäer**, die **Illyrer** und die **Sarmaten** –
  verteilt über Europa, das Mittelmeer, Nordafrika, den Vorderen Orient und die
  Steppe nördlich des Schwarzen Meeres. Alle beginnen mit demselben Startgold und
  (bis auf die zwei Heere der Seleukiden, Karthagos und Makedoniens) demselben
  Heer: der Unterschied liegt in der Lage, den Nachbarn und den eigenen
  Einheiten.
- **Makedonien und Syrakus: die zwei Reiche, die dem Jahr 264 fehlten.** Das
  Spiel beginnt im **Martius 264 v. Chr.**, und in diesem Monat waren drei
  Diadochenreiche die Großmächte der östlichen Welt: Seleukiden, Ptolemäer –
  und die **Antigoniden in Makedonien**. Zwei davon standen auf der Karte, das
  dritte nicht: Thessalonike lag als herrenloses Feld herum, während Antigonos
  II. Gonatas von Pella aus halb Griechenland hielt. Und im selben Monat begann
  wegen **Syrakus** der Krieg, nach dem dieses Spiel seinen ersten Zug zählt –
  auch Syrakus war nur ein unabhängiger Ort.

  **Makedonien** hält Pella als Königssitz, **Amphipolis** an der Küste und
  **Larissa** in Thessalien – die Küste des Thermäischen Golfs und den Weg
  nach Süden. Korinth, die Burg über der Landenge, gehörte in einer früheren
  Fassung dazu; sie ist der Zwei-Felder-Regel zum Opfer gefallen, weil sie
  Athen und Sparta die Mauern berührte. Makedonien kämpft mit der
  **Sarissenphalanx** – dem Vorbild, das
  alle anderen nachbauten: sie deckt sich schlechter als die Hoplitenwand der
  Griechen, aber sie greift härter an, denn fünf Meter Speer reichen weiter
  als jeder Schild. Dazu die **Hetairoi**, die Stoßreiterei, mit der Alexander
  seine Schlachten entschied.

  **Syrakus** unter **Hieron II.** hält die Ostküste Siziliens: die Stadt
  selbst und **Tauromenion**. Es kämpft griechisch und
  schießt sizilisch – und hat als einzige Fraktion einen Vorteil, der keine
  Truppenwerte betrifft: **Belagerungsgerät kostet es ein Viertel weniger**
  (Widder 180 statt 240, Katapult 225 statt 300). In Syrakus bauten die
  Ingenieure des Dionysios das erste Torsionsgeschütz; dort war das Zimmern von
  Gerät kein Sonderfall, sondern Handwerk.

  **Messana** bleibt frei. Dort saßen die Mamertiner – keine Macht, sondern
  eine Söldnerschar, die sich eine Stadt genommen hatte. Dass sie 264 v. Chr.
  beide um Hilfe riefen, Karthago und Rom, ist der Anfang des Krieges. Auf der
  Karte liegt Messana als **unabhängige Stadt** genau zwischen Rom und Syrakus,
  und wer sie will, muss über die Meerenge.
- **Die Startlage ist die des Jahres 264 v. Chr. – keine Regel mehr.** Lange
  bekam jede Fraktion gleich viel: Hauptstadt, Stadt, Dorf, **drei Orte für
  alle**, für das Seleukidenreich wie für die Germanen. Das war gerecht, und es
  war falsch. Im Frühjahr 264, als in Messana der Erste Punische Krieg beginnt,
  war nichts gleich verteilt.

  | Orte | Fraktion | was sie hält |
  | --- | --- | --- |
  | **7** | **Karthago** | Karthago und Hadrumetum in Afrika, Panormus auf Sizilien, Caralis auf Sardinien, Gades und Malaca in Iberien, dazu Leptis Magna |
  | **7** | **Seleukiden** | von Kilikien über Syrien und Babylonien bis nach Susa: Antiochia, Tarsos, Edessa, Damaskus, Dura Europos, Babylon |
  | **6** | **Ptolemäer** | Alexandria, Memphis, Kyrene, Salamis auf Zypern, Tyrus und Jerusalem |
  | **5** | **Rom** | ganz Italien südlich des Po – Roma, Capua, Arretium, Ravenna, Tarent |
  | **5** | **Gallier** | Alesia, Bibracte, Lutetia, Burdigala, Tolosa |
  | **3** | die mittleren Königreiche und Stammesverbände | Makedonien, Pontus, Armenien, Numidien, Illyrer, Germanen, Britannier, Iberer, Daker, Sarmaten |
  | **2** | **Parther** | Ekbatana und Rhagae – die Parner sind noch ein Reitervolk am Saum des Seleukidenreichs |
  | **1** | **Athen · Sparta · Syrakus** | eine Stadt, ein Heer, sonst nichts |

  Wer als Karthago beginnt, hat sieben Orte und sieben Grenzen; wer als Athen
  beginnt, hat eine Stadt und muss sich alles nehmen. **Das ist der
  Unterschied, den die Epoche macht, und er soll zu spüren sein.** Sonst bleibt
  alles gleich: dieselben 500 Gold, dasselbe Startheer (bis auf Sparta, das
  weniger Bürger hat).

  **Was dabei neutral wurde, ist ebenso Absicht.** **Sinope**, **Olbia** und
  **Chersonesos** waren 264 freie griechische Poleis, keine Untertanen von
  Pontus oder der Sarmaten – Sinope fiel erst 183 an Pontus. **Karthago Nova**
  gab es noch nicht: die Stadt wurde 228 gegründet, und Karthagos Besitz in
  Iberien waren 264 die alten phönizischen Kolonien Gades und Malaca.
  **Massilia** war eine freie Stadt und blieb es. **Messana** liegt in der Hand
  der Mamertiner – eben deshalb beginnt dort der Krieg. **42 der 107 Orte
  gehören niemandem.**

  **Eine Freiheit ist genommen:** Ekbatana war 264 seleukidisch, nicht
  parthisch. Ohne diesen Sitz hätten die Parther gar keinen – als reines
  Steppenvolk wären sie keine spielbare Fraktion mehr, sondern eine Fußnote.
  Sie behalten Ekbatana und bekommen Rhagae dazu; alles andere in Medien und
  Susiana ist seleukidisch.

  **Gemessen** über acht Läufe zu 60 Runden (mit Athen als unbespielter
  Fraktion, damit Rom von der KI geführt wird) reicht das Feld von **1,4**
  (Parther) bis **10,1** (Karthago) Orten, mit Rom bei 8,3, den Seleukiden bei
  10,0 und den Ptolemäern bei 6,9. Vorher lag es zwischen 1,7 und 8,6. Die
  Spanne ist **breiter geworden, und das ist der Sinn**: die Karte bildet jetzt
  ab, wer 264 groß war. Ausgeschaltet wird trotzdem fast niemand – nur die
  Parther fielen in einem von acht Läufen.
- **Kein Ort steht neben einem anderen.** Zwischen zwei Siedlungen liegt
  jetzt mindestens ein freies Feld – bei 55 km je Feld rund hundert Kilometer.
  Vorher standen **vierzehn Paare** Wand an Wand, vor allem in Griechenland
  und auf Sizilien, und dort war die Karte kein Land mehr, sondern eine
  Häuserzeile: Athen und Eleusis und Korinth in drei Feldern nebeneinander,
  Syrakus, Tauromenion und Messana in einer Reihe die Küste hinauf.

  Wo zwei echte Städte in benachbarte Felder fielen, musste eine weichen.
  Weggefallen sind **Thessalonike** (neben Pella), **Korinth** (zwischen Athen
  und Sparta), **Eleusis** (vor Athen), **Gytheion** (unter Sparta),
  **Tauromenion** (zwischen Syrakus und Messana), dazu Dion, Ktesiphon,
  Naxuana und Azagarion. Das ist der Preis der Regel, und bei Thessalonike und
  Korinth tut er weh – aber eine Karte, auf der zwei Hauptstädte einander die
  Mauern berühren, ist keine Karte.

  Mit Korinth fiel auch **Makedoniens zweites Heer** weg: es war die Besatzung
  auf Akrokorinth, und ohne die Burg hat es keinen Grund mehr.
- **Athen und Sparta statt „der Griechen".** Es gab nie eine Fraktion „Griechen". Athen, Sparta, Pergamon, Ephesos
  und Rhodos waren 264 v. Chr. fünf verschiedene politische Körper, von denen
  mehrere miteinander im Krieg lagen; sie in einen Topf zu werfen war die
  bequeme Lösung, nicht die richtige. **Athen** und **Sparta** stehen jetzt als
  **zwei eigene Fraktionen** auf der Karte – Verbündete im Chremonideischen
  Krieg, aber zwei Staaten mit zwei Verfassungen und zwei Heeren. Pergamon,
  Ephesos und Rhodos sind **unabhängig**; Argos und Theben stehen nicht mehr auf
  der Karte, denn Griechenland war eng, und eine Karte mit 55 km je Feld
  verträgt dort keine Ortsdichte, die jedes Feld belegt.

  **Und sie haben genau einen Ort: die Stadt.** Athen ist Athen, Sparta ist
  Sparta, Syrakus ist Syrakus – eine Mauer, ein Heer, und dahinter nichts. Das
  ist keine Sparmaßnahme, sondern der Maßstab: **Attika und die Lakonike sind
  bei 55 km je Feld jeweils ein einziges Feld groß.** Was ein Stadtstaat sonst
  noch hielt – Eleusis, Piräus, Gytheion – liegt im Nachbarfeld seiner
  Hauptstadt und kann unter der Zwei-Felder-Regel kein eigener Ort sein. Statt
  einen zweiten Ort an den Rand der Einflusszone zu setzen, wo er nicht
  hingehört, hat der Stadtstaat gar keinen: die erste Aufgabe ist, sich einen
  zu nehmen.

  In den Messungen ist das mit Abstand die härteste Ausgangslage im Spiel:
  Athen **2,1**, Sparta **2,0**, Syrakus **4,0** Orte im Schnitt nach 60
  Runden, bei einem Median von **5,7**. Wer als Athen spielt, hat nach
  sechzig Runden im Schnitt **einen** Ort dazugewonnen. Ausgeschaltet wurde in
  zwölf Läufen aber keiner von ihnen: die Lage ist eng, nicht aussichtslos.

  **Sparta ist die schärfste Fraktion des Spiels.** Der **Spartiat** hat
  **13 Verteidigung** – mehr hat niemand –, kostet dafür 132 Gold, und Sparta
  stellt als einzige Fraktion ein **kleineres Startheer** (440 statt 540 Mann).
  Das ist die Oliganthropie, an der Sparta wirklich zugrunde ging: es gab zu
  wenige Spartiaten, und jeder gefallene war nicht zu ersetzen. Reiterei und
  Schleuderer sind entsprechend das Schwächste auf der Karte. **Athen** kämpft
  ausgeglichen und fährt, worauf die Stadt wirklich stand: die **Triere** ist
  ihre erste Bauart.

  **Auf Sizilien stehen jetzt drei Orte statt sieben.** Syrakus, dazu die
  unabhängigen **Messana** und **Panormus** – jeder zwei Felder vom nächsten.
  Akragas, Kamarina, Gela und Tauromenion sind weg: auf einer Insel, die neun
  Felder breit ist, war jeder zweite davon eine Stadt.
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
  | Makedonien | Sarissenphalanx (härteste Phalanx im Angriff) | Hetairoi (Stoßreiterei) | Agrianische Speerwerfer |
  | Syrakus | Syrakusanische Hopliten | Syrakusanische Reiter | Sizilische Schützen |
  | Athen | Athenische Hopliten | Athenische Ritter | Toxotai |
  | Sparta | Spartiaten (beste Verteidigung der Karte) | Lakedaimonische Reiter (die schwächste) | Periöken-Schleuderer |
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
  Karthago und Athen kämpfen ausgewogen, Sparta gar nicht – es steht nur.
- Die **Britannier** sitzen auf ihrer Insel und kommen ohne Schiffe nirgendwo
  hin – ihre erste Landung an der gallischen Küste fällt meist in die ersten
  Spielrunden.
- Die **Germanen** sitzen zwischen Rhein, Nordsee und Elbe im Herkynischen
  Wald, der jeden Vormarsch verlangsamt. Sie führen keine stehende Armee,
  sondern einen fußlastigen Heerhaufen.
- Die **Seleukiden** halten Syrien, Kilikien und das Zweistromland um
  Antiochia. Als größtes Diadochenreich stellen sie zwei Heere auf – sie
  brauchen beide, denn sie stehen zwischen Kleinasien und den Ptolemäern.
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
  seinem Rang.
  **Und der Rang ist nicht mehr für immer: ein Ort wächst mit seinen
  Einwohnern.** Bisher war der Rang, mit dem ein Ort das Spiel begann, auch
  der, mit dem er es beendete – ein Weiler blieb hundert Runden lang ein
  Weiler, gleichgültig wie viele Menschen darin lebten, und die Obergrenze
  seines Rangs war eine Wand. Jetzt ist sie eine Schwelle: **wer die Obergrenze
  seines Rangs erreicht, bekommt den nächsten** – aus dem Dorf wird eine Stadt,
  aus der Stadt eine große. Die Schwelle ist das **1,6fache** der
  Einwohnerzahl, mit der ein Ort seines Rangs beginnt (ein Dorf also bei
  **2.240**, eine Stadt bei **5.600**; für eine Hauptstadt entsprechend mehr);
  der Kornspeicher zählt dabei nicht mit – er soll den gewachsenen Ort
  ernähren, nicht seinen Aufstieg erkaufen.
  Mit dem Rang wächst alles, was an ihm hängt: die **Einnahmen** (Faktor 0,5 –
  1 – 1,7), die **Wache**, die der Ort halten kann, seine neue Obergrenze und
  sein **Bild auf der Karte** – aus vier Hütten werden Häuser um eine Halle,
  aus der Stadt eine große mit Tempel, und der Mauerring wächst mit. Ein
  Meldefenster sagt es, wenn ein eigener Ort hinüberwächst. **Kleiner wird ein
  Ort nicht wieder**: was gebaut steht, steht, auch wenn eine Belagerung die
  Hälfte der Menschen gekostet hat.
  Wie lange das dauert, entscheidet, was man in den Ort steckt: ein Dorf
  braucht ohne alles rund **135 Runden** bis zur Stadt, mit einer **Farm 89**,
  mit **Farm und Viadukt 77**. In zweihundert Runden ohne Krieg wachsen so von
  107 Orten etwa **62** in den nächsten Rang.
  **Auf der Karte hat jedes Gebäude überall dasselbe Maß.** Vorher wuchsen mit
  dem Rang eines Orts einfach alle Gebäude mit – dieselben vier Hütten, nur
  größer gezeichnet; eine Große Stadt sah aus wie ein Dorf für Riesen, und zwei
  Orte nebeneinander waren nicht zu vergleichen. Maßstab ist jetzt **das Dorf**:
  Ein Haus ist ein Haus, ob es in einem Weiler oder in einer Metropole steht.
  Der Rang zeigt sich daran, **wie viele** Häuser dort stehen und wie weit sie
  sich ausbreiten – ein **Dorf** hat vier Hütten, eine **Stadt** eine Halle und
  fünfzehn Häuser in zwei Ringen, eine **Große Stadt** eine Halle, zwanzig
  Häuser in zwei weiteren Ringen und einen **Tempel**. Der Mauerring wächst mit
  der Ausbreitung mit, die Häuser darin nicht. Dasselbe gilt für alles, was um
  einen Ort herum steht: **Hafensteg, Äcker, Viadukt und Fördergerüst haben in
  jedem Ort dieselbe Größe**.
  **Dieser Maßstab gilt jetzt für die ganze Karte**, nicht mehr nur für die
  Orte. Gemessen wird alles am Haus, und das Haus ist die Eins:

  | Ding | Höhe | woran man es sieht |
  | --- | --- | --- |
  | Haus, Hütte | 1,0 | der Maßstab selbst |
  | Baum | 2,2 | gut doppelt so hoch wie ein Haus |
  | Zelt eines Heeres | 0,8 | ein Zelt ist kein Haus |
  | Mann in der Kolonne | 0,5 | halb so hoch wie ein Haus |
  | Erzbrocken | 0,45 | ein Brocken, kein Findling |
  | Bergkegel | 1–3 | nach der Höhe des Feldes |

  Vorher hatte jedes dieser Dinge sein eigenes Maß, das irgendwann einmal gut
  ausgesehen hatte: Wälder standen als Büschel neben Städten, die größer waren
  als sie, und ein marschierendes Heer war fast so hoch wie das Dorf, an dem es
  vorbeizog. Jetzt überragt ein Wald die Häuser, ein Lager duckt sich neben
  den Ort, und eine Kolonne ist ein Zug kleiner Gestalten. Man sieht einem
  Bildausschnitt an, wie groß das ist, was darin steht.

  **Straßen und Flüsse haben einen Körper.** Beide waren Bänder aus einer
  einzigen Fläche, flach auf das Land gelegt: von oben sah das niemand, aber
  diese Karte wird schräg angesehen, und einem Aufkleber fehlt aus jeder
  anderen Richtung genau das, was ihn zu einem Weg macht – eine Kante. Jetzt
  liegt die Straße auf einem **Damm**, dessen Böschung im Schrägblick einen
  Schatten wirft.

  **Und der Fluss richtet sich nach dem Land, durch das er läuft.** Er folgt
  wie eh und je dem Gelände – jedes Uferstück nimmt seine Höhe dort, wo es
  wirklich liegt. Eine Fassung lang lag die Wasserfläche stattdessen eben und
  über der höchsten Stelle ihrer Kante: gerade, aber im Hang wie ein Aquädukt
  aufgeständert. Ein Fluss läuft bergab, nicht waagerecht.

  Was sich ändert, ist die **Breite**, und die entscheidet das Land zu beiden
  Seiten. **In der Ebene** zieht ein Strom breit dahin; **im Hügelland und im
  Gebirge** steht der Fels bis ans Wasser, und der Lauf ist eingeengt und **um
  ein Drittel schmaler**. Man sieht es einem Fluss an, wo er das Gebirge
  verlässt.

  Uferstreifen aus Sand und Kies standen hier zweimal daneben – sie machten aus
  jedem Bach eine zweifarbige Trasse und aus der Karte ein Gleisnetz. Sie sind
  wieder fort: **ein Fluss ist Wasser und sonst nichts.**

  **Und er läuft rund, nicht eckig.** Ein Fluss wurde bisher Uferstück für
  Uferstück gezeichnet: für jede Feldkante ein eigenes Band, das ein Stück über
  die Ecke hinausragte, damit an den Knicken kein Zwickel offen blieb. Das
  ergab rechte Winkel – ein Strom, der abbiegt wie eine Straße im Schachbrett.
  Jetzt wird zuerst der **ganze Lauf** zusammengesetzt: aus den Kanten werden
  die Ecken des Rasters gewonnen, aus den Ecken ein Linienzug, dessen Knicke
  mit einer **Bézierkurve ausgerundet** werden – und darauf liegt ein
  **durchgehendes Band**, ohne Überlappungen und ohne Ecken. Weil das Band
  durchläuft, kann sich seine Breite von Punkt zu Punkt ändern: er **verengt
  sich allmählich**, wo der Fluss ins Bergland eintritt, statt abzusetzen.

  An einer Gabelung geht der Linienzug **geradeaus** weiter statt in den
  erstbesten Ast: wo zwei Züge stumpf aneinanderstoßen, klafft im Band sonst
  ein Keil.

  **Und die Läufe sind nachgeprüft.** Vier waren grob daneben: der **Nil**
  begann 170 km östlich im Golf von Suez, der **Euphrat** lief in Syrien
  durchweg hundert Kilometer zu weit östlich an Raqqa, Deir ez-Zor und Abu
  Kamal vorbei, der **Tigris** umgekehrt zu weit westlich an Diyarbakır, Cizre
  und Mosul vorbei, und der **Ebro** hundert Kilometer zu weit nördlich an
  Tudela und Zaragoza vorbei. Dazu fünf kleinere Berichtigungen: die Donau
  schnitt den Bogen über Vukovar und Belgrad ab, die Rhône lief an Lyon vorbei,
  die Loire erreichte Orléans nicht, der Rhein sparte Karlsruhe und Mannheim
  aus, und die Weichsel bog unterhalb von Warschau zu spät nach Westen.

  **Und der Lauf erreicht das Meer.** An der Mündung reicht das Band jetzt
  eine halbe Feldbreite weiter in das Wasserfeld hinein, statt an der
  Feldgrenze aufzuhören – vorher endete mancher Strom sichtbar vor der Küste.

  Dazu sind beide auf ihr Maß gebracht –
  eine Straße ist so breit, dass zwei Karren aneinander vorbeikommen, also
  ungefähr ein Haus lang und nicht drei nebeneinander; sie war vorher um zwei
  Drittel zu breit und um einen Ton zu hell. Die Brücke darüber ist etwas
  breiter als die Straße, die sie trägt.

  **Und es stehen mehr Bäume da.** Ein Waldfeld trug einen einzigen Baum; ein
  Wald aus einem Baum ist kein Wald. Jetzt stehen auf einem Waldfeld **vier bis
  sechs**, und weil ein Land nicht an der Waldgrenze aufhört, steht auch auf
  jedem zweiten Hügelfeld und jedem vierten Ebenenfeld einer, in der Ebene in
  kleinen Gruppen. Wo ein Ort, sein Umland oder eine Straße liegt, wächst
  keiner: eine Eiche mitten auf dem Pflaster ist keine Landschaft, sondern ein
  Versehen. Aus rund 350 Bäumen sind so etwa 2.500 geworden – gezeichnet wird
  das weiterhin in zwei Aufrufen, denn alle Stämme und alle Kronen sind je eine
  Instanzenwolke.

  **Und die Welt lebt.** Eine Karte, auf der sich nichts rührt als die eigenen
  Heere, ist ein Plan; was aus ihr eine Welt macht, sind die Dinge, die ohne
  den Feldherrn geschehen. Über den Untiefen ziehen **Fischschwärme** in engen
  Kreisen, weit draußen tauchen **Wale** auf, blasen und gehen wieder unter – der Blas
  ist kein Strahl, sondern ein Strauß feiner Strahlen in zwei Bögen, die oben
  auseinandergehen und in Tropfen zerfallen –,
  über der Küste kreisen **Möwen** mit schlagenden Flügeln, an den Waldrändern
  steht **Wild**; über die Straßen ziehen **Ochsenkarren** hin
  und zurück: zwei Pferde nebeneinander, jedes mit Leib, Hals, Kopf, vier
  Läufen und Schweif, dazu Joch, Deichsel und der Kastenwagen mit Plane über
  zwei Speichenrädern – rund 220 Fische, **fünf Wale**,
  vierzig Möwen, zweihundertdreißig Stück Wild, **sechsundzwanzig
  Handelsschiffe** und ein Fuhrwerk auf jedem Weg von einiger Länge. Ein Dutzend Wale waren zu viele: das Meer sah aus wie ein
  Teich mit Karpfen. Fünf sind ein Fund, und sie ziehen erst dort, wo das
  Wasser wirklich offen ist – im Umkreis von **vier** Feldern darf kein Land
  liegen, vorher genügten zwei.

  **Ein Schwarm ist kein Gänsemarsch.** Die Fische saßen mit festem
  Zeitversatz auf ein und derselben Kreisbahn und schwammen deshalb brav
  hintereinander her – fünf Enten auf dem Teich. Jetzt hat der Schwarm eine
  Mitte, die den Kreis zieht, und jeder Fisch einen festen Platz darin, längs
  und quer. Der Platz dreht mit der Schwimmrichtung mit, damit der Schwarm in
  der Kurve seine Form behält; ein leichtes Wandern lässt ihn dabei atmen.
  Fünf Rücken je Schwarm statt drei, dafür weniger Schwärme.

  **Und Wild ist nicht gleich Wild.** Wo vorher ein bis drei gleiche Tiere
  standen, steht jetzt eines von dreien, und die Zahl gehört zur Art: ein
  **Hirsch** zieht **allein** und trägt ein Geweih aus zwei Stangen mit je drei
  Enden; **Rehe** stehen zu **dritt**, kleiner und zierlicher, mit dem hellen
  Spiegel am Hinterteil; **Wildschweine** ebenfalls zu dritt – eine Bache mit
  ihren Frischlingen, gedrungen, mit Rüssel, zwei Hauern und dem Kamm über dem
  Widerrist. Rehe sind am häufigsten, der einzelne Hirsch am seltensten.

  **Und auf dem Meer fahren Handelsschiffe.** Was die Ochsenkarren auf den
  Straßen sind, sind sie auf dem Wasser: Verkehr, der ohne den Feldherrn
  stattfindet. Sechsundzwanzig **Frachtsegler** – bauchiger Rumpf, hochgezogene
  Steven, ein Mast mit hellem Rahsegel, Kisten an Deck – ziehen auf **Seewegen**
  hin und zurück. Die Wege liegen dort, wo in der Antike wirklich gefahren
  wurde: **an der Küste entlang, in Sichtweite des Landes** und höchstens drei
  Felder von ihr entfernt, aber nicht auf dem Strand. Quer über die offene See
  fuhr niemand freiwillig, und auf der Karte tut es auch niemand. Von einer
  Kriegsflotte unterscheidet man sie auf den ersten Blick: die hat Rammsporn
  und Ruderreihen, der Frachtsegler hat ein Segel und Fracht. Eine Straße, auf der nie etwas fährt, ist ein Strich; die
  Karren fahren die wirklichen Wege ab und wenden an ihrem Ende. Nichts davon greift in die Regeln ein: es
  ist Landschaft. Deshalb ist es billig gebaut – je Gattung **eine
  Instanzenwolke**, und bewegt wird nur **fünfzehnmal je Sekunde**; dazwischen
  wird gar nicht gezeichnet, sonst liefe die Karte für einen Fischschwarm
  dauerhaft mit voller Bildrate. In der taktischen Sicht bleibt alles stehen –
  dort geht es um Grenzen und Heere, und ein Rudel Rotwild sagt darüber nichts.
  Wer eine ruhige Karte will, schaltet es in den Einstellungen unter **„Leben
  auf der Karte"** ab.

  **Die Koordinaten sind nachgeprüft.** Jeder Ort steht dort, wo er wirklich
  stand; sechs standen daneben und wurden berichtigt: **Trapezus** (Trabzon lag
  42 km weiter südlich), **Kabeira** (Niksar, 30 km), **Sarmizegetusa** (die
  dakische Burg liegt bei Grădiștea Muncelului, nicht bei der römischen
  Nachfolgestadt – 40 km), **Bibracte** (Mont Beuvray, 19 km), **Siga** (an der
  Mündung der Tafna, 17 km) und **Mattium** (Altenburg bei Niedenstein, 11 km).

  Zwei Abweichungen bleiben mit Absicht. **Amisos** steht 26 km zu weit
  nördlich: auf dem echten Platz (Samsun) läge es Feld an Feld mit Amaseia, und
  die Zwei-Felder-Regel geht vor. Und wo die Lage in der Forschung strittig
  ist, steht ein plausibler Punkt aus der Spanne – **Tigranokerta** und **Zama
  Regia** sind bis heute nicht sicher lokalisiert, und **Gelonos**,
  **Amadoka**, **Karrodounon**, **Naubaris**, **Exopolis** und **Rha** sind
  Namen aus Herodot und Ptolemaios, zu denen es keine Ausgrabung gibt.
  **Wie viel wem gehört, sagt nicht mehr eine Regel, sondern das Jahr 264**:
  zwischen sieben Orten (Karthago, Seleukiden) und einem (Athen, Sparta,
  Syrakus) – die ganze Aufstellung steht weiter unten unter *Die Startlage ist
  die des Jahres 264 v. Chr.* **42 der 107 Orte gehören niemandem** und sind
  frei zu erobern – von Massilia bis Exopolis.
  Zwischen je zwei Orten liegt mindestens **ein freies Feld**. Neun davon liegen im **Nordosten**, wo die
  Karte bisher leer war: Kremnoi am Maiotischen See, Azagarion und Karrodounon
  im Binnenland, Naubaris und Exopolis im asiatischen Sarmatien, Rha an dem
  Strom, der bei Ptolemaios so heißt, und Pityus, Phasis und Harmozica in
  Kolchis und Iberien – Namen aus Herodot, Strabon und Ptolemaios, wie Amadoka
  und Tanais auch. Sizilien, Sardinien, Kreta, Zypern, Rhodos, die Balearen und
  Britannien sind nur mit Schiffen erreichbar.
- **Orte werden gebacken: ein Mesh je Material statt eines je Balken.** Ein
  Ort wurde aus sechzig bis hundertachtzig einzelnen Meshes gebaut – jedes Haus
  ein Klotz und ein Dach, jeder Pfahl der Palisade ein Zylinder und eine
  Spitze –, jedes mit eigener Geometrie. Für die Grafikkarte waren das
  **5.667 Zeichenaufrufe je Bild** bei 107 Orten, und die Zahl der Aufrufe,
  nicht die der Dreiecke, ist es, was eine Karte auf schwacher Hardware zäh
  macht. Jetzt wird jeder Ort, jeder Mauerring, jeder Anbau, jedes Wunder und
  das Zelt **nach dem Bau gebacken**: alle Teile mit demselben Material zu
  einem einzigen Mesh verschmolzen. Draußen bleibt, was sich noch bewegen oder
  ändern muss – die Fahnen, die sich mit der Kamera drehen; die Terrasse und
  die Fundamentplatten, die erst beim Setzen ans Gelände angepasst werden; die
  Werft am Hafen und der Speicher am Acker, die sich ein- und ausschalten; und
  die Zeltbahnen, weil ihr Stoffmuster UV-Koordinaten braucht, die das Backen
  nicht weiterträgt. Die Teile in der Fraktionsfarbe bekommen ein gemeinsames
  Material, damit ein Besitzerwechsel weiterhin nur eine Farbe setzt.

  | | vorher | nachher |
  | --- | --- | --- |
  | Zeichenaufrufe je Bild | 5.667 | **733** |
  | Meshes in der Szene | 11.405 | **1.297** |
  | Geometrien im Speicher | 9.889 | **1.142** |
  | Zeichenzeit je Bild (Software-GL) | 40,6 ms | **4,7 ms** |
  | JS-Heap nach dem Start | 90 MB | **37 MB** |
  | Start bis zur Karte | 11,0 s | **6,5 s** |
  | `refresh()` je Klick | 61 ms | **21 ms** |

  Die Dreiecke bleiben gleich (360.000) – es wird nichts weggelassen, nur
  zusammengefasst; die Orte sind vor und nach dem Backen **pixelgenau
  identisch** (0,00 % Abweichung in drei Nahaufnahmen, ebenso Zelt, Mauern und
  Anbauten). Zwei Fallen hat das Backen bereitgehalten: Wunder werden gebacken,
  nachdem ihre Gruppe schon verschoben und skaliert ist – gerechnet wird
  deshalb **relativ zur Gruppe**, nicht in Weltkoordinaten, sonst wandert die
  Verschiebung in die Scheitelpunkte und wird beim Zeichnen ein zweites Mal
  angewandt (der Leuchtturm stand dann irgendwo im Meer); und die Werft am
  Hafen ist eine Untergruppe mit eigener Verschiebung, für die dasselbe gilt.
  Der Rundenwechsel wird davon nicht schneller: seine drei Sekunden sind die
  sichtbaren Märsche der KI, nicht das Zeichnen – die Rechnung der neunzehn
  Fraktionen selbst dauert 100 bis 170 ms.
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
- `js/scenarios.js` – die Ausgangslagen: anderes Startjahr, andere
  Ortsbesitzer, ein schon erklärter Krieg
- `js/savegame.js` – der Spielstand: Ablage und Wiederherstellung im Browser,
  ohne die Karte, die aus fester Startzahl neu entsteht
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
  Renderer, Gestalten als Instanzenwolken, dazu Gelände, Wetter, Mauer mit
  Wehrgang und Leitern. Spielt Runde für Runde nach, was der Schlachtbericht
  schon enthält, und würfelt nichts eigenes
- `js/vendor/three.min.js` – lokal eingebundenes Three.js (MIT-Lizenz, r149)
- `js/weather.js` – Kalender, Klimazonen, Wettertypen und ihre Regelwirkung
- `js/anthems.js` – die Partituren der neunzehn Fraktionen: Leitern, Grundtöne,
  Motive und Besetzung
- `js/audio.js` – der ganze Ton: Hall- und Kompressorkette, die einzelnen
  Klangereignisse, der Marschtritt, das Titelstück und der Spieler für die
  Fraktionsmusik
- `js/titlemusic.js` – wo das Titelstück liegt; der Bündler tauscht diese eine
  Zeile gegen eine eingebettete Datenadresse
- `audio/aureate-legion.mp3` – das Titelstück, die einzige Klangdatei im Spiel
- `js/settings.js` – Einstellungen: Schema, Speicherung, Einstellungsfenster
- `js/events.js` – die Zufallsereignisse: Bedingung, Wirkung und der Satz,
  der sie erzählt
- `js/titlescene.js` – das Titelbild des Hauptmenüs als SVG-Silhouetten
- `js/ornaments.js` – Lorbeerkranz und Menüzeichen des Startbildschirms als SVG
- `js/chronicle.js` – die acht Chronikbilder als SVG-Silhouetten
- `js/ui.js`, `js/input.js`, `js/main.js` – Seitenleiste, Eingabe, Startbildschirm, Bootstrap

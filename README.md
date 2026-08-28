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

**Jede Jahreszeit dauert vier Runden**, vier Jahreszeiten ergeben das Jahr – ein
Feldzugsjahr sind also sechzehn Runden. Das Spiel beginnt im **Frühling
264 v. Chr.**, dem Jahr, in dem der Erste Punische Krieg ausbricht. Die
Kopfzeile zeigt Jahreszeit, Jahr und die wievielte Runde der Jahreszeit gerade
läuft (`Frühling 264 v. Chr. · 2/4`), daneben das Wetter dort, wo die Kamera
gerade hinsieht.

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
durch die Fraktionswahl und blendet aus, wenn der Feldzug beginnt; auf der
Karte bleibt es still. Früher kann sie nicht anfangen: ein Browser lässt Ton
erst nach einer echten Geste des Spielers zu.

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
- **Drei Schiffsarten**, historisch nach Fraktion verteilt: die **Quinquereme**
  mit Turm und Enterbrücke für Rom, Karthago, Seleukiden und Ptolemäer
  (50/52, 220 Gold) – schwer und im Rammstoß überlegen; der **leichte Ruderer**
  (Lembos, Triere) für Griechen, Illyrer und Iberer (44/40, 170 Gold) – schnell
  und billig, aber dünnwandig; das **Segelschiff** mit hochbordigem Eichenrumpf
  und Ledersegel für Gallier, Britannier, Germanen, Daker und Sarmaten
  (36/54, 195 Gold) – schwer zu rammen, schwach im Angriff. Jede Bauart hat ihr
  eigenes Modell auf der Karte.
- **Flotten bauen**: Jede eigene Stadt mit Hafen hat eine Werft: **60 Schiffe**
  der eigenen Bauart. Sie laufen als eigene **Flotte** aus – ein
  Verband, der das Meer hält, statt ein Heer überzusetzen. Liegt schon eine
  Flotte im Hafen, wächst sie stattdessen. Eine Flotte fährt 15 Felder weit,
  geht nie an Land und greift an, was auf dem Wasser fährt.
- **Kampf zur See**: Auf dem Wasser zählt das Schiff, nicht der Mann. Fußvolk
  an Bord kämpft mit halber Kraft, Reiterei mit 40 %, Bogenschützen mit 80 % –
  Kriegsschiffe zu voller. 60 Kriegsschiffe versenken deshalb ein
  übergesetztes Heer von 540 Mann (20 % eigene Verluste), 30 reichen dafür
  nicht. Wer eine Landung erwartet, hält seine Flotte davor.
- **Heere vereinigen**: Zieht man ein Heer auf ein eigenes (blau markiertes
  Feld), werden beide eines. Erfahrung, Moral und Erschöpfung mitteln sich nach
  Kopfzahl. Auch die KI legt zusammen, statt mit zwei halben Heeren vor einer
  Stadt zu warten, die keines von beiden nehmen kann.
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
  Bewegungspunkt berechnet (2,5), nicht je Feld – auf der Straße kommt ein Heer
  für denselben Preis weiter als querfeldein. Ein voller Tagesmarsch kostet
  damit 45, eine Schlacht weitere 18. Gerastet wird im Verhältnis der Bewegung,
  die stehen geblieben ist: −18 je Runde im Feld, −34 in einer eigenen Stadt,
  jeweils anteilig. Ein kurzer Marsch trägt sich so selbst, zwei Gewaltmärsche
  hintereinander laugen ein Heer aus – wer ausgeruht in die Schlacht geht,
  gewinnt sie fast sicher, wer erschöpft antritt, fast nie.
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
  neue Straßen legen sich an das bestehende Netz an. Zu Spielbeginn hängen die
  Städte jeder Fraktion an ihrer Hauptstadt, die Dörfer noch nicht. Fällt einer
  der beiden Orte an den Feind, wird der Bau abgebrochen.
- **Bewegung wird in Punkten gerechnet, nicht in Feldern**: offene Ebene kostet
  3, gebrochenes Gelände – Wald, Hügel, Wüste – das Doppelte, eine gepflasterte
  Straße 2, und ein Heer hat 18 Punkte je Runde. Das sind sechs Felder Ebene,
  drei Felder Wald – und neun Felder Straße.
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
- **Das Stadtfenster hat zwei Reiter**: **Infos** – Rang, Bevölkerung,
  Einnahmen, Stadtwache, Bauwerke, Befestigung, Garnison – und **Bauen**:
  Mauern, Hafen, Flotte, Straßen, Rekrutierung und Aushebung. Im Reiter
  **Bauen** bleibt die Geländeauskunft aus – dort geht es darum, was man tun
  kann, und die Bauknöpfe sollen nicht unter einer Wand aus Höhenangaben
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
- **Ton**: 🔊 schaltet alles ab, was zu hören ist – Titelmusik, Marschtritt,
  Zusammenstoß, Hornruf, Steinarbeit, Kriegstrommel. Nichts davon ist eine
  Audiodatei: alles entsteht zur Laufzeit aus Oszillatoren und Rauschen und
  läuft über eine gemeinsame Kette aus Hall und Kompressor, damit die Klänge
  in einem Raum stehen und sich nicht gegenseitig übersteuern. Eine Auswahl
  ist bewusst nur ein trockener Klick, kein Ton – bei jedem zweiten Handgriff
  wäre ein Piepser eine Belästigung. Die Titelmusik lässt sich in den
  Einstellungen getrennt abschalten.
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
- Die **Illyrer** sitzen mit vier Orten an der Adria, eingeklemmt zwischen den
  Dinariden und dem Meer – wenig Land, aber lauter Häfen.
- Die **Sarmaten** ziehen mit ihren Kataphrakten durch die Steppe nördlich des
  Schwarzen Meeres. Weite Wege, kaum Nachbarn, kaum Einkommen.
- Die **Daker** halten die Karpaten um Sarmizegetusa – Bergland, das sich gut
  verteidigen lässt, mit der Donau als Sprungbrett nach Süden.
- **77 Siedlungen in drei Größen**: **Große Stadt** (viel Bevölkerung, starke
  Garnison, 1,7-faches Grundeinkommen), **Stadt** (Normalmaß) und **Dorf**
  (klein, halbes Grundeinkommen – leicht zu nehmen und gute Sprungbretter).
  20 davon gehören niemandem und sind frei zu erobern – von Olisipo bis
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
- `js/ai.js` – einfache KI (Wirtschaft + Angriffsverhalten)
- `js/scene3d.js` – Three.js-Szene: instanziertes 3D-Gelände, Städte/Armeen als
  3D-Objekte, isometrische Kamera (Pan/Zoom), Raycasting-Feldauswahl
- `js/vendor/three.min.js` – lokal eingebundenes Three.js (MIT-Lizenz, r149)
- `js/weather.js` – Kalender, Klimazonen, Wettertypen und ihre Regelwirkung
- `js/audio.js` – der ganze Ton: Hall- und Kompressorkette, die einzelnen
  Klangereignisse, der Marschtritt und die Titelmusik
- `js/settings.js` – Einstellungen: Schema, Speicherung, Einstellungsfenster
- `js/events.js` – die Zufallsereignisse: Bedingung, Wirkung und der Satz,
  der sie erzählt
- `js/chronicle.js` – die acht Chronikbilder als SVG-Silhouetten
- `js/ui.js`, `js/input.js`, `js/main.js` – Seitenleiste, Eingabe, Startbildschirm, Bootstrap

---
name: run-game
description: Startet Pax Aeterna und spielt es in einem headless Chromium wirklich durch - Heere wählen, marschieren, angreifen, Runden beenden, Screenshots machen. Nutze diesen Skill immer, wenn das Spiel gestartet, ausprobiert, vorgeführt oder eine Änderung im echten Spiel überprüft werden soll: "starte das Spiel", "spiel eine Belagerung", "zeig mir das im Spiel", "sieht die Kampfvorschau richtig aus", "funktioniert das wirklich" - auch dann, wenn nur von einer Schlacht, einer Stadt, einem Feldzug oder der Karte die Rede ist und der Browser gar nicht erwähnt wird. Ohne diesen Skill ist die 3D-Karte praktisch nicht bedienbar, weil sich Felder nicht anklicken lassen.
---

# Pax Aeterna starten und spielen

Das Spiel ist eine reine Browser-Anwendung ohne Bauschritt: ein statischer
Server, ES-Module, eine Three.js-Karte. Es zu "starten" heißt deshalb, den
Server zu starten und einen Browser darauf zu treiben - und der schwierige
Teil ist das Klicken auf der Karte. Dafür liegt hier ein Treiber bereit.

## Server

```bash
npm start > /tmp/paxserver.log 2>&1 &          # bedient Port 8080
timeout 30 bash -c 'until curl -sf http://localhost:8080 >/dev/null; do sleep 1; done'
```

Zum Schluss wieder anhalten - sonst läuft der nächste Start in `EADDRINUSE`:

```bash
lsof -ti:8080 -sTCP:LISTEN | xargs -r kill
```

Ein anderer Port geht über `PORT=9000 npm start` und `GAME_URL` für den Treiber.

## Warum es einen Treiber braucht

Die Karte ist ein einziges Canvas. Felder sind keine DOM-Knoten, es gibt keine
Selektoren, und die Umrechnung Feld → Bildpunkt ist perspektivisch **und**
vom Gelände abhängig: dasselbe Feld liegt auf einem Hügel woanders als in der
Ebene. Eine feste Formel trifft daneben.

Der Ausweg steckt im Spiel selbst: **Rechtsklick öffnet die Feldinfo, und die
nennt Längen- und Breitengrad.** `js/geodata.js` rechnet die zurück in ein
Feld. Damit lässt sich jeder Klick prüfen und nachkorrigieren. `scripts/driver.mjs`
schätzt daraus zuerst eine Homographie (die Kartenebene unter Perspektive) und
regelt den Rest je Ziel weg. `aimAt` trifft danach zuverlässig.

## Ein Lauf von Anfang bis Ende

```js
import {
  openGame, startNewGame, calibrate, aimAt, clickTile, tileText,
  endTurn, resolvePreview, isOpen, initialState, geodataOf,
} from './.claude/skills/run-game/scripts/driver.mjs';

const GAME = '/home/user/Alpino';
const geo = await geodataOf(GAME);

// Ziele vorher offline bestimmen, statt sie auf der Karte zu suchen.
const st = await initialState(GAME, 'rom');
const roma = st.cities.find((c) => c.name === 'Roma');            // 34,27
const ziel = st.cities.find((c) => c.name === 'Scodra');          // 44,26, Mauerstufe 2

const { browser, page, errors } = await openGame();
await startNewGame(page, 'Rom');
const project = await calibrate(page, geo);                       // einmal je Sitzung

await clickTile(page, project, geo, 34, 26);                      // Heer wählen
await clickTile(page, project, geo, roma.col, roma.row);          // in die Stadt ziehen

// In einer eigenen Stadt lässt sich direkt ins Heer rekrutieren.
for (let i = 0; i < 4; i++) {
  const b = page.locator('button.reinforce-btn[data-unit="infantry"]');
  if (await b.count() && await b.first().isEnabled()) { await b.first().click(); await page.waitForTimeout(700); }
}

await endTurn(page);
// ... marschieren ...
await clickTile(page, project, geo, ziel.col, ziel.row);          // Angriff auslösen
const kampf = await resolvePreview(page, { label: 'belagerung', shots: '/tmp/shots' });
console.log(kampf.preview);   // Siegchance, Frontbreite, erwartete Verluste
console.log(kampf.report);    // Ausgang, Verluste je Gattung, Rundenverlauf
await browser.close();
```

`resolvePreview` legt `vorschau-<label>.png` und `bericht-<label>.png` ab, wenn
`shots` gesetzt ist. **Sieh dir die Bilder an** - ein schwarzes Bild heißt, dass
die Karte nicht gerendert hat, und der Text allein verrät das nicht.

## Marschieren

Ein Heer zieht 18 Bewegungspunkte weit, Ebene kostet 3 je Feld, Hügel und Wald
6, Regen und Schnee kommen obendrauf. Ein Zug reicht also für rund vier bis
sechs Felder in der Ebene. Der Weg selbst wird am besten vorher offline gesucht
(Breitensuche über `st.map.tiles`, unpassierbar ist, was in `TILE_TYPES` als
`impassable` steht) und dann Wegpunkt für Wegpunkt geklickt.

Zwei Dinge, an denen ein naiver Marschlauf hängen bleibt:

- **Ein fremdes Heer im Weg** macht den Klick zum Angriff und öffnet die
  Kampfvorschau. Wer die nicht abfängt, klickt danach ins Leere, weil die
  Überlagerung alles schluckt. Nach jedem Zug also `isOpen(page, '#battlePreview')`
  prüfen und mit `resolvePreview` auflösen.
- **Kontrollzonen** (orange Felder) beenden die Bewegung. Ein Klick, der nichts
  bewirkt, ist normal - dann das nächstnähere Feld versuchen.

Ob das Heer angekommen ist, steht in der Feldinfo. Dabei auf den Heeresnamen
prüfen (`/Rom Feldarmee/`) und nicht auf "Mann": das Wort steht auch in der
Garnison jeder fremden Stadt, und der Marsch endet dann scheinbar erfolgreich
vor einer Stadt, die noch gar nicht genommen ist.

## Was sonst noch auffällt

- **Marschanimation aus.** `openGame` legt dafür `spqr.settings` in den
  localStorage. Mit Animation wartet der Treiber ein Vielfaches der Zeit.
- **Die Ansprache zu Beginn** liegt über der Karte und geht mit Escape weg;
  `startNewGame` erledigt das.
- **Nicht schwenken oder zoomen.** Die Kamera folgt keinem Marsch, deshalb hält
  die Kalibrierung den ganzen Lauf. Wer die Kamera bewegt, muss neu kalibrieren.
- **Konsolenfehler prüfen.** `openGame` sammelt sie in `errors`; die Karte kann
  aussehen, als stünde sie, während im Hintergrund etwas geworfen hat.
- **Kein Speicherstand.** Ein neuer Browser heißt neuer Feldzug. Was in einem
  Lauf gezeigt werden soll, muss in einem Skript stehen.

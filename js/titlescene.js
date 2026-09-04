// Das Bild hinter dem Hauptmenü: der Feldherrnblick.
//
// Ein Mann in rotem Mantel steht auf einer Terrasse über einer Hafenstadt am
// Meer, dahinter die Berge; neben ihm das Feldzeichen, vor ihm der Tisch mit
// Karte und Helm. Es ist der Augenblick vor dem Feldzug - und damit das
// Titelbild des Spiels.
//
// Wie alles Bildliche hier ist es als SVG gezeichnet und wird zur Laufzeit
// zusammengesetzt: keine Bilddatei, damit das Spiel auch als einzelne
// HTML-Datei und ohne Netz läuft. Die Bildsprache ist dieselbe wie in der
// Chronik - geschichtete Silhouetten vor einem Himmelsverlauf -, nur dichter
// gestaffelt, weil dieses eine Bild stehen bleibt, statt weiterzuziehen.

import { SCENE_W, SCENE_H, seeded, sky, sun, peaks, temple } from './chronicle.js';

// --- Die Schiffe im Hafen ---------------------------------------------------
// Die Chronik zeichnet ihr Schiff aus der Ferne, als eine von vielen kleinen
// Figuren in einem historischen Augenblick. Hier steht es groß und allein im
// eigenen Vordergrund, und in dieser Größe reichten Rumpf, Ruder und Segel
// aus der Chronik nicht mehr: der Bug war eine gerade Kante, kein Rammsporn,
// das Achterdeck fehlte ganz. Diese Fassung gehört nur dem Titelbild.
function titleWarship(x, y, s, hull, sail) {
  const g = (v) => (v * s).toFixed(1);
  const oars = Array.from({ length: 8 }, (_, i) =>
    `<path d="M ${g(-64 + i * 18)} 0 l ${g(-6)} ${g(16)}"
      stroke="${hull}" stroke-width="${g(3)}" fill="none"/>`).join('');
  return `<g transform="translate(${x} ${y})">
    ${oars}
    <!-- Rumpf: der Bug schwingt hoch, das Heck nur leicht - so lag ein
         Kriegsschiff der Alten Welt im Wasser. -->
    <path d="M ${g(-84)} ${g(-6)} Q ${g(-98)} ${g(-26)} ${g(-74)} ${g(-38)}
      L ${g(80)} ${g(-8)} Q ${g(96)} ${g(-2)} ${g(86)} ${g(13)}
      L ${g(-70)} ${g(13)} Z" fill="${hull}"/>
    <!-- Der Rammsporn, knapp über der Wasserlinie am Bug -->
    <path d="M ${g(-84)} ${g(-6)} L ${g(-108)} ${g(-2)} L ${g(-84)} ${g(6)} Z" fill="${sail}"/>
    <!-- Das Achterdeck, leicht erhöht -->
    <rect x="${g(56)}" y="${g(-19)}" width="${g(26)}" height="${g(11)}" rx="${g(4)}"
      fill="${sail}" opacity="0.85"/>
    <!-- Mast und Rah -->
    <rect x="${g(-5)}" y="${g(-92)}" width="${g(5)}" height="${g(86)}" fill="${hull}"/>
    <rect x="${g(-28)}" y="${g(-88)}" width="${g(52)}" height="${g(4)}" fill="${hull}"/>
    ${sail ? `<path d="M ${g(-24)} ${g(-84)} Q 0 ${g(-64)} ${g(24)} ${g(-84)}
      L ${g(19)} ${g(-36)} Q 0 ${g(-47)} ${g(-19)} ${g(-36)} Z" fill="${sail}"/>` : ''}
  </g>`;
}

// --- Wolken ---------------------------------------------------------------
// Ein Haufen aus überlappenden Kreisen mit flacher Unterkante: aus der Ferne
// ist eine Quellwolke nichts anderes.
function cloud(x, y, s, color, opacity) {
  const ball = (dx, dy, r) =>
    `<circle cx="${(x + dx * s).toFixed(1)}" cy="${(y + dy * s).toFixed(1)}" r="${(r * s).toFixed(1)}"/>`;
  return `<g fill="${color}" opacity="${opacity}">
    ${ball(-90, 14, 46)}${ball(-40, -6, 62)}${ball(18, -20, 74)}${ball(80, 2, 56)}
    ${ball(132, 18, 40)}${ball(46, 22, 52)}${ball(-6, 26, 46)}
    <rect x="${(x - 136 * s).toFixed(1)}" y="${(y + 14 * s).toFixed(1)}"
      width="${(310 * s).toFixed(1)}" height="${(30 * s).toFixed(1)}" rx="${(14 * s).toFixed(1)}"/>
  </g>`;
}

// --- Die Bucht ------------------------------------------------------------
// Eine Landzunge, die von der Seite ins Bild greift: sie macht aus dem Meer
// eine Bucht, und ohne sie sähe das Wasser wie ein Streifen aus.
function headland(x0, x1, baseY, height, color, opacity = 1) {
  return `<path d="M ${x0} ${baseY} Q ${x0 + (x1 - x0) * 0.3} ${baseY - height}
    ${x0 + (x1 - x0) * 0.62} ${baseY - height * 0.72}
    Q ${x0 + (x1 - x0) * 0.86} ${baseY - height * 0.45} ${x1} ${baseY}
    Z" fill="${color}" opacity="${opacity}"/>`;
}

// --- Die Stadt am Hang ----------------------------------------------------
// Terrassen, darauf Häuser mit Ziegeldächern. Die Reihen werden nach hinten
// kleiner und blasser - so entsteht Tiefe ohne Perspektivrechnung.
function terracedTown(x0, x1, baseY, rows, rng, wall, roof, dunst) {
  let out = '';
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1 || 1);
    const y = baseY - t * 96;
    const s = 1 - t * 0.42;
    const einzug = t * (x1 - x0) * 0.09;
    const schleier = (0.42 * t).toFixed(2);
    let reihe = '';
    for (let x = x0 + einzug; x < x1 - einzug; x += 34 * s + rng() * 16 * s) {
      const w = (20 + rng() * 22) * s;
      const h = (18 + rng() * 26) * s;
      reihe += `<rect x="${x.toFixed(1)}" y="${(y - h).toFixed(1)}"
        width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${wall}"/>`;
      // Das Dach: ein flaches Dreieck, in Ziegelrot.
      reihe += `<path d="M ${(x - 2.5 * s).toFixed(1)} ${(y - h).toFixed(1)}
        L ${(x + w / 2).toFixed(1)} ${(y - h - 9 * s).toFixed(1)}
        L ${(x + w + 2.5 * s).toFixed(1)} ${(y - h).toFixed(1)} Z" fill="${roof}"/>`;
    }
    out += `<g>${reihe}<rect x="${x0}" y="${(y - 2).toFixed(1)}"
      width="${x1 - x0}" height="4" fill="${wall}" opacity="0.5"/></g>`;
    if (t > 0) out += `<rect x="${x0}" y="${(y - 130).toFixed(1)}" width="${x1 - x0}"
      height="132" fill="${dunst}" opacity="${schleier}"/>`;
  }
  return out;
}

// --- Der Leuchtturm -------------------------------------------------------
// Drei Stockwerke, die nach oben schmaler werden, und ein Feuerkorb darauf:
// der Pharos, wie ihn die Münzen zeigen.
function pharos(x, baseY, h, color, feuer) {
  const w = h * 0.19;
  // Das Feuer im Korb flackert leise (CSS, `.tscn-flame` in style.css) - das
  // einzige Licht im Bild, das sich bewegt, statt nur zu scheinen.
  return `<g fill="${color}">
    <rect x="${x - w / 2}" y="${baseY - h * 0.55}" width="${w}" height="${h * 0.55}"/>
    <rect x="${x - w * 0.36}" y="${baseY - h * 0.84}" width="${w * 0.72}" height="${h * 0.3}"/>
    <rect x="${x - w * 0.24}" y="${baseY - h}" width="${w * 0.48}" height="${h * 0.18}"/>
    <rect x="${x - w * 0.66}" y="${baseY - h * 0.57}" width="${w * 1.32}" height="${h * 0.035}"/>
    <rect x="${x - w * 0.46}" y="${baseY - h * 0.86}" width="${w * 0.92}" height="${h * 0.03}"/>
  </g>
  <g class="tscn-flame">
    <circle cx="${x}" cy="${baseY - h - h * 0.02}" r="${h * 0.055}" fill="${feuer}"/>
    <circle cx="${x}" cy="${baseY - h - h * 0.02}" r="${h * 0.16}" fill="${feuer}" opacity="0.22"/>
  </g>`;
}

// --- Das Feldzeichen ------------------------------------------------------
// Ein Tuch an einer Querstange, unten in Zipfel geschnitten, mit einem Kranz
// darauf und einer Lanzenspitze über der Stange.
function fieldStandard(x, top, h, w, tuch, saum, gold) {
  const unten = top + h;
  const zipfel = `M ${x - w / 2} ${unten - 46} L ${x - w / 2} ${unten}
    L ${x - w / 6} ${unten - 34} L ${x + w / 6} ${unten} L ${x + w / 2} ${unten - 34}
    L ${x + w / 2} ${unten - 46} Z`;
  return `<g>
    <rect x="${x - 5}" y="${top - 150}" width="10" height="${h + 190}" fill="${gold}" opacity="0.85"/>
    <path d="M ${x} ${top - 208} L ${x + 13} ${top - 168} L ${x} ${top - 150}
      L ${x - 13} ${top - 168} Z" fill="${gold}"/>
    <rect x="${x - w / 2 - 26}" y="${top - 14}" width="${w + 52}" height="12" rx="6" fill="${gold}"/>
    <circle cx="${x - w / 2 - 26}" cy="${top - 8}" r="9" fill="${gold}"/>
    <circle cx="${x + w / 2 + 26}" cy="${top - 8}" r="9" fill="${gold}"/>
    <!-- Das Tuch selbst schwingt leicht (CSS-Klasse tscn-cloth) - Stange,
         Kranz und Spitze bleiben starr, wie es sich für Metall im Boden gehört. -->
    <g class="tscn-cloth">
      <rect x="${x - w / 2}" y="${top}" width="${w}" height="${h - 46}" fill="${tuch}"/>
      <path d="${zipfel}" fill="${tuch}"/>
      <rect x="${x - w / 2}" y="${top}" width="${w}" height="${h - 46}" fill="none"
        stroke="${saum}" stroke-width="5"/>
      <text x="${x}" y="${top + 158}" text-anchor="middle" fill="${gold}"
        font-family="Georgia, 'Times New Roman', serif" font-size="46"
        letter-spacing="4" opacity="0.92">SPQR</text>
    </g>
    <g fill="none" stroke="${gold}" stroke-width="7" stroke-linecap="round" opacity="0.9">
      <path d="M ${x - 44} ${top + 178} Q ${x - 60} ${top + 116} ${x - 28} ${top + 76}"/>
      <path d="M ${x + 44} ${top + 178} Q ${x + 60} ${top + 116} ${x + 28} ${top + 76}"/>
    </g>
  </g>`;
}

// --- Der Feldherr ---------------------------------------------------------
// Von hinten gesehen: Kopf, Schulterstück, darüber der Mantel, der bis unter
// den Bildrand fällt. Ein Arm liegt auf der Brüstung. Alles in Silhouette,
// nur der Mantel trägt Farbe - er ist das eine Rot im Bild, das nicht Ziegel
// ist, und dorthin soll der Blick.
function commander(x, kopfY, s, haut, haar, panzer, mantel, mantelTief, gold) {
  const g = (v) => (v * s).toFixed(1);
  return `<g transform="translate(${x} ${kopfY})">
    <!-- Kopf und Nacken: eine runde Kalotte, die unten flach ausläuft statt
         spitz zuzulaufen - ein Punkt am Hinterkopf machte aus dem Kopf ein
         Gefäß statt eines Schädels. -->
    <path d="M ${g(-48)} 0 Q ${g(-54)} ${g(-64)} 0 ${g(-72)}
      Q ${g(54)} ${g(-64)} ${g(48)} 0
      Q ${g(46)} ${g(38)} ${g(30)} ${g(50)} L ${g(-30)} ${g(50)}
      Q ${g(-46)} ${g(38)} ${g(-48)} 0 Z" fill="${haar}"/>
    <path d="M ${g(-18)} ${g(48)} L ${g(18)} ${g(48)} L ${g(22)} ${g(90)}
      L ${g(-22)} ${g(90)} Z" fill="${haut}"/>
    <!-- Schulterstück und Rücken: höher angesetzt und mit flachem Bund statt
         einer Spitze, damit über dem Mantel wirklich ein Kragen aus Rüstung
         steht und nicht nur ein schmaler dunkler Strich. -->
    <path d="M ${g(-104)} ${g(214)} Q ${g(-96)} ${g(100)} ${g(-16)} ${g(80)}
      L ${g(16)} ${g(80)} Q ${g(96)} ${g(100)} ${g(104)} ${g(214)} Z" fill="${panzer}"/>
    <!-- Der Mantel: über die linke Schulter geworfen, nach unten breiter -->
    <path d="M ${g(-96)} ${g(134)} Q ${g(-150)} ${g(180)} ${g(-168)} ${g(300)}
      Q ${g(-186)} ${g(470)} ${g(-160)} ${g(660)} L ${g(150)} ${g(660)}
      Q ${g(172)} ${g(430)} ${g(140)} ${g(268)}
      Q ${g(120)} ${g(170)} ${g(74)} ${g(126)}
      Q ${g(20)} ${g(164)} ${g(-40)} ${g(140)} Z" fill="${mantel}"/>
    <!-- Die Falten: dieselbe Farbe, nur tiefer -->
    <g fill="${mantelTief}" opacity="0.55">
      <path d="M ${g(-150)} ${g(300)} Q ${g(-128)} ${g(450)} ${g(-142)} ${g(660)}
        L ${g(-96)} ${g(660)} Q ${g(-92)} ${g(430)} ${g(-118)} ${g(292)} Z"/>
      <path d="M ${g(40)} ${g(190)} Q ${g(76)} ${g(400)} ${g(64)} ${g(660)}
        L ${g(112)} ${g(660)} Q ${g(126)} ${g(400)} ${g(86)} ${g(178)} Z"/>
    </g>
    <!-- Die Spange auf der Schulter -->
    <circle cx="${g(-84)}" cy="${g(140)}" r="${g(15)}" fill="${gold}"/>
    <!-- Der Arm, der auf der Brüstung liegt -->
    <path d="M ${g(96)} ${g(180)} Q ${g(168)} ${g(220)} ${g(196)} ${g(330)}
      L ${g(150)} ${g(348)} Q ${g(126)} ${g(258)} ${g(72)} ${g(226)} Z" fill="${haut}"/>
    <path d="M ${g(150)} ${g(330)} L ${g(212)} ${g(330)} L ${g(212)} ${g(366)}
      L ${g(146)} ${g(366)} Z" fill="${haut}"/>
    <!-- Das Armband -->
    <rect x="${g(140)}" y="${g(322)}" width="${g(22)}" height="${g(40)}" rx="${g(5)}" fill="${gold}"
      opacity="0.8"/>
  </g>`;
}

// --- Der Helm auf dem Tisch -----------------------------------------------
// Von der Seite gesehen, wie er abgelegt daliegt: die Kalotte, der
// Nackenschirm hinten, die Wangenklappe darunter - und darauf der Helmbusch,
// der über die ganze Länge läuft. Eine frühere Fassung setzte ihm eine
// schmale Feder auf; das sah aus wie ein Hut mit Blume.
function helmet(x, baseY, s, metall, busch, dunkel) {
  const g = (v) => (v * s).toFixed(1);
  // Der Busch als Bürste: eine Reihe von Zacken über einer Grundkurve.
  let borsten = `M ${g(-66)} ${g(-96)}`;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const bx = -66 + t * 132;
    const hoehe = -96 - Math.sin(t * Math.PI) * 62 - (i % 2 ? 0 : 9);
    borsten += ` L ${g(bx)} ${g(hoehe)}`;
  }
  borsten += ` L ${g(66)} ${g(-96)} Z`;
  return `<g transform="translate(${x} ${baseY})">
    <!-- Nackenschirm -->
    <path d="M ${g(50)} ${g(-58)} Q ${g(92)} ${g(-40)} ${g(96)} ${g(4)}
      L ${g(58)} ${g(6)} Q ${g(56)} ${g(-28)} ${g(38)} ${g(-42)} Z" fill="${dunkel}"/>
    <!-- Die Kalotte -->
    <path d="M ${g(-70)} ${g(6)} Q ${g(-74)} ${g(-92)} 0 ${g(-98)}
      Q ${g(74)} ${g(-92)} ${g(70)} ${g(6)} Z" fill="${metall}"/>
    <!-- Der Stirnreif -->
    <path d="M ${g(-72)} ${g(-8)} L ${g(72)} ${g(-8)} L ${g(70)} ${g(8)}
      L ${g(-70)} ${g(8)} Z" fill="${dunkel}"/>
    <!-- Die Wangenklappe -->
    <path d="M ${g(-48)} ${g(4)} Q ${g(-58)} ${g(52)} ${g(-30)} ${g(66)}
      L ${g(-14)} ${g(58)} Q ${g(-34)} ${g(38)} ${g(-28)} ${g(4)} Z" fill="${metall}"/>
    <!-- Der Helmbusch, längs über die Kalotte -->
    <path d="${borsten}" fill="${busch}"/>
    <path d="M ${g(-66)} ${g(-96)} L ${g(66)} ${g(-96)} L ${g(62)} ${g(-84)}
      L ${g(-62)} ${g(-84)} Z" fill="${dunkel}"/>
  </g>`;
}

// --- Die Karte auf dem Tisch ----------------------------------------------
function mapScroll(x, y, w, papier, schatten, tinte) {
  return `<g transform="translate(${x} ${y})">
    <rect x="0" y="0" width="${w}" height="${w * 0.3}" rx="${w * 0.03}" fill="${papier}"/>
    <rect x="0" y="${w * 0.24}" width="${w}" height="${w * 0.06}" fill="${schatten}" opacity="0.5"/>
    <g stroke="${tinte}" stroke-width="2.5" fill="none" opacity="0.55">
      <path d="M ${w * 0.1} ${w * 0.13} Q ${w * 0.28} ${w * 0.05} ${w * 0.46} ${w * 0.15}
        Q ${w * 0.64} ${w * 0.24} ${w * 0.9} ${w * 0.11}"/>
      <path d="M ${w * 0.16} ${w * 0.21} Q ${w * 0.4} ${w * 0.14} ${w * 0.72} ${w * 0.22}"/>
    </g>
    <ellipse cx="${-w * 0.02}" cy="${w * 0.15}" rx="${w * 0.045}" ry="${w * 0.17}" fill="${papier}"/>
    <ellipse cx="${w * 1.02}" cy="${w * 0.15}" rx="${w * 0.045}" ry="${w * 0.17}" fill="${papier}"/>
    <ellipse cx="${-w * 0.02}" cy="${w * 0.15}" rx="${w * 0.02}" ry="${w * 0.13}" fill="${schatten}"/>
    <ellipse cx="${w * 1.02}" cy="${w * 0.15}" rx="${w * 0.02}" ry="${w * 0.13}" fill="${schatten}"/>
  </g>`;
}

// --- Das ganze Bild -------------------------------------------------------
export function titleSceneSVG() {
  const rng = seeded(2641);

  // Später Nachmittag, kein Abend: der Himmel ist oben tief und wird zum
  // Horizont hin hell und warm. Eine erste Fassung war zu dunkel - sie sah
  // aus wie Nacht, und eine Hafenstadt bei Nacht zeigt nichts von dem Land,
  // um das gespielt wird.
  const HIMMEL = sky([
    [0, '#3d78bb'], [0.26, '#6f9fc9'], [0.54, '#a6c8db'],
    [0.76, '#d4e0e5'], [0.9, '#efdfc0'], [1, '#faeed4'],
  ], 'titelHimmel');

  // Der Dunst über dem Wasser: er trennt Berge, Stadt und Vordergrund
  // voneinander, ohne dass eine Linie dazwischen liegen muss.
  const dunst = '#c3d4dc';

  return `<svg viewBox="0 0 ${SCENE_W} ${SCENE_H}" preserveAspectRatio="xMidYMid slice"
    xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="title-scene">
    ${HIMMEL}
    ${sun(1210, 214, 40, '#fff6dc', 0.22)}

    <!-- Wolken: hoch und hell, tiefer und schwerer. Sie sind hell, nicht
         grau - sonst zieht ein Gewitter auf, wo Sommer sein soll. -->
    ${cloud(340, 128, 1.0, '#ffffff', 0.5)}
    ${cloud(1080, 96, 1.2, '#ffffff', 0.55)}
    ${cloud(720, 202, 0.8, '#f4f8fa', 0.38)}
    ${cloud(1500, 232, 0.9, '#eef4f7', 0.32)}
    ${cloud(120, 262, 0.7, '#e8f0f4', 0.26)}

    <!-- Die Berge hinter der Bucht: drei Staffeln statt zwei, wie schon in
         der Chronik - eine dritte, nahe und dunklere Reihe gibt der Kette
         Tiefe, statt dass die zweite Reihe schon die letzte ist. -->
    ${peaks(452, 250, rng, '#6f87a2', 0.72, 7)}
    ${peaks(472, 158, rng, '#5b7590', 0.85, 9)}
    ${peaks(486, 96, rng, '#465e76', 0.9, 11)}
    <rect y="300" width="${SCENE_W}" height="184" fill="${dunst}" opacity="0.26"/>

    <!-- Das Meer -->
    <rect y="470" width="${SCENE_W}" height="240" fill="#3f7ba6"/>
    <rect y="470" width="${SCENE_W}" height="54" fill="#8fbdd6" opacity="0.6"/>
    <!-- Die Lichtflecken darauf glitzern leise und einzeln (CSS-Klasse
         tscn-sparkle) - jeder mit seiner eigenen Verzögerung, sonst
         blinkte das ganze Meer im Gleichtakt statt in der Sonne zu glitzern. -->
    <g fill="#c2ddea" opacity="0.4">
      ${Array.from({ length: 52 }, () => {
        const x = rng() * SCENE_W;
        const y = 484 + rng() * 200;
        const w = 26 + rng() * 62;
        const delay = (rng() * 4).toFixed(2);
        return `<rect class="tscn-sparkle" style="animation-delay:${delay}s"
          x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="3" rx="1.5"/>`;
      }).join('')}
    </g>

    <!-- Ein Segler weit draußen, jenseits des Hafens - er zieht ganz langsam
         vorbei, statt nur dazustehen (CSS-Klasse tscn-underway). Ausreichend
         Weg auf beiden Seiten, damit der Sprung zurück an den Anfang
         außerhalb des Bildes liegt, wo ihn niemand sieht. Er steht vor der
         Landzunge und der Stadt, nicht danach: sonst zöge er quer über die
         Hafenstadt statt hinter ihr vorbeizuziehen. -->
    <g class="tscn-underway">${titleWarship(-140, 512, 0.4, '#5a7488', '#e9e2c8')}</g>

    <!-- Die Landzunge links, die aus dem Meer eine Bucht macht -->
    ${headland(-60, 470, 502, 126, '#5d7a70', 0.9)}
    ${headland(-60, 330, 514, 78, '#46614f')}

    <!-- Die Stadt am Hang, rechts der Mitte -->
    <path d="M 560 566 Q 860 466 1220 482 Q 1500 496 1660 566 L 1660 706 L 560 706 Z"
      fill="#93876c"/>
    ${terracedTown(580, 1580, 560, 5, rng, '#e6dcc0', '#c0603f', dunst)}
    ${temple(940, 476, 176, 122, '#f4ecd6')}
    ${temple(1268, 512, 112, 78, '#eae1c8')}
    ${pharos(1560, 524, 200, '#f0e6c8', '#ffcf7a')}
    <rect y="430" width="${SCENE_W}" height="130" fill="${dunst}" opacity="0.16"/>

    <!-- Der Hafen: Kai und Schiffe. Jedes Schiff liegt vor Anker und wiegt
         sich leicht - fünf verschiedene Verzögerungen, sonst nickte die
         ganze Flotte im Gleichtakt. -->
    <path d="M 620 706 L 1660 706 L 1660 670 Q 1160 646 620 670 Z" fill="#6d6350"/>
    <g class="tscn-ship" style="animation-delay:-0.6s">${titleWarship(700, 630, 0.62, '#33475c', '#f2ead0')}</g>
    <g class="tscn-ship" style="animation-delay:-2.1s">${titleWarship(880, 652, 0.72, '#2c3e50', '#eadfc0')}</g>
    <g class="tscn-ship" style="animation-delay:-3.4s">${titleWarship(1180, 624, 0.56, '#33475c', '#f2ead0')}</g>
    <g class="tscn-ship" style="animation-delay:-1.2s">${titleWarship(1360, 660, 0.76, '#28384a', '#e4d8b6')}</g>
    <g class="tscn-ship" style="animation-delay:-4.0s">${titleWarship(380, 600, 0.5, '#3a5670', '#e6eef2')}</g>

    <!-- Der Hang unter der Terrasse: er trägt den Vordergrund -->
    <path d="M -40 900 L -40 620 Q 240 604 440 668 Q 600 716 740 764
      Q 900 818 1120 834 L 1660 846 L 1660 900 Z" fill="#4a4a3c"/>
    <path d="M -40 900 L -40 706 Q 280 698 500 766 Q 760 844 1120 872
      L 1660 886 L 1660 900 Z" fill="#33342a"/>

    <!-- Die Brüstung: die Kante, über die geblickt wird -->
    <g>
      <rect x="180" y="700" width="1480" height="32" fill="#bdae8e"/>
      <rect x="180" y="700" width="1480" height="9" fill="#dbcda9"/>
      <rect x="180" y="726" width="1480" height="174" fill="#968b73"/>
      <g fill="#83795f">
        ${Array.from({ length: 19 }, (_, i) =>
          `<rect x="${200 + i * 78}" y="${740 + (i % 2) * 44}" width="72" height="40"/>`).join('')}
      </g>
      <rect x="180" y="732" width="1480" height="6" fill="#71684f" opacity="0.7"/>
    </g>

    <!-- Der Feldherr: rechts der Mitte, damit die Stadt frei bleibt. Er ist
         kleiner als in der ersten Fassung - dort verdeckte er den halben
         Hafen und war nicht mehr die Figur im Bild, sondern das Bild. -->
    ${commander(1146, 468, 0.62, '#c99a72', '#241a12', '#3c3a33', '#a83324', '#75211a', '#e0bb63')}

    <!-- Das Feldzeichen rechts, ganz am Rand -->
    ${fieldStandard(1452, 122, 372, 156, '#8e2a1f', '#c2a15c', '#e0bb63')}

    <!-- Der Tisch rechts unten: Karte, Helm, Rolle. Er steht hoch genug,
         dass die Leiste unten ihn nicht abschneidet. -->
    <g>
      <path d="M 1180 900 L 1180 800 L 1660 776 L 1660 900 Z" fill="#6a5338"/>
      <path d="M 1180 810 L 1660 786 L 1660 804 L 1180 828 Z" fill="#4b3925"/>
      ${mapScroll(1206, 792, 218, '#efe6cc', '#c0b28f', '#4a3a26')}
      ${helmet(1462, 806, 0.86, '#b6bac0', '#a83324', '#6e7278')}
    </g>

    <!-- Der Schatten, der alles bindet: unten dunkel, links dunkel -->
    <defs>
      <linearGradient id="titelUnten" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0b0906" stop-opacity="0"/>
        <stop offset="1" stop-color="#0b0906" stop-opacity="0.6"/>
      </linearGradient>
      <linearGradient id="titelLinks" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#0b0906" stop-opacity="0.72"/>
        <stop offset="0.4" stop-color="#0b0906" stop-opacity="0.3"/>
        <stop offset="1" stop-color="#0b0906" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect y="620" width="${SCENE_W}" height="${SCENE_H - 620}" fill="url(#titelUnten)"/>
    <rect width="${SCENE_W * 0.56}" height="${SCENE_H}" fill="url(#titelLinks)"/>
  </svg>`;
}

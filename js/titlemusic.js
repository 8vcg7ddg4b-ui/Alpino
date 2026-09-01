// Wo das Titelstück liegt.
//
// „Aureate Legion" ist eine Aufnahme, keine Partitur - das erste und bisher
// einzige Stück im Spiel, das nicht Takt für Takt aus Oszillatoren gebaut
// wird. Es läuft im Hauptmenü und durch die Fraktionswahl; im Zelt übernimmt
// dann wieder die Musik der eigenen Fraktion aus `anthems.js`.
//
// Der Pfad steht in einer eigenen Datei, weil er zweierlei sein muss: beim
// Spiel aus dem Ordner ein Dateipfad, im gebündelten Artefakt eine
// eingebettete Datenadresse. Der Bündler tauscht genau diese eine Zeile aus -
// er findet sie an der Marke unten, und deshalb steht sie so allein.

/* BUNDLE:TITLE_MUSIC */
export const TITLE_MUSIC_URL = 'audio/aureate-legion.mp3';

// Wie lange das Stück ein- und ausblendet. Es ist kein Signal, sondern ein
// Vorhang: es soll aufgehen, nicht angehen.
export const TITLE_MUSIC_FADE_IN = 2.5;
export const TITLE_MUSIC_FADE_OUT = 2.2;

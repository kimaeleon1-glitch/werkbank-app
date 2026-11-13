// Einstellungen im localStorage. Gespeichert wird nur, was Kapitel 2.2 der
// Anforderungen und docs/analyse.md (A3) erlauben – nie Messwerte.

const SCHLUESSEL = 'werkbank.einstellungen';

const STANDARD = {
  winkelEinheit: 'grad', // grad | prozent | mmm
  laengenEinheit: 'mm', // mm | cm | m | zoll
  thema: 'dunkel', // dunkel | hell
  ton: true,
  vibration: true,
  // Nullpunkte in Grad: Display-Lage, Kantenlage je Viertel, Lot
  nullpunkt: { flach: { x: 0, y: 0 }, kante: [0, 0, 0, 0], lot: { seitlich: 0, vorn: 0 } },
  missweisung: 0, // Grad, Ost positiv
  nordModus: 'magnetisch', // magnetisch | geografisch
  lattenLaengeMm: 2000, // Bezugslänge im Neigungsmesser
  linealFaktor: null, // CSS-Pixel pro mm, aus der Kalibrierung mit der Bankkarte
  rechner: {}, // nur Produktfaktoren: ergiebigkeit, sackAusbeute, rollenBreite, rollenLaenge
  augenhoehe: 1.6, // m, Höhenschätzung
  schallOffset: 120, // dB, Korrektur des Mikrofonpegels (bewusst eher hoch: warnt lieber zu früh)
  letzteVersion: null
};

function laden() {
  try {
    const roh = JSON.parse(localStorage.getItem(SCHLUESSEL) || '{}');
    return {
      ...structuredClone(STANDARD),
      ...roh,
      nullpunkt: { ...structuredClone(STANDARD.nullpunkt), ...(roh.nullpunkt || {}) }
    };
  } catch {
    return structuredClone(STANDARD);
  }
}

const werte = laden();
const beobachter = new Set();

export function lies(name) {
  return werte[name];
}

export function setze(name, wert) {
  werte[name] = wert;
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(werte));
  } catch {
    // Speicher voll oder gesperrt: Einstellung gilt dann nur bis zum Schließen.
  }
  beobachter.forEach((f) => f(name, wert));
}

export function nullpunkteZuruecksetzen() {
  setze('nullpunkt', structuredClone(STANDARD.nullpunkt));
}

// Benachrichtigung bei Änderungen; liefert eine Abmeldefunktion.
export function beobachte(f) {
  beobachter.add(f);
  return () => beobachter.delete(f);
}

// Nächsten Wert aus einer Liste wählen (für die Taste „Einheit").
export function weiterschalten(name, liste) {
  const i = liste.indexOf(werte[name]);
  setze(name, liste[(i + 1) % liste.length]);
  return werte[name];
}

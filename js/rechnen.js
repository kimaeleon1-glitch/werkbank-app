// Heimwerker-Rechnungen (F8), Timer- und Lineal-Hilfen (F7, F10).
// Reine Funktionen ohne Browser-Bezug, getestet mit `node --test`.
// Ungültige Eingaben liefern null statt einer falschen Zahl.

import { rad, GRAD } from './mathe.js';

const gueltig = (...zahlen) => zahlen.every((z) => Number.isFinite(z) && z > 0);

// Farbe: Liter = Fläche × Anstriche ÷ Ergiebigkeit
export function farbe({ flaeche, anstriche, ergiebigkeit }) {
  if (!gueltig(flaeche, anstriche, ergiebigkeit)) return null;
  return { liter: (flaeche * anstriche) / ergiebigkeit };
}

// Fliesen: Anzahl = Fläche × (1 + Verschnitt) ÷ Fliesenfläche (aufgerundet)
// Fliesenmaße in cm, Verschnitt in Prozent.
export function fliesen({ flaeche, laengeCm, breiteCm, verschnittProzent = 0 }) {
  if (!gueltig(flaeche, laengeCm, breiteCm) || !(verschnittProzent >= 0)) return null;
  const mitVerschnitt = flaeche * (1 + verschnittProzent / 100);
  const fliese = (laengeCm * breiteCm) / 10000;
  // kleine Rundungsreste (z. B. 12,000000001) nicht zu einer ganzen Fliese mehr machen
  return { anzahl: Math.ceil(mitVerschnitt / fliese - 1e-9), flaeche: mitVerschnitt };
}

// Tapete: Bahnen nebeneinander über die Wandlänge, Bahnen pro Rolle nach Höhe.
// Zugabe je Bahn in cm (zum Beschneiden oben und unten).
export function tapete({ hoehe, laenge, rollenBreite, rollenLaenge, zugabeCm = 0 }) {
  if (!gueltig(hoehe, laenge, rollenBreite, rollenLaenge) || !(zugabeCm >= 0)) return null;
  const bahnLaenge = hoehe + zugabeCm / 100;
  const bahnen = Math.ceil(laenge / rollenBreite - 1e-9);
  const bahnenProRolle = Math.floor(rollenLaenge / bahnLaenge + 1e-9);
  if (bahnenProRolle < 1) return { fehler: 'Die Wand ist höher als eine Rolle lang ist.' };
  return { bahnen, bahnenProRolle, rollen: Math.ceil(bahnen / bahnenProRolle) };
}

// Beton: Volumen = Länge × Breite × Dicke. Dicke in cm, Ausbeute in Litern pro Sack.
export function beton({ laenge, breite, dickeCm, ausbeuteLiter }) {
  if (!gueltig(laenge, breite, dickeCm)) return null;
  const kubik = laenge * breite * (dickeCm / 100);
  const liter = kubik * 1000;
  const saecke = gueltig(ausbeuteLiter) ? Math.ceil(liter / ausbeuteLiter - 1e-9) : null;
  return { kubik, liter, saecke };
}

// Gefälle: aus Länge (m) und einer Angabe (Höhe in cm, Prozent oder Winkel)
// die beiden anderen berechnen.
export function gefaelle({ laenge, gegeben, wert }) {
  if (!gueltig(laenge) || !Number.isFinite(wert) || wert < 0) return null;
  let prozent;
  if (gegeben === 'hoehe') prozent = (wert / 100 / laenge) * 100;
  else if (gegeben === 'prozent') prozent = wert;
  else if (gegeben === 'winkel') {
    if (wert >= 90) return null;
    prozent = Math.tan(rad(wert)) * 100;
  } else return null;
  return {
    prozent,
    hoeheCm: (prozent / 100) * laenge * 100,
    winkel: Math.atan(prozent / 100) * GRAD,
    mmProM: prozent * 10
  };
}

// ------------------------------------------------------------ Timer

// Restzeit in ms aus Endzeitpunkt; nie negativ.
export const restzeit = (ende, jetzt) => Math.max(0, ende - jetzt);

// 65000 → "1:05", 3725000 → "1:02:05". Aufgerundet auf volle Sekunden,
// damit „0:00" erst beim Ablauf erscheint.
export function uhrzeit(ms) {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sek = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sek}` : `${m}:${sek}`;
}

// ------------------------------------------------------------ Lineal

export const KARTE_MM = { breite: 85.6, hoehe: 53.98 }; // ISO/IEC 7810 ID-1

// Faktor in CSS-Pixel pro mm aus der Rahmengröße, die die Karte abdeckt.
export const linealFaktor = (rahmenPx, karteMm = KARTE_MM.breite) => rahmenPx / karteMm;

// Startwert vor der Kalibrierung: CSS definiert 96 px pro Zoll.
export const FAKTOR_STANDARD = 96 / 25.4;

// ------------------------------------------------------------ Höhenschätzung (F14)

// Zwei Peilungen, kein Abstand nötig: Fußpunkt (Winkel nach unten, positiv)
// und Oberkante (Winkel nach oben, negativ wenn unter Augenhöhe).
// Abstand d = e ÷ tan(β), Höhe H = e + d × tan(α). Liefert null bei
// unbrauchbaren Peilungen (Fußpunkt fast waagerecht oder über Augenhöhe).
export function hoehe(augenhoehe, untenGrad, obenGrad) {
  if (!(augenhoehe > 0) || !(untenGrad >= 1 && untenGrad < 89) || !(obenGrad > -89 && obenGrad < 89)) return null;
  const abstand = augenhoehe / Math.tan(rad(untenGrad));
  return { abstand, hoehe: augenhoehe + abstand * Math.tan(rad(obenGrad)) };
}

// ------------------------------------------------------------ Schallpegel (F12)

// Effektivwert eines Abschnitts in dBFS (0 = Vollaussteuerung).
export function rmsDbfs(werte) {
  let summe = 0;
  for (const v of werte) summe += v * v;
  const rms = Math.sqrt(summe / (werte.length || 1));
  return 20 * Math.log10(Math.max(rms, 1e-8));
}

// Zeitbewertung „Fast" (125 ms) auf der Leistung: glättet ohne zu verschleppen.
export function zeitbewertung(zeitkonstanteMs = 125) {
  let leistung = null;
  return (dbfs, dtMs) => {
    const p = 10 ** (dbfs / 10);
    const a = 1 - Math.exp(-dtMs / zeitkonstanteMs);
    leistung = leistung === null ? p : leistung + a * (p - leistung);
    return 10 * Math.log10(Math.max(leistung, 1e-16));
  };
}

// Hinweisstufe nach Anforderung F12: ab 80 dB Hinweis, ab 85 dB Warnung.
export const laermStufe = (db) => (db >= 85 ? 'warnung' : db >= 80 ? 'hinweis' : 'ok');

// ------------------------------------------------------------ Vibration (F13)

// Effektivwert der Beschleunigung (ohne Schwerkraft) über ein Zeitfenster.
export function vibrationsMesser(fensterMs = 1000) {
  const werte = []; // { t, q } mit q = Betrag²
  return (v, t) => {
    werte.push({ t, q: v.x * v.x + v.y * v.y + v.z * v.z });
    while (werte.length && werte[0].t < t - fensterMs) werte.shift();
    return Math.sqrt(werte.reduce((s, w) => s + w.q, 0) / werte.length);
  };
}

// Prozentuale Änderung gegenüber einem Vergleichswert („vorher/nachher").
export const aenderungProzent = (vorher, jetzt) => (vorher > 0 ? ((jetzt - vorher) / vorher) * 100 : null);

// ------------------------------------------------------------ Einheiten umrechnen

// Je Größe: Einheiten als [Kürzel, Name, Faktor zur Grundeinheit].
// Temperatur hat Versatz und wird gesondert gerechnet.
export const GROESSEN = {
  laenge: { titel: 'Länge', einheiten: [
    ['mm', 'Millimeter', 0.001], ['cm', 'Zentimeter', 0.01], ['m', 'Meter', 1], ['km', 'Kilometer', 1000],
    ['in', 'Zoll', 0.0254], ['ft', 'Fuß', 0.3048], ['yd', 'Yard', 0.9144], ['mi', 'Meile', 1609.344]] },
  flaeche: { titel: 'Fläche', einheiten: [
    ['cm²', 'Quadratzentimeter', 1e-4], ['m²', 'Quadratmeter', 1], ['a', 'Ar', 100], ['ha', 'Hektar', 1e4],
    ['km²', 'Quadratkilometer', 1e6], ['in²', 'Quadratzoll', 0.00064516], ['ft²', 'Quadratfuß', 0.09290304]] },
  volumen: { titel: 'Volumen', einheiten: [
    ['ml', 'Milliliter', 0.001], ['l', 'Liter', 1], ['m³', 'Kubikmeter', 1000], ['cm³', 'Kubikzentimeter', 0.001],
    ['gal (US)', 'US-Gallone', 3.785411784], ['gal (UK)', 'Brit. Gallone', 4.54609], ['ft³', 'Kubikfuß', 28.316846592]] },
  gewicht: { titel: 'Gewicht', einheiten: [
    ['g', 'Gramm', 0.001], ['kg', 'Kilogramm', 1], ['t', 'Tonne', 1000],
    ['lb', 'Pfund (engl.)', 0.45359237], ['oz', 'Unze', 0.028349523125]] },
  druck: { titel: 'Druck', einheiten: [
    ['Pa', 'Pascal', 1], ['hPa', 'Hektopascal = mbar', 100], ['kPa', 'Kilopascal', 1000], ['bar', 'Bar', 1e5],
    ['MPa', 'Megapascal = N/mm²', 1e6], ['psi', 'Pfund/Quadratzoll', 6894.757293168], ['atm', 'Atmosphäre', 101325],
    ['mmHg', 'Millimeter Quecksilber', 133.322387415], ['mWS', 'Meter Wassersäule', 9806.65]] },
  temperatur: { titel: 'Temperatur', einheiten: [['°C', 'Celsius'], ['°F', 'Fahrenheit'], ['K', 'Kelvin']] },
  kraft: { titel: 'Kraft', einheiten: [
    ['N', 'Newton', 1], ['kN', 'Kilonewton', 1000], ['kp', 'Kilopond', 9.80665], ['lbf', 'Pfund-Kraft', 4.4482216152605]] },
  drehmoment: { titel: 'Drehmoment', einheiten: [
    ['Nm', 'Newtonmeter', 1], ['kpm', 'Kilopondmeter', 9.80665],
    ['lbf·ft', 'Pound-foot', 1.3558179483314], ['lbf·in', 'Pound-inch', 0.1129848290276]] },
  leistung: { titel: 'Leistung', einheiten: [
    ['W', 'Watt', 1], ['kW', 'Kilowatt', 1000], ['PS', 'Pferdestärke', 735.49875], ['hp', 'Horsepower', 745.69987158227]] },
  energie: { titel: 'Energie', einheiten: [
    ['J', 'Joule', 1], ['kJ', 'Kilojoule', 1000], ['Wh', 'Wattstunde', 3600], ['kWh', 'Kilowattstunde', 3.6e6],
    ['kcal', 'Kilokalorie', 4186.8]] },
  tempo: { titel: 'Tempo', einheiten: [
    ['m/s', 'Meter pro Sekunde', 1], ['km/h', 'Kilometer pro Stunde', 1 / 3.6],
    ['mph', 'Meilen pro Stunde', 0.44704], ['kn', 'Knoten', 1852 / 3600]] },
  winkel: { titel: 'Winkel', einheiten: [
    ['°', 'Grad', 1], ['rad', 'Radiant', 180 / Math.PI], ['gon', 'Gon', 0.9], ['′', 'Bogenminute', 1 / 60]] }
};

const ZU_KELVIN = { '°C': (w) => w + 273.15, '°F': (w) => (w - 32) * 5 / 9 + 273.15, K: (w) => w };
const VON_KELVIN = { '°C': (k) => k - 273.15, '°F': (k) => (k - 273.15) * 9 / 5 + 32, K: (k) => k };

// Rechnet wert (in Einheit `von`) in alle Einheiten der Größe um.
// Liefert [{ kuerzel, name, wert }] oder null bei ungültiger Eingabe.
export function umrechnen(groesse, wert, von) {
  const g = GROESSEN[groesse];
  if (!g || !Number.isFinite(wert)) return null;
  if (groesse === 'temperatur') {
    const k = ZU_KELVIN[von](wert);
    if (k < 0) return null; // unter dem absoluten Nullpunkt
    return g.einheiten.map(([kuerzel, name]) => ({ kuerzel, name, wert: VON_KELVIN[kuerzel](k) }));
  }
  const eintrag = g.einheiten.find(([k]) => k === von);
  if (!eintrag) return null;
  const grund = wert * eintrag[2];
  return g.einheiten.map(([kuerzel, name, faktor]) => ({ kuerzel, name, wert: grund / faktor }));
}

// Zahl mit bis zu 6 gültigen Stellen (ab 100.000 ganzzahlig) im deutschen Format; sehr große und
// sehr kleine Werte als Zehnerpotenz.
export function kurzZahl(w) {
  if (w === 0 || Object.is(w, -0)) return '0';
  const b = Math.abs(w);
  if (b >= 1e12 || b < 1e-6) {
    const [m, e] = w.toExponential(4).split('e');
    return `${Number(m).toLocaleString('de-DE', { maximumFractionDigits: 4 })} · 10^${Number(e)}`;
  }
  const n = b >= 1e5 ? Math.round(w) : Number(w.toPrecision(6));
  return (Object.is(n, -0) ? 0 : n).toLocaleString('de-DE', { maximumFractionDigits: 10 });
}

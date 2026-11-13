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

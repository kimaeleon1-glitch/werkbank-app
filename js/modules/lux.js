// F15 Lux-Messer: Beleuchtungsstärke am Arbeitsplatz als Richtwert.
// Chrome gibt den Sensor derzeit nicht frei; dann erscheint ein Hinweis.

import { starteLicht, lichtVerfuegbar } from '../sensors.js';
import { el, messansicht, fehler, nichtVerfuegbar } from '../ansicht.js';

// Orientierung, keine Vorschrift (siehe Anforderung F15).
const RICHTWERTE = [
  ['Keller, Flur, Lager', 'etwa 50–100 lx'],
  ['Wohnraum', 'etwa 100–300 lx'],
  ['Grobe Arbeit an der Werkbank', 'etwa 300 lx'],
  ['Feine Arbeit, Lesen von Plänen', 'etwa 500–750 lx'],
  ['Sehr feine Arbeit, Elektronik', 'ab etwa 1.000 lx']
];

const einordnung = (lx) =>
  lx < 100 ? 'Dämmrig' : lx < 300 ? 'Wohnlich hell' : lx < 500 ? 'Hell genug für grobe Arbeit'
    : lx < 1000 ? 'Hell genug für feine Arbeit' : 'Sehr hell';

export default {
  start(bereich) {
    let stopp = null;
    let aus = false;
    lichtVerfuegbar().then((ok) => {
      if (aus) return;
      if (ok) stopp = messen(bereich);
      else nichtVerfuegbar(bereich, 'Der Lux-Messer');
    });
    return () => { aus = true; stopp?.(); };
  }
};

function messen(bereich) {
  const a = messansicht(bereich);
  const fuellung = el('div', { class: 'balken-fuellung' });
  a.grafik.append(el('div', { class: 'balken' }, fuellung));
  a.ansicht.insertBefore(el('div', { class: 'tabelle-rahmen' },
    el('table', { class: 'tabelle' },
      el('caption', {}, 'Richtwerte'),
      el('tbody', {}, RICHTWERTE.map(([wo, wert]) => el('tr', {}, el('td', {}, wo), el('td', {}, wert)))))), a.leiste);
  a.ansicht.insertBefore(el('p', { class: 'hinweis' },
    'Display zur Lichtquelle halten, der Sensor sitzt oben neben der Kamera. Richtwert, kein Messgerät; Chrome liefert Schritte von 50 lx.'), a.leiste);

  function aufWert(lx) {
    a.setzeWert(Math.round(lx).toLocaleString('de-DE'), 'lx');
    a.setzeStatus(einordnung(lx));
    // logarithmisch: 10 lx … 10.000 lx
    const anteil = Math.max(0, Math.min(1, (Math.log10(Math.max(lx, 1)) - 1) / 3));
    fuellung.style.width = `${(anteil * 100).toFixed(1)}%`;
  }

  return starteLicht(aufWert, (text) => fehler(bereich, text));
}

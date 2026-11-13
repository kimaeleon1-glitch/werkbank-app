// F5 Winkel übertragen: Winkel an Fläche A abnehmen, an Fläche B wiederfinden.
// Der Zielwinkel gilt nur bis zum Schließen des Moduls.

import { starteSchwerkraft } from '../sensors.js';
import { treffer } from '../feedback.js';
import { bestimmeLage, laengsneigung, neigungKante, toleranz, zahl } from '../mathe.js';
import { messansicht, haltenKnopf, knopf, fehler, meldung } from '../ansicht.js';

const TOLERANZ = 0.3; // Grad, laut Anforderung F5

const SVG = `<svg viewBox="-50 -50 100 100">
  <path d="M-48 0H48" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.6"/>
  <g class="ziel" visibility="hidden"><path d="M-46 0H46" stroke="currentColor" stroke-width="3" stroke-dasharray="8 5"/></g>
  <g class="ist"><rect x="-44" y="-4" width="88" height="8" rx="3" fill="var(--akzent)" stroke="currentColor" stroke-width="1.5"/></g>
  <circle r="2.5" fill="currentColor"/>
</svg>`;

export default {
  start(bereich) {
    const a = messansicht(bereich);
    const gehalten = haltenKnopf(a);
    a.grafik.innerHTML = SVG;
    const ist = a.grafik.querySelector('.ist');
    const ziel = a.grafik.querySelector('.ziel');
    const tol = toleranz(TOLERANZ, TOLERANZ + 0.1);
    let lage = null;
    let winkel = null;
    let zielWinkel = null;

    // Im Bild: positiv = gegen den Uhrzeigersinn (Oberkante des Handys höher).
    const kipp = (w) => `rotate(${(-Math.max(-60, Math.min(60, w))).toFixed(1)})`;

    function aufWert(g) {
      if (gehalten()) return;
      lage = bestimmeLage(g, lage);
      winkel = laengsneigung(g);
      a.drehe(lage === 'flach' ? 0 : neigungKante(g).q);
      ist.setAttribute('transform', kipp(winkel));

      if (zielWinkel === null) {
        a.setzeWert(zahl(Math.abs(winkel)), '°');
        a.setzeTreffer(false);
        a.setzeStatus('Handy an Fläche A legen');
        a.setzeZusatz('dann „Winkel speichern“');
        return;
      }
      const differenz = winkel - zielWinkel;
      a.setzeWert(zahl(Math.abs(differenz)), '°');
      const { drin, eingetreten } = tol(differenz);
      if (eingetreten) treffer();
      a.setzeTreffer(drin);
      // Richtung bewusst nicht als Wort: je nach Lage wäre „steiler“ mal so, mal so herum.
      a.setzeStatus(drin ? '✓ Passt' : 'Passt noch nicht');
      a.setzeZusatz(`Ziel ${zahl(zielWinkel)}° · Ist ${zahl(winkel)}°`);
    }

    const speichern = knopf('Winkel speichern', () => {
      if (zielWinkel !== null) {
        zielWinkel = null;
        speichern.textContent = 'Winkel speichern';
        ziel.setAttribute('visibility', 'hidden');
        return;
      }
      if (winkel === null) return;
      zielWinkel = winkel;
      speichern.textContent = 'Neuer Winkel';
      ziel.setAttribute('transform', kipp(zielWinkel));
      ziel.setAttribute('visibility', 'visible');
      meldung(`Ziel gespeichert: ${zahl(zielWinkel)}°. Jetzt an Fläche B legen.`, 3000);
    }, 'haupt');
    a.leiste.append(speichern);

    return starteSchwerkraft(aufWert, (text) => fehler(bereich, text));
  }
};

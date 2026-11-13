// F6 Kamera-Wasserwaage: Kamerabild mit Horizont- und Lotlinie, die die
// Neigung des Handys ausgleichen. Das Bild wird nur angezeigt, nie gespeichert.

import { starteSchwerkraft, starteKamera } from '../sensors.js';
import { treffer } from '../feedback.js';
import { lotAbweichung, toleranz, zahl } from '../mathe.js';
import { el, fehler } from '../ansicht.js';

const SVG = `<svg viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid slice">
  <g class="linien">
    <path class="horizont" d="M-200 0H200" stroke-width="0.8"/>
    <path class="lot" d="M0-200V200" stroke-width="0.8"/>
  </g>
  <circle r="2" fill="none" stroke="#fff" stroke-width="0.6"/>
</svg>`;

export default {
  start(bereich) {
    const video = el('video', { class: 'kamera-bild', autoplay: true, muted: true, playsinline: true });
    const ueberlagerung = el('div', { class: 'kamera-linien', html: SVG });
    const anzeige = el('div', { class: 'kamera-wert', 'aria-live': 'polite' }, 'Kamera startet …');
    const flaeche = el('div', { class: 'kamera' }, video, ueberlagerung, anzeige);
    bereich.replaceChildren(flaeche);

    const linien = ueberlagerung.querySelector('.linien');
    const tol = toleranz(0.2, 0.3);
    let stoppKamera = () => {};
    let stoppSensor = () => {};
    let aus = false;

    function aufWert(g) {
      const betrag = Math.hypot(g.x, g.y, g.z) || 1;
      if (g.y / betrag < 0.5) {
        anzeige.textContent = 'Handy aufrecht halten';
        flaeche.classList.remove('treffer');
        return;
      }
      const { seitlich } = lotAbweichung(g);
      // Das echte Lot und der echte Horizont erscheinen entgegen der Kippung gedreht.
      linien.setAttribute('transform', `rotate(${(-seitlich).toFixed(2)})`);
      const { drin, eingetreten } = tol(seitlich);
      if (eingetreten) treffer();
      flaeche.classList.toggle('treffer', drin);
      anzeige.textContent = drin ? '✓ Waagerecht' : `${zahl(Math.abs(seitlich))}° ${seitlich > 0 ? '↺' : '↻'}`;
    }

    starteKamera().then(
      ({ strom, stopp }) => {
        if (aus) { stopp(); return; }
        stoppKamera = stopp;
        video.srcObject = strom;
        stoppSensor = starteSchwerkraft(aufWert, (text) => { anzeige.textContent = text; });
      },
      (text) => { if (!aus) fehler(bereich, text); }
    );

    return () => {
      aus = true;
      stoppSensor();
      stoppKamera();
      video.srcObject = null;
    };
  }
};

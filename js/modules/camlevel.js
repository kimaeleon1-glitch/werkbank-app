// F6 Kamera-Wasserwaage: Kamerabild mit Horizont- und Lotlinie, die die
// Neigung des Handys ausgleichen. Funktioniert hochkant, quer und auf dem
// Kopf; die Anzeige dreht sich mit. Das Bild wird nur angezeigt, nie gespeichert.

import { starteSchwerkraft, starteKamera } from '../sensors.js';
import { treffer } from '../feedback.js';
import { kameraLage, toleranz, zahl } from '../mathe.js';
import { el, fehler, bildschirmWinkel } from '../ansicht.js';

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
    // Quadrat in der Mitte, das sich mit der Haltung dreht; die Anzeige sitzt
    // an seiner Unterkante – also immer dort, wo für den Betrachter „unten" ist.
    const dreher = el('div', { class: 'kamera-dreher' }, anzeige);
    const flaeche = el('div', { class: 'kamera' }, video, ueberlagerung, dreher);
    bereich.replaceChildren(flaeche);

    const linien = ueberlagerung.querySelector('.linien');
    const tol = toleranz(0.2, 0.3);
    let viertel = -1;
    let stoppKamera = () => {};
    let stoppSensor = () => {};
    let aus = false;

    function aufWert(g) {
      const l = kameraLage(g);
      if (!l.aufrecht) {
        anzeige.textContent = 'Handy aufrecht oder quer halten';
        flaeche.classList.remove('treffer');
        return;
      }
      const schirm = bildschirmWinkel();
      // Linien: Horizont und Lot stehen im Bild entgegen der Drehung des Handys.
      // Das Kreuz ist um 90° symmetrisch, daher passt es in jeder Haltung.
      linien.setAttribute('transform', `rotate(${(l.drehung - schirm).toFixed(2)})`);
      if (l.viertel !== viertel) {
        viertel = l.viertel;
        dreher.style.transform = `rotate(${viertel * 90 - schirm}deg)`;
      }
      const { drin, eingetreten } = tol(l.abweichung);
      if (eingetreten) treffer();
      flaeche.classList.toggle('treffer', drin);
      // Abweichung < 0: Handy im Uhrzeigersinn verdreht → gegen den Uhrzeigersinn korrigieren.
      anzeige.textContent = drin ? '✓ Waagerecht' : `${zahl(Math.abs(l.abweichung))}° ${l.abweichung < 0 ? '↺' : '↻'}`;
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

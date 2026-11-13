// F14 Höhenschätzung mit zwei Peilungen durch die Kamera: erst den Fußpunkt,
// dann die Oberkante. Kein Abstand nötig, aber ebener Boden.

import { starteSchwerkraft, starteKamera } from '../sensors.js';
import { lies, setze } from '../einstellungen.js';
import { GRAD, zahl } from '../mathe.js';
import { hoehe } from '../rechnen.js';
import { el, knopf, fehler, meldung, zahlAbfragen } from '../ansicht.js';

// Neigung der Blickrichtung der Kamera gegen die Waagerechte (+ = nach oben).
const blickwinkel = (g) => Math.atan2(-g.z, Math.hypot(g.x, g.y)) * GRAD;

export default {
  start(bereich) {
    const video = el('video', { class: 'kamera-bild', autoplay: true, muted: true, playsinline: true });
    const kreuz = el('div', { class: 'kamera-linien', html: `<svg viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid slice">
      <path d="M-200 0H-6M6 0H200M0-200V-6M0 6V200" stroke-width="0.6"/><circle r="4" fill="none" stroke="#fff" stroke-width="0.6"/></svg>` });
    const winkelText = el('div', { class: 'kamera-wert' }, '–');
    const schritt = el('p', { class: 'hoehe-schritt', 'aria-live': 'polite' });
    const ergebnis = el('p', { class: 'hoehe-ergebnis', hidden: true });
    const leiste = el('div', { class: 'leiste' });
    const flaeche = el('div', { class: 'kamera' }, video, kreuz, winkelText);
    bereich.replaceChildren(el('div', { class: 'mess' }, schritt, flaeche, ergebnis, leiste));

    let winkel = null;
    let unten = null;
    let stoppKamera = () => {};
    let aus = false;

    function zeigeSchritt() {
      const e = zahl(lies('augenhoehe'), 2);
      leiste.replaceChildren();
      ergebnis.hidden = true;
      flaeche.hidden = false;
      if (unten === null) {
        schritt.textContent = `1. Fadenkreuz auf den Fußpunkt richten (Augenhöhe ${e} m)`;
        leiste.append(knopf(`Augenhöhe`, augenhoeheAendern), knopf('Fußpunkt merken', merkeUnten, 'haupt'));
      } else {
        schritt.textContent = `2. Fadenkreuz auf die Oberkante richten`;
        leiste.append(knopf('Zurück', () => { unten = null; zeigeSchritt(); }), knopf('Oberkante merken', merkeOben, 'haupt'));
      }
    }

    function merkeUnten() {
      if (winkel === null) return;
      if (-winkel < 1) { meldung('Der Fußpunkt muss unterhalb der Augenhöhe liegen: Handy nach unten neigen.'); return; }
      unten = -winkel;
      zeigeSchritt();
    }

    function merkeOben() {
      if (winkel === null) return;
      const e = hoehe(lies('augenhoehe'), unten, winkel);
      if (!e) { meldung('Diese Peilung lässt sich nicht auswerten. Bitte neu anfangen.'); return; }
      flaeche.hidden = true;
      schritt.textContent = 'Geschätzte Höhe';
      ergebnis.hidden = false;
      ergebnis.replaceChildren(
        el('span', { class: 'wert' }, zahl(e.hoehe, 2), el('span', { class: 'wert-einheit' }, 'm')),
        el('span', { class: 'zusatz' }, `Abstand etwa ${zahl(e.abstand, 1)} m · Fußpunkt ${zahl(unten)}° · Oberkante ${zahl(winkel)}°`),
        el('span', { class: 'hinweis' }, 'Schätzung. Stimmt nur bei ebenem Boden zwischen dir und dem Fußpunkt.'));
      leiste.replaceChildren(knopf('Neu messen', () => { unten = null; zeigeSchritt(); }, 'haupt'));
    }

    async function augenhoeheAendern() {
      const neu = await zahlAbfragen('Augenhöhe', 'Höhe deiner Augen über dem Boden.', lies('augenhoehe'), 'm');
      if (neu === null) return;
      if (neu < 0.5 || neu > 2.5) { meldung('Bitte einen Wert zwischen 0,5 und 2,5 m eingeben.'); return; }
      setze('augenhoehe', neu);
      zeigeSchritt();
    }

    zeigeSchritt();
    const stoppSensor = starteSchwerkraft((g) => {
      winkel = blickwinkel(g);
      winkelText.textContent = `${winkel >= 0 ? '↑' : '↓'} ${zahl(Math.abs(winkel))}°`;
    }, (text) => fehler(bereich, text));

    starteKamera().then(
      ({ strom, stopp }) => {
        if (aus) { stopp(); return; }
        stoppKamera = stopp;
        video.srcObject = strom;
      },
      () => {
        // Ohne Kamera geht es auch: über die Rückseite des Handys peilen.
        if (!aus) flaeche.prepend(el('p', { class: 'kamera-ersatz' }, 'Ohne Kamerabild: die Rückseite des Handys genau auf das Ziel richten.'));
      }
    );

    return () => {
      aus = true;
      stoppSensor();
      stoppKamera();
      video.srcObject = null;
    };
  }
};

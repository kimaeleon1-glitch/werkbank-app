// F9 Taschenlampe: Blitz an/aus mit einer großen Taste. Geht aus, sobald
// das Werkzeug verlassen wird oder die App in den Hintergrund geht.

import { starteLampe } from '../sensors.js';
import { el, fehler } from '../ansicht.js';

export default {
  start(bereich) {
    let ausschalten = null;
    let beschaeftigt = false;
    const status = el('p', { class: 'status', 'aria-live': 'polite' }, 'Aus');
    const taste = el('button', { type: 'button', class: 'lampe-taste', 'aria-pressed': 'false' }, 'Licht an');

    function zeige(an) {
      taste.textContent = an ? 'Licht aus' : 'Licht an';
      taste.setAttribute('aria-pressed', String(an));
      status.textContent = an ? '💡 An' : 'Aus';
    }

    function aus() {
      if (ausschalten) ausschalten();
      ausschalten = null;
      zeige(false);
    }

    taste.addEventListener('click', async () => {
      if (beschaeftigt) return;
      if (ausschalten) { aus(); return; }
      beschaeftigt = true;
      taste.textContent = '…';
      try {
        ausschalten = await starteLampe();
        zeige(true);
      } catch (text) {
        fehler(bereich, String(text));
      } finally {
        beschaeftigt = false;
      }
    });

    const beiSichtbarkeit = () => { if (document.visibilityState === 'hidden') aus(); };
    document.addEventListener('visibilitychange', beiSichtbarkeit);

    bereich.replaceChildren(el('div', { class: 'mess lampe' },
      el('div', { class: 'anzeige' }, el('div', { class: 'lampe-mitte' }, taste, status)),
      el('p', { class: 'hinweis' }, 'Die Lampe geht aus, wenn du das Werkzeug verlässt oder die App in den Hintergrund legst.')));

    return () => {
      document.removeEventListener('visibilitychange', beiSichtbarkeit);
      aus();
    };
  }
};

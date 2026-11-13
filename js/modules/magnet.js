// F11 Magnetfeld-Detektor: Stahl hinter der Wand grob orten.
// Braucht das Chrome-Flag „Generic Sensor Extra Classes". Kein Leitungssucher.

import { starteMagnetfeld, magnetfeldVerfuegbar } from '../sensors.js';
import { setze } from '../einstellungen.js';
import { zahl } from '../mathe.js';
import { el, messansicht, knopf, fehler, flagAnleitung, verlauf } from '../ansicht.js';

export default {
  start(bereich) {
    if (!magnetfeldVerfuegbar()) {
      setze('flagAnleitungGelesen', true);
      flagAnleitung(bereich, 'Der Magnetfeld-Detektor');
      return;
    }
    const a = messansicht(bereich);
    const graf = verlauf({ sekunden: 10, minMax: 20, einheit: 'µT' });
    a.grafik.append(graf.element);
    a.ansicht.insertBefore(el('p', { class: 'hinweis warnung' },
      'Findet Stahl und Magnete, aber keine Strom- oder Wasserleitungen. Vor dem Bohren ein Leitungssuchgerät nutzen.'), a.leiste);

    let feld = null;
    let bezug = null; // Umgebungsfeld als Vektor, abgezogen nach „Nullen"
    let spitze = 0;

    function aufWert(v) {
      feld = v;
      const d = bezug ? { x: v.x - bezug.x, y: v.y - bezug.y, z: v.z - bezug.z } : v;
      const staerke = Math.hypot(d.x, d.y, d.z);
      spitze = Math.max(spitze, staerke);
      graf.neu(staerke);
      a.setzeWert(zahl(staerke, 1), 'µT');
      a.setzeStatus(bezug ? 'Änderung gegenüber Nullpunkt' : 'Gesamtes Magnetfeld');
      a.setzeZusatz(`Höchster Wert: ${zahl(spitze, 1)} µT`);
    }

    const nullKnopf = knopf('Nullen', () => {
      if (bezug) { bezug = null; nullKnopf.textContent = 'Nullen'; }
      else if (feld) { bezug = { ...feld }; nullKnopf.textContent = 'Null aus'; }
      spitze = 0;
    });
    a.leiste.append(nullKnopf, knopf('Höchstwert 0', () => { spitze = 0; }));
    a.setzeStatus('Handy langsam an der Wand entlangführen');

    return starteMagnetfeld(aufWert, (text) => fehler(bereich, text));
  }
};

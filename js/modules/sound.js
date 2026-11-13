// F12 Schallpegelmesser: grober Richtwert für Maschinenlärm.
// Es wird nichts aufgenommen oder gespeichert, nur der laufende Pegel berechnet.

import { starteSchallpegel } from '../sensors.js';
import { lies, setze } from '../einstellungen.js';
import { zeitbewertung, laermStufe } from '../rechnen.js';
import { el, messansicht, knopf, fehler, zahlAbfragen, meldung } from '../ansicht.js';

const HINWEIS = { ok: '', hinweis: '⚠ Laut – Gehörschutz empfohlen', warnung: '⛔ Gehörschutz tragen!' };

export default {
  start(bereich) {
    const a = messansicht(bereich);
    const fuellung = el('div', { class: 'balken-fuellung' });
    a.grafik.append(el('div', { class: 'balken' }, fuellung,
      el('div', { class: 'balken-marke links', style: `right: ${100 - (80 / 120) * 100}%` }, '80'),
      el('div', { class: 'balken-marke', style: `left: ${(85 / 120) * 100}%` }, '85')));
    a.ansicht.insertBefore(el('p', { class: 'hinweis' },
      'Richtwert: Handy-Mikrofone sind nicht geeicht. Mit „Korrektur“ an ein echtes Messgerät angleichen.'), a.leiste);
    a.setzeStatus('Mikrofon startet …');

    const fast = zeitbewertung(125);
    let hoechst = -Infinity;
    let letzteAnzeige = 0;

    function aufPegel(dbfs, dtMs) {
      const db = fast(dbfs, dtMs) + lies('schallOffset');
      hoechst = Math.max(hoechst, db);
      const jetzt = performance.now();
      if (jetzt - letzteAnzeige < 150) return; // Zahl ruhig halten
      letzteAnzeige = jetzt;
      const stufe = laermStufe(db);
      a.setzeWert(String(Math.max(0, Math.round(db))), 'dB');
      a.setzeStatus(HINWEIS[stufe] || 'Richtwert');
      a.ansicht.classList.toggle('laut', stufe === 'hinweis');
      a.ansicht.classList.toggle('sehr-laut', stufe === 'warnung');
      a.setzeZusatz(`Höchstwert: ${Math.round(hoechst)} dB`);
      // Balken 0 … 120 dB
      fuellung.style.width = `${Math.max(0, Math.min(100, (db / 120) * 100)).toFixed(1)}%`;
    }

    a.leiste.append(
      knopf('Höchstwert 0', () => { hoechst = -Infinity; }),
      knopf('Korrektur', async () => {
        const neu = await zahlAbfragen('Korrektur',
          'Wert, der zum Mikrofonpegel addiert wird. Mit einem echten Messgerät vergleichen und so einstellen, dass beide gleich anzeigen.',
          lies('schallOffset'), 'dB');
        if (neu === null) return;
        if (neu < 40 || neu > 160) { meldung('Bitte einen Wert zwischen 40 und 160 eingeben.'); return; }
        setze('schallOffset', neu);
      }));

    let stopp = null;
    let aus = false;
    starteSchallpegel(aufPegel).then(
      (s) => { if (aus) s(); else stopp = s; },
      (text) => { if (!aus) fehler(bereich, String(text)); }
    );
    return () => { aus = true; stopp?.(); };
  }
};

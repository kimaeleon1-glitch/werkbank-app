// F13 Vibrationsmesser: Unwucht erkennen, z. B. an Waschmaschine oder
// Standbohrmaschine. Vergleichswert „vorher/nachher" hilft beim Ausrichten.

import { starteBewegung } from '../sensors.js';
import { zahl } from '../mathe.js';
import { vibrationsMesser, aenderungProzent } from '../rechnen.js';
import { messansicht, knopf, fehler, verlauf } from '../ansicht.js';

export default {
  start(bereich) {
    const a = messansicht(bereich);
    const graf = verlauf({ sekunden: 10, minMax: 0.5, einheit: 'm/s²' });
    a.grafik.append(graf.element);
    const messer = vibrationsMesser(1000);
    let aktuell = 0;
    let vorher = null;
    let letzteAnzeige = 0;

    function aufWert(v, t) {
      aktuell = messer(v, t);
      if (t - letzteAnzeige < 100) return;
      letzteAnzeige = t;
      graf.neu(aktuell, t);
      a.setzeWert(zahl(aktuell, 2), 'm/s²');
      if (vorher === null) {
        a.setzeStatus(aktuell < 0.05 ? 'Ruhig' : aktuell < 0.5 ? 'Leichte Vibration' : aktuell < 2 ? 'Deutliche Vibration' : 'Starke Vibration');
        a.setzeZusatz('Handy flach auf das Gerät legen');
      } else {
        const p = aenderungProzent(vorher, aktuell);
        a.setzeStatus(p === null ? '' : p <= -10 ? `✓ ${zahl(-p, 0)} % ruhiger` : p >= 10 ? `${zahl(p, 0)} % stärker` : 'Etwa gleich');
        a.setzeZusatz(`Vorher ${zahl(vorher, 2)} m/s²`);
      }
    }

    const vergleich = knopf('Vorher merken', () => {
      if (vorher === null) {
        vorher = aktuell;
        graf.vergleich(vorher);
        vergleich.textContent = 'Vergleich weg';
      } else {
        vorher = null;
        graf.vergleich(null);
        vergleich.textContent = 'Vorher merken';
      }
    });
    a.leiste.append(vergleich);

    return starteBewegung(aufWert, (text) => fehler(bereich, text));
  }
};

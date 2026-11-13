// F2 Lot: Handy hochkant an eine Kante halten. Zeigt die Abweichung der
// Längsachse von der Senkrechten als Lotschnur und als Winkel.

import { starteSchwerkraft } from '../sensors.js';
import { treffer } from '../feedback.js';
import { lies, setze, weiterschalten } from '../einstellungen.js';
import { lotAbweichung, toleranz, winkelText, zahl, WINKEL_EINHEITEN, WINKEL_NAMEN } from '../mathe.js';
import { messansicht, haltenKnopf, knopf, fehler, frage, meldung } from '../ansicht.js';

const SVG_LOT = `<svg viewBox="-50 -50 100 100">
  <path d="M0-46V46" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.7"/>
  <g class="schnur">
    <path d="M0-46V30" stroke="var(--akzent)" stroke-width="3"/>
    <path d="M-7 30h14L0 46z" fill="var(--akzent)" stroke="currentColor" stroke-width="1.5"/>
  </g>
  <circle cy="-46" r="3" fill="currentColor"/>
</svg>`;

export default {
  start(bereich) {
    const a = messansicht(bereich);
    const gehalten = haltenKnopf(a);
    a.grafik.innerHTML = SVG_LOT;
    const schnur = a.grafik.querySelector('.schnur');
    const tol = toleranz(0.2, 0.3);
    let roh = null;

    function aufWert(g) {
      if (gehalten()) return;
      const betrag = Math.hypot(g.x, g.y, g.z) || 1;
      if (g.y / betrag < 0.5) {
        roh = null;
        a.setzeWert('–', '');
        a.setzeTreffer(false);
        a.setzeStatus('Handy hochkant halten');
        a.setzeZusatz('Oberkante nach oben, Seite an die Kante');
        schnur.setAttribute('transform', '');
        return;
      }
      const l = lotAbweichung(g);
      roh = l;
      const np = lies('nullpunkt').lot;
      const seitlich = l.seitlich - np.seitlich;
      const vorn = l.vorn - np.vorn;
      const gesamt = Math.hypot(seitlich, vorn);

      // Das echte Lot erscheint im Bild entgegen der Kippung gedreht.
      const bild = Math.max(-40, Math.min(40, -seitlich * 4));
      schnur.setAttribute('transform', `rotate(${bild.toFixed(1)} 0 -46)`);

      const t = winkelText(gesamt, lies('winkelEinheit'));
      a.setzeWert(t.wert, t.einheit);
      const { drin, eingetreten } = tol(gesamt);
      if (eingetreten) treffer();
      a.setzeTreffer(drin);

      if (drin) {
        a.setzeStatus('✓ Senkrecht');
      } else if (Math.abs(seitlich) >= Math.abs(vorn)) {
        a.setzeStatus(seitlich > 0 ? 'Oben kippt nach rechts' : 'Oben kippt nach links');
      } else {
        a.setzeStatus(vorn > 0 ? 'Oben kippt nach vorn' : 'Oben kippt nach hinten');
      }
      a.setzeZusatz(`↔ ${zahl(Math.abs(seitlich))}°   ⇅ ${zahl(Math.abs(vorn))}°`);
    }

    async function nullen() {
      if (!roh) return;
      const messung = roh;
      const ok = await frage(
        'Nullpunkt setzen (Lot)',
        'Das Handy muss jetzt an einer Kante anliegen, die sicher senkrecht ist. Die aktuelle Anzeige wird zu 0.',
        'Nullen'
      );
      if (!ok) return;
      const np = structuredClone(lies('nullpunkt'));
      np.lot = { seitlich: messung.seitlich, vorn: messung.vorn };
      setze('nullpunkt', np);
      meldung('Nullpunkt gespeichert. Gegenprobe: Handy umdrehen und an dieselbe Kante halten.', 8000);
    }

    a.leiste.append(
      knopf('Nullen', nullen),
      knopf('Einheit', () => {
        const e = weiterschalten('winkelEinheit', WINKEL_EINHEITEN);
        meldung(`Einheit: ${WINKEL_NAMEN[e]}`, 1500);
      })
    );

    return starteSchwerkraft(aufWert, (text) => fehler(bereich, text));
  }
};

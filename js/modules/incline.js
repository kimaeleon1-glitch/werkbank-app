// F4 Neigungsmesser: Steigung der langen Kante gegen die Waagerechte.
// Anzeige in Grad und Prozent sowie als Höhendifferenz auf einer Bezugslänge.
// „Nullen" setzt einen Bezugswinkel, der nur bis zum Schließen gilt.

import { starteSchwerkraft } from '../sensors.js';
import { treffer } from '../feedback.js';
import { lies, setze, weiterschalten } from '../einstellungen.js';
import {
  bestimmeLage, laengsneigung, neigungKante, toleranz, winkelText, laengeText,
  hoehendifferenz, tanProzent, zahl, inMm, vonMm, WINKEL_EINHEITEN, WINKEL_NAMEN
} from '../mathe.js';
import { messansicht, haltenKnopf, knopf, fehler, meldung, zahlAbfragen } from '../ansicht.js';

const SVG_KEIL = `<svg viewBox="-50 -50 100 100">
  <path d="M-48 0H48" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.7"/>
  <g class="latte"><rect x="-44" y="-4" width="88" height="8" rx="3" fill="var(--akzent)" stroke="currentColor" stroke-width="1.5"/></g>
  <circle r="2.5" fill="currentColor"/>
</svg>`;

// Welche Bildschirmseite liegt höher, wenn die Oberkante des Handys höher liegt?
// Abhängig davon, wie die Anzeige in Kantenlage gedreht ist.
const OBERKANTE_IM_BILD = ['Oben', 'Links', 'Unten', 'Rechts'];
const GEGENSEITE = { Oben: 'Unten', Unten: 'Oben', Links: 'Rechts', Rechts: 'Links' };

export default {
  start(bereich) {
    const a = messansicht(bereich);
    const gehalten = haltenKnopf(a);
    a.grafik.innerHTML = SVG_KEIL;
    const latte = a.grafik.querySelector('.latte');
    const tol = toleranz(0.2, 0.3);
    let lage = null;
    let roh = null;
    let bezug = 0; // Grad, nur für diese Sitzung

    function aufWert(g) {
      if (gehalten()) return;
      lage = bestimmeLage(g, lage);
      roh = laengsneigung(g);
      const w = roh - bezug;
      const q = lage === 'flach' ? 0 : neigungKante(g).q;
      a.drehe(q);

      const einheit = lies('winkelEinheit');
      const t = winkelText(w, einheit);
      a.setzeWert(t.wert, t.einheit);
      const { drin, eingetreten } = tol(w);
      if (eingetreten) treffer();
      a.setzeTreffer(drin);

      const oberkante = lage === 'flach' ? 'Oben' : OBERKANTE_IM_BILD[q];
      const hoeher = w > 0 ? oberkante : GEGENSEITE[oberkante];
      // Latte im Bild so kippen, dass die höhere Seite oben ist (SVG: positiv = im Uhrzeigersinn).
      const kipp = Math.min(45, Math.abs(w)) * (hoeher === 'Links' ? 1 : hoeher === 'Rechts' ? -1 : 0);
      latte.setAttribute('transform', `rotate(${kipp.toFixed(1)})`);
      const name = bezug ? 'Wie Bezug' : 'Waagerecht';
      a.setzeStatus(drin ? `✓ ${name}` : `${hoeher} höher`);

      const latteMm = lies('lattenLaengeMm');
      const le = lies('laengenEinheit');
      const h = laengeText(Math.abs(hoehendifferenz(latteMm, w)), le);
      const l = laengeText(latteMm, le);
      const zweit = einheit === 'grad' ? `${zahl(Math.abs(tanProzent(w)))} %` : `${zahl(Math.abs(w))}°`;
      a.setzeZusatz(`${zweit} · auf ${l.wert} ${l.einheit}: ${h.wert} ${h.einheit}`);
    }

    const bezugKnopf = knopf('Nullen', () => {
      if (bezug) {
        bezug = 0;
        bezugKnopf.textContent = 'Nullen';
        meldung('Bezug gelöscht. Gemessen wird wieder gegen die Waagerechte.', 3000);
      } else if (roh !== null) {
        bezug = roh;
        bezugKnopf.textContent = 'Bezug weg';
        meldung(`Bezug gesetzt: ${zahl(roh)}°. Gilt bis zum Schließen.`, 3000);
      }
    });

    async function laengeAendern() {
      const le = lies('laengenEinheit');
      const l = laengeText(lies('lattenLaengeMm'), le);
      const neu = await zahlAbfragen('Bezugslänge',
        'Auf welche Länge soll die Höhendifferenz angezeigt werden? Zum Beispiel die Länge der Latte.',
        Number(vonMm(lies('lattenLaengeMm'), le).toFixed(3)), l.einheit);
      if (neu === null) return;
      if (neu <= 0) { meldung('Die Länge muss größer als 0 sein.'); return; }
      setze('lattenLaengeMm', inMm(neu, le));
    }

    a.leiste.append(
      bezugKnopf,
      knopf('Länge', laengeAendern),
      knopf('Einheit', () => {
        const e = weiterschalten('winkelEinheit', WINKEL_EINHEITEN);
        meldung(`Einheit: ${WINKEL_NAMEN[e]}`, 1500);
      })
    );

    return starteSchwerkraft(aufWert, (text) => fehler(bereich, text));
  }
};

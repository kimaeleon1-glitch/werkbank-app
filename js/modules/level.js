// F1 Wasserwaage: Display-Lage (Dosenlibelle, zwei Achsen) und Kantenlage
// (Röhrenlibelle, eine Achse). Die Lage wird aus der Schwerkraft erkannt.

import { starteSchwerkraft } from '../sensors.js';
import { treffer } from '../feedback.js';
import { lies, setze, weiterschalten } from '../einstellungen.js';
import {
  bestimmeLage, neigungFlach, neigungKante, toleranz, winkelText, zahl,
  WINKEL_EINHEITEN, WINKEL_NAMEN
} from '../mathe.js';
import { messansicht, haltenKnopf, knopf, fehler, frage, meldung } from '../ansicht.js';

const BEREICH_GRAD = 5; // Ausschlag der Blase bis zum Rand

const SVG_DOSE = `<svg viewBox="-50 -50 100 100">
  <circle r="46" fill="none" stroke="currentColor" stroke-width="3"/>
  <circle r="10" fill="none" stroke="currentColor" stroke-width="2"/>
  <path d="M-46 0h30M16 0h30M0-46v30M0 16v30" stroke="currentColor" stroke-width="1" opacity="0.6"/>
  <circle class="blase" r="9" fill="var(--akzent)" stroke="currentColor" stroke-width="2"/>
</svg>`;

const SVG_ROEHRE = `<svg viewBox="-50 -16 100 32">
  <rect x="-48" y="-12" width="96" height="24" rx="12" fill="none" stroke="currentColor" stroke-width="3"/>
  <path d="M-9-12v24M9-12v24" stroke="currentColor" stroke-width="2"/>
  <ellipse class="blase" rx="8" ry="8" fill="var(--akzent)" stroke="currentColor" stroke-width="2"/>
</svg>`;

// Ausschlag auf ±1 begrenzen, nahe null fein aufgelöst.
const ausschlag = (grad) => Math.max(-1, Math.min(1, grad / BEREICH_GRAD));

export default {
  start(bereich) {
    const a = messansicht(bereich);
    const gehalten = haltenKnopf(a);
    let lage = null;
    let roh = null; // letzte unkorrigierte Messung, für „Nullen"
    let tol = toleranz(0.2, 0.3);
    let blase = null;

    function zeichneGrafik(neueLage) {
      a.grafik.innerHTML = neueLage === 'flach' ? SVG_DOSE : SVG_ROEHRE;
      blase = a.grafik.querySelector('.blase');
      tol = toleranz(0.2, 0.3);
      if (neueLage === 'flach') a.drehe(0);
    }

    function zeige(abweichung, status, zusatz) {
      const t = winkelText(abweichung, lies('winkelEinheit'));
      a.setzeWert(t.wert, t.einheit);
      const { drin, eingetreten } = tol(abweichung);
      if (eingetreten) treffer();
      a.setzeTreffer(drin);
      a.setzeStatus(drin ? '✓ Waagerecht' : status);
      a.setzeZusatz(zusatz);
    }

    function aufWert(g) {
      if (gehalten()) return;
      const neueLage = bestimmeLage(g, lage);
      if (neueLage !== lage) zeichneGrafik(neueLage);
      lage = neueLage;

      if (lage === 'flach') {
        const n = neigungFlach(g);
        roh = { lage, n };
        const np = lies('nullpunkt').flach;
        const x = n.x - np.x;
        const y = n.y - np.y;
        // Blase wandert zur höheren Seite; im Bild ist oben = negatives y.
        blase.setAttribute('cx', (ausschlag(x) * 36).toFixed(1));
        blase.setAttribute('cy', (-ausschlag(y) * 36).toFixed(1));
        const richtung = [];
        if (Math.abs(x) >= 0.1) richtung.push(x > 0 ? 'links' : 'rechts');
        // oben/unten wie auf dem Bildschirm: oben = Oberkante des Handys
        if (Math.abs(y) >= 0.1) richtung.push(y > 0 ? 'unten' : 'oben');
        const status = richtung.length ? `${richtung.join(' und ')} anheben`.replace(/^./, (c) => c.toUpperCase()) : '';
        zeige(Math.hypot(x, y), status,
          `↔ ${zahl(Math.abs(x))}°   ↕ ${zahl(Math.abs(y))}°`);
      } else {
        const k = neigungKante(g);
        roh = { lage, k };
        const d = k.abweichung - lies('nullpunkt').kante[k.q];
        a.drehe(k.q);
        blase.setAttribute('cx', (ausschlag(d) * 38).toFixed(1));
        zeige(d, Math.abs(d) < 0.1 ? '' : d > 0 ? '◀ Links anheben' : 'Rechts anheben ▶', 'Kantenlage');
      }
    }

    async function nullen() {
      if (!roh) return;
      const messung = roh;
      const welche = messung.lage === 'flach' ? 'Display-Lage' : 'Kantenlage';
      const ok = await frage(
        `Nullpunkt setzen (${welche})`,
        'Das Handy muss jetzt auf einer Fläche liegen, die sicher waagerecht ist, zum Beispiel einer geprüften Wasserwaage. Die aktuelle Anzeige wird zu 0.',
        'Nullen'
      );
      if (!ok) return;
      const np = structuredClone(lies('nullpunkt'));
      if (messung.lage === 'flach') np.flach = { x: messung.n.x, y: messung.n.y };
      else np.kante[messung.k.q] = messung.k.abweichung;
      setze('nullpunkt', np);
      meldung('Nullpunkt gespeichert. Gegenprobe: Handy um 180° drehen. Die Anzeige soll wieder nahe 0 sein.', 8000);
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

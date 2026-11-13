// F3 Kompass: Kurs aus dem Orientierungssensor, wahlweise auf magnetisch
// oder geografisch Nord (mit der Missweisung aus den Einstellungen).

import { starteOrientierung, starteMagnetfeld, magnetfeldVerfuegbar } from '../sensors.js';
import { lies, setze } from '../einstellungen.js';
import { kursAusMatrix, kreisGlaettung, himmelsrichtung, normiere360 } from '../mathe.js';
import { el, messansicht, haltenKnopf, knopf, fehler } from '../ansicht.js';

// Erdmagnetfeld in Mitteleuropa: etwa 48–50 µT. Deutlich daneben heißt Störung.
const FELD_MIN = 25;
const FELD_MAX = 70;

const ACHT = 'Kompass ungenau? Handy einige Male in Form einer liegenden Acht bewegen. Metall, Magnete und Lautsprecher fernhalten, Hülle mit Magnetverschluss abnehmen.';

function roseSvg() {
  const striche = [];
  for (let w = 0; w < 360; w += 10) {
    const lang = w % 90 === 0 ? 12 : w % 30 === 0 ? 8 : 4;
    striche.push(`<path d="M0 -46v${lang}" transform="rotate(${w})" stroke="currentColor" stroke-width="${w % 90 === 0 ? 2.5 : 1.2}"/>`);
  }
  const buchstabe = (t, w, farbe = 'currentColor') =>
    `<text transform="rotate(${w}) translate(0 -24) rotate(${-w})" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="800" fill="${farbe}">${t}</text>`;
  return `<svg viewBox="-50 -50 100 100">
    <g class="rose">
      <circle r="47" fill="none" stroke="currentColor" stroke-width="2"/>
      ${striche.join('')}
      ${buchstabe('N', 0, 'var(--akzent)')}${buchstabe('O', 90)}${buchstabe('S', 180)}${buchstabe('W', 270)}
      <path d="M0-20l5 20h-10z" fill="var(--akzent)"/>
      <path d="M0 20l5-20h-10z" fill="none" stroke="currentColor" stroke-width="1.2"/>
    </g>
    <path d="M0-50l-5-0.5 5 10 5-10z" fill="currentColor"/>
  </svg>`;
}

export default {
  start(bereich) {
    const a = messansicht(bereich);
    const gehalten = haltenKnopf(a);
    a.grafik.innerHTML = roseSvg();
    const rose = a.grafik.querySelector('.rose');
    const glatt = kreisGlaettung(0.15);
    const hinweis = el('p', { class: 'hinweis', hidden: true }, '');
    a.ansicht.insertBefore(hinweis, a.leiste);
    let feldGestoert = false;
    let stoppFeld = () => {};

    function zeigeHinweis() {
      const texte = [];
      if (feldGestoert) texte.push('⚠ Magnetfeld gestört. ' + ACHT);
      if (lies('nordModus') === 'geografisch' && !lies('missweisung')) {
        texte.push('Missweisung ist 0°. Für geografisch Nord den Wert in den Einstellungen eintragen.');
      }
      hinweis.hidden = texte.length === 0;
      hinweis.classList.toggle('warnung', feldGestoert);
      hinweis.textContent = texte.join(' ');
    }

    function aufWert({ matrix }) {
      if (gehalten()) return;
      const magnetisch = glatt(kursAusMatrix(matrix));
      const geo = lies('nordModus') === 'geografisch';
      const kurs = normiere360(magnetisch + (geo ? lies('missweisung') : 0));
      rose.setAttribute('transform', `rotate(${(-kurs).toFixed(1)})`);
      const gerundet = Math.round(kurs) % 360;
      a.setzeWert(String(gerundet), '°');
      a.setzeStatus(himmelsrichtung(kurs));
      a.setzeZusatz(geo ? 'geografisch Nord' : 'magnetisch Nord');
    }

    const nordKnopf = knopf('', () => {
      setze('nordModus', lies('nordModus') === 'geografisch' ? 'magnetisch' : 'geografisch');
      nordBeschriften();
      zeigeHinweis();
    });
    const nordBeschriften = () => {
      nordKnopf.textContent = lies('nordModus') === 'geografisch' ? 'Geogr. Nord' : 'Magn. Nord';
    };
    nordBeschriften();

    const achtKnopf = knopf('Ungenau?', () => {
      hinweis.hidden = false;
      hinweis.classList.remove('warnung');
      hinweis.textContent = ACHT;
    });
    a.leiste.append(nordKnopf, achtKnopf);
    zeigeHinweis();

    // Störungserkennung nur mit Chrome-Flag möglich (siehe docs/analyse.md, B3).
    if (magnetfeldVerfuegbar()) {
      stoppFeld = starteMagnetfeld(({ x, y, z }) => {
        const ut = Math.hypot(x, y, z);
        const gestoert = ut < FELD_MIN || ut > FELD_MAX;
        if (gestoert !== feldGestoert) {
          feldGestoert = gestoert;
          zeigeHinweis();
        }
      }, () => {});
    }

    const stoppOrientierung = starteOrientierung(aufWert, (text) => {
      stoppFeld();
      fehler(bereich, text);
    });
    return () => { stoppOrientierung(); stoppFeld(); };
  }
};

// F3 Kompass: Kurs aus dem Orientierungssensor, wahlweise auf magnetisch
// oder geografisch Nord (mit der Missweisung aus den Einstellungen).
// Auf Wunsch zeigt er den GPS-Standort (Grad, UTM, MGRS). Der Standort wird
// nur angezeigt, nie gespeichert oder verschickt.

import { starteOrientierung, starteMagnetfeld, magnetfeldVerfuegbar, starteStandort } from '../sensors.js';
import { lies, setze } from '../einstellungen.js';
import { kursAusMatrix, kreisGlaettung, himmelsrichtung, normiere360, utm, mgrs, gradMinSek } from '../mathe.js';
import { el, messansicht, haltenKnopf, knopf, fehler, meldung } from '../ansicht.js';

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
    let aus = false;

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
    // ---- Standort
    const standort = el('div', { class: 'standort', hidden: true, 'aria-live': 'polite' });
    a.ansicht.insertBefore(standort, a.leiste);
    let stoppStandort = null;
    let letzteKoordinaten = '';

    const zeile = (name, wert) => el('p', { class: 'standort-zeile' }, el('span', {}, name), el('strong', {}, wert));
    function zeigeStandort({ breite, laenge, genauigkeit }) {
      const u = utm(breite, laenge);
      letzteKoordinaten = `${breite.toFixed(6)}, ${laenge.toFixed(6)}`;
      standort.replaceChildren(
        zeile('Breite, Länge', letzteKoordinaten),
        zeile('', `${gradMinSek(breite, 'N', 'S')}  ${gradMinSek(laenge, 'O', 'W')}`),
        u ? zeile('UTM', `${u.zone}${u.band} ${Math.round(u.ost)} ${Math.round(u.nord)}`) : null,
        u ? zeile('MGRS', mgrs(u)) : null,
        zeile('Genauigkeit', `± ${Math.round(genauigkeit)} m`),
        kopierKnopf);
    }
    const kopierKnopf = knopf('Koordinaten kopieren', async () => {
      try {
        await navigator.clipboard.writeText(letzteKoordinaten);
        meldung('Kopiert: ' + letzteKoordinaten, 2500);
      } catch {
        meldung('Kopieren nicht möglich.', 2500);
      }
    });
    function standortAn(an) {
      setze('standortZeigen', an);
      standortKnopf.setAttribute('aria-pressed', String(an));
      standort.hidden = !an;
      stoppStandort?.();
      stoppStandort = null;
      if (!an) return;
      standort.replaceChildren(el('p', { class: 'standort-zeile' }, 'Standort wird gesucht … Im Freien geht es schneller.'));
      stoppStandort = starteStandort(zeigeStandort, (text) => {
        standort.replaceChildren(el('p', { class: 'standort-zeile fehler-text' }, text));
      });
    }
    const standortKnopf = knopf('Standort', () => standortAn(standort.hidden));

    a.leiste.append(nordKnopf, achtKnopf, standortKnopf);
    zeigeHinweis();
    standortAn(lies('standortZeigen'));

    // Störungserkennung nur, wenn Chrome den Magnetsensor freigibt (docs/analyse.md, B3/C23).
    magnetfeldVerfuegbar().then((ja) => {
      if (!ja || aus) return;
      stoppFeld = starteMagnetfeld(({ x, y, z }) => {
        const ut = Math.hypot(x, y, z);
        const gestoert = ut < FELD_MIN || ut > FELD_MAX;
        if (gestoert !== feldGestoert) {
          feldGestoert = gestoert;
          zeigeHinweis();
        }
      }, () => {});
    });

    const stoppOrientierung = starteOrientierung(aufWert, (text) => {
      stoppFeld();
      stoppStandort?.();
      fehler(bereich, text);
    });
    return () => { aus = true; stoppOrientierung(); stoppFeld(); stoppStandort?.(); };
  }
};

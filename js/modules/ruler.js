// F7 Lineal: Lineal in mm und Zoll am Bildschirmrand, zwei verschiebbare
// Striche zeigen die Länge dazwischen. Kalibrierung mit einer Bankkarte.

import { lies, setze } from '../einstellungen.js';
import { laengeText, zahl } from '../mathe.js';
import { KARTE_MM, linealFaktor, FAKTOR_STANDARD } from '../rechnen.js';
import { el, knopf, meldung } from '../ansicht.js';

const ns = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attr) => {
  const e = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attr)) e.setAttribute(k, v);
  return e;
};

export default {
  start(bereich) {
    let stoppAktuell = () => {};
    const zeige = (ansicht) => {
      stoppAktuell();
      stoppAktuell = ansicht === 'kalibrieren' ? kalibrieren(bereich, zeige) : lineal(bereich, zeige);
    };
    zeige(lies('linealFaktor') ? 'lineal' : 'kalibrieren');
    return () => stoppAktuell();
  }
};

// ------------------------------------------------------------ Lineal

function lineal(bereich, zeige) {
  const faktor = lies('linealFaktor') || FAKTOR_STANDARD;
  const flaeche = el('div', { class: 'lineal' });
  // Platzhaltertext, damit die Zeile ihre Höhe hat, bevor die Skala ausgemessen wird.
  const ergebnis = el('p', { class: 'lineal-wert', 'aria-live': 'polite' }, '0 mm');
  const leiste = el('div', { class: 'leiste' },
    knopf('Striche zurück', () => { striche = [hoehe * 0.2, hoehe * 0.6]; zeichneStriche(); }),
    knopf('Kalibrieren', () => zeige('kalibrieren')));
  const hinweis = lies('linealFaktor') ? null
    : el('p', { class: 'hinweis warnung' }, 'Noch nicht kalibriert – Werte stimmen nur ungefähr.');
  bereich.replaceChildren(el('div', { class: 'mess' }, hinweis, flaeche, ergebnis, leiste));

  const hoehe = flaeche.clientHeight;
  const breite = flaeche.clientWidth;
  const svg = svgEl('svg', { width: breite, height: hoehe, class: 'lineal-svg' });
  flaeche.append(svg);

  // mm-Skala links, Zoll-Skala rechts. 0 liegt an der Oberkante der Fläche.
  for (let mm = 0; mm * faktor <= hoehe; mm += 1) {
    const y = mm * faktor + 0.5;
    const lang = mm % 10 === 0 ? 34 : mm % 5 === 0 ? 22 : 12;
    svg.append(svgEl('line', { x1: 0, x2: lang, y1: y, y2: y, class: 'strich-skala' }));
    if (mm % 10 === 0 && mm > 0) {
      const t = svgEl('text', { x: 40, y: y + 7, class: 'skala-zahl' });
      t.textContent = String(mm / 10);
      svg.append(t);
    }
  }
  const zollPx = 25.4 * faktor;
  for (let i = 0; i * zollPx / 16 <= hoehe; i += 1) {
    const y = (i * zollPx) / 16 + 0.5;
    const lang = i % 16 === 0 ? 34 : i % 8 === 0 ? 26 : i % 4 === 0 ? 18 : 10;
    svg.append(svgEl('line', { x1: breite - lang, x2: breite, y1: y, y2: y, class: 'strich-skala' }));
    if (i % 16 === 0 && i > 0) {
      const t = svgEl('text', { x: breite - 40, y: y + 7, class: 'skala-zahl', 'text-anchor': 'end' });
      t.textContent = `${i / 16}″`;
      svg.append(t);
    }
  }
  const beschrift = (x, text, anker) => {
    const t = svgEl('text', { x, y: hoehe - 8, class: 'skala-einheit', 'text-anchor': anker });
    t.textContent = text;
    svg.append(t);
  };
  beschrift(4, 'cm', 'start');
  beschrift(breite - 4, 'Zoll', 'end');

  // Zwei Striche, mit dem Finger verschiebbar (ganze Breite ist Griff).
  let striche = [hoehe * 0.2, hoehe * 0.6];
  const linien = striche.map(() => {
    const g = svgEl('g', { class: 'messstrich' });
    g.append(svgEl('rect', { x: 0, y: -22, width: breite, height: 44, fill: 'transparent' }));
    g.append(svgEl('line', { x1: 0, x2: breite, y1: 0, y2: 0 }));
    svg.append(g);
    return g;
  });
  const band = svgEl('rect', { x: 70, width: breite - 140, class: 'messband' });
  svg.insertBefore(band, linien[0]);

  function zeichneStriche() {
    linien.forEach((g, i) => g.setAttribute('transform', `translate(0 ${striche[i]})`));
    const [o, u] = [Math.min(...striche), Math.max(...striche)];
    band.setAttribute('y', o);
    band.setAttribute('height', u - o);
    const mm = (u - o) / faktor;
    const l = laengeText(mm, lies('laengenEinheit'));
    const zoll = laengeText(mm, 'zoll');
    ergebnis.textContent = lies('laengenEinheit') === 'zoll'
      ? `${l.wert} ${l.einheit}`
      : `${l.wert} ${l.einheit}  ·  ${zoll.wert} in`;
  }
  zeichneStriche();

  let gezogen = null;
  svg.addEventListener('pointerdown', (e) => {
    const y = e.clientY - svg.getBoundingClientRect().top;
    gezogen = Math.abs(y - striche[0]) <= Math.abs(y - striche[1]) ? 0 : 1;
    svg.setPointerCapture(e.pointerId);
    bewege(e);
  });
  const bewege = (e) => {
    if (gezogen === null) return;
    const y = e.clientY - svg.getBoundingClientRect().top;
    striche[gezogen] = Math.max(0, Math.min(hoehe, y));
    zeichneStriche();
  };
  svg.addEventListener('pointermove', bewege);
  svg.addEventListener('pointerup', () => { gezogen = null; });
  svg.addEventListener('pointercancel', () => { gezogen = null; });

  return () => {};
}

// ------------------------------------------------------------ Kalibrierung

function kalibrieren(bereich, zeige) {
  let faktor = lies('linealFaktor') || FAKTOR_STANDARD;
  const rahmen = el('div', { class: 'karte-rahmen' }, el('span', {}, 'Bankkarte hier hochkant auflegen'));
  const wert = el('p', { class: 'lineal-wert' });
  const regler = el('input', {
    type: 'range', class: 'regler', min: '2.5', max: '9', step: '0.005', value: String(faktor),
    'aria-label': 'Rahmengröße'
  });
  const flaeche = el('div', { class: 'kalibrier-flaeche' }, rahmen);

  const setze_ = (f) => {
    faktor = Math.max(2.5, Math.min(9, f));
    regler.value = String(faktor);
    rahmen.style.height = `${KARTE_MM.breite * faktor}px`;
    rahmen.style.width = `${KARTE_MM.hoehe * faktor}px`;
    wert.textContent = `${zahl(faktor, 2)} Pixel pro mm`;
  };
  regler.addEventListener('input', () => setze_(Number(regler.value)));

  bereich.replaceChildren(el('div', { class: 'mess' },
    el('p', { class: 'hinweis' },
      'Eine Bank- oder Ausweiskarte hochkant oben links auflegen. Rahmen mit − und + so einstellen, dass er genau die lange Kante (85,6 mm) abdeckt.'),
    flaeche,
    wert,
    el('div', { class: 'regler-zeile' }, regler),
    el('div', { class: 'leiste' },
      knopf('−', () => setze_(faktor * 0.998)),
      knopf('+', () => setze_(faktor * 1.002)),
      knopf('Speichern', () => {
        setze('linealFaktor', linealFaktor(KARTE_MM.breite * faktor));
        meldung('Lineal kalibriert.', 2500);
        zeige('lineal');
      }, 'haupt'))));
  setze_(faktor);
  return () => {};
}

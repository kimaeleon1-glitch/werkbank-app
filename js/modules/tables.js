// F16 Nachschlagetabellen: feste, mitgelieferte Werte, nur lesen.
// Typische Beispielwerte – vor dem Einsatz mit Herstellerangaben abgleichen.

import { el, knopf } from '../ansicht.js';

const TABELLEN = {
  duebel: {
    titel: 'Dübel',
    kopf: ['Dübel', 'Bohrer', 'Schraube ⌀'],
    zeilen: [
      ['5 mm', '5 mm', '3–4 mm'],
      ['6 mm', '6 mm', '4–5 mm'],
      ['8 mm', '8 mm', '4,5–6 mm'],
      ['10 mm', '10 mm', '6–8 mm'],
      ['12 mm', '12 mm', '8–10 mm'],
      ['14 mm', '14 mm', '10–12 mm']
    ],
    text: 'Schraubenlänge ≈ Dübellänge + Dicke des Anbauteils + 1 × Schraubendurchmesser. Bohrloch etwa 10 mm tiefer als der Dübel lang ist.'
  },
  gewinde: {
    titel: 'Gewinde',
    kopf: ['Gewinde', 'Kernloch', 'Durchgang', 'Schlüssel'],
    zeilen: [
      ['M3', '2,5', '3,4', '5,5'],
      ['M4', '3,3', '4,5', '7'],
      ['M5', '4,2', '5,5', '8'],
      ['M6', '5,0', '6,6', '10'],
      ['M8', '6,8', '9,0', '13'],
      ['M10', '8,5', '11', '16 / 17'],
      ['M12', '10,2', '13,5', '18 / 19']
    ],
    text: 'Alle Werte in mm, metrisches Regelgewinde. Kernloch: Bohrer vor dem Gewindeschneiden. Durchgang: Bohrung „mittel“ für die Schraube. Schlüsselweite für Sechskant (ISO / DIN).'
  },
  holz: {
    titel: 'Schrauben',
    kopf: ['Schraube ⌀', 'Vorbohren Hartholz', 'Typische Länge'],
    zeilen: [
      ['3,0 mm', '2,0 mm', '12–40 mm'],
      ['3,5 mm', '2,5 mm', '16–50 mm'],
      ['4,0 mm', '2,5–3 mm', '20–60 mm'],
      ['4,5 mm', '3,0 mm', '25–70 mm'],
      ['5,0 mm', '3,5 mm', '30–100 mm'],
      ['6,0 mm', '4,0 mm', '40–160 mm']
    ],
    text: 'Weichholz meist ohne Vorbohren, nahe am Rand trotzdem vorbohren. Kopfformen: Senkkopf (bündig, für Beschläge), Linsenkopf (leicht gewölbt), Zylinderkopf (für Metall), Sechskant (große Kräfte).'
  },
  zoll: {
    titel: 'Zoll',
    kopf: ['Zoll', 'mm'],
    zeilen: [
      ['1/16″', '1,59'], ['1/8″', '3,18'], ['3/16″', '4,76'], ['1/4″', '6,35'],
      ['5/16″', '7,94'], ['3/8″', '9,53'], ['1/2″', '12,70'], ['5/8″', '15,88'],
      ['3/4″', '19,05'], ['1″', '25,40'], ['1 Fuß = 12″', '304,8']
    ],
    text: '1 Zoll = 25,4 mm (genau). Rohrgewinde-Zoll (z. B. ½″ Wasserrohr) ist eine Nennweite, kein Außendurchmesser.'
  }
};

export default {
  start(bereich) {
    const reiter = el('div', { class: 'reiter reiter-4', role: 'tablist' });
    const inhalt = el('div', { class: 'rechner-inhalt' });
    bereich.replaceChildren(el('div', { class: 'rechner' },
      reiter,
      el('p', { class: 'hinweis warnung' }, 'Typische Beispielwerte. Vor dem Einsatz mit den Angaben des Herstellers abgleichen.'),
      inhalt));

    function oeffne(id) {
      reiter.querySelectorAll('.knopf').forEach((k) => k.setAttribute('aria-pressed', String(k.dataset.id === id)));
      const t = TABELLEN[id];
      inhalt.replaceChildren(
        el('div', { class: 'tabelle-rahmen' },
          el('table', { class: 'tabelle' },
            el('thead', {}, el('tr', {}, t.kopf.map((k) => el('th', { scope: 'col' }, k)))),
            el('tbody', {}, t.zeilen.map((z) => el('tr', {}, z.map((w, i) => (i === 0 ? el('th', { scope: 'row' }, w) : el('td', {}, w)))))))),
        el('p', { class: 'tabelle-text' }, t.text));
    }

    for (const [id, t] of Object.entries(TABELLEN)) {
      const k = knopf(t.titel, () => oeffne(id));
      k.dataset.id = id;
      reiter.append(k);
    }
    oeffne('duebel');
  }
};

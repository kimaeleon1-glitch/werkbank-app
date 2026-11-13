// F8 Rechner: Farbe, Fliesen, Tapete, Beton, Gefälle, Umrechnung.
// Eingaben gelten nur bis zum Schließen. Gespeichert werden nur die
// Produktfaktoren (Ergiebigkeit, Sackausbeute), siehe docs/analyse.md A3.

import { lies, setze } from '../einstellungen.js';
import { zahl, inMm, vonMm, LAENGEN_EINHEITEN } from '../mathe.js';
import { farbe, fliesen, tapete, beton, gefaelle } from '../rechnen.js';
import { el, knopf } from '../ansicht.js';

const lesen = (eingabe) => {
  const t = eingabe.value.trim().replace(/\s/g, '').replace(',', '.');
  return t === '' ? NaN : Number(t);
};

// Ein Eingabefeld mit Beschriftung und Einheit. `gespeichert` = Name der Einstellung.
function feld(beschriftung, einheit, { start = '', beispiel = '', gespeichert = null } = {}) {
  const wert = gespeichert ? (lies('rechner')?.[gespeichert] ?? '') : start;
  const eingabe = el('input', {
    type: 'text', inputmode: 'decimal', class: 'eingabe', autocomplete: 'off',
    value: String(wert).replace('.', ','), placeholder: beispiel ? `z. B. ${beispiel}` : ''
  });
  if (gespeichert) {
    eingabe.addEventListener('change', () => {
      const z = lesen(eingabe);
      setze('rechner', { ...(lies('rechner') || {}), [gespeichert]: Number.isFinite(z) && z > 0 ? z : '' });
    });
  }
  const zeile = el('label', { class: 'feld' },
    el('span', { class: 'feld-name' }, beschriftung),
    el('span', { class: 'eingabe-zeile' }, eingabe, el('span', { class: 'feld-einheit' }, einheit)));
  return { zeile, eingabe, zahl: () => lesen(eingabe) };
}

// Ergebniszeilen: [[Bezeichnung, Wert], …] oder ein Hinweistext.
function zeigeErgebnis(ziel, zeilen) {
  if (typeof zeilen === 'string') {
    ziel.replaceChildren(el('p', { class: 'ergebnis-leer' }, zeilen));
    return;
  }
  ziel.replaceChildren(...zeilen.map(([name, wert]) =>
    el('p', { class: 'ergebnis-zeile' }, el('span', {}, name), el('strong', {}, wert))));
}

const FEHLT = 'Bitte alle Felder ausfüllen (Zahlen größer als 0).';

// ------------------------------------------------------------ Rechner

const RECHNER = {
  farbe: {
    titel: 'Farbe',
    felder: () => ({
      flaeche: feld('Fläche', 'm²', { beispiel: '24' }),
      anstriche: feld('Anstriche', '×', { start: 2 }),
      ergiebigkeit: feld('Ergiebigkeit (siehe Eimer)', 'm²/l', { beispiel: '8', gespeichert: 'ergiebigkeit' })
    }),
    rechne: (f) => {
      const e = farbe({ flaeche: f.flaeche.zahl(), anstriche: f.anstriche.zahl(), ergiebigkeit: f.ergiebigkeit.zahl() });
      return e ? [['Farbe', `${zahl(e.liter, 2)} l`]] : FEHLT;
    }
  },
  fliesen: {
    titel: 'Fliesen',
    felder: () => ({
      flaeche: feld('Raumfläche', 'm²', { beispiel: '12' }),
      laenge: feld('Fliese Länge', 'cm', { beispiel: '60' }),
      breite: feld('Fliese Breite', 'cm', { beispiel: '30' }),
      verschnitt: feld('Verschnitt', '%', { start: 10 })
    }),
    rechne: (f) => {
      const e = fliesen({
        flaeche: f.flaeche.zahl(), laengeCm: f.laenge.zahl(), breiteCm: f.breite.zahl(),
        verschnittProzent: Number.isFinite(f.verschnitt.zahl()) ? f.verschnitt.zahl() : 0
      });
      return e ? [['Fliesen', `${e.anzahl} Stück`], ['Fläche mit Verschnitt', `${zahl(e.flaeche, 2)} m²`]] : FEHLT;
    }
  },
  tapete: {
    titel: 'Tapete',
    felder: () => ({
      hoehe: feld('Wandhöhe', 'm', { beispiel: '2,5' }),
      laenge: feld('Wandlänge', 'm', { beispiel: '4' }),
      rollenBreite: feld('Rollenbreite', 'm', { beispiel: '0,53', gespeichert: 'rollenBreite' }),
      rollenLaenge: feld('Rollenlänge', 'm', { beispiel: '10,05', gespeichert: 'rollenLaenge' }),
      zugabe: feld('Zugabe je Bahn', 'cm', { start: 10 })
    }),
    rechne: (f) => {
      const e = tapete({
        hoehe: f.hoehe.zahl(), laenge: f.laenge.zahl(), rollenBreite: f.rollenBreite.zahl(),
        rollenLaenge: f.rollenLaenge.zahl(), zugabeCm: Number.isFinite(f.zugabe.zahl()) ? f.zugabe.zahl() : 0
      });
      if (!e) return FEHLT;
      if (e.fehler) return e.fehler;
      return [['Bahnen', String(e.bahnen)], ['Bahnen pro Rolle', String(e.bahnenProRolle)], ['Rollen', String(e.rollen)]];
    }
  },
  beton: {
    titel: 'Beton',
    felder: () => ({
      laenge: feld('Länge', 'm', { beispiel: '2' }),
      breite: feld('Breite', 'm', { beispiel: '1,5' }),
      dicke: feld('Dicke', 'cm', { beispiel: '12' }),
      ausbeute: feld('Ausbeute pro Sack (siehe Sack)', 'l', { beispiel: '15', gespeichert: 'sackAusbeute' })
    }),
    rechne: (f) => {
      const e = beton({ laenge: f.laenge.zahl(), breite: f.breite.zahl(), dickeCm: f.dicke.zahl(), ausbeuteLiter: f.ausbeute.zahl() });
      if (!e) return FEHLT;
      return [
        ['Volumen', `${zahl(e.kubik, 3)} m³`],
        ['', `${zahl(e.liter, 0)} l`],
        ['Säcke', e.saecke === null ? 'Ausbeute eintragen' : `${e.saecke} Stück`]
      ];
    }
  },
  gefaelle: {
    titel: 'Gefälle',
    felder: () => {
      const auswahl = { wert: 'hoehe' };
      return {
        laenge: feld('Länge', 'm', { beispiel: '5' }),
        gegeben: auswahl,
        wert: feld('Höhenunterschied', 'cm', { beispiel: '10' })
      };
    },
    rechne: (f) => {
      const e = gefaelle({ laenge: f.laenge.zahl(), gegeben: f.gegeben.wert, wert: f.wert.zahl() });
      if (!e) return 'Länge und einen Wert eintragen.';
      return [
        ['Höhenunterschied', `${zahl(e.hoeheCm, 2)} cm`],
        ['Gefälle', `${zahl(e.prozent, 2)} %`],
        ['', `${zahl(e.mmProM, 1)} mm/m`],
        ['Winkel', `${zahl(e.winkel, 2)}°`]
      ];
    }
  },
  umrechnung: {
    titel: 'Umrechnung',
    felder: () => ({ wert: feld('Wert', '', { beispiel: '100' }), einheit: { wert: 'mm' } }),
    rechne: (f) => {
      const w = f.wert.zahl();
      if (!Number.isFinite(w)) return 'Wert eintragen.';
      const mm = inMm(w, f.einheit.wert);
      const namen = { mm: 'mm', cm: 'cm', m: 'm', zoll: 'Zoll' };
      const stellen = { mm: 1, cm: 2, m: 4, zoll: 3 };
      return LAENGEN_EINHEITEN.filter((e) => e !== f.einheit.wert)
        .map((e) => [namen[e], zahl(vonMm(mm, e), stellen[e])]);
    }
  }
};

// Tasten zum Wählen einer Option; ändert ziel.wert.
function wahl(optionen, ziel, nachher) {
  const knoepfe = Object.entries(optionen).map(([wert, text]) => {
    const k = knopf(text, () => {
      ziel.wert = wert;
      knoepfe.forEach((b) => b.setAttribute('aria-pressed', String(b === k)));
      nachher(wert);
    });
    k.setAttribute('aria-pressed', String(wert === ziel.wert));
    return k;
  });
  return el('div', { class: 'auswahl', role: 'group' }, knoepfe);
}

export default {
  start(bereich) {
    const reiter = el('div', { class: 'reiter', role: 'tablist' });
    const inhalt = el('div', { class: 'rechner-inhalt' });
    bereich.replaceChildren(el('div', { class: 'rechner' }, reiter, inhalt));

    function oeffne(id) {
      reiter.querySelectorAll('.knopf').forEach((k) => k.setAttribute('aria-pressed', String(k.dataset.id === id)));
      const r = RECHNER[id];
      const f = r.felder();
      const ergebnis = el('div', { class: 'ergebnis', 'aria-live': 'polite' });
      const aktualisiere = () => zeigeErgebnis(ergebnis, r.rechne(f));
      const teile = [];

      for (const [name, teil] of Object.entries(f)) {
        if (teil.zeile) {
          teil.eingabe.addEventListener('input', aktualisiere);
          teile.push(teil.zeile);
        } else if (id === 'gefaelle' && name === 'gegeben') {
          teile.push(wahl({ hoehe: 'Höhe', prozent: 'Prozent', winkel: 'Winkel' }, teil, (w) => {
            const [text, einheit] = { hoehe: ['Höhenunterschied', 'cm'], prozent: ['Gefälle', '%'], winkel: ['Winkel', '°'] }[w];
            f.wert.zeile.querySelector('.feld-name').textContent = text;
            f.wert.zeile.querySelector('.feld-einheit').textContent = einheit;
            aktualisiere();
          }));
        } else if (id === 'umrechnung' && name === 'einheit') {
          teile.push(wahl({ mm: 'mm', cm: 'cm', m: 'm', zoll: 'Zoll' }, teil, aktualisiere));
        }
      }
      inhalt.replaceChildren(...teile, ergebnis);
      aktualisiere();
      inhalt.closest('main')?.scrollTo(0, 0);
    }

    for (const [id, r] of Object.entries(RECHNER)) {
      const k = knopf(r.titel, () => oeffne(id));
      k.dataset.id = id;
      reiter.append(k);
    }
    oeffne('farbe');
  }
};

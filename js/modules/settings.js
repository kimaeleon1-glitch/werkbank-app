// Einstellungen: Einheiten, Ton, Vibration, Thema, Missweisung, Nullpunkte,
// Version und Sicherheitshinweise.

import { lies, setze, nullpunkteZuruecksetzen } from '../einstellungen.js';
import { WINKEL_NAMEN, zahl } from '../mathe.js';
import { el, knopf, frage, meldung, zahlAbfragen } from '../ansicht.js';
import { versionAbfragen } from '../app.js';

// Reihe von Tasten, von denen genau eine gewählt ist.
function auswahl(name, optionen) {
  const knoepfe = Object.entries(optionen).map(([wert, text]) => {
    const k = knopf(text, () => {
      setze(name, wert);
      markiere();
    });
    k.dataset.wert = wert;
    return k;
  });
  const markiere = () => knoepfe.forEach((k) =>
    k.setAttribute('aria-pressed', String(String(lies(name)) === k.dataset.wert)));
  markiere();
  return el('div', { class: 'auswahl', role: 'group' }, knoepfe);
}

// An/Aus-Schalter für einen Wahrheitswert.
function schalter(name) {
  const k = knopf('', () => { setze(name, !lies(name)); beschrifte(); });
  const beschrifte = () => {
    k.textContent = lies(name) ? 'An' : 'Aus';
    k.setAttribute('aria-pressed', String(lies(name)));
  };
  beschrifte();
  return k;
}

const abschnitt = (titel, ...inhalt) => el('section', {}, el('h2', {}, titel), ...inhalt);

function missweisungText() {
  const m = lies('missweisung');
  if (!m) return '0° (nicht eingetragen)';
  return `${zahl(Math.abs(m))}° ${m > 0 ? 'Ost' : 'West'}`;
}

export default {
  start(bereich) {
    const missweisungWert = el('strong', {}, missweisungText());
    const version = el('span', {}, '…');
    versionAbfragen().then((v) => { version.textContent = v || 'noch nicht offline gespeichert'; });

    const tonUndVibration = el('div', { class: 'auswahl' },
      el('div', {}, el('p', {}, 'Ton'), schalter('ton')),
      el('div', {}, el('p', {}, 'Vibration'), schalter('vibration')));

    bereich.replaceChildren(el('div', { class: 'einstellungen' },
      abschnitt('Winkel',
        auswahl('winkelEinheit', WINKEL_NAMEN)),
      abschnitt('Längen',
        auswahl('laengenEinheit', { mm: 'mm', cm: 'cm', m: 'm', zoll: 'Zoll' })),
      abschnitt('Anzeige',
        auswahl('thema', { dunkel: 'Dunkel', hell: 'Hell (Sonne)' })),
      abschnitt('Rückmeldung bei exakter Lage', tonUndVibration),
      abschnitt('Missweisung für den Kompass',
        el('p', {}, 'Aktuell: ', missweisungWert),
        el('p', {}, 'Abweichung zwischen magnetisch und geografisch Nord am Wohnort. Östlich positiv, westlich negativ. In Deutschland derzeit etwa +3° bis +5°.'),
        knopf('Missweisung eingeben', async () => {
          const neu = await zahlAbfragen('Missweisung',
            'Grad, Ost positiv (z. B. 4,2), West negativ (z. B. -1,5).', lies('missweisung'), '°');
          if (neu === null) return;
          if (Math.abs(neu) > 30) { meldung('Wert zu groß. Erlaubt sind -30° bis +30°.'); return; }
          setze('missweisung', neu);
          missweisungWert.textContent = missweisungText();
        })),
      abschnitt('Nullpunkte',
        el('p', {}, 'Wasserwaage und Lot speichern ihren Nullpunkt dauerhaft. Hier lassen sie sich auf Werkszustand zurücksetzen.'),
        knopf('Nullpunkte zurücksetzen', async () => {
          if (await frage('Nullpunkte zurücksetzen?', 'Alle gespeicherten Nullpunkte von Wasserwaage und Lot werden gelöscht.', 'Zurücksetzen')) {
            nullpunkteZuruecksetzen();
            meldung('Nullpunkte zurückgesetzt.');
          }
        })),
      abschnitt('Lineal',
        el('p', {}, lies('linealFaktor') ? 'Kalibriert.' : 'Noch nicht kalibriert.'),
        knopf('Lineal kalibrieren', () => {
          setze('linealFaktor', null);
          location.hash = 'lineal';
        })),
      abschnitt('Sicherheitshinweise',
        el('ul', {},
          el('li', {}, 'Alle Messwerte sind Richtwerte. Die App ersetzt kein Profi-Werkzeug.'),
          el('li', {}, 'Bei Statik, Gas, Strom und Absturzsicherung immer Fachwerkzeug nutzen.'),
          el('li', {}, 'Vor dem Bohren in Wände ein Leitungssuchgerät und die Baupläne nutzen.'),
          el('li', {}, 'Genauigkeit erst nach dem Nullen auf einer geprüften Fläche: Wasserwaage etwa ±0,3°, Kompass etwa ±5°.'))),
      abschnitt('Über die App',
        el('p', {}, 'Werkbank · Version ', version),
        el('p', {}, 'Ohne Werbung, ohne Konto, ohne Tracking. Gespeichert werden nur diese Einstellungen, und zwar nur auf diesem Handy.'))
    ));
  }
};

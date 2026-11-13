// F10 Timer: mehrere benannte Timer für Trocknungs- und Aushärtezeiten.
//
// Gerechnet wird mit Zeitstempeln, daher stimmt die Restzeit auch nach der
// Rückkehr aus dem Hintergrund. Der Alarm kommt aber nur bei geöffneter App:
// Eine Web-App kann ohne Netz nicht zuverlässig im Hintergrund wecken.
// Die Timer leben, solange die App offen ist – auch in anderen Werkzeugen.
// Gespeichert wird nichts.

import { lies } from '../einstellungen.js';
import { piepsen, vibrieren } from '../feedback.js';
import { restzeit, uhrzeit } from '../rechnen.js';
import { el, knopf } from '../ansicht.js';

const VORGABEN = [5, 15, 30, 60];

// Zustand auf Modulebene: überlebt das Verlassen des Werkzeugs.
const timer = []; // { id, name, dauer, ende, pausiertRest, fertig }
let naechsteId = 1;
let takt = null;
let alarmTakt = null;
let zeichnen = null; // Zeichenfunktion der offenen Ansicht, sonst null

function alarm() {
  piepsen(988, 0.25);
  setTimeout(() => piepsen(784, 0.25), 300);
  vibrieren([300, 150, 300]);
}

function pruefen() {
  const jetzt = Date.now();
  let neuFertig = false;
  for (const t of timer) {
    if (!t.fertig && t.ende !== null && restzeit(t.ende, jetzt) === 0) {
      t.fertig = true;
      neuFertig = true;
    }
  }
  const klingelt = timer.some((t) => t.fertig);
  if (neuFertig) zeigeAlarmBanner();
  if (klingelt && !alarmTakt) { alarm(); alarmTakt = setInterval(alarm, 1500); }
  if (!klingelt && alarmTakt) { clearInterval(alarmTakt); alarmTakt = null; }
  if (!timer.length && takt) { clearInterval(takt); takt = null; }
  zeichnen?.();
  if (!klingelt) document.querySelector('.timer-banner')?.remove();
}

function starteTakt() {
  if (!takt) takt = setInterval(pruefen, 250);
}

// Banner, damit der Alarm auch in anderen Werkzeugen sichtbar ist.
function zeigeAlarmBanner() {
  if (document.querySelector('.timer-banner')) return;
  const namen = timer.filter((t) => t.fertig).map((t) => t.name).join(', ');
  const banner = el('div', { class: 'timer-banner', role: 'alert' },
    el('strong', {}, `⏰ Fertig: ${namen}`),
    knopf('Stopp', () => { alleFertigenEntfernen(); pruefen(); }, 'haupt'));
  document.body.append(banner);
}

function alleFertigenEntfernen() {
  for (let i = timer.length - 1; i >= 0; i--) if (timer[i].fertig) timer.splice(i, 1);
}

function neuerTimer(minuten, name) {
  const dauer = Math.round(minuten * 60000);
  timer.push({ id: naechsteId++, name: name || `${String(minuten).replace('.', ',')} min`, dauer, ende: Date.now() + dauer, pausiertRest: null, fertig: false });
  starteTakt();
  pruefen();
}

// Dialog: Minuten und optionaler Name. Liefert { minuten, name } oder null.
function timerAbfragen() {
  return new Promise((fertig) => {
    const minuten = el('input', { type: 'text', inputmode: 'decimal', class: 'eingabe', placeholder: 'z. B. 45' });
    const name = el('input', { type: 'text', class: 'eingabe', maxlength: '30', placeholder: 'z. B. Spachtel' });
    const fehlerText = el('p', { class: 'fehler-text', hidden: true }, 'Bitte Minuten zwischen 0,1 und 1440 eintragen.');
    const d = el('dialog', { class: 'dialog' },
      el('h2', {}, 'Neuer Timer'),
      el('label', { class: 'feld' }, el('span', { class: 'feld-name' }, 'Dauer'),
        el('span', { class: 'eingabe-zeile' }, minuten, el('span', { class: 'feld-einheit' }, 'min'))),
      el('label', { class: 'feld' }, el('span', { class: 'feld-name' }, 'Name (optional)'), name),
      fehlerText,
      el('div', { class: 'leiste' },
        knopf('Abbrechen', () => schliesse(null)),
        knopf('Starten', () => {
          const m = Number(minuten.value.trim().replace(',', '.'));
          if (!(m >= 0.1 && m <= 1440)) { fehlerText.hidden = false; return; }
          schliesse({ minuten: m, name: name.value.trim() });
        }, 'haupt')));
    function schliesse(wert) { d.close(); d.remove(); fertig(wert); }
    d.addEventListener('cancel', (e) => { e.preventDefault(); schliesse(null); });
    document.body.append(d);
    d.showModal();
    minuten.focus();
  });
}

export default {
  start(bereich) {
    const liste = el('div', { class: 'timer-liste', 'aria-live': 'polite' });
    const warnung = el('p', { class: 'hinweis warnung', hidden: true },
      'Ton und Vibration sind in den Einstellungen aus – der Alarm ist dann nur zu sehen.');
    warnung.hidden = lies('ton') || lies('vibration');

    const vorgaben = el('div', { class: 'leiste' },
      VORGABEN.map((m) => knopf(`${m} min`, () => neuerTimer(m))));
    const frei = el('div', { class: 'leiste' },
      knopf('Eigene Zeit …', async () => {
        const e = await timerAbfragen();
        if (e) neuerTimer(e.minuten, e.name);
      }, 'haupt'));

    bereich.replaceChildren(el('div', { class: 'timer' },
      warnung, vorgaben, frei, liste,
      el('p', { class: 'hinweis' }, 'Der Alarm kommt nur, solange die App geöffnet ist. Der Bildschirm bleibt hier an.')));

    zeichnen = () => {
      const jetzt = Date.now();
      if (!timer.length) {
        liste.replaceChildren(el('p', { class: 'ergebnis-leer' }, 'Noch kein Timer. Oben eine Zeit wählen.'));
        return;
      }
      // Karten nur neu bauen, wenn sich die Liste geändert hat; sonst nur Zeiten setzen.
      const ids = timer.map((t) => `${t.id}${t.fertig}${t.ende === null}`).join(',');
      if (liste.dataset.ids !== ids) {
        liste.dataset.ids = ids;
        liste.replaceChildren(...timer.map((t) => {
          const pausiert = t.ende === null;
          return el('div', { class: `timer-karte${t.fertig ? ' fertig' : ''}`, 'data-id': t.id },
            el('p', { class: 'timer-name' }, t.name),
            el('p', { class: 'timer-zeit' }, ''),
            el('div', { class: 'timer-balken' }, el('div', {})),
            el('div', { class: 'leiste' },
              t.fertig ? null : knopf(pausiert ? 'Weiter' : 'Pause', () => {
                if (pausiert) { t.ende = Date.now() + t.pausiertRest; t.pausiertRest = null; }
                else { t.pausiertRest = restzeit(t.ende, Date.now()); t.ende = null; }
                pruefen();
              }),
              knopf(t.fertig ? 'Stopp' : 'Löschen', () => {
                timer.splice(timer.indexOf(t), 1);
                pruefen();
              }, t.fertig ? 'haupt' : '')));
        }));
      }
      for (const t of timer) {
        const karte = liste.querySelector(`[data-id="${t.id}"]`);
        const rest = t.ende === null ? t.pausiertRest : restzeit(t.ende, jetzt);
        karte.querySelector('.timer-zeit').textContent = t.fertig ? '⏰ Fertig' : `${uhrzeit(rest)}${t.ende === null ? ' ⏸' : ''}`;
        karte.querySelector('.timer-balken div').style.width = `${(100 * (1 - rest / t.dauer)).toFixed(1)}%`;
      }
    };
    pruefen();
    zeichnen();

    return () => { zeichnen = null; };
  }
};

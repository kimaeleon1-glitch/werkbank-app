// Navigation, Startraster, Thema, Service Worker.
//
// Jedes Modul exportiert default { start(bereich) → stopp }. Es wird erst
// beim Öffnen per import() geladen. Beim Verlassen ruft die App stopp() auf,
// das Modul gibt dann Sensoren, Kamera und Mikrofon frei.

import { lies, setze, beobachte } from './einstellungen.js';
import { bildschirmAn, bildschirmAus, tonVorbereiten } from './feedback.js';
import { el, fehler, meldung } from './ansicht.js';

const SYMBOLE = {
  wasserwaage: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4"><rect x="4" y="22" width="56" height="20" rx="4"/><rect x="22" y="26" width="20" height="12" rx="6"/><circle cx="32" cy="32" r="3" fill="currentColor"/></svg>',
  lot: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4"><path d="M20 6h24M32 6v30"/><path d="M24 38h16l-8 20z" fill="currentColor"/></svg>',
  kompass: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4"><circle cx="32" cy="32" r="26"/><path d="M32 12l7 20H25z" fill="currentColor"/><path d="M32 52l-7-20h14z"/></svg>',
  neigung: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4"><path d="M6 54h52L6 18z"/><path d="M38 54a18 18 0 0 0-5-12"/></svg>',
  winkel: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4"><path d="M6 56h24L6 32zM34 56h24V32z"/><path d="M28 20h10m-4-4 4 4-4 4"/></svg>',
  kamera: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4"><rect x="6" y="16" width="52" height="38" rx="6"/><path d="M22 16l4-7h12l4 7"/><path d="M2 35h60" stroke-dasharray="6 4"/></svg>',
  lineal: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4"><rect x="20" y="4" width="24" height="56" rx="3"/><path d="M20 14h10M20 24h6M20 34h10M20 44h6M20 54h10"/></svg>',
  rechner: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4"><rect x="12" y="4" width="40" height="56" rx="5"/><rect x="19" y="11" width="26" height="11"/><path d="M21 32h2M31 32h2M41 32h2M21 41h2M31 41h2M41 41h2M21 50h2M31 50h2M41 50h2" stroke-width="5"/></svg>',
  lampe: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4"><path d="M24 26h16l-3 32H27z"/><path d="M20 18h24v8H20z"/><path d="M32 4v6M18 8l4 5M46 8l-4 5"/></svg>',
  magnet: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4"><path d="M14 8v24a18 18 0 0 0 36 0V8H38v24a6 6 0 0 1-12 0V8z"/><path d="M14 18h12M38 18h12"/></svg>',
  schall: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4"><path d="M8 24h10l14-12v40L18 40H8z"/><path d="M42 22a14 14 0 0 1 0 20M48 14a24 24 0 0 1 0 36"/></svg>',
  vibration: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4"><rect x="22" y="10" width="20" height="44" rx="4"/><path d="M12 20l-6 6 6 6-6 6 6 6M52 20l6 6-6 6 6 6-6 6"/></svg>',
  hoehe: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4"><path d="M8 56h48M44 56V8"/><path d="M10 50L44 10M10 50l34 6" stroke-dasharray="5 4"/><circle cx="10" cy="50" r="3" fill="currentColor"/></svg>',
  lux: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4"><circle cx="32" cy="32" r="11"/><path d="M32 4v8M32 52v8M4 32h8M52 32h8M12 12l6 6M46 46l6 6M12 52l6-6M46 18l6-6"/></svg>',
  tabellen: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4"><rect x="8" y="8" width="48" height="48" rx="4"/><path d="M8 22h48M8 36h48M24 8v48"/></svg>',
  timer: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4"><circle cx="32" cy="36" r="22"/><path d="M32 36V22M26 6h12M32 6v8"/></svg>'
};

const MODULE = [
  { id: 'wasserwaage', titel: 'Wasserwaage', datei: './modules/level.js', messung: true },
  { id: 'lot', titel: 'Lot', datei: './modules/plumb.js', messung: true },
  { id: 'kompass', titel: 'Kompass', datei: './modules/compass.js', messung: true },
  { id: 'neigung', titel: 'Neigungsmesser', datei: './modules/incline.js', messung: true },
  { id: 'winkel', titel: 'Winkel übertragen', datei: './modules/transfer.js', messung: true },
  { id: 'kamera', titel: 'Kamera-Wasserwaage', datei: './modules/camlevel.js', messung: true },
  { id: 'lineal', titel: 'Lineal', datei: './modules/ruler.js', messung: true },
  { id: 'rechner', titel: 'Rechner', datei: './modules/calc.js', messung: false },
  { id: 'lampe', titel: 'Taschenlampe', datei: './modules/torch.js', messung: false },
  { id: 'timer', titel: 'Timer', datei: './modules/timer.js', messung: true },
  { id: 'magnet', titel: 'Magnetfeld', datei: './modules/magnet.js', messung: true, braucht: 'Magnetometer' },
  { id: 'schall', titel: 'Schallpegel', datei: './modules/sound.js', messung: true },
  { id: 'vibration', titel: 'Vibration', datei: './modules/vibration.js', messung: true },
  { id: 'hoehe', titel: 'Höhe schätzen', datei: './modules/height.js', messung: true },
  { id: 'lux', titel: 'Lux-Messer', datei: './modules/lux.js', messung: true, braucht: 'AmbientLightSensor' },
  { id: 'tabellen', titel: 'Tabellen', datei: './modules/tables.js', messung: false },
  { id: 'einstellungen', titel: 'Einstellungen', datei: './modules/settings.js', messung: false, versteckt: true }
];

const inhalt = document.getElementById('inhalt');
const titel = document.getElementById('titel');
const zurueck = document.getElementById('zurueck');
const einstellungenKnopf = document.getElementById('einstellungen');

let aktuellesStopp = null;
let vomStart = false; // wurde das Modul vom Startraster aus geöffnet?
let ladeNummer = 0;

// ------------------------------------------------------------ Thema

function themaAnwenden() {
  const thema = lies('thema');
  document.documentElement.dataset.thema = thema;
  document.querySelector('meta[name="theme-color"]').content = thema === 'hell' ? '#ffffff' : '#101214';
}

// ------------------------------------------------------------ Navigation

function verlasseModul() {
  if (aktuellesStopp) {
    try { aktuellesStopp(); } catch { /* Modul räumt so gut auf, wie es kann */ }
  }
  aktuellesStopp = null;
  bildschirmAus();
}

function zeigeStart() {
  titel.textContent = 'Werkbank';
  document.title = 'Werkbank';
  zurueck.hidden = true;
  einstellungenKnopf.hidden = false;
  // Werkzeuge, deren Sensor fehlt (Chrome-Flag aus), sind ausgegraut; ein Tipp zeigt die Anleitung.
  const kacheln = MODULE.filter((m) => !m.versteckt).map((m) => {
    const gesperrt = m.braucht && !(m.braucht in window);
    return el('button', {
      type: 'button',
      class: gesperrt ? 'kachel gesperrt' : 'kachel',
      onclick: () => { tonVorbereiten(); vomStart = true; location.hash = m.id; }
    }, el('span', { html: SYMBOLE[m.id] }), m.titel,
    gesperrt ? el('span', { class: 'kachel-hinweis' }, 'Chrome-Flag nötig') : null);
  });
  inhalt.replaceChildren(
    el('nav', { class: 'kacheln', 'aria-label': 'Werkzeuge' }, kacheln),
    el('p', { class: 'fusszeile' }, 'Alle Messwerte sind Richtwerte. Für sicherheitsrelevante Arbeiten Fachwerkzeug nutzen.')
  );
}

async function zeigeModul(modul) {
  const nummer = ++ladeNummer;
  titel.textContent = modul.titel;
  document.title = `${modul.titel} – Werkbank`;
  zurueck.hidden = false;
  einstellungenKnopf.hidden = true;
  const bereich = el('div', { class: 'modul' });
  bereich.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0';
  inhalt.replaceChildren(bereich);

  try {
    const { default: m } = await import(modul.datei);
    if (nummer !== ladeNummer) return; // inzwischen woanders hin navigiert
    if (modul.messung) bildschirmAn();
    aktuellesStopp = m.start(bereich) || null;
  } catch (e) {
    console.error(e);
    fehler(bereich, 'Das Werkzeug konnte nicht geladen werden. App einmal schließen und neu öffnen.');
  }
}

function navigiere() {
  verlasseModul();
  document.querySelectorAll('.meldung, dialog').forEach((e) => e.remove());
  const id = location.hash.slice(1);
  const modul = MODULE.find((m) => m.id === id);
  if (modul) zeigeModul(modul);
  else zeigeStart();
  inhalt.scrollTop = 0;
}

zurueck.addEventListener('click', () => {
  // Zurück über den Verlauf, damit auch die Zurück-Geste von Android passt.
  if (vomStart) history.back();
  else location.replace('#');
  vomStart = false;
});

einstellungenKnopf.addEventListener('click', () => {
  vomStart = true;
  location.hash = 'einstellungen';
});

window.addEventListener('hashchange', navigiere);

// Ton freischalten, sobald irgendwo getippt wird.
document.addEventListener('pointerdown', tonVorbereiten, { passive: true });

beobachte((name) => { if (name === 'thema') themaAnwenden(); });

// ------------------------------------------------------------ Offline und Updates

// Fragt den aktiven Service Worker nach seiner Version.
export function versionAbfragen() {
  return new Promise((fertig) => {
    const sw = navigator.serviceWorker?.controller;
    if (!sw) return fertig(null);
    const kanal = new MessageChannel();
    kanal.port1.onmessage = (ev) => fertig(ev.data?.version ?? null);
    sw.postMessage({ typ: 'version' }, [kanal.port2]);
    setTimeout(() => fertig(null), 1000);
  });
}

async function versionPruefen() {
  const version = await versionAbfragen();
  if (!version) return;
  const bisher = lies('letzteVersion');
  if (bisher && bisher !== version) meldung(`Neue Version aktiv: ${version}`, 6000);
  if (bisher !== version) setze('letzteVersion', version);
}

async function offlineEinrichten() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) versionPruefen();
    else navigator.serviceWorker.addEventListener('controllerchange', versionPruefen, { once: true });
  } catch (e) {
    console.warn('Service Worker nicht registriert:', e);
  }
  // Offline-Speicher vor dem automatischen Löschen schützen.
  try { await navigator.storage?.persist?.(); } catch { /* nicht kritisch */ }
}

// ------------------------------------------------------------ Start

themaAnwenden();
try { screen.orientation?.lock?.('portrait').catch(() => {}); } catch { /* nur installiert möglich */ }
navigiere();
offlineEinrichten();

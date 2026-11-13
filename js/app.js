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
  neigung: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4"><path d="M6 54h52L6 18z"/><path d="M38 54a18 18 0 0 0-5-12"/></svg>'
};

const MODULE = [
  { id: 'wasserwaage', titel: 'Wasserwaage', datei: './modules/level.js', messung: true },
  { id: 'lot', titel: 'Lot', datei: './modules/plumb.js', messung: true },
  { id: 'kompass', titel: 'Kompass', datei: './modules/compass.js', messung: true },
  { id: 'neigung', titel: 'Neigungsmesser', datei: './modules/incline.js', messung: true },
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
  const kacheln = MODULE.filter((m) => !m.versteckt).map((m) =>
    el('button', {
      type: 'button',
      class: 'kachel',
      onclick: () => { tonVorbereiten(); vomStart = true; location.hash = m.id; }
    }, el('span', { html: SYMBOLE[m.id] }), m.titel));
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

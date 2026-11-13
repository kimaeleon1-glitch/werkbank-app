// Rückmeldung: Ton, Vibration und Bildschirm anlassen (Wake Lock).

import { lies } from './einstellungen.js';

// ------------------------------------------------------------ Ton

let audio = null;

// Muss bei einer Berührung aufgerufen werden, sonst bleibt der Ton stumm.
export function tonVorbereiten() {
  try {
    audio = audio || new AudioContext();
    if (audio.state === 'suspended') audio.resume();
  } catch {
    audio = null;
  }
}

export function piepsen(frequenz = 880, dauer = 0.12) {
  if (!lies('ton') || !audio || audio.state !== 'running') return;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.frequency.value = frequenz;
  g.gain.setValueAtTime(0.25, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dauer);
  o.connect(g).connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + dauer);
}

export function vibrieren(muster = 40) {
  if (lies('vibration') && navigator.vibrate) navigator.vibrate(muster);
}

// Ton und Vibration beim Eintritt in die Toleranz.
export function treffer() {
  piepsen();
  vibrieren();
}

// ------------------------------------------------------------ Wake Lock

let sperre = null;
let gewuenscht = false;

async function anfordern() {
  if (!gewuenscht || sperre || !('wakeLock' in navigator)) return;
  try {
    sperre = await navigator.wakeLock.request('screen');
    sperre.addEventListener('release', () => { sperre = null; });
  } catch {
    // nicht kritisch: dann geht der Bildschirm eben aus
  }
}

export function bildschirmAn() {
  gewuenscht = true;
  anfordern();
}

export function bildschirmAus() {
  gewuenscht = false;
  if (sperre) sperre.release();
  sperre = null;
}

// Chrome gibt den Wake Lock frei, wenn die App in den Hintergrund geht.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') anfordern();
});

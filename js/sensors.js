// Sensor-Dienst: die einzige Stelle, die Sensoren des Browsers anspricht.
// Jede start…-Funktion liefert eine Stopp-Funktion. Fehler kommen als
// deutscher Text über beiFehler, nie als Ausnahme.

import { vektorMittel, quaternionZuMatrix, eulerZuMatrix, schwerkraftAusMatrix } from './mathe.js';

const WARTEZEIT_MS = 1500; // so lange wartet jede Quelle auf ihren ersten Messwert

const NICHT_ERLAUBT = 'ist nicht erlaubt. In Chrome: Schloss-Symbol neben der Adresse → Website-Einstellungen → Bewegungssensoren erlauben.';

// Eine Quelle ist eine Funktion (melde, scheitere) → stopp | null.
// null heißt: gibt es hier nicht. scheitere(name) meldet einen Fehler zur Laufzeit.

// Quelle aus einem Generic-Sensor (GravitySensor, Accelerometer …).
function generisch(klassenName, optionen, lesen) {
  return (melde, scheitere) => {
    if (!(klassenName in window)) return null;
    let sensor;
    try {
      sensor = new window[klassenName](optionen);
    } catch (e) {
      return null;
    }
    sensor.addEventListener('reading', () => melde(lesen(sensor)));
    sensor.addEventListener('error', (ev) => scheitere(ev.error?.name));
    sensor.start();
    return () => sensor.stop();
  };
}

// Quelle aus einem Fenster-Ereignis (devicemotion, deviceorientationabsolute).
function ereignis(name, lesen) {
  return (melde) => {
    if (!(`on${name}` in window)) return null;
    const h = (ev) => {
      const wert = lesen(ev);
      if (wert) melde(wert);
    };
    window.addEventListener(name, h);
    return () => window.removeEventListener(name, h);
  };
}

// Probiert die Quellen der Reihe nach. Eine Quelle, die scheitert oder
// innerhalb der Wartezeit nichts liefert, wird durch die nächste ersetzt.
// Fehlt die Berechtigung, wird sofort abgebrochen.
function kette(quellen, beiWert, beiFehler, sensorName) {
  let i = -1;
  let stopp = null;
  let uhr = null;
  let aus = false;

  const beende = () => {
    clearTimeout(uhr);
    if (stopp) stopp();
    stopp = null;
  };

  const naechste = () => {
    beende();
    if (aus) return;
    for (i += 1; i < quellen.length; i += 1) {
      const nr = i;
      let kam = false;
      const melde = (wert) => {
        if (aus || nr !== i) return;
        kam = true;
        beiWert(wert);
      };
      const scheitere = (fehlerName) => {
        if (aus || nr !== i) return;
        if (fehlerName === 'NotAllowedError' || fehlerName === 'SecurityError') {
          beende();
          aus = true;
          beiFehler(`${sensorName} ${NICHT_ERLAUBT}`);
        } else {
          naechste();
        }
      };
      stopp = quellen[nr](melde, scheitere);
      if (stopp) {
        uhr = setTimeout(() => { if (!kam && nr === i) naechste(); }, WARTEZEIT_MS);
        return;
      }
    }
    aus = true;
    beiFehler(`${sensorName} nicht verfügbar.`);
  };

  naechste();
  return () => { aus = true; beende(); };
}

// ------------------------------------------------------------ Schwerkraft

// Liefert den geglätteten Schwerkraftvektor {x, y, z} in m/s² (zeigt nach oben).
//
// Chrome rundet Beschleunigungswerte auf 0,1 m/s², das sind rund 0,6° –
// zu grob für ±0,3°. Lagewinkel rundet Chrome nur auf 0,1°. Deshalb kommt
// die Schwerkraftrichtung zuerst aus dem Lagesensor (Beschleunigung und
// Gyroskop verrechnet, ohne Magnetfeld), der Beschleunigungssensor ist nur Ersatz.
// Reihenfolge: RelativeOrientationSensor → deviceorientation → GravitySensor
// → Accelerometer → devicemotion.
export function starteSchwerkraft(beiWert, beiFehler, { frequenz = 60, fenster = 12 } = {}) {
  // Accelerometer und devicemotion enthalten auch Bewegung: stärker glätten.
  const xyz = (s, grob) => ({ x: s.x, y: s.y, z: s.z, grob });
  const ausLage = (matrix) => ({ ...schwerkraftAusMatrix(matrix), grob: false });
  const fein = vektorMittel(fenster);
  const grob = vektorMittel(fenster * 2);
  const takt = 1000 / frequenz;
  let letzter = null;
  let zeit = 0;
  const verarbeite = () => beiWert((letzter.grob ? grob : fein)(letzter));

  // Chrome meldet nur geänderte Werte. Liegt das Handy still, kommt nichts
  // Neues – dann den letzten Wert im Takt weiter einspeisen, damit der
  // Mittelwert auf ihm ankommt und nicht auf einem Mischwert stehen bleibt.
  const halten = setInterval(() => {
    if (letzter && performance.now() - zeit > 1.5 * takt) verarbeite();
  }, takt);

  const stopp = kette(
    [
      generisch('RelativeOrientationSensor', { frequency: frequenz, referenceFrame: 'device' },
        (s) => ausLage(quaternionZuMatrix(s.quaternion))),
      ereignis('deviceorientation', (ev) =>
        ev.beta === null ? null : ausLage(eulerZuMatrix(ev.alpha ?? 0, ev.beta, ev.gamma))),
      generisch('GravitySensor', { frequency: frequenz }, (s) => xyz(s, false)),
      generisch('Accelerometer', { frequency: frequenz }, (s) => xyz(s, true)),
      ereignis('devicemotion', (ev) => {
        const a = ev.accelerationIncludingGravity;
        return a && a.x !== null ? xyz(a, true) : null;
      })
    ],
    (v) => { letzter = v; zeit = performance.now(); verarbeite(); },
    (text) => { clearInterval(halten); beiFehler(text); },
    'Beschleunigungssensor'
  );
  return () => { clearInterval(halten); stopp(); };
}

// ------------------------------------------------------------ Orientierung

// Liefert { matrix } mit der Rotationsmatrix Gerät → Welt (x Ost, y Nord, z oben).
// Reihenfolge: AbsoluteOrientationSensor → deviceorientationabsolute.
export function starteOrientierung(beiWert, beiFehler, { frequenz = 30 } = {}) {
  // Letzten Wert im Takt wiederholen, damit die Glättung im Modul ankommt
  // (siehe starteSchwerkraft).
  const takt = 1000 / frequenz;
  let letzter = null;
  let zeit = 0;
  const halten = setInterval(() => {
    if (letzter && performance.now() - zeit > 1.5 * takt) beiWert(letzter);
  }, takt);
  const stopp = kette(
    [
      generisch('AbsoluteOrientationSensor', { frequency: frequenz, referenceFrame: 'device' },
        (s) => ({ matrix: quaternionZuMatrix(s.quaternion) })),
      ereignis('deviceorientationabsolute', (ev) =>
        ev.alpha === null ? null : { matrix: eulerZuMatrix(ev.alpha, ev.beta, ev.gamma) })
    ],
    (v) => { letzter = v; zeit = performance.now(); beiWert(v); },
    (text) => { clearInterval(halten); beiFehler(text); },
    'Kompass'
  );
  return () => { clearInterval(halten); stopp(); };
}

// ------------------------------------------------------------ Magnetfeld

export const magnetfeldVerfuegbar = () => 'Magnetometer' in window;

// Liefert die Feldstärke in µT. Nur mit dem Chrome-Flag
// „Generic Sensor Extra Classes"; ohne Flag meldet beiFehler, kein Absturz.
export function starteMagnetfeld(beiWert, beiFehler, { frequenz = 10 } = {}) {
  return kette(
    [generisch('Magnetometer', { frequency: frequenz }, (s) => Math.hypot(s.x, s.y, s.z))],
    beiWert,
    beiFehler,
    'Magnetfeldsensor'
  );
}

// ------------------------------------------------------------ Kamera

const KAMERA_VERWEIGERT = 'Kamera ist nicht erlaubt. In Chrome: Schloss-Symbol neben der Adresse → Berechtigungen → Kamera → Zulassen. Danach das Werkzeug neu öffnen.';

function kameraFehler(e) {
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') return KAMERA_VERWEIGERT;
  if (e?.name === 'NotReadableError') return 'Die Kamera wird gerade von einer anderen App benutzt.';
  return 'Keine Kamera verfügbar.';
}

// Öffnet die Rückkamera. Liefert { strom, stopp } oder wirft einen deutschen Text.
// Das Bild wird nur angezeigt, nie gespeichert.
export async function starteKamera() {
  if (!navigator.mediaDevices?.getUserMedia) throw 'Keine Kamera verfügbar.';
  try {
    const strom = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    return { strom, stopp: () => strom.getTracks().forEach((t) => t.stop()) };
  } catch (e) {
    throw kameraFehler(e);
  }
}

// ------------------------------------------------------------ Taschenlampe

const kannLeuchten = (spur) => {
  try { return Boolean(spur.getCapabilities?.().torch); } catch { return false; }
};

// Sucht eine Rückkamera mit Blitz und schaltet ihn ein.
// Liefert eine Ausschalt-Funktion oder wirft einen deutschen Text.
// Das Pixel hat mehrere Rückkameras; nicht jede hat den Blitz.
export async function starteLampe() {
  if (!navigator.mediaDevices?.getUserMedia) throw 'Keine Kamera verfügbar, daher keine Taschenlampe.';
  let strom;
  try {
    strom = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  } catch (e) {
    throw kameraFehler(e);
  }
  let spur = strom.getVideoTracks()[0];

  if (!kannLeuchten(spur)) {
    const genutzt = spur.getSettings().deviceId;
    strom.getTracks().forEach((t) => t.stop());
    strom = null;
    const geraete = (await navigator.mediaDevices.enumerateDevices())
      .filter((g) => g.kind === 'videoinput' && g.deviceId !== genutzt);
    for (const g of geraete) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: g.deviceId } }, audio: false });
        if (kannLeuchten(s.getVideoTracks()[0])) { strom = s; spur = s.getVideoTracks()[0]; break; }
        s.getTracks().forEach((t) => t.stop());
      } catch { /* nächste Kamera probieren */ }
    }
    if (!strom) throw 'Dieses Handy erlaubt die Taschenlampe im Browser nicht.';
  }

  try {
    await spur.applyConstraints({ advanced: [{ torch: true }] });
  } catch {
    strom.getTracks().forEach((t) => t.stop());
    throw 'Die Taschenlampe ließ sich nicht einschalten.';
  }
  return () => strom.getTracks().forEach((t) => t.stop());
}

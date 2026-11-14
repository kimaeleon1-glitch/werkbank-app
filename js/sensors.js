// Sensor-Dienst: die einzige Stelle, die Sensoren des Browsers anspricht.
// Jede start…-Funktion liefert eine Stopp-Funktion. Fehler kommen als
// deutscher Text: bei Sensoren über beiFehler, bei Kamera, Lampe und
// Mikrofon (async) als geworfener Text. Nie als unbehandelte Ausnahme.

import { vektorMittel, quaternionZuMatrix, eulerZuMatrix, schwerkraftAusMatrix } from './mathe.js';
import { rmsDbfs } from './rechnen.js';

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

// Magnetometer und Lichtsensor gibt Chrome derzeit nicht frei. Das Flag
// „Generic Sensor Extra Classes" wurde in Chrome 138 entfernt. Mit
// „Experimental Web Platform features" gibt es die Schnittstellen zwar,
// sie liefern aber keine Werte („Could not connect to a sensor").
// Deshalb wird echt geprüft, ob ein Messwert kommt – nicht nur, ob es die
// Schnittstelle gibt. Gibt Chrome die Sensoren wieder frei, gehen F11/F15
// von selbst wieder.
const geprueft = new Map();

export function sensorLiefert(klassenName) {
  if (!(klassenName in window)) return Promise.resolve(false);
  if (!geprueft.has(klassenName)) {
    geprueft.set(klassenName, new Promise((fertig) => {
      let s;
      const ende = (ok) => { try { s?.stop(); } catch { /* egal */ } fertig(ok); };
      try {
        s = new window[klassenName]({ frequency: 5 });
        s.addEventListener('reading', () => ende(true), { once: true });
        s.addEventListener('error', () => ende(false), { once: true });
        s.start();
        setTimeout(() => ende(false), WARTEZEIT_MS);
      } catch {
        ende(false);
      }
    }).then((ok) => {
      // Ein Fehlschlag wird nicht gemerkt: beim nächsten Öffnen neu prüfen.
      if (!ok) geprueft.delete(klassenName);
      return ok;
    }));
  }
  return geprueft.get(klassenName);
}

export const magnetfeldVerfuegbar = () => sensorLiefert('Magnetometer');
export const lichtVerfuegbar = () => sensorLiefert('AmbientLightSensor');

// Wiederholt den letzten Wert im Takt, solange Chrome nichts Neues meldet
// (Chrome meldet nur geänderte Werte, siehe starteSchwerkraft).
function halteglied(frequenz, weiter) {
  const takt = 1000 / frequenz;
  let letzter = null;
  let zeit = 0;
  const uhr = setInterval(() => {
    if (letzter !== null && performance.now() - zeit > 1.5 * takt) weiter(letzter);
  }, takt);
  return {
    melde(v) { letzter = v; zeit = performance.now(); weiter(v); },
    stopp() { clearInterval(uhr); }
  };
}

// Liefert das Magnetfeld als Vektor {x, y, z} in µT.
export function starteMagnetfeld(beiWert, beiFehler, { frequenz = 10 } = {}) {
  const h = halteglied(frequenz, beiWert);
  const stopp = kette(
    [generisch('Magnetometer', { frequency: frequenz }, (s) => ({ x: s.x, y: s.y, z: s.z }))],
    h.melde,
    (text) => { h.stopp(); beiFehler(text); },
    'Magnetfeldsensor'
  );
  return () => { h.stopp(); stopp(); };
}

// Liefert die Beleuchtungsstärke in Lux. Chrome rundet auf 50 lx.
export function starteLicht(beiWert, beiFehler, { frequenz = 5 } = {}) {
  const h = halteglied(frequenz, beiWert);
  const stopp = kette(
    [generisch('AmbientLightSensor', { frequency: frequenz }, (s) => s.illuminance)],
    h.melde,
    (text) => { h.stopp(); beiFehler(text); },
    'Lichtsensor'
  );
  return () => { h.stopp(); stopp(); };
}

// ------------------------------------------------------------ Bewegung (Vibration)

// Liefert die Beschleunigung ohne Schwerkraft {x, y, z} in m/s² mit Zeitstempel.
// Reihenfolge: LinearAccelerationSensor → Accelerometer mit Hochpass → devicemotion.
export function starteBewegung(beiWert, beiFehler, { frequenz = 60 } = {}) {
  // Hochpass: Schwerkraft als langsamer Mittelwert abziehen.
  const hochpass = () => {
    let tief = null;
    return (v) => {
      tief = tief ? { x: tief.x + 0.05 * (v.x - tief.x), y: tief.y + 0.05 * (v.y - tief.y), z: tief.z + 0.05 * (v.z - tief.z) } : { ...v };
      return { x: v.x - tief.x, y: v.y - tief.y, z: v.z - tief.z };
    };
  };
  const hpSensor = hochpass();
  const hpEreignis = hochpass();
  const xyz = (s) => ({ x: s.x, y: s.y, z: s.z });
  const h = halteglied(frequenz, (v) => beiWert(v.filter ? v.filter(v) : v, performance.now()));
  const stopp = kette(
    [
      generisch('LinearAccelerationSensor', { frequency: frequenz }, xyz),
      generisch('Accelerometer', { frequency: frequenz }, (s) => ({ ...xyz(s), filter: hpSensor })),
      ereignis('devicemotion', (ev) => {
        if (ev.acceleration && ev.acceleration.x !== null) return xyz(ev.acceleration);
        const a = ev.accelerationIncludingGravity;
        return a && a.x !== null ? { ...xyz(a), filter: hpEreignis } : null;
      })
    ],
    h.melde,
    (text) => { h.stopp(); beiFehler(text); },
    'Beschleunigungssensor'
  );
  return () => { h.stopp(); stopp(); };
}

// ------------------------------------------------------------ Mikrofon

const MIKROFON_VERWEIGERT = 'Mikrofon ist nicht erlaubt. In Chrome: Schloss-Symbol neben der Adresse → Berechtigungen → Mikrofon → Zulassen. Danach das Werkzeug neu öffnen.';

// Meldet laufend den Pegel in dBFS (0 = Vollaussteuerung) und die Zeit seit
// dem letzten Wert. Es wird nichts aufgenommen oder gespeichert.
// Liefert eine Stopp-Funktion oder wirft einen deutschen Text.
export async function starteSchallpegel(beiPegel) {
  if (!navigator.mediaDevices?.getUserMedia) throw 'Kein Mikrofon verfügbar.';
  let strom;
  try {
    // Ohne diese Abschaltungen verfälscht die Sprachaufbereitung den Pegel.
    strom = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false
    });
  } catch (e) {
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') throw MIKROFON_VERWEIGERT;
    if (e?.name === 'NotReadableError') throw 'Das Mikrofon wird gerade von einer anderen App benutzt.';
    throw 'Kein Mikrofon verfügbar.';
  }
  const ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const analyse = ctx.createAnalyser();
  analyse.fftSize = 2048;
  ctx.createMediaStreamSource(strom).connect(analyse);
  const puffer = new Float32Array(analyse.fftSize);

  let zuletzt = performance.now();
  // Takt per setInterval statt requestAnimationFrame: läuft gleichmäßig und
  // lässt sich sicher stoppen (Codeskizze 20.7 hörte nie auf).
  const uhr = setInterval(() => {
    analyse.getFloatTimeDomainData(puffer);
    const jetzt = performance.now();
    beiPegel(rmsDbfs(puffer), jetzt - zuletzt);
    zuletzt = jetzt;
  }, 50);

  return () => {
    clearInterval(uhr);
    strom.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
  };
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

// ------------------------------------------------------------ Standort

// Standort über GPS (läuft auch ohne Netz, der erste Fix dauert dann länger).
// beiPosition({ breite, laenge, genauigkeit }), Genauigkeit in m.
// Liefert eine Stopp-Funktion.
// Der Standort wird nur angezeigt, nie gespeichert oder verschickt.
export function starteStandort(beiPosition, beiFehler) {
  if (!navigator.geolocation) {
    beiFehler('Dieses Gerät liefert keinen Standort.');
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    ({ coords: c }) => beiPosition({
      breite: c.latitude, laenge: c.longitude, genauigkeit: c.accuracy
    }),
    (e) => beiFehler(e.code === 1
      ? 'Standort nicht erlaubt. Erlauben über die Website-Einstellungen von Chrome (Schloss-Symbol neben der Adresse) bzw. in den App-Infos von Werkbank.'
      : 'Kein Standort. Ist der Standort im Handy eingeschaltet? Im Freien klappt es am besten.'),
    { enableHighAccuracy: true, maximumAge: 0 }
  );
  return () => navigator.geolocation.clearWatch(id);
}

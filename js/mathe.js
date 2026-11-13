// Reine Rechenfunktionen ohne Browser-Bezug. Getestet mit `node --test`.
//
// Achsen wie in der Generic Sensor API: x nach rechts, y zur Oberkante des
// Handys, z aus dem Display heraus. Der Schwerkraftvektor g zeigt nach oben:
// Liegt das Handy flach mit dem Display nach oben, ist g ≈ (0, 0, +9,81).

export const GRAD = 180 / Math.PI;
export const rad = (grad) => grad / GRAD;

// Winkel auf den Bereich (-180, 180] bringen.
export function normiere180(w) {
  let r = ((w + 180) % 360 + 360) % 360 - 180;
  return r === -180 ? 180 : r;
}

// Winkel auf den Bereich [0, 360) bringen.
export function normiere360(w) {
  return ((w % 360) + 360) % 360;
}

// ---------------------------------------------------------------- Neigung

// Lage aus der Schwerkraft: 'flach' (Display oben oder unten) oder 'kante'.
// Mit Hysterese, damit die Anzeige an der Grenze nicht hin und her springt.
export function bestimmeLage(g, bisher = null) {
  const betrag = Math.hypot(g.x, g.y, g.z) || 1;
  const anteilZ = Math.abs(g.z) / betrag;
  if (bisher === 'flach') return anteilZ > 0.5 ? 'flach' : 'kante';
  if (bisher === 'kante') return anteilZ > 0.8 ? 'flach' : 'kante';
  return anteilZ > 0.65 ? 'flach' : 'kante';
}

// Display-Lage: Neigung um beide Achsen in Grad.
// x > 0: rechte Seite liegt höher. y > 0: Oberkante liegt höher.
export function neigungFlach(g) {
  return {
    x: Math.atan2(g.x, g.z) * GRAD,
    y: Math.atan2(g.y, g.z) * GRAD
  };
}

// Kantenlage: Winkel der Schwerkraft in der Display-Ebene.
// Liefert das Viertel q (0: steht auf der Unterkante, 1: auf der linken
// Kante, 2: auf dem Kopf, 3: auf der rechten Kante) und die Abweichung in
// Grad. Abweichung > 0 heißt: Aus Sicht des Betrachters liegt rechts höher.
export function neigungKante(g) {
  const phi = Math.atan2(g.x, g.y) * GRAD; // 0 bei aufrechtem Handy
  const q = normiere360(Math.round(phi / 90)) % 4;
  return { q, abweichung: normiere180(phi - q * 90) };
}

// Lot: Abweichung der Längsachse (y) von der Senkrechten.
// seitlich > 0: Oberkante nach rechts gekippt. vorn > 0: Oberkante zum
// Betrachter gekippt. gesamt ist der Winkel zwischen Längsachse und Lot.
export function lotAbweichung(g) {
  return {
    seitlich: Math.atan2(-g.x, g.y) * GRAD,
    vorn: Math.atan2(-g.z, g.y) * GRAD,
    gesamt: Math.atan2(Math.hypot(g.x, g.z), g.y) * GRAD
  };
}

// Neigungsmesser: Steigung der Längsachse (y) gegen die Waagerechte.
// > 0: Oberkante liegt höher. Funktioniert flach liegend und auf der langen Kante.
export function laengsneigung(g) {
  return Math.atan2(g.y, Math.hypot(g.x, g.z)) * GRAD;
}

// ---------------------------------------------------------------- Einheiten

export const tanProzent = (grad) => Math.tan(rad(grad)) * 100;
export const tanMmProM = (grad) => Math.tan(rad(grad)) * 1000;

// Zahl im deutschen Format, ohne „-0,0".
export function zahl(wert, stellen = 1) {
  const gerundet = Number(wert.toFixed(stellen));
  const ohneMinusNull = Object.is(gerundet, -0) || gerundet === 0 ? 0 : gerundet;
  return ohneMinusNull.toLocaleString('de-DE', {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen
  });
}

export const WINKEL_EINHEITEN = ['grad', 'prozent', 'mmm'];
export const WINKEL_NAMEN = { grad: 'Grad', prozent: 'Prozent', mmm: 'mm pro m' };

// Winkel in Grad in der gewählten Einheit, als Zahl und Einheit getrennt.
export function winkelText(grad, einheit) {
  if (einheit === 'prozent') return { wert: zahl(Math.abs(tanProzent(grad)), 1), einheit: '%' };
  if (einheit === 'mmm') return { wert: zahl(Math.abs(tanMmProM(grad)), 0), einheit: 'mm/m' };
  return { wert: zahl(Math.abs(grad), 1), einheit: '°' };
}

export const LAENGEN_EINHEITEN = ['mm', 'cm', 'm', 'zoll'];
const MM_JE = { mm: 1, cm: 10, m: 1000, zoll: 25.4 };
const LAENGEN_STELLEN = { mm: 0, cm: 1, m: 3, zoll: 2 };
const LAENGEN_ZEICHEN = { mm: 'mm', cm: 'cm', m: 'm', zoll: 'in' };

export const vonMm = (mm, einheit) => mm / MM_JE[einheit];
export const inMm = (wert, einheit) => wert * MM_JE[einheit];

export function laengeText(mm, einheit) {
  return { wert: zahl(vonMm(mm, einheit), LAENGEN_STELLEN[einheit]), einheit: LAENGEN_ZEICHEN[einheit] };
}

// Höhendifferenz in mm auf einer Länge in mm bei gegebener Neigung.
export const hoehendifferenz = (laengeMm, grad) => laengeMm * Math.tan(rad(grad));

// ---------------------------------------------------------------- Toleranz

// Zustand „in Toleranz" mit Hysterese: Eintritt unter `ein`, Austritt erst
// über `aus`. Liefert { drin, eingetreten }.
export function toleranz(ein, aus) {
  let drin = false;
  return (abweichung) => {
    const a = Math.abs(abweichung);
    const vorher = drin;
    drin = drin ? a <= aus : a < ein;
    return { drin, eingetreten: drin && !vorher };
  };
}

// ---------------------------------------------------------------- Kompass

// Rotationsmatrix (Gerät → Welt, Welt: x Ost, y Nord, z oben) aus einer
// Quaternion [x, y, z, w] wie vom AbsoluteOrientationSensor.
export function quaternionZuMatrix([x, y, z, w]) {
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]
  ];
}

// Rotationsmatrix aus den Winkeln des deviceorientation-Ereignisses
// (alpha um z, beta um x, gamma um y; Reihenfolge Z-X'-Y'').
export function eulerZuMatrix(alpha, beta, gamma) {
  const [ca, sa] = [Math.cos(rad(alpha)), Math.sin(rad(alpha))];
  const [cb, sb] = [Math.cos(rad(beta)), Math.sin(rad(beta))];
  const [cg, sg] = [Math.cos(rad(gamma)), Math.sin(rad(gamma))];
  return [
    [ca * cg - sa * sb * sg, -sa * cb, ca * sg + sa * sb * cg],
    [sa * cg + ca * sb * sg, ca * cb, sa * sg - ca * sb * cg],
    [-cb * sg, sb, cb * cg]
  ];
}

// Schwerkraftvektor (zeigt nach oben, in m/s²) im Gerätesystem aus einer
// Rotationsmatrix Gerät → Welt: die Welt-Hochachse, ausgedrückt im Gerät.
export function schwerkraftAusMatrix(m, g = 9.80665) {
  return { x: m[2][0] * g, y: m[2][1] * g, z: m[2][2] * g };
}

// Kurs in Grad (0 = Nord, 90 = Ost). Liegt das Handy eher flach, zählt die
// Richtung der Oberkante; steht es aufrecht, die Blickrichtung der Kamera.
export function kursAusMatrix(m) {
  const oberkante = [m[0][1], m[1][1], m[2][1]];
  const kamera = [-m[0][2], -m[1][2], -m[2][2]];
  const achse = Math.abs(oberkante[2]) < 0.75 ? oberkante : kamera;
  return normiere360(Math.atan2(achse[0], achse[1]) * GRAD);
}

const RICHTUNGEN = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
export const himmelsrichtung = (kurs) => RICHTUNGEN[Math.round(normiere360(kurs) / 45) % 8];

// Glättung für Winkel über die 0°/360°-Grenze hinweg.
export function kreisGlaettung(faktor) {
  let s = null;
  let c = null;
  return (grad) => {
    const [sn, cn] = [Math.sin(rad(grad)), Math.cos(rad(grad))];
    if (s === null) [s, c] = [sn, cn];
    else [s, c] = [s + faktor * (sn - s), c + faktor * (cn - c)];
    return normiere360(Math.atan2(s, c) * GRAD);
  };
}

// Gleitender Mittelwert über die letzten n Vektoren.
export function vektorMittel(n) {
  const fenster = [];
  return (v) => {
    fenster.push(v);
    if (fenster.length > n) fenster.shift();
    const k = fenster.length;
    return fenster.reduce(
      (a, w) => ({ x: a.x + w.x / k, y: a.y + w.y / k, z: a.z + w.z / k }),
      { x: 0, y: 0, z: 0 }
    );
  };
}

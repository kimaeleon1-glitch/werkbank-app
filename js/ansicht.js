// Gemeinsame Bausteine der Oberfläche.

// Element erzeugen: el('div', { class: 'x', onclick: f }, 'Text', kind)
export function el(tag, attribute = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attribute)) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kinder.flat()) {
    if (k !== null && k !== undefined && k !== false) e.append(k);
  }
  return e;
}

export function knopf(text, beiTipp, klasse = '') {
  return el('button', { type: 'button', class: `knopf ${klasse}`.trim(), onclick: beiTipp }, text);
}

// Fehlerhinweis anstelle der Messanzeige.
export function fehler(bereich, text) {
  bereich.replaceChildren(
    el('div', { class: 'fehler', role: 'alert' },
      el('p', { class: 'fehler-titel' }, '⚠ Messung nicht möglich'),
      el('p', {}, text))
  );
}

// Kurze Meldung am unteren Rand.
export function meldung(text, dauerMs = 4000) {
  const m = el('div', { class: 'meldung', role: 'status' }, text);
  document.body.append(m);
  setTimeout(() => m.remove(), dauerMs);
}

// Dialog mit großen Tasten. Liefert true bei „Ja".
export function frage(titel, text, jaText = 'Ja', neinText = 'Abbrechen') {
  return new Promise((fertig) => {
    const d = el('dialog', { class: 'dialog' },
      el('h2', {}, titel),
      el('p', {}, text),
      el('div', { class: 'leiste' },
        knopf(neinText, () => schliesse(false)),
        knopf(jaText, () => schliesse(true), 'haupt')));
    function schliesse(antwort) {
      d.close();
      d.remove();
      fertig(antwort);
    }
    d.addEventListener('cancel', (e) => { e.preventDefault(); schliesse(false); });
    document.body.append(d);
    d.showModal();
  });
}

// Dialog mit Zahleneingabe. Liefert die Zahl oder null.
export function zahlAbfragen(titel, text, startwert, einheit) {
  return new Promise((fertig) => {
    const eingabe = el('input', {
      type: 'text', inputmode: 'decimal', class: 'eingabe',
      value: String(startwert).replace('.', ',')
    });
    const d = el('dialog', { class: 'dialog' },
      el('h2', {}, titel),
      el('p', {}, text),
      el('label', { class: 'eingabe-zeile' }, eingabe, el('span', {}, einheit)),
      el('div', { class: 'leiste' },
        knopf('Abbrechen', () => schliesse(null)),
        knopf('Übernehmen', () => schliesse(eingabe.value), 'haupt')));
    function schliesse(roh) {
      d.close();
      d.remove();
      if (roh === null) return fertig(null);
      const zahl = Number(String(roh).trim().replace(',', '.'));
      fertig(Number.isFinite(zahl) ? zahl : null);
    }
    d.addEventListener('cancel', (e) => { e.preventDefault(); schliesse(null); });
    document.body.append(d);
    d.showModal();
    eingabe.select();
  });
}

// Messansicht: Grafik, großer Wert, Statuszeile, Zusatzzeile, Tastenleiste.
// Der Block .drehbar lässt sich in Kantenlage um 90° drehen.
export function messansicht(bereich) {
  const grafik = el('div', { class: 'grafik', 'aria-hidden': 'true' });
  const wert = el('span', { class: 'wert-zahl' }, '–');
  const einheit = el('span', { class: 'wert-einheit' }, '');
  const status = el('p', { class: 'status', 'aria-live': 'polite' }, '');
  const zusatz = el('p', { class: 'zusatz' }, '');
  const gehalten = el('p', { class: 'gehalten', hidden: true }, '⏸ Gehalten');
  const drehbar = el('div', { class: 'drehbar' },
    grafik, el('p', { class: 'wert' }, wert, einheit), status, zusatz, gehalten);
  const leiste = el('div', { class: 'leiste' });
  const ansicht = el('div', { class: 'mess' }, el('div', { class: 'anzeige' }, drehbar), leiste);
  bereich.replaceChildren(ansicht);

  let letzteDrehung = -1;
  let letzterStatus = '';
  return {
    ansicht, grafik, leiste,
    setzeWert(w, e) {
      wert.textContent = w;
      einheit.textContent = e;
      einheit.classList.toggle('grad', e === '°');
    },
    setzeStatus(text) {
      // nur bei Änderung schreiben, sonst liest der Screenreader dauernd vor
      if (text !== letzterStatus) status.textContent = letzterStatus = text;
    },
    setzeZusatz(text) { zusatz.textContent = text; },
    setzeTreffer(an) { ansicht.classList.toggle('treffer', an); },
    setzeGehalten(an) {
      gehalten.hidden = !an;
      ansicht.classList.toggle('ist-gehalten', an);
    },
    drehe(viertel) {
      if (viertel === letzteDrehung) return;
      letzteDrehung = viertel;
      drehbar.style.transform = `rotate(${viertel * 90}deg)`;
    }
  };
}

// Taste „Halten" / „Weiter". Liefert eine Funktion, die angibt, ob gehalten wird.
export function haltenKnopf(ansicht) {
  let gehalten = false;
  const k = knopf('Halten', () => {
    gehalten = !gehalten;
    k.textContent = gehalten ? 'Weiter' : 'Halten';
    k.setAttribute('aria-pressed', String(gehalten));
    ansicht.setzeGehalten(gehalten);
  });
  k.setAttribute('aria-pressed', 'false');
  ansicht.leiste.append(k);
  return () => gehalten;
}

// Verlaufsdiagramm der letzten Sekunden. Die y-Achse wächst mit dem größten
// gesehenen Wert, mindestens bis `minMax`.
export function verlauf({ sekunden = 10, minMax = 1, einheit = '' } = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 40');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'verlauf-svg');
  const linie = document.createElementNS(ns, 'polyline');
  linie.setAttribute('class', 'verlauf-linie');
  svg.append(linie);
  const skala = el('span', { class: 'verlauf-skala' }, '');
  const element = el('div', { class: 'verlauf', 'aria-hidden': 'true' }, svg, skala);
  const punkte = [];
  let groesster = minMax;
  let marke = null;

  const zeichne = () => {
    const jetzt = punkte.length ? punkte[punkte.length - 1].t : 0;
    linie.setAttribute('points', punkte.map((p) =>
      `${(100 - ((jetzt - p.t) / (sekunden * 1000)) * 100).toFixed(2)},${(40 - (p.w / groesster) * 38).toFixed(2)}`).join(' '));
    skala.textContent = `${sekunden} s · bis ${Number(groesster.toPrecision(2)).toLocaleString('de-DE')} ${einheit}`;
    if (marke) {
      const y = (40 - (marke.wert / groesster) * 38).toFixed(2);
      marke.setAttribute('y1', y);
      marke.setAttribute('y2', y);
    }
  };

  return {
    element,
    neu(wert, t = performance.now()) {
      punkte.push({ w: wert, t });
      while (punkte.length && punkte[0].t < t - sekunden * 1000) punkte.shift();
      groesster = Math.max(groesster, wert * 1.1);
      zeichne();
    },
    // Waagerechte Vergleichslinie (z. B. „vorher") oder null zum Entfernen.
    vergleich(wert) {
      marke?.remove();
      marke = null;
      if (wert === null) return;
      marke = document.createElementNS(ns, 'line');
      marke.setAttribute('class', 'verlauf-marke');
      marke.setAttribute('x1', '0');
      marke.setAttribute('x2', '100');
      marke.wert = wert;
      svg.append(marke);
      zeichne();
    }
  };
}

// Hinweis für Werkzeuge, deren Sensor Chrome nicht freigibt (F11, F15).
// Bewusst ohne Bastel-Anleitung: Der frühere Weg über chrome://flags ist
// seit Chrome 138 weg (siehe docs/analyse.md, C23).
export function nichtVerfuegbar(bereich, werkzeug) {
  bereich.replaceChildren(el('div', { class: 'einstellungen' },
    el('div', { class: 'fehler' },
      el('p', { class: 'fehler-titel' }, 'In Chrome derzeit gesperrt'),
      el('p', {}, `${werkzeug} braucht einen Sensor, den Chrome an Web-Apps im Moment nicht weitergibt. Früher ließ er sich in den Chrome-Einstellungen freischalten; diese Möglichkeit hat Google entfernt.`),
      el('p', {}, 'Alle anderen Werkzeuge funktionieren ganz normal. Gibt Chrome den Sensor wieder frei, ist dieses Werkzeug automatisch wieder nutzbar.'))));
}

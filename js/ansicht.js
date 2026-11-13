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

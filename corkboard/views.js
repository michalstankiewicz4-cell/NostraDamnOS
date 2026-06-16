// views.js – widoki automatyczne (partie / czas / ustawy / podstawowy)

export const VIEWS = ['basic', 'party', 'time', 'law'];

// Oblicz pozycje dla każdego widoku na podstawie danych
export function computeViewPositions(cards, view) {
  const positions = {};

  if (view === 'basic') {
    // Oryginalne pozycje
    cards.forEach(c => { positions[c.id] = { x: c.x, y: c.y }; });
    return positions;
  }

  if (view === 'party') {
    return computePartyView(cards);
  }

  if (view === 'time') {
    return computeTimeView(cards);
  }

  if (view === 'law') {
    return computeLawView(cards);
  }

  cards.forEach(c => { positions[c.id] = { x: c.x, y: c.y }; });
  return positions;
}

function computePartyView(cards) {
  const positions = {};

  // Zbierz unikalne partie
  const parties = {};
  cards.filter(c => c.type === 'party').forEach(c => {
    parties[c.data.name] = c;
  });
  const partyNames = Object.keys(parties);

  // Układamy partie poziomo w nagłówku
  const partyCount = Math.max(partyNames.length, 1);
  const colWidth = Math.max(300, Math.floor(1400 / partyCount));

  partyNames.forEach((pName, pi) => {
    const cx = 80 + pi * colWidth + colWidth / 2;
    positions[parties[pName].id] = { x: cx - 70, y: 80 };
  });

  // Osoby pod swoją partią
  const personsByParty = {};
  cards.filter(c => c.type === 'person').forEach(c => {
    const pn = c.data.party || '__brak__';
    if (!personsByParty[pn]) personsByParty[pn] = [];
    personsByParty[pn].push(c);
  });

  partyNames.forEach((pName, pi) => {
    const cx = 80 + pi * colWidth;
    const people = personsByParty[pName] || [];
    people.forEach((p, i) => {
      positions[p.id] = { x: cx + (i % 3) * 145, y: 240 + Math.floor(i / 3) * 200 };
    });
  });
  // Osoby bez partii
  (personsByParty['__brak__'] || []).forEach((p, i) => {
    positions[p.id] = { x: 80 + i * 145, y: 600 };
  });

  // Notatki, newsy, daty, ustawy – z prawej
  const others = cards.filter(c => !['party','person'].includes(c.type));
  others.forEach((c, i) => {
    positions[c.id] = { x: 1300 + (i % 2) * 210, y: 80 + Math.floor(i / 2) * 180 };
  });

  return positions;
}

function computeTimeView(cards) {
  const positions = {};

  // Wyodrębnij daty z kart
  function extractDate(c) {
    if (c.type === 'law' && c.data.date) return new Date(c.data.date);
    if (c.type === 'date' && c.data.date) {
      const d = parsePolishDate(c.data.date);
      if (d) return d;
    }
    return null;
  }

  const datable = cards.filter(c => extractDate(c)).map(c => ({ card: c, date: extractDate(c) }));
  datable.sort((a, b) => a.date - b.date);

  const undatable = cards.filter(c => !extractDate(c));

  // Oś czasu pozioma
  const timelineY = 300;
  const startX = 100;
  const spacing = datable.length > 1 ? Math.min(280, (1400 - startX) / datable.length) : 280;

  datable.forEach((item, i) => {
    const x = startX + i * spacing;
    // Naprzemiennie góra/dół osi
    const y = i % 2 === 0 ? timelineY - 160 : timelineY + 80;
    positions[item.card.id] = { x, y };
  });

  // Reszta kart poniżej
  undatable.forEach((c, i) => {
    positions[c.id] = { x: 80 + (i % 6) * 230, y: 530 + Math.floor(i / 6) * 200 };
  });

  return positions;
}

function computeLawView(cards) {
  const positions = {};

  const laws = cards.filter(c => c.type === 'law');
  const others = cards.filter(c => c.type !== 'law');

  // Ustawy jako kolumny
  const lawSpacing = Math.max(250, Math.floor(1400 / Math.max(laws.length, 1)));

  laws.forEach((law, li) => {
    positions[law.id] = { x: 80 + li * lawSpacing, y: 80 };
  });

  // Powiązane karty (przez nitki) – układamy je pod ustawą
  // Tu rozkładamy wszystkie inne karty równomiernie pod ustawami
  const perCol = Math.ceil(others.length / Math.max(laws.length, 1));
  others.forEach((c, i) => {
    const col = Math.min(Math.floor(i / perCol), laws.length - 1);
    const row = i % perCol;
    positions[c.id] = {
      x: 80 + col * lawSpacing + (row % 2) * 150,
      y: 260 + Math.floor(row / 2) * 200
    };
  });

  return positions;
}

function parsePolishDate(str) {
  // Próba parsowania "15 marca 2024", "2024-03-15" itp.
  const months = ['stycznia','lutego','marca','kwietnia','maja','czerwca',
    'lipca','sierpnia','września','października','listopada','grudnia'];
  const parts = str.trim().split(/\s+/);
  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const mon = months.indexOf(parts[1].toLowerCase());
    const year = parseInt(parts[2]);
    if (!isNaN(day) && mon >= 0 && !isNaN(year)) {
      return new Date(year, mon, day);
    }
  }
  // ISO
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

// views.js – widoki automatyczne + force-directed graph

export function computeViewPositions(cards, view, threads, pins) {
  if (view === 'basic')  return basicPositions(cards);
  if (view === 'party')  return computePartyView(cards);
  if (view === 'time')   return computeTimeView(cards);
  if (view === 'law')    return computeLawView(cards);
  if (view === 'force')  return computeForceView(cards, threads, pins);
  return basicPositions(cards);
}

function basicPositions(cards) {
  const p = {};
  cards.forEach(c => { p[c.id] = { x: c.x, y: c.y }; });
  return p;
}

function computePartyView(cards) {
  const positions = {};
  const parties = {};
  cards.filter(c => c.type === 'party').forEach(c => { parties[c.data.name] = c; });
  const partyNames = Object.keys(parties);
  const partyCount = Math.max(partyNames.length, 1);
  const colWidth = Math.max(300, Math.floor(1400 / partyCount));

  partyNames.forEach((pName, pi) => {
    const cx = 80 + pi * colWidth + colWidth / 2;
    positions[parties[pName].id] = { x: cx - 70, y: 60 };
  });

  const personsByParty = {};
  cards.filter(c => c.type === 'person' || c.type === 'unknown').forEach(c => {
    const pn = c.data.party || '__brak__';
    if (!personsByParty[pn]) personsByParty[pn] = [];
    personsByParty[pn].push(c);
  });

  partyNames.forEach((pName, pi) => {
    const cx = 80 + pi * colWidth;
    (personsByParty[pName] || []).forEach((p, i) => {
      positions[p.id] = { x: cx + (i % 3) * 145, y: 220 + Math.floor(i / 3) * 200 };
    });
  });
  (personsByParty['__brak__'] || []).forEach((p, i) => {
    positions[p.id] = { x: 80 + i * 145, y: 580 };
  });

  const others = cards.filter(c => !['party','person','unknown'].includes(c.type));
  others.forEach((c, i) => {
    positions[c.id] = { x: 1320 + (i % 2) * 210, y: 60 + Math.floor(i / 2) * 180 };
  });
  return positions;
}

function computeTimeView(cards) {
  const positions = {};
  const datable = cards
    .map(c => ({ card: c, date: extractDate(c) }))
    .filter(x => x.date)
    .sort((a, b) => a.date - b.date);
  const undatable = cards.filter(c => !extractDate(c));

  const startX = 80, timelineY = 320;
  const spacing = datable.length > 1 ? Math.min(260, (1500 - startX) / datable.length) : 260;
  datable.forEach((item, i) => {
    const x = startX + i * spacing;
    const y = i % 2 === 0 ? timelineY - 180 : timelineY + 60;
    positions[item.card.id] = { x, y };
  });
  undatable.forEach((c, i) => {
    positions[c.id] = { x: 80 + (i % 6) * 230, y: 560 + Math.floor(i / 6) * 200 };
  });
  return positions;
}

function computeLawView(cards) {
  const positions = {};
  const laws   = cards.filter(c => c.type === 'law');
  const others = cards.filter(c => c.type !== 'law');
  const lawSpacing = Math.max(240, Math.floor(1400 / Math.max(laws.length, 1)));

  laws.forEach((law, li) => {
    positions[law.id] = { x: 80 + li * lawSpacing, y: 60 };
  });

  const perCol = Math.ceil(others.length / Math.max(laws.length, 1));
  others.forEach((c, i) => {
    const col = Math.min(Math.floor(i / perCol), Math.max(laws.length - 1, 0));
    const row = i % perCol;
    positions[c.id] = {
      x: 80 + col * lawSpacing + (row % 2) * 150,
      y: 260 + Math.floor(row / 2) * 200,
    };
  });
  return positions;
}

// Force-directed layout (symulacja sprężyn)
function computeForceView(cards, threads, pins) {
  if (!cards.length) return {};

  // Inicjalizacja pozycji w kole
  const N = cards.length;
  const cx = 700, cy = 400, R = Math.min(300, N * 40);
  const pos = {};
  cards.forEach((c, i) => {
    const a = (2 * Math.PI * i) / N;
    pos[c.id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });

  // Buduj graf sąsiedztwa z nitek (przez pinezki)
  const pinToCard = {};
  pins.forEach(p => { if (p.cardId) pinToCard[p.id] = p.cardId; });
  const edges = [];
  threads.forEach(t => {
    const a = pinToCard[t.fromPin];
    const b = pinToCard[t.toPin];
    if (a && b && a !== b) edges.push([a, b]);
  });

  // Iteracje symulacji
  const ITER = 120, k = 120, C = 0.8;
  for (let iter = 0; iter < ITER; iter++) {
    const force = {};
    cards.forEach(c => { force[c.id] = { x: 0, y: 0 }; });

    // Odpychanie między wszystkimi węzłami
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i], b = cards[j];
        const dx = pos[a.id].x - pos[b.id].x;
        const dy = pos[a.id].y - pos[b.id].y;
        const d  = Math.max(1, Math.hypot(dx, dy));
        const f  = (k * k) / d;
        force[a.id].x += (dx / d) * f;
        force[a.id].y += (dy / d) * f;
        force[b.id].x -= (dx / d) * f;
        force[b.id].y -= (dy / d) * f;
      }
    }

    // Przyciąganie po krawędziach
    edges.forEach(([aid, bid]) => {
      if (!pos[aid] || !pos[bid]) return;
      const dx = pos[bid].x - pos[aid].x;
      const dy = pos[bid].y - pos[aid].y;
      const d  = Math.max(1, Math.hypot(dx, dy));
      const f  = (d * d) / k;
      force[aid].x += (dx / d) * f;
      force[aid].y += (dy / d) * f;
      force[bid].x -= (dx / d) * f;
      force[bid].y -= (dy / d) * f;
    });

    // Zastosuj siły (cooling)
    const t = C * (1 - iter / ITER);
    cards.forEach(c => {
      const fd = Math.hypot(force[c.id].x, force[c.id].y);
      if (fd > 0) {
        pos[c.id].x += (force[c.id].x / fd) * Math.min(fd, t * 30);
        pos[c.id].y += (force[c.id].y / fd) * Math.min(fd, t * 30);
      }
      // Trzymaj w granicach
      pos[c.id].x = Math.max(30, Math.min(1450, pos[c.id].x));
      pos[c.id].y = Math.max(30, Math.min(700,  pos[c.id].y));
    });
  }
  return pos;
}

function extractDate(c) {
  if (c.type === 'law'  && c.data.date) return new Date(c.data.date);
  if (c.type === 'date' && c.data.date) {
    const d = parsePolishDate(c.data.date);
    if (d) return d;
  }
  return null;
}

function parsePolishDate(str) {
  const months = ['stycznia','lutego','marca','kwietnia','maja','czerwca',
    'lipca','sierpnia','września','października','listopada','grudnia'];
  const parts = str.trim().split(/\s+/);
  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const mon = months.indexOf(parts[1].toLowerCase());
    const year = parseInt(parts[2]);
    if (!isNaN(day) && mon >= 0 && !isNaN(year)) return new Date(year, mon, day);
  }
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

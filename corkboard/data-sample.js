// data-sample.js – przykładowe wypełnienie tablicy

export const SAMPLE_DATA = {
  cards: [
    // --- PARTIE ---
    {
      id: 'party-1', type: 'party',
      x: 80, y: 80,
      data: { name: 'Partia Ludowa', logo: '🌾', color: '#2e7d32', desc: 'Centrum-prawica, elektorat wiejski' }
    },
    {
      id: 'party-2', type: 'party',
      x: 700, y: 80,
      data: { name: 'Front Obywatelski', logo: '🏛️', color: '#1565c0', desc: 'Liberalna opozycja' }
    },
    {
      id: 'party-3', type: 'party',
      x: 1200, y: 80,
      data: { name: 'Nowa Prawica', logo: '⚖️', color: '#b71c1c', desc: 'Konserwatywna koalicja' }
    },

    // --- OSOBY ---
    {
      id: 'person-1', type: 'person',
      x: 60, y: 260,
      angle: -4,
      data: { name: 'Andrzej Kowalski', role: 'Minister Finansów', party: 'Partia Ludowa', partyColor: '#2e7d32', emoji: '👨‍💼', photo: null }
    },
    {
      id: 'person-2', type: 'person',
      x: 220, y: 240,
      angle: 3,
      data: { name: 'Maria Wiśniewska', role: 'Wiceminister', party: 'Partia Ludowa', partyColor: '#2e7d32', emoji: '👩‍💼', photo: null }
    },
    {
      id: 'person-3', type: 'person',
      x: 670, y: 260,
      angle: -2,
      data: { name: 'Piotr Nowak', role: 'Lider opozycji', party: 'Front Obywatelski', partyColor: '#1565c0', emoji: '🧑‍⚖️', photo: null }
    },
    {
      id: 'person-4', type: 'person',
      x: 850, y: 240,
      angle: 5,
      data: { name: 'Katarzyna Lewandowska', role: 'Posłanka', party: 'Front Obywatelski', partyColor: '#1565c0', emoji: '👩‍💼', photo: null }
    },
    {
      id: 'person-5', type: 'person',
      x: 1180, y: 260,
      angle: -3,
      data: { name: 'Tomasz Zając', role: 'Senator', party: 'Nowa Prawica', partyColor: '#b71c1c', emoji: '👨‍⚖️', photo: null }
    },

    // --- USTAWY ---
    {
      id: 'law-1', type: 'law',
      x: 380, y: 180,
      angle: 2,
      data: { title: 'Ustawa o podatku cyfrowym', date: '2024-03-15', desc: 'Opodatkowanie platform internetowych 3% od przychodu' }
    },
    {
      id: 'law-2', type: 'law',
      x: 900, y: 380,
      angle: -3,
      data: { title: 'Nowelizacja Prawa Budowlanego', date: '2024-07-01', desc: 'Uproszczenie procedur dla inwestycji do 150m²' }
    },
    {
      id: 'law-3', type: 'law',
      x: 550, y: 450,
      angle: 4,
      data: { title: 'Ustawa antykorupcyjna', date: '2024-11-20', desc: 'Zaostrzenie kar i rozszerzenie katalogu przestępstw' }
    },

    // --- DATY ---
    {
      id: 'date-1', type: 'date',
      x: 370, y: 400,
      angle: -5,
      data: { label: 'Głosowanie', date: '15 marca 2024', color: 'y' }
    },
    {
      id: 'date-2', type: 'date',
      x: 750, y: 500,
      angle: 3,
      data: { label: 'Wejście w życie', date: '1 lipca 2024', color: 'g' }
    },

    // --- NEWSY ---
    {
      id: 'news-1', type: 'news',
      x: 100, y: 500,
      angle: -2,
      data: {
        source: 'Gazeta.pl',
        title: 'Minister Kowalski tłumaczy nowe regulacje',
        body: 'Na konferencji prasowej minister wyjaśnił mechanizm poboru nowego podatku. Opozycja zarzuca brak konsultacji.',
        url: 'https://gazeta.pl',
        accentColor: '#e63946'
      }
    },
    {
      id: 'news-2', type: 'news',
      x: 1100, y: 420,
      angle: 3,
      data: {
        source: 'TVN24',
        title: 'Zając: „Ta ustawa to zamach na samorządy"',
        body: 'Senator Nowej Prawicy zapowiedział zaskarżenie ustawy do Trybunału Konstytucyjnego.',
        url: 'https://tvn24.pl',
        accentColor: '#e63946'
      }
    },

    // --- NOTATKI ---
    {
      id: 'note-1', type: 'note',
      x: 480, y: 290,
      angle: 6,
      data: { text: 'Sprawdzić powiązania\nz lobbystą W.K.!', color: 'y' }
    },
    {
      id: 'note-2', type: 'note',
      x: 1050, y: 180,
      angle: -4,
      data: { text: 'Głosowanie:\nPL 187 za\nFO 142 prze\nNP 56 wstrz.', color: 'm' }
    },
    {
      id: 'note-3', type: 'note',
      x: 300, y: 480,
      angle: 2,
      data: { text: 'Źródło: przeciek\nz kancelarii\n(anonimowe)', color: 'r' }
    }
  ],

  pins: [
    { id: 'pin-1', cardId: 'person-1', x: 125, y: 268, color: 'red' },
    { id: 'pin-2', cardId: 'person-2', x: 285, y: 248, color: 'red' },
    { id: 'pin-3', cardId: 'person-3', x: 735, y: 268, color: 'blue' },
    { id: 'pin-4', cardId: 'person-4', x: 915, y: 248, color: 'blue' },
    { id: 'pin-5', cardId: 'person-5', x: 1245, y: 268, color: 'darkred' },
    { id: 'pin-6', cardId: 'law-1', x: 460, y: 188, color: 'gold' },
    { id: 'pin-7', cardId: 'law-2', x: 980, y: 388, color: 'gold' },
    { id: 'pin-8', cardId: 'law-3', x: 630, y: 458, color: 'gold' },
    { id: 'pin-9', cardId: 'note-1', x: 545, y: 298, color: 'orange' },
    { id: 'pin-10', cardId: 'party-1', x: 150, y: 88, color: 'green' },
    { id: 'pin-11', cardId: 'party-2', x: 770, y: 88, color: 'blue' },
    { id: 'pin-12', cardId: 'party-3', x: 1270, y: 88, color: 'darkred' },
    { id: 'pin-13', cardId: 'news-1', x: 195, y: 508, color: 'black' },
    { id: 'pin-14', cardId: 'date-1', x: 415, y: 408, color: 'purple' },
  ],

  threads: [
    // Kowalski → Ustawa podatkowa
    { id: 't-1', fromPin: 'pin-1', toPin: 'pin-6', color: 'red', striped: false },
    // Wiśniewska → Ustawa podatkowa
    { id: 't-2', fromPin: 'pin-2', toPin: 'pin-6', color: 'red', striped: false },
    // Nowak → Ustawa podatkowa (sprzeciw)
    { id: 't-3', fromPin: 'pin-3', toPin: 'pin-6', color: 'blue', striped: true, stripeColor2: 'red' },
    // Zając → Prawo Budowlane
    { id: 't-4', fromPin: 'pin-5', toPin: 'pin-7', color: 'darkred', striped: false },
    // Lewandowska → Ustawa antykorupcyjna
    { id: 't-5', fromPin: 'pin-4', toPin: 'pin-8', color: 'blue', striped: false },
    // Kowalski → Nota
    { id: 't-6', fromPin: 'pin-1', toPin: 'pin-9', color: 'orange', striped: true, stripeColor2: 'yellow' },
    // Partia Ludowa → Kowalski
    { id: 't-7', fromPin: 'pin-10', toPin: 'pin-1', color: 'green', striped: false },
    // Front Obywatelski → Nowak
    { id: 't-8', fromPin: 'pin-11', toPin: 'pin-3', color: 'blue', striped: false },
    // Nowa Prawica → Zając
    { id: 't-9', fromPin: 'pin-12', toPin: 'pin-5', color: 'darkred', striped: false },
    // News → Kowalski
    { id: 't-10', fromPin: 'pin-13', toPin: 'pin-1', color: 'black', striped: true, stripeColor2: 'white' },
    // Data głosowania → Ustawa podatkowa
    { id: 't-11', fromPin: 'pin-14', toPin: 'pin-6', color: 'purple', striped: false },
  ]
};

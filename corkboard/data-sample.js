// data-sample.js – Afera Rywina 2002–2004
// Prawdziwa historia: korupcja przy nowelizacji ustawy medialnej,
// "grupa trzymająca władzę", media zmieniające temat gdy działo się coś ważnego

export const SAMPLE_DATA = {
  cards: [

    // ── PARTIE ──────────────────────────────────────────
    {
      id: 'party-sld', type: 'party',
      x: 80, y: 70, angle: -1,
      data: { name: 'SLD', logo: '🌹', color: '#c0392b', desc: 'Sojusz Lewicy Demokratycznej\nPartia rządząca 2001–2004\nPremier: Leszek Miller' }
    },
    {
      id: 'party-po', type: 'party',
      x: 380, y: 70, angle: 2,
      data: { name: 'Platforma Obywatelska', logo: '🏛️', color: '#2980b9', desc: 'Opozycja centroprawicowa\nGłówni śledczy komisji:\nTusk, Rokita' }
    },
    {
      id: 'party-pis', type: 'party',
      x: 680, y: 70, angle: -2,
      data: { name: 'Prawo i Sprawiedliwość', logo: '⚖️', color: '#1a5276', desc: 'Opozycja prawicowa\nZiobro gwiazda komisji śledczej\n„Rywin to zero"' }
    },
    {
      id: 'party-psl', type: 'party',
      x: 980, y: 70, angle: 1,
      data: { name: 'PSL', logo: '🌾', color: '#27ae60', desc: 'Polskie Stronnictwo Ludowe\nKoalicjant SLD w rządzie\nJarosław Kalinowski – wicepremier' }
    },

    // ── OSOBY ───────────────────────────────────────────
    {
      id: 'person-miller', type: 'person',
      x: 90, y: 260, angle: -3,
      data: { name: 'Leszek Miller', role: 'Premier RP 2001–2004', party: 'SLD', partyColor: '#c0392b', emoji: '👨‍💼', photo: null }
    },
    {
      id: 'person-kwasniewski', type: 'person',
      x: 230, y: 240, angle: 4,
      data: { name: 'Aleksander Kwaśniewski', role: 'Prezydent RP', party: 'SLD', partyColor: '#c0392b', emoji: '🎖️', photo: null }
    },
    {
      id: 'person-rywin', type: 'person',
      x: 460, y: 260, angle: -5,
      data: { name: 'Lew Rywin', role: 'Producent filmowy\n„posłaniec grupy"', party: 'SLD', partyColor: '#c0392b', emoji: '🎬', photo: null }
    },
    {
      id: 'person-michnik', type: 'person',
      x: 600, y: 250, angle: 3,
      data: { name: 'Adam Michnik', role: 'Red. naczelny\nGazety Wyborczej / Agora SA', party: 'PO', partyColor: '#2980b9', emoji: '📰', photo: null }
    },
    {
      id: 'person-rokita', type: 'person',
      x: 380, y: 460, angle: -2,
      data: { name: 'Jan Rokita', role: 'Poseł PO\nKomisja śledcza ds. Rywina', party: 'PO', partyColor: '#2980b9', emoji: '🔍', photo: null }
    },
    {
      id: 'person-tusk', type: 'person',
      x: 510, y: 470, angle: 5,
      data: { name: 'Donald Tusk', role: 'Przewodniczący PO\nWicemarszałek Sejmu', party: 'PO', partyColor: '#2980b9', emoji: '🧑‍⚖️', photo: null }
    },
    {
      id: 'person-ziobro', type: 'person',
      x: 700, y: 460, angle: -4,
      data: { name: 'Zbigniew Ziobro', role: 'Poseł PiS\nGwiazda komisji śledczej', party: 'PiS', partyColor: '#1a5276', emoji: '⚡', photo: null }
    },
    {
      id: 'person-kalinowski', type: 'person',
      x: 980, y: 260, angle: 2,
      data: { name: 'Jarosław Kalinowski', role: 'Wicepremier\nLider PSL', party: 'PSL', partyColor: '#27ae60', emoji: '🌾', photo: null }
    },
    {
      id: 'person-solorz', type: 'unknown',
      x: 830, y: 250, angle: -3,
      data: { name: 'Zygmunt Solorz-Żak', role: 'Właściciel Polsatu\n„cel przejęcia" Agory', emoji: '❓' }
    },
    {
      id: 'person-wrobel', type: 'unknown',
      x: 1180, y: 260, angle: 4,
      data: { name: '„Grupa trzymająca władzę"', role: 'Nigdy nieustalona\nwedług Rywina: „z premierem"', emoji: '👥' }
    },

    // ── USTAWY ──────────────────────────────────────────
    {
      id: 'law-medialna', type: 'law',
      x: 360, y: 150, angle: -3,
      data: {
        title: 'Nowelizacja Ustawy o RTV',
        date: '2002-07-22',
        desc: 'Kluczowy zapis: zakaz posiadania\ngazety + stacji TV. Agora chciała\nkupić Polsat – przepis blokował transakcję.\nRywin oferował „usunięcie zapisu"\nza 17,5 mln USD.'
      }
    },
    {
      id: 'law-konc', type: 'law',
      x: 620, y: 150, angle: 2,
      data: {
        title: 'Ustawa antykoncentracyjna (art. 37)',
        date: '2003-04-10',
        desc: 'Przepis „antykoncentracyjny"\nuniemożliwiający fuzje medialne.\nSerce całej afery – walka o kształt\ntego jednego artykułu kosztowała\nmiliony dolarów.'
      }
    },
    {
      id: 'law-komisja', type: 'law',
      x: 870, y: 155, angle: -2,
      data: {
        title: 'Ustawa o komisjach śledczych',
        date: ''  +  '1999-01-21',
        desc: 'Na jej podstawie powołano\nKomisję Śledczą ds. Rywina.\nZiobro i Rokita zyskali\nplatformę ogólnopolską.\nPrzesłuchania transmitowane na żywo.'
      }
    },
    {
      id: 'law-kpk', type: 'law',
      x: 1100, y: 155, angle: 3,
      data: {
        title: 'Nowelizacja KPK – ochrona świadka',
        date: '2003-09-15',
        desc: 'Uchwalona w trakcie afery.\nKrytycy wskazują: uchwalana\nnocą gdy komisja śledcza\nujawniała kolejne zeznania.\nMedia skupione na Rywinie.'
      }
    },

    // ── NEWSY (co ukrywały media) ────────────────────────
    {
      id: 'news-wprost', type: 'news',
      x: 90, y: 490, angle: -3,
      data: {
        source: 'Wprost – lipiec 2002',
        title: 'Wprost publikuje – nikt nie słucha',
        body: 'Tygodnik Wprost jako pierwszy opisał propozycję korupcyjną Rywina latem 2002. Publikacja przeszła bez echa. Główne media (TVP, Gazeta Wyborcza) zignorowały temat. Agora milczała – była stroną w sprawie.',
        url: 'https://www.wprost.pl',
        accentColor: '#e74c3c'
      }
    },
    {
      id: 'news-wyborcza', type: 'news',
      x: 240, y: 500, angle: 4,
      data: {
        source: 'Gazeta Wyborcza – grudzień 2002',
        title: '„Wyborcza" publikuje stenogram i wybucha skandal',
        body: 'Dopiero 27 grudnia 2002 Gazeta Wyborcza opublikowała stenogram rozmowy Michnik–Rywin. Pytanie dlaczego czekała 5 miesięcy nigdy nie zostało jednoznacznie wyjaśnione przez redakcję.',
        url: 'https://wyborcza.pl',
        accentColor: '#e74c3c'
      }
    },
    {
      id: 'news-tvp-dywersja', type: 'news',
      x: 760, y: 490, angle: -2,
      data: {
        source: 'TVP / TVN – styczeń 2003',
        title: 'Media zmieniają temat: atak Iraku i gwiazdy pop',
        body: 'W tygodniach kluczowych zeznań przed komisją śledczą główne serwisy informacyjne poświęcały czas wojnie w Iraku i aferom celebrytów. Zdaniem krytyków był to klasyczny mechanizm odwracania uwagi.',
        url: 'https://tvp.pl',
        accentColor: '#8e44ad'
      }
    },
    {
      id: 'news-komisja-live', type: 'news',
      x: 900, y: 480, angle: 3,
      data: {
        source: 'Polsat News – 2003',
        title: 'Komisja na żywo – Ziobro: „Rywin to zero"',
        body: 'Transmisje komisji śledczej oglądały miliony Polaków. Ziobro (PiS) i Rokita (PO) stali się gwiazdami politycznymi. Miller zeznając powiedział Ziobrze że „jest zerem" – cytat stał się symbolem epoki.',
        url: 'https://polsat.pl',
        accentColor: '#27ae60'
      }
    },
    {
      id: 'news-orlen', type: 'news',
      x: 1100, y: 490, angle: -4,
      data: {
        source: 'Media 2002 – tło afery',
        title: 'Afera Orlenu przykrywa komisję śledczą',
        body: 'Gdy komisja ds. Rywina przesłuchiwała kluczowych świadków, część mediów przerzuciła się na aferę Orlenu (odwołanie Pietrewicza). Podwójna afera = rozmycie uwagi opinii publicznej.',
        url: 'https://rp.pl',
        accentColor: '#e67e22'
      }
    },

    // ── NOTATKI ŚLEDCZEGO ────────────────────────────────
    {
      id: 'note-grupa', type: 'note',
      x: 460, y: 380, angle: 6,
      data: { text: 'KTO TO\n„GRUPA TRZYMAJĄCA\nWŁADZĘ"?\nKomisja NIE ustaliła\n→ Miller? Kwaśniewski?\n→ ???', color: 'r' }
    },
    {
      id: 'note-17mln', type: 'note',
      x: 180, y: 380, angle: -5,
      data: { text: '17,5 MLN USD\nłapówka dla\n„grupy"\n+ prezesura\nPolsatu dla\nRywina', color: 'y' }
    },
    {
      id: 'note-5miesiecy', type: 'note',
      x: 310, y: 620, angle: 4,
      data: { text: 'Dlaczego\nWyborcza\nczekała\n5 MIESIĘCY??\nVII→XII 2002', color: 'm' }
    },
    {
      id: 'note-zero', type: 'note',
      x: 650, y: 620, angle: -3,
      data: { text: 'Miller → Ziobro:\n„Pan jest\nzerem"\nPrzesłuchanie\nkomisji 2003', color: 'b' }
    },
    {
      id: 'note-wyrok', type: 'note',
      x: 830, y: 620, angle: 5,
      data: { text: 'Wyrok 2004:\nRywin = 2 lata\n+ 100 tys. zł\nALE „grupy"\nnie znaleziono', color: 'g' }
    },
    {
      id: 'note-agora', type: 'note',
      x: 1050, y: 360, angle: -4,
      data: { text: 'Agora = ofiara\nCZY\nwspółuczestnik?\nMichnik nie\nzawiadomił\npolicji przez\n5 miesięcy!', color: 'c' }
    },

    // ── DATY KLUCZOWE ────────────────────────────────────
    {
      id: 'date-rozmowa', type: 'date',
      x: 140, y: 180, angle: -4,
      data: { label: 'Propozycja Rywina', date: '22 lipca 2002', color: 'r' }
    },
    {
      id: 'date-publikacja', type: 'date',
      x: 290, y: 185, angle: 3,
      data: { label: 'GW publikuje stenogram', date: '27 grudnia 2002', color: 'y' }
    },
    {
      id: 'date-komisja-start', type: 'date',
      x: 780, y: 360, angle: -2,
      data: { label: 'Komisja śledcza – start', date: '17 stycznia 2003', color: 'b' }
    },
    {
      id: 'date-wyrok-sad', type: 'date',
      x: 1170, y: 610, angle: 4,
      data: { label: 'Wyrok sądowy Rywina', date: '26 marca 2004', color: 'g' }
    },
  ],

  pins: [
    // Partie
    { id: 'pin-p-sld',    cardId: 'party-sld',          x: 150,  y: 78,  color: 'red'    },
    { id: 'pin-p-po',     cardId: 'party-po',            x: 450,  y: 78,  color: 'blue'   },
    { id: 'pin-p-pis',    cardId: 'party-pis',           x: 750,  y: 78,  color: 'black'  },
    { id: 'pin-p-psl',    cardId: 'party-psl',           x: 1050, y: 78,  color: 'green'  },
    // Osoby
    { id: 'pin-miller',   cardId: 'person-miller',       x: 155,  y: 268, color: 'red'    },
    { id: 'pin-kwasn',    cardId: 'person-kwasniewski',  x: 295,  y: 248, color: 'red'    },
    { id: 'pin-rywin',    cardId: 'person-rywin',        x: 525,  y: 268, color: 'orange' },
    { id: 'pin-michnik',  cardId: 'person-michnik',      x: 665,  y: 258, color: 'blue'   },
    { id: 'pin-rokita',   cardId: 'person-rokita',       x: 445,  y: 468, color: 'blue'   },
    { id: 'pin-tusk',     cardId: 'person-tusk',         x: 575,  y: 478, color: 'blue'   },
    { id: 'pin-ziobro',   cardId: 'person-ziobro',       x: 765,  y: 468, color: 'black'  },
    { id: 'pin-kalin',    cardId: 'person-kalinowski',   x: 1045, y: 268, color: 'green'  },
    { id: 'pin-solorz',   cardId: 'person-solorz',       x: 895,  y: 258, color: 'purple' },
    { id: 'pin-grupa',    cardId: 'person-wrobel',       x: 1245, y: 268, color: 'gold'   },
    // Ustawy
    { id: 'pin-law-med',  cardId: 'law-medialna',        x: 430,  y: 158, color: 'gold'   },
    { id: 'pin-law-konc', cardId: 'law-konc',            x: 690,  y: 158, color: 'gold'   },
    { id: 'pin-law-kom',  cardId: 'law-komisja',         x: 940,  y: 163, color: 'gold'   },
    { id: 'pin-law-kpk',  cardId: 'law-kpk',            x: 1170, y: 163, color: 'darkred'},
    // Newsy
    { id: 'pin-news-wp',  cardId: 'news-wprost',         x: 160,  y: 498, color: 'red'    },
    { id: 'pin-news-gw',  cardId: 'news-wyborcza',       x: 310,  y: 508, color: 'red'    },
    { id: 'pin-news-tvp', cardId: 'news-tvp-dywersja',   x: 825,  y: 498, color: 'purple' },
    { id: 'pin-news-pol', cardId: 'news-komisja-live',   x: 965,  y: 488, color: 'black'  },
    { id: 'pin-news-orl', cardId: 'news-orlen',          x: 1165, y: 498, color: 'orange' },
    // Notatki
    { id: 'pin-note-gr',  cardId: 'note-grupa',          x: 530,  y: 388, color: 'red'    },
    { id: 'pin-note-17',  cardId: 'note-17mln',          x: 250,  y: 388, color: 'orange' },
    { id: 'pin-note-5m',  cardId: 'note-5miesiecy',      x: 380,  y: 628, color: 'purple' },
    { id: 'pin-note-z',   cardId: 'note-zero',           x: 720,  y: 628, color: 'black'  },
    { id: 'pin-note-wyr', cardId: 'note-wyrok',          x: 900,  y: 628, color: 'green'  },
    { id: 'pin-note-ag',  cardId: 'note-agora',          x: 1120, y: 368, color: 'blue'   },
    // Daty
    { id: 'pin-date-r',   cardId: 'date-rozmowa',        x: 185,  y: 188, color: 'red'    },
    { id: 'pin-date-p',   cardId: 'date-publikacja',     x: 335,  y: 193, color: 'yellow' },
    { id: 'pin-date-k',   cardId: 'date-komisja-start',  x: 845,  y: 368, color: 'blue'   },
    { id: 'pin-date-w',   cardId: 'date-wyrok-sad',      x: 1235, y: 618, color: 'green'  },
  ],

  threads: [
    // ── Partie → politycy ──────────────────────────────
    { id: 't-sld-miller',  fromPin: 'pin-p-sld',   toPin: 'pin-miller',   color: 'red',    striped: false, width: 2.5 },
    { id: 't-sld-kwasn',   fromPin: 'pin-p-sld',   toPin: 'pin-kwasn',    color: 'red',    striped: false, width: 2   },
    { id: 't-po-rokita',   fromPin: 'pin-p-po',    toPin: 'pin-rokita',   color: 'b',      striped: false, width: 2   },
    { id: 't-po-tusk',     fromPin: 'pin-p-po',    toPin: 'pin-tusk',     color: 'b',      striped: false, width: 2   },
    { id: 't-po-michnik',  fromPin: 'pin-p-po',    toPin: 'pin-michnik',  color: 'b',      striped: true, stripeColor2: 'w', width: 1.5, label: 'nieformalnie' },
    { id: 't-pis-ziobro',  fromPin: 'pin-p-pis',   toPin: 'pin-ziobro',   color: 'k',      striped: false, width: 2.5 },
    { id: 't-psl-kalin',   fromPin: 'pin-p-psl',   toPin: 'pin-kalin',    color: 'g',      striped: false, width: 2   },

    // ── Rywin → kluczowe połączenia ─────────────────────
    { id: 't-rywin-michnik', fromPin: 'pin-rywin',  toPin: 'pin-michnik',  color: 'or',   striped: false, width: 3,   label: 'propozycja 22.07.2002' },
    { id: 't-rywin-miller',  fromPin: 'pin-rywin',  toPin: 'pin-miller',   color: 'or',   striped: true, stripeColor2: 'r', width: 2.5, label: 'twierdził że "z grupy"' },
    { id: 't-rywin-law',     fromPin: 'pin-rywin',  toPin: 'pin-law-med',  color: 'or',   striped: false, width: 2,   label: '17,5 mln USD za zmianę' },
    { id: 't-rywin-solorz',  fromPin: 'pin-rywin',  toPin: 'pin-solorz',   color: 'pu',   striped: false, width: 1.5, label: 'obiecał prezesurę Polsatu' },

    // ── Michnik → ustawa i Agora ────────────────────────
    { id: 't-michnik-law',   fromPin: 'pin-michnik', toPin: 'pin-law-med',  color: 'b',   striped: false, width: 2,   label: 'Agora chciała kupić Polsat' },
    { id: 't-michnik-5m',    fromPin: 'pin-michnik', toPin: 'pin-note-5m',  color: 'pu',  striped: true, stripeColor2: 'w', width: 1.5, label: '5 miesięcy milczenia' },
    { id: 't-michnik-gw',    fromPin: 'pin-michnik', toPin: 'pin-news-gw',  color: 'b',   striped: false, width: 2   },

    // ── Ustawy między sobą ──────────────────────────────
    { id: 't-law-med-konc',  fromPin: 'pin-law-med', toPin: 'pin-law-konc', color: 'go',  striped: false, width: 2,   label: 'art. 37 = serce afery' },
    { id: 't-law-konc-kom',  fromPin: 'pin-law-konc',toPin: 'pin-law-kom',  color: 'go',  striped: false, width: 1.5 },
    { id: 't-law-kpk-night', fromPin: 'pin-law-kpk', toPin: 'pin-news-tvp', color: 'pu', striped: true, stripeColor2: 'k', width: 2, label: 'uchwalona nocą gdy komisja obradowała' },

    // ── Komisja śledcza ─────────────────────────────────
    { id: 't-rokita-miller', fromPin: 'pin-rokita',  toPin: 'pin-miller',   color: 'b',   striped: false, width: 2,   label: 'przesłuchanie komisji' },
    { id: 't-ziobro-miller', fromPin: 'pin-ziobro',  toPin: 'pin-miller',   color: 'k',   striped: false, width: 2.5, label: '„Pan jest zerem"' },
    { id: 't-rokita-kom',    fromPin: 'pin-rokita',  toPin: 'pin-law-kom',  color: 'b',   striped: false, width: 1.5 },
    { id: 't-ziobro-kom',    fromPin: 'pin-ziobro',  toPin: 'pin-law-kom',  color: 'k',   striped: false, width: 1.5 },
    { id: 't-komisja-nota',  fromPin: 'pin-law-kom', toPin: 'pin-news-pol', color: 'k',   striped: false, width: 1.5, label: 'transmisje na żywo' },

    // ── Tajemnicza "Grupa" ───────────────────────────────
    { id: 't-miller-grupa',  fromPin: 'pin-miller',  toPin: 'pin-grupa',    color: 'r',   striped: true, stripeColor2: 'k', width: 3,   label: '„Grupa trzymająca władzę"?' },
    { id: 't-kwasn-grupa',   fromPin: 'pin-kwasn',   toPin: 'pin-grupa',    color: 'r',   striped: true, stripeColor2: 'k', width: 2,   label: 'nieustalona rola' },
    { id: 't-rywin-nota-gr', fromPin: 'pin-rywin',   toPin: 'pin-note-gr',  color: 'or',  striped: false, width: 2   },

    // ── Media ukrywające ─────────────────────────────────
    { id: 't-wp-early',     fromPin: 'pin-news-wp',  toPin: 'pin-date-r',   color: 'r',   striped: false, width: 1.5, label: 'publikacja ignorowana' },
    { id: 't-gw-late',      fromPin: 'pin-news-gw',  toPin: 'pin-date-p',   color: 'b',   striped: false, width: 2   },
    { id: 't-tvp-dyw',      fromPin: 'pin-news-tvp', toPin: 'pin-note-ag',  color: 'pu',  striped: true, stripeColor2: 'w', width: 2, label: 'odwracanie uwagi' },
    { id: 't-orlen-dyw',    fromPin: 'pin-news-orl', toPin: 'pin-ziobro',   color: 'or',  striped: true, stripeColor2: 'k', width: 1.5, label: 'afera Orlen nakłada się' },

    // ── Daty → zdarzenia ─────────────────────────────────
    { id: 't-date-r-rywin', fromPin: 'pin-date-r',  toPin: 'pin-rywin',    color: 'r',   striped: false, width: 1.5 },
    { id: 't-date-p-gw',    fromPin: 'pin-date-p',  toPin: 'pin-news-gw',  color: 'y',   striped: false, width: 1.5 },
    { id: 't-date-k-kom',   fromPin: 'pin-date-k',  toPin: 'pin-law-kom',  color: 'b',   striped: false, width: 1.5 },
    { id: 't-date-w-wyr',   fromPin: 'pin-date-w',  toPin: 'pin-note-wyr', color: 'g',   striped: false, width: 1.5 },

    // ── Wyrok ────────────────────────────────────────────
    { id: 't-rywin-wyrok',  fromPin: 'pin-rywin',   toPin: 'pin-note-wyr', color: 'or',  striped: false, width: 2,   label: '2 lata więzienia' },
    { id: 't-miller-17mln', fromPin: 'pin-miller',  toPin: 'pin-note-17',  color: 'r',   striped: false, width: 1.5 },
  ]
};

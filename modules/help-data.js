// ============================================
// Help Data v1.0
// Centralized help texts for all UI elements
// Key = data-help-id attribute value
// ============================================

export const HELP_DATA = {

    // ── Górny pasek ──────────────────────────────
    topInfoBar: {
        title: "📢 Pasek info",
        desc: "Pasek informacyjny pod nagłówkiem. Pokazuje bieżący status operacji, komunikaty systemowe i podsumowania."
    },

    // ── ETL Panel ────────────────────────────────
    estimateBox: {
        title: "💡 Estymacja",
        desc: "Estymacja rozmiaru danych, czasu pobierania i liczby zapytań API na podstawie wybranych opcji."
    },
    etlFetchBtn: {
        title: "📥 Pobierz dane",
        desc: "Rozpoczyna pobieranie danych z API Sejmu. Pipeline ETL pobiera, normalizuje i zapisuje dane do lokalnej bazy SQLite w przeglądarce."
    },
    etlClearBtn: {
        title: "🗑️ Wyczyść bazę",
        desc: "Kasuje całą bazę danych SQLite z przeglądarki. Operacja nieodwracalna — dane będą musiały być pobrane ponownie."
    },
    fieldInstitution: {
        title: "🏛️ Instytucja",
        desc: "Wybierz Sejm lub Senat. Każda instytucja ma własne API i strukturę danych. Senat jest obecnie wyłączony."
    },
    fieldTerm: {
        title: "📅 Kadencja",
        desc: "Kadencja to okres działania parlamentu (np. X = 2023-2027). Wybierz którą kadencję chcesz analizować."
    },
    fieldRange: {
        title: "🎯 Zakres posiedzeń",
        desc: "Określ numery posiedzeń do pobrania (np. od 1 do 5). Im więcej posiedzeń, tym dłużej potrwa pobieranie."
    },
    fieldBasicData: {
        title: "📋 Dane podstawowe",
        desc: "Posłowie i posiedzenia są pobierane zawsze — to fundament bazy danych. Nie można ich odznaczyć."
    },
    fieldPerSitting: {
        title: "📝 Dane per posiedzenie",
        desc: "Wypowiedzi, głosowania i głosy indywidualne — pobierane per posiedzenie. Każde posiedzenie oznacza dodatkowe zapytania API."
    },
    fieldPerTerm: {
        title: "🗂️ Dane per kadencja",
        desc: "Interpelacje, zapytania, projekty ustaw i akty prawne — pobierane dla całej kadencji naraz. Mogą być duże (kilka MB)."
    },
    fieldCommittees: {
        title: "🏢 Komisje",
        desc: "Dane o komisjach sejmowych: lista posiedzeń, składy i protokoły. Możesz wybrać konkretne komisje z listy."
    },

    // ── Podsumowanie bazy ────────────────────────
    summaryImportDb: {
        title: "📥 Import bazy",
        desc: "Importuj bazę SQLite z pliku na dysku."
    },
    summaryExportDb: {
        title: "📤 Export bazy",
        desc: "Eksportuj bieżącą bazę SQLite jako plik do pobrania."
    },

    // ── AI Asystent ──────────────────────────────
    aiModelSelect: {
        title: "🤖 Wybór modelu AI",
        desc: "Wybierz model AI: OpenAI, Claude, Gemini lub modele lokalne. Każdy ma inne możliwości i wymagania."
    },
    chatMessages: {
        title: "💬 Historia czatu",
        desc: "Historia rozmów z AI. Model odpowiada na pytania o dane parlamentarne, analizuje wzorce i może odpytywać bazę."
    },
    chatInput: {
        title: "✍️ Pole tekstowe",
        desc: "Wpisz pytanie lub polecenie dla AI. Możesz pytać o posłów, głosowania, statystyki czy wzorce zachowań."
    },
    sendChatBtn: {
        title: "📤 Wyślij",
        desc: "Kliknij lub naciśnij Enter aby wysłać wiadomość do wybranego modelu AI."
    },

    // ── Wykresy ──────────────────────────────────
    chartsControlPanel: {
        title: "📊 Zarządzanie wykresami",
        desc: "Zarządzaj widocznością i kolejnością wykresów. Przeciągnij aby zmienić kolejność, zaznacz/odznacz aby pokazać/ukryć."
    },
    chartsGrid: {
        title: "📈 Wykresy",
        desc: "Siatka interaktywnych wykresów Chart.js. Każdy wykres ma przycisk odświeżania. Najedź na punkty danych by zobaczyć szczegóły."
    },

    // ── Ustawienia ───────────────────────────────
    resetMemorySettings: {
        title: "🗑️ Reset pamięci",
        desc: "Usuwa ustawienia z localStorage: pozycje przycisków, kolejność wykresów, preferencje UI. Operacja nieodwracalna."
    },
    helpModeInfo: {
        title: "❓ Tryb pomocy",
        desc: "Kliknij przycisk ❓ — strona się zablokuje, najedź na element by zobaczyć opis. ESC aby wyjść."
    },

    // ── Predykcja ────────────────────────────────
    predDiscipline: {
        title: "🎯 Dyscyplina klubowa",
        desc: "Analiza jak często posłowie głosują zgodnie z linią swojego klubu. Wyższy wskaźnik = większa dyscyplina partii."
    },
    predRebels: {
        title: "⚠️ Wykrywanie anomalii",
        desc: "Wykrywa posłów którzy często głosują przeciwko większości swojego klubu. Identyfikuje niezależnych myślicieli."
    },
    predCoalitions: {
        title: "🤝 Potencjalne koalicje",
        desc: "Macierz koalicji — pokazuje jak często różne kluby głosują tak samo. Pozwala przewidywać potencjalne sojusze."
    },
    predTrend: {
        title: "📈 Trend aktywności",
        desc: "Analiza zmian aktywności posłów w czasie: kto zwiększa zaangażowanie a kto je zmniejsza. Porównuje dwie połowy kadencji."
    },
    predSentiment: {
        title: "📰 Analiza online",
        desc: "Pobierz i analizuj artykuły z polskich serwisów informacyjnych. Analiza sentymentu treści o posłach."
    },

    // ── Nawigacja dolna ──────────────────────────
    navDane: {
        title: "📥 Dane",
        desc: "Sekcja ETL — konfiguracja i pobieranie danych z API Sejmu do lokalnej bazy SQLite."
    },
    navPodsumowanie: {
        title: "📊 Podsumowanie",
        desc: "Podsumowanie bazy danych: liczba rekordów, tabele, statystyki i eksport/import."
    },
    navAI: {
        title: "🤖 AI Asystent",
        desc: "Czat z AI działającym lokalnie w przeglądarce. Zadawaj pytania o dane parlamentarne."
    },
    navWykresy: {
        title: "📈 Wykresy",
        desc: "Interaktywne wykresy: aktywność posłów, frekwencja, głosowania, kluby parlamentarne, sentyment."
    },
    navPredykcja: {
        title: "🔮 Predykcja",
        desc: "Modele predykcyjne: dyscyplina klubowa, buntownicy, koalicje, trendy aktywności."
    },
    navUstawienia: {
        title: "⚙️ Ustawienia",
        desc: "Ustawienia interfejsu: styl, widoczność elementów, tryb pomocy, język."
    },

    // ── Floating buttons (lewy panel) ────────────
    btnAiChat: {
        title: "🤖 AI Asystent",
        desc: "Otwiera sekcję AI Asystenta. Rozmawiaj z modelem językowym o danych parlamentarnych."
    },
    btnExport: {
        title: "📤 Export bazy",
        desc: "Eksportuje całą bazę SQLite jako plik .sqlite do pobrania na dysk."
    },
    btnImport: {
        title: "📥 Import bazy",
        desc: "Importuje wcześniej wyeksportowaną bazę SQLite z pliku. Zastępuje aktualną bazę."
    },
    btnHelp: {
        title: "❓ Pomoc",
        desc: "Włącza tryb pomocy. Najedź na element aby zobaczyć opis. ESC, prawy przycisk myszy lub ponowne kliknięcie ❓ wyłącza."
    },
    btnAbout: {
        title: "ℹ️ O projekcie",
        desc: "Wyświetla informacje o projekcie, autorze i współtwórcach."
    },
    btnLanguage: {
        title: "🇵🇱 Język",
        desc: "Zmienia język interfejsu (funkcja w przygotowaniu)."
    },
    btnResetMemory: {
        title: "🗑️ Reset pamięci",
        desc: "Resetuje wszystkie ustawienia UI: pozycje przycisków, kolejność wykresów, preferencje."
    },

    // ── Status Bar (dolny pasek) ─────────────────
    statusVersion: {
        title: "🏷️ Wersja",
        desc: "Aktualna wersja programu. Format: major.minor.patch."
    },
    statusDb: {
        title: "💾 Status bazy",
        desc: "Trzy lampki: stan bazy danych, stan rekordów z API, poprawność danych. Zielona = OK, czerwona = błąd, żółta = ostrzeżenie."
    },
    statusAI: {
        title: "🤖 Status AI",
        desc: "Status modelu AI WebLLM. Lampka sygnalizuje czy model jest załadowany i gotowy do użycia."
    },
    statusLoad: {
        title: "📡 Ładowanie danych",
        desc: "Pasek postępu ładowania danych z API Sejmu. Lampka: idle = brak akcji, pulsuje = ładowanie, zielona = gotowe."
    },
    statusMemory: {
        title: "🧠 Pamięć RAM",
        desc: "Zajętość pamięci RAM przeglądarki. Zielona = poniżej 50%, żółta = 50-80%, czerwona = powyżej 80%."
    },
    statusStorage: {
        title: "💿 Storage",
        desc: "Zajętość localStorage przeglądarki (limit ~5 MB). Baza danych i ustawienia są tu przechowywane."
    },
    statusCache: {
        title: "📊 Cache",
        desc: "Graficzne przedstawienie zajętości cache bazy danych — widać zużycie poszczególnych tabel."
    },
    statusLive: {
        title: "🔴 LIVE",
        desc: "Pojawia się gdy trwa transmisja na żywo z Sejmu. Kliknij aby obejrzeć transmisję."
    },
    statusConsole: {
        title: "🖥️ Konsola",
        desc: "Otwiera konsolę deweloperską z logami systemu. Skrót: Ctrl+`. Lampka sygnalizuje status."
    },

    // ── Panel informacyjny (prawy górny) ─────────
    detailPanel: {
        title: "📋 Panel informacyjny",
        desc: "Rozwijany panel informacyjny w prawym górnym rogu. Zawiera szczegóły pobierania danych (postęp ETL) oraz informacje o transmisji LIVE z Sejmu."
    }
};

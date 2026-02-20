// ============================================
// Help Data v1.0
// Centralized help texts for all UI elements
// Key = data-help-id attribute value
// ============================================

// ── Clippy — wskazówki kontekstowe per sekcja ──
// Każda sekcja: { name, icon, tips: [] }
// Tłumaczenie: dodaj analogiczny obiekt w pliku językowym
export const CLIPPY_TIPS = {
    '1': {
        name: 'Dane',
        icon: '📊',
        tips: [
            'Hej! Jestem w sekcji DANE. Tu pobierasz dane parlamentarne z API Sejmu i zapisujesz je do lokalnej bazy.',
            '📥 Kliknij "Pobierz/Zaktualizuj dane" aby rozpocząć pobieranie. Wybierz najpierw kadencję i zakres posiedzeń!',
            '⚡ Wybierz moduły danych: posłowie, posiedzenia, wypowiedzi, głosowania, interpelacje, komisje i więcej!',
            '📦 Pasek cache na górze pokazuje co jest już w bazie. Zielony = kompletne, żółty = częściowe.',
            '🔒 Filtr RODO usuwa wrażliwe dane (email, PESEL) przed zapisem. Zalecamy pozostawić włączony.',
            '⏱️ Głosowania i wypowiedzi pobierane są per posiedzenie — każde to ~100 zapytań do API Sejmu.',
        ]
    }
    // Pozostałe sekcje: Podsumowanie, AI Asystent, Wykresy, Ustawienia, Predykcja — dodamy potem
};

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


    // ── Ustawienia ───────────────────────────────
    resetMemorySettings: {
        title: "🗑️ Reset pamięci",
        desc: "Usuwa ustawienia z localStorage: pozycje przycisków, kolejność wykresów, preferencje UI. Operacja nieodwracalna."
    },
    helpModeInfo: {
        title: "❓ Tryb pomocy",
        desc: "Kliknij przycisk ❓ — strona się zablokuje, najedź na element by zobaczyć opis. ESC aby wyjść."
    },

    // ── Moduły AI ─────────────────────────────────
    predSessionSummary: {
        title: "🤖 Auto-podsumowanie posiedzeń",
        desc: "AI generuje streszczenia sesji parlamentarnych na podstawie wypowiedzi i głosowań. Wymaga pobranych wypowiedzi i skonfigurowanego modelu AI. Podsumowanie obejmuje kluczowe tematy, decyzje i kontrowersje z danego posiedzenia."
    },
    predTopicClassification: {
        title: "🏷️ Klasyfikacja tematyczna",
        desc: "Automatyczne tagowanie wypowiedzi parlamentarnych według tematu (ekonomia, obronność, zdrowie, edukacja itp.). AI analizuje treść wypowiedzi i przypisuje kategorie tematyczne. Wymaga pobranych wypowiedzi i modelu AI."
    },
    predMpContradictions: {
        title: "🔄 Sprzeczności posła",
        desc: "AI wykrywa zmiany stanowiska tego samego posła w czasie — porównuje wypowiedzi i głosowania z różnych okresów. Pozwala zidentyfikować posłów którzy zmienili zdanie w kluczowych kwestiach. Wymaga wypowiedzi z wielu posiedzeń."
    },
    predAiReport: {
        title: "📊 Raport AI",
        desc: "Jednym kliknięciem generuje pełny raport analityczny obejmujący: aktywność, dyscyplinę, trendy, anomalie i sentyment. AI łączy wszystkie dostępne dane w spójne podsumowanie kadencji. Wymaga kompletnej bazy danych i klucza API."
    },
    predWebllmChat: {
        title: "🧠 WebLLM — AI lokalne",
        desc: "Model językowy działający w całości w przeglądarce (WebGPU). Nie wymaga klucza API ani połączenia z internetem. Obsługuje mniejsze modele (np. Llama 3). Wymaga GPU z obsługą WebGPU i ~4 GB VRAM. Ładowanie modelu trwa 1-3 minuty."
    },
    predAntiPolish: {
        title: "🛡️ Wykrywanie zachowań antypolskich",
        desc: "AI analizuje wypowiedzi parlamentarne pod kątem treści prorosyjskich, antypaństwowych i antyunijnych. Wykorzystuje analizę sentymentu i słowa kluczowe. Wymaga pobranych wypowiedzi i modelu AI. Wyniki prezentowane z kontekstem i cytatami."
    },
    predWebIntel: {
        title: "🌐 Wywiad sieciowy",
        desc: "AI przeszukuje internet w kontekście parlamentarnym — zbiera informacje o posłach, partiach i wydarzeniach politycznych z zewnętrznych źródeł. Wymaga klucza API i połączenia z internetem. Wyniki krzyżowane z danymi z bazy."
    },
    predAiCharts: {
        title: "📊 Wykresy AI",
        desc: "Opisz słownie jaki wykres chcesz — AI wygeneruje zapytanie SQL i narysuje wykres z danych w bazie. Obsługuje: kołowy, słupkowy, liniowy, radarowy. Np. 'pokaż aktywność klubów w czasie' lub 'porównaj frekwencję PiS vs KO'."
    },

    // ── Investigation Engine ──────────────────────────
    predInvestigationEngine: {
        title: "🕵️ Investigation Engine",
        desc: "Moduł wykrywający teorie spiskowe, spekulacyjne narracje i manipulacje retoryczne w wypowiedziach parlamentarnych. Analizuje 500 losowych wypowiedzi z bazy, skanuje pod kątem 6 kategorii narracji i 14 wzorców retorycznych, buduje mapę pojęć i wykrywa powtarzające się motywy. Przycisk '🔍 Zbadaj' wysyła wybrany element do czatu AI w celu pogłębionej analizy."
    },
    invTabClusters: {
        title: "🏷️ Klastry narracji",
        desc: "Wypowiedzi są grupowane w 6 kategorii narracji: ukryte wpływy zagraniczne, tajne działania rządu, manipulacja mediami, zbiegi okoliczności, niewyjaśnione zdarzenia, niejawne powiązania. Każda wypowiedź jest skanowana pod kątem słów kluczowych i przypisywana do dominującej kategorii. Klaster pokazuje ile wypowiedzi zawiera, łączny score, najczęstszych mówców i partie. Kliknij '🔍 Zbadaj' aby wysłać klaster do AI."
    },
    invTabRhetoric: {
        title: "🎭 Wzorce retoryczne",
        desc: "Wykrywa 14 typów technik manipulacji retorycznej w wypowiedziach, np.: 'to nie przypadek' (negacja przypadkowości), 'obudźcie się' (wezwanie do przebudzenia), 'cui bono' (motyw korzyści), 'nikt nie mówi' (argument z przemilczenia), 'oficjalna wersja' (podważanie narracji). Każdy wzorzec ma przypisaną wagę — im częstszy i mocniejszy, tym wyższy pasek na wykresie."
    },
    invTabMotifs: {
        title: "🔁 Motywy",
        desc: "Wyświetla powtarzające się bigramy (pary wyrazów) wykryte w wypowiedziach parlamentarnych. Tekst jest dzielony na słowa (>3 znaki, bez stop-words), liczone są pary sąsiednich wyrazów. Filtrowane są tylko te, które pojawiły się ≥3 razy u ≥2 różnych mówców. Motywy oznaczone 'trans-partyjny' pojawiają się w więcej niż jednej partii — potencjalnie skoordynowane narracje lub wspólne punkty zapalne."
    },
    invTabConceptMap: {
        title: "🕸️ Mapa pojęć",
        desc: "Wizualizacja SVG współwystępowania najczęstszych pojęć. Analizuje top 40 słów z wypowiedzi i mierzy jak często pojawiają się razem w oknie 5 wyrazów. Węzły (kółka) to pojęcia — im większe, tym częstsze. Krawędzie (linie) łączą pojęcia występujące obok siebie — im grubsza linia, tym silniejsze powiązanie. Pozwala zobaczyć jakie idee 'krążą' razem w parlamencie."
    },
    invTabTopFlagged: {
        title: "🚩 Top oflagowane",
        desc: "Ranking 10 wypowiedzi z najwyższym 'Investigation Score'. Score obliczany jest na podstawie: liczby trafień słów kluczowych z 6 kategorii narracji (każda z własną wagą) + wykrytych wzorców retorycznych. Każda karta pokazuje mówcę, partię, score, kategorie, sentyment i fragment tekstu. Kliknij '🔍 Zbadaj' aby AI oceniło czy to rzeczywisty sygnał czy fałszywy alarm."
    },

    // ── Wykresy (karty) ──────────────────────────
    chartKluby: {
        title: "🏛️ Rozkład klubów parlamentarnych",
        desc: "Wykres kołowy (doughnut) przedstawiający liczbę posłów w każdym klubie parlamentarnym. Wymaga pobranych danych o posłach. Kolory odpowiadają barwom partii. Kliknij segment aby zobaczyć szczegóły klubu."
    },
    chartTopPoslowie: {
        title: "👥 Top 10 najaktywniejszych posłów",
        desc: "Wykres słupkowy z rankingiem 10 posłów z największą liczbą wypowiedzi sejmowych. Wymaga pobranych wypowiedzi. Najedź na słupek aby zobaczyć dokładną liczbę. Aktywność mierzona liczbą wypowiedzi na posiedzeniach."
    },
    chartGlosowania: {
        title: "🗳️ Wyniki głosowań",
        desc: "Wykres kołowy (doughnut) pokazujący proporcje głosów: za, przeciw, wstrzymał się i nieobecny. Wymaga pobranych danych o głosowaniach. Daje ogólny obraz konsensusu lub podziałów w Sejmie."
    },
    chartCustom: {
        title: "📊 Wykres niestandardowy",
        desc: "Wykres z wybieralnym typem danych: głosowania w czasie (liniowy), aktywność komisji (słupkowy), interpelacje wg posłów (słupkowy), frekwencja głosowań (liniowy). Użyj selektora aby zmienić widok. Przycisk 🔄 odświeża dane."
    },
    chartNajmniejAktywni: {
        title: "😴 Top 20 najmniej aktywnych posłów",
        desc: "Wykres słupkowy pokazujący 20 posłów z najmniejszą liczbą wypowiedzi. Wymaga pobranych wypowiedzi i posłów. Pozwala zidentyfikować parlamentarzystów o niskiej aktywności mówniczej. Uwaga: niska aktywność mównicza ≠ niska aktywność ogólna."
    },
    chartNajmniejAktywneKluby: {
        title: "🔻 Najmniej aktywne kluby",
        desc: "Wykres słupkowy porównujący aktywność klubów parlamentarnych per capita (średnia liczba wypowiedzi na posła). Wymaga pobranych wypowiedzi i posłów. Normalizacja per capita eliminuje wpływ wielkości klubu na wyniki."
    },
    chartHeatmap: {
        title: "🔥 Heatmapa frekwencji",
        desc: "Macierz obecności posłów/klubów na głosowaniach. Oś X: posiedzenia lub głosowania. Oś Y: posłowie lub kluby. Kolor: obecność, głosy za, przeciw lub wstrzymał się. Wymaga pobranych głosów indywidualnych. Użyj selektorów aby zmienić widok."
    },
    chartSentimentDist: {
        title: "📊 Rozkład sentymentu wypowiedzi",
        desc: "Wykres kołowy (doughnut) z proporcjami wypowiedzi pozytywnych, neutralnych i negatywnych. Sentyment mierzony algorytmem NLP na podstawie słownika polskiego. Wymaga pobranych wypowiedzi. Zielony = pozytywny, szary = neutralny, czerwony = negatywny."
    },
    chartSentimentTime: {
        title: "📈 Sentyment w czasie",
        desc: "Wykres liniowy pokazujący ewolucję średniego sentymentu wypowiedzi w kolejnych miesiącach. Pozwala śledzić trendy nastrojów — czy debata się radykalizuje czy łagodnieje. Wymaga wypowiedzi z wielu posiedzeń."
    },
    chartSentimentParty: {
        title: "🎭 Sentyment per klub",
        desc: "Wykres słupkowy porównujący średni sentyment wypowiedzi w podziale na kluby parlamentarne. Pozwala sprawdzić który klub mówi najbardziej pozytywnie a który najbardziej krytycznie. Wymaga pobranych wypowiedzi."
    },
    chartTopSpeakers: {
        title: "🎤 Top mówcy — sentyment",
        desc: "Wykres słupkowy z rankingiem posłów o najbardziej pozytywnym i najbardziej negatywnym sentymencie wypowiedzi. Wymaga pobranych wypowiedzi. Sentyment analizowany algorytmem NLP. Pokazuje dwustronny ranking: optymistów i krytyków."
    },

    // ── Predykcja ────────────────────────────────
    predMpProfile: {
        title: "👤 Profil parlamentarzysty",
        desc: "Szczegółowy profil wybranego posła: dane osobowe, klub, aktywność, frekwencja, dyscyplina klubowa, interpelacje, projekty ustaw. Wybierz posła z listy lub wpisz nazwisko. Wymaga pobranych danych posłów, głosowań i wypowiedzi."
    },
    predClubProfile: {
        title: "🏛️ Profil klubu / partii",
        desc: "Kompleksowe statystyki wybranego klubu parlamentarnego: skład, aktywność, dyscyplina głosowań, frekwencja, sentyment wypowiedzi. Porównuje klub z resztą Sejmu. Wymaga kompletnych danych (posłowie, głosowania, wypowiedzi)."
    },
    predCommitteeProfile: {
        title: "📋 Profil komisji",
        desc: "Szczegóły wybranej komisji sejmowej: skład, częstotliwość posiedzeń, tematy, aktywność członków. Wymaga pobranych danych o komisjach (zaznacz 'Komisje' w panelu ETL)."
    },
    predDiscipline: {
        title: "🎯 Dyscyplina klubowa",
        desc: "Analiza jak często posłowie głosują zgodnie z linią swojego klubu. Dla każdego głosowania porównuje głos posła z większością jego klubu. Wyższy wskaźnik = większa dyscyplina partii. Wymaga pobranych głosów indywidualnych."
    },
    predRebels: {
        title: "⚠️ Wykrywanie anomalii",
        desc: "Wykrywa posłów którzy często głosują przeciwko większości swojego klubu — tzw. buntowników partyjnych. Identyfikuje niezależnych myślicieli i potencjalne frakcje wewnątrzpartyjne. Wymaga pobranych głosów indywidualnych."
    },
    predCoalitions: {
        title: "🤝 Potencjalne koalicje",
        desc: "Macierz koalicji — pokazuje jak często różne kluby głosują tak samo (procent zgodności). Pozwala przewidywać potencjalne sojusze polityczne. Wizualizacja: macierz z kolorami od czerwonego (niska zgodność) do zielonego (wysoka)."
    },
    predTrend: {
        title: "📈 Trend aktywności",
        desc: "Analiza zmian aktywności posłów w czasie: kto zwiększa zaangażowanie a kto je zmniejsza. Porównuje dwie połowy kadencji. Wymaga wypowiedzi z wielu posiedzeń aby uchwycić trend."
    },
    predSentiment: {
        title: "📰 Analiza online",
        desc: "Pobierz i analizuj artykuły z polskich serwisów informacyjnych (Onet, WP, TVN24, etc.). Analiza sentymentu treści medialnych o posłach i partiach. Wymaga połączenia z internetem. Wyniki krzyżowane z danymi parlamentarnymi."
    },
    predAttendance: {
        title: "📊 Frekwencja & Absencja",
        desc: "Ranking obecności posłów na głosowaniach — kto jest najczęściej obecny a kto najczęściej opuszcza głosowania. Uwzględnia wszystkie głosowania w pobranych posiedzeniach. Wymaga głosów indywidualnych (opcja 'głosy' w ETL)."
    },
    predPolarization: {
        title: "⚡ Polaryzacja głosowań",
        desc: "Mierzy jak mocno podzielone są głosowania — identyfikuje głosowania gdzie Sejm jest najbardziej podzielony vs jednomyślny. Indeks polaryzacji: 0% = pełna zgodność, 100% = pełny podział. Wymaga pobranych głosowań."
    },
    predActivityRank: {
        title: "🏆 Ranking aktywności",
        desc: "Composite score łączący różne wymiary aktywności posła: wypowiedzi, interpelacje, głosowania, projekty ustaw. Normalizowany ranking pozwala porównać aktywność posłów na wielu płaszczyznach jednocześnie."
    },
    predLegislation: {
        title: "⏱️ Tempo legislacyjne",
        desc: "Analiza szybkości procedowania ustaw: od złożenia projektu do uchwalenia. Identyfikuje ustawy procedowane ekspresowo vs. te zamrożone w komisjach. Wymaga pobranych projektów ustaw i aktów prawnych."
    },
    predInterpellations: {
        title: "📬 Analiza interpelacji",
        desc: "Analiza tematów i aktywności interpelacyjnej posłów. Kto składa najwięcej interpelacji? Do kogo? Na jakie tematy? Wymaga pobranych interpelacji (opcja 'interpelacje' w panelu ETL, dane per kadencja)."
    },
    predCommittees: {
        title: "🔗 Sieć komisji",
        desc: "Analiza współpracy międzykomisyjnej posłów — kto zasiada w wielu komisjach jednocześnie, kto jest łącznikiem między komisjami. Wizualizacja sieci powiązań. Wymaga pobranych danych o komisjach."
    },
    predControversialSpeeches: {
        title: "🔥 Kontrowersyjne wypowiedzi",
        desc: "Ranking najbardziej agresywnych i negatywnych wystąpień sejmowych na podstawie analizy sentymentu NLP. Pokazuje cytaty z kontekstem, posła, posiedzenie i wynik sentymentu. Wymaga pobranych wypowiedzi."
    },
    predContradictoryVotes: {
        title: "⚔️ Sprzeczne głosowania",
        desc: "Wykrywa posłów którzy głosowali wbrew linii swojego klubu w konkretnych głosowaniach — pokazuje temat głosowania, głos posła vs. większość klubu. Bardziej szczegółowa wersja modułu 'Wykrywanie anomalii'. Wymaga głosów indywidualnych."
    },
    predDefectionRisk: {
        title: "🚪 Ryzyko odejścia z klubu",
        desc: "Scoring prawdopodobieństwa zmiany partii dla każdego posła. Algorytm uwzględnia: częstość głosowania wbrew klubowi, podobieństwo głosowań do innych partii, trend dyscypliny w czasie. Im wyższy wynik, tym większe ryzyko odejścia."
    },
    predVotePredictor: {
        title: "🎯 Prognoza głosowania",
        desc: "Symulacja wyniku głosowania na podstawie historii głosowań. Wprowadź temat — model przewidzi jak zagłosują kluby i poszczególni posłowie. Bazuje na wzorcach z poprzednich głosowań w podobnych tematach."
    },
    predTensionBarometer: {
        title: "🌡️ Barometr napięcia",
        desc: "Trend radykalizacji debaty politycznej w czasie. Mierzy poziom agresji, polaryzacji i emocjonalności wypowiedzi sejmowych. Skala: 0 (spokój) → 100 (maksymalne napięcie). Wymaga wypowiedzi z wielu posiedzeń."
    },
    predCoalitionForecast: {
        title: "🤝 Prognoza koalicji",
        desc: "Zbieżność głosowań między klubami w czasie — wykres liniowy pokazujący jak zmienia się zgodność głosowania par klubów z posiedzenia na posiedzenie. Pozwala śledzić zbliżanie lub oddalanie się partii. Wymaga wielu posiedzeń."
    },
    predActivityForecast: {
        title: "📈 Predykcja aktywności",
        desc: "Prognoza przyszłej aktywności posłów na podstawie dotychczasowych trendów. Model regresji liniowej przewiduje czy aktywność posła będzie rosła czy malała w kolejnych posiedzeniach. Wymaga danych z min. 3 posiedzeń."
    },
    predGhostVoting: {
        title: "👻 Podejrzane głosowania",
        desc: "Wykrywanie anomalii: posłowie którzy oddali głos mimo nieobecności na innych głosowaniach tego samego dnia (potencjalne ghost voting). Algorytm porównuje wzorce obecności w ramach jednego posiedzenia. Wymaga głosów indywidualnych."
    },
    predAggressionAnalysis: {
        title: "🔥 Analiza agresji parlamentarnej",
        desc: "Trzy analizy: (1) Kto najczęściej prowokuje agresję — posłowie po których wypowiedziach następują agresywne reakcje, (2) Kto inicjuje agresję — posłowie z najwyższym wynikiem agresji, (3) Stereotypowe prośby o spokój — wykrywanie szablonowych apeli o kulturę debaty. Wymaga wypowiedzi."
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
        desc: "Panel informacyjny w prawym górnym rogu. Wyświetla szczegóły pobierania danych (postęp ETL) gdy trwa ściąganie."
    }
};

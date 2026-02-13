// Help & Interactive Tour System
// Interaktywny przewodnik po aplikacji z spotlight effect

/**
 * Tour steps - kroki przewodnika dla każdej sekcji
 * Kontekstowa pomoc wykrywa aktywną sekcję i pokazuje tylko jej elementy
 */
const SECTION_TOUR_STEPS = {
    // Sekcja 1: ETL - Dane
    '1': [
        {
            selector: '.console-style-panel:nth-child(1)',
            title: '🏛️ Wybór instytucji',
            description: 'Wybierz Sejm lub Senat (obecnie Senat jest wyłączony). Każda instytucja ma własne API i strukturę danych.'
        },
        {
            selector: '#kadencjaSelect',
            title: '📅 Wybór kadencji',
            description: 'Kadencja to okres działania parlamentu (np. Kadencja X = 2023-2027). Wybierz którą kadencję chcesz analizować.'
        },
        {
            selector: '#zakresInput',
            title: '🔢 Zakres posiedzeń',
            description: 'Określ zakres numerów posiedzeń do pobrania (np. "1-5" pobierze posiedzenia od 1 do 5). Możesz też podać pojedyncze numery oddzielone przecinkami.'
        },
        {
            selector: '.data-options',
            title: '✅ Wybór danych',
            description: 'Zaznacz jakie dane chcesz pobrać: posłowie, wypowiedzi, głosowania, kluby, komisje itp. Im więcej zaznaczyłeś, tym dłużej potrwa pobieranie.'
        },
        {
            selector: '#etlFetchBtn',
            title: '🚀 Przycisk pobierania',
            description: 'Kliknij aby rozpocząć pobieranie! Pipeline ETL automatycznie pobierze dane z API, przetworzy je i zapisze do lokalnej bazy SQLite.'
        },
        {
            selector: '.etl-status',
            title: '📊 Pasek postępu',
            description: 'Obserwuj postęp pobierania: aktualna operacja, procent ukończenia, liczba pobranych rekordów. Możesz anulować proces w każdej chwili.'
        }
    ],
    
    // Sekcja 2: Podsumowanie
    '2': [
        {
            selector: '.stats-grid',
            title: '📊 Statystyki bazy danych',
            description: 'Zobacz ile rekordów znajduje się w bazie: posłowie, wypowiedzi, głosowania, komisje i inne. Kliknij w kartę aby zobaczyć szczegóły.'
        },
        {
            selector: '.table-list',
            title: '🗂️ Lista tabel',
            description: 'Wszystkie tabele w bazie danych SQLite. Kliknij w tabelę aby zobaczyć jej zawartość i strukturę.'
        },
        {
            selector: '#refreshStatsBtn',
            title: '🔄 Odświeżanie statystyk',
            description: 'Kliknij aby zaktualizować statystyki po dodaniu nowych danych lub zmianie bazy.'
        }
    ],
    
    // Sekcja 3: AI Asystent
    '3': [
        {
            selector: '#modelSelect',
            title: '🤖 Wybór modelu AI',
            description: 'Wybierz model językowy: Llama, Qwen, Phi lub inny. Każdy model ma inne możliwości i wymagania pamięciowe.'
        },
        {
            selector: '#loadModelBtn',
            title: '⚡ Ładowanie modelu',
            description: 'Kliknij aby pobrać i załadować model AI. Model działa lokalnie w przeglądarce - wszystko pozostaje prywatne!'
        },
        {
            selector: '#chatMessages',
            title: '💬 Historia czatu',
            description: 'Twoje rozmowy z AI. Model odpowiada na pytania o dane parlamentarne, analizuje wzorce i wyjaśnia kontekst.'
        },
        {
            selector: '#userInput',
            title: '✍️ Pole tekstowe',
            description: 'Wpisz pytanie lub polecenie dla AI. Możesz pytać o konkretnych posłów, głosowania, statystyki czy wzorce zachowań.'
        },
        {
            selector: '#sendBtn',
            title: '📤 Wyślij wiadomość',
            description: 'Kliknij lub naciśnij Enter aby wysłać wiadomość do AI.'
        }
    ],
    
    // Sekcja 4: Wykresy
    '4': [
        {
            selector: '.charts-control-panel',
            title: '🎛️ Panel zarządzania wykresami',
            description: 'Przeciągnij wykresy aby zmienić kolejność, zaznacz/odznacz aby pokazać/ukryć. Twoja konfiguracja jest automatycznie zapisywana!'
        },
        {
            selector: '.chart-item:first-child input[type="checkbox"]',
            title: '✅ Widoczność wykresu',
            description: 'Zaznacz/odznacz aby pokazać/ukryć wykres. Ukryte wykresy nie są renderowane, co przyspiesza działanie aplikacji.'
        },
        {
            selector: '.chart-item:first-child .chart-drag-handle',
            title: '↕️ Przeciąganie',
            description: 'Chwyć za ikonę ⋮⋮ i przeciągnij aby zmienić kolejność wykresów. Kolejność jest zachowywana w localStorage.'
        },
        {
            selector: '#refreshChartsBtn',
            title: '🔄 Odświeżanie wykresów',
            description: 'Kliknij aby przeładować wszystkie widoczne wykresy z aktualnymi danymi z bazy.'
        },
        {
            selector: '.charts-container',
            title: '📈 Wykresy',
            description: 'Interaktywne wykresy Chart.js: aktywność posłów, frekwencja, wyniki głosowań, kluby parlamentarne i wiele więcej. Najedź na wykresy aby zobaczyć szczegóły.'
        }
    ],
    
    // Sekcja 5: Ustawienia
    '5': [
        {
            selector: 'input[name="consoleStyle"]',
            title: '🎨 Styl konsoli',
            description: 'Wybierz wygląd aplikacji: Jasny, Ciemny lub Retro (terminal). Styl jest zapisywany w localStorage.'
        },
        {
            selector: '#btnResetMemory',
            title: '🗑️ Reset pamięci',
            description: 'Usuwa wszystkie zapisane ustawienia z localStorage: pozycje przycisków, kolejność wykresów, preferencje UI.'
        },
        {
            selector: '#toggleFloatingBtns',
            title: '🔘 Widoczność przycisków',
            description: 'Włącz/wyłącz pływające przyciski po lewej stronie: import, export, AI, pomoc, reset.'
        },
        {
            selector: '#toggleTopBar',
            title: '📊 Pasek górny',
            description: 'Włącz/wyłącz pasek informacyjny u góry ekranu z wersją, statusem i informacjami.'
        },
        {
            selector: '#toggleBottomBar',
            title: '📊 Pasek dolny',
            description: 'Włącz/wyłącz pasek statusu na dole ekranu z nawigacją między sekcjami.'
        },
        {
            selector: 'input[name="helpMode"]',
            title: '❓ Tryb pomocy',
            description: 'Wybierz jak wyświetlać pomoc: Szklany (efekt rozmycia) lub Markerowy (żółte zaznaczenie).'
        }
    ],
    
    // Sekcja 6: Predykcja
    '6': [
        {
            selector: '.prediction-card:nth-child(1)',
            title: '🎯 Dyscyplina klubowa',
            description: 'Analiza jak często posłowie głosują zgodnie z linią swojego klubu. Wyższy wskaźnik = większa dyscyplina partii.'
        },
        {
            selector: '.prediction-card:nth-child(2)',
            title: '🔴 Potencjalni buntownicy',
            description: 'Wykrywa posłów którzy często głosują przeciwko większości swojego klubu. Identyfikuje anomalie i niezależnych myślicieli.'
        },
        {
            selector: '.prediction-card:nth-child(3)',
            title: '🤝 Podobieństwo klubów',
            description: 'Macierz koalicji - pokazuje jak często różne kluby głosują tak samo. Pozwala przewidywać potencjalne sojusze.'
        },
        {
            selector: '.prediction-card:nth-child(4)',
            title: '📈 Trendy aktywności',
            description: 'Analiza zmian aktywności posłów w czasie: kto zwiększa zaangażowanie, a kto je zmniejsza. Wykrywa wzorce i anomalie.'
        },
        {
            selector: '.prediction-card:nth-child(5)',
            title: '📰 Analiza online',
            description: 'Analiza sentimentu w artykułach prasowych o posłach. Pozwala przewidywać zmiany w opinii publicznej.'
        }
    ]
};

/**
 * Tour Manager Class
 */
class InteractiveTour {
    constructor() {
        this.currentStep = 0;
        this.isActive = false;
        this.overlay = null;
        this.spotlight = null;
        this.tooltip = null;
        this.mode = localStorage.getItem('helpMode') || 'glass'; // 'glass' or 'marker'
        this.currentSteps = []; // Dynamiczne kroki dla aktywnej sekcji
        this.currentSection = null;
        
        // Bind methods
        this.start = this.start.bind(this);
        this.stop = this.stop.bind(this);
        this.next = this.next.bind(this);
        this.prev = this.prev.bind(this);
        this.goToStep = this.goToStep.bind(this);
        this.handleKeyboard = this.handleKeyboard.bind(this);
        this.setMode = this.setMode.bind(this);
    }
    
    /**
     * Wykryj aktywną sekcję (która jest widoczna)
     */
    getActiveSection() {
        const sections = document.querySelectorAll('[data-section]');
        for (const section of sections) {
            const sectionNum = section.getAttribute('data-section');
            const isVisible = section.style.display !== 'none' && 
                            window.getComputedStyle(section).display !== 'none';
            if (isVisible) {
                return sectionNum;
            }
        }
        return '1'; // Domyślnie sekcja 1
    }
    
    /**
     * Zbuduj listę kroków dla danej sekcji
     * Filtruje tylko widoczne elementy
     */
    buildStepsForSection(sectionId) {
        const steps = SECTION_TOUR_STEPS[sectionId] || [];
        const visibleSteps = [];
        
        for (const step of steps) {
            const element = document.querySelector(step.selector);
            if (element) {
                // Sprawdź czy element jest widoczny
                const style = window.getComputedStyle(element);
                const isVisible = style.display !== 'none' && 
                                style.visibility !== 'hidden' &&
                                style.opacity !== '0';
                
                if (isVisible) {
                    visibleSteps.push(step);
                }
            }
        }
        
        return visibleSteps;
    }
    
    /**
     * Ustaw tryb pomocy
     */
    setMode(mode) {
        if (mode !== 'glass' && mode !== 'marker') return;
        this.mode = mode;
        localStorage.setItem('helpMode', mode);
        
        // Aktualizuj klasę overlay jeśli tour jest aktywny
        if (this.isActive && this.overlay) {
            this.overlay.className = mode === 'glass' ? 'tour-overlay' : 'tour-overlay tour-overlay-marker';
            if (this.spotlight) {
                this.spotlight.className = mode === 'glass' ? 'tour-spotlight' : 'tour-spotlight tour-spotlight-marker';
            }
        }
        
        console.log(`[Tour] Mode changed to: ${mode}`);
    }
    
    /**
     * Inicjalizacja elementów DOM
     */
    init() {
        this.overlay = document.getElementById('tourOverlay');
        this.spotlight = this.overlay?.querySelector('.tour-spotlight');
        this.tooltip = this.overlay?.querySelector('.tour-tooltip');
        
        // Przyciski nawigacji
        const closeBtn = document.getElementById('tourClose');
        const prevBtn = document.getElementById('tourPrev');
        const nextBtn = document.getElementById('tourNext');
        
        if (closeBtn) closeBtn.addEventListener('click', this.stop);
        if (prevBtn) prevBtn.addEventListener('click', this.prev);
        if (nextBtn) nextBtn.addEventListener('click', this.next);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboard);
        
        console.log('[Tour] Initialized');
    }
    
    /**
     * Start tour
     */
    start() {
        if (this.isActive) return;
        
        // Wykryj aktywną sekcję
        this.currentSection = this.getActiveSection();
        console.log(`[Tour] Detected active section: ${this.currentSection}`);
        
        // Zbuduj kroki dla aktywnej sekcji
        this.currentSteps = this.buildStepsForSection(this.currentSection);
        
        if (this.currentSteps.length === 0) {
            console.warn('[Tour] No visible steps found in current section');
            alert('Brak widocznych elementów do pokazania w tej sekcji! Przejdź do innej sekcji i spróbuj ponownie.');
            return;
        }
        
        console.log(`[Tour] Built ${this.currentSteps.length} steps for section ${this.currentSection}`);
        
        this.isActive = true;
        this.currentStep = 0;
        
        if (this.overlay) {
            // Ustaw klasę w zależności od trybu
            this.overlay.className = this.mode === 'glass' ? 'tour-overlay' : 'tour-overlay tour-overlay-marker';
            this.overlay.style.display = 'block';
        }
        
        if (this.spotlight) {
            this.spotlight.className = this.mode === 'glass' ? 'tour-spotlight' : 'tour-spotlight tour-spotlight-marker';
        }
        
        this.goToStep(0);
        console.log(`[Tour] Started in ${this.mode} mode for section ${this.currentSection}`);
    }
    
    /**
     * Stop tour
     */
    stop() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        if (this.overlay) {
            this.overlay.style.animation = 'tourFadeOut 0.3s ease';
            setTimeout(() => {
                this.overlay.style.display = 'none';
                this.overlay.style.animation = '';
            }, 300);
        }
        
        console.log('[Tour] Stopped');
    }
    
    /**
     * Następny krok
     */
    next() {
        if (this.currentStep < this.currentSteps.length - 1) {
            this.goToStep(this.currentStep + 1);
        }
    }
    
    /**
     * Poprzedni krok
     */
    prev() {
        if (this.currentStep > 0) {
            this.goToStep(this.currentStep - 1);
        }
    }
    
    /**
     * Przejdź do konkretnego kroku
     */
    goToStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= this.currentSteps.length) return;
        
        this.currentStep = stepIndex;
        const step = this.currentSteps[stepIndex];
        
        // Znajdź element
        const element = document.querySelector(step.selector);
        if (!element) {
            console.warn(`[Tour] Element not found: ${step.selector}`);
            return;
        }
        
        // Pozycja elementu
        const rect = element.getBoundingClientRect();
        
        // Ustaw spotlight
        if (this.spotlight) {
            this.spotlight.style.top = `${rect.top - 5}px`;
            this.spotlight.style.left = `${rect.left - 5}px`;
            this.spotlight.style.width = `${rect.width + 10}px`;
            this.spotlight.style.height = `${rect.height + 10}px`;
        }
        
        // Pozycjonuj tooltip (pod elementem lub nad jeśli brak miejsca)
        if (this.tooltip) {
            const tooltipRect = this.tooltip.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            
            if (spaceBelow > tooltipRect.height + 20) {
                // Pod elementem
                this.tooltip.style.top = `${rect.bottom + 15}px`;
                this.tooltip.style.left = `${Math.max(20, Math.min(rect.left, window.innerWidth - tooltipRect.width - 20))}px`;
            } else if (spaceAbove > tooltipRect.height + 20) {
                // Nad elementem
                this.tooltip.style.top = `${rect.top - tooltipRect.height - 15}px`;
                this.tooltip.style.left = `${Math.max(20, Math.min(rect.left, window.innerWidth - tooltipRect.width - 20))}px`;
            } else {
                // Na środku ekranu
                this.tooltip.style.top = `${(window.innerHeight - tooltipRect.height) / 2}px`;
                this.tooltip.style.left = `${(window.innerWidth - tooltipRect.width) / 2}px`;
            }
        }
        
        // Aktualizuj tekst
        const titleEl = document.getElementById('tourTitle');
        const descEl = document.getElementById('tourDescription');
        const counterEl = document.getElementById('tourCounter');
        
        if (titleEl) titleEl.textContent = step.title;
        if (descEl) descEl.textContent = step.description;
        if (counterEl) counterEl.textContent = `${stepIndex + 1} / ${this.currentSteps.length}`;
        
        // Aktualizuj przyciski nawigacji
        const prevBtn = document.getElementById('tourPrev');
        const nextBtn = document.getElementById('tourNext');
        
        if (prevBtn) prevBtn.disabled = stepIndex === 0;
        if (nextBtn) {
            if (stepIndex === this.currentSteps.length - 1) {
                nextBtn.textContent = 'Zakończ ✓';
                nextBtn.onclick = this.stop;
            } else {
                nextBtn.textContent = 'Dalej →';
                nextBtn.onclick = this.next;
            }
        }
        
        // Scroll do elementu jeśli nie jest widoczny
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        console.log(`[Tour] Step ${stepIndex + 1}/${this.currentSteps.length}: ${step.title}`);
    }
    
    /**
     * Obsługa klawiatury
     */
    handleKeyboard(e) {
        if (!this.isActive) return;
        
        switch (e.key) {
            case 'Escape':
                this.stop();
                break;
            case 'ArrowLeft':
                this.prev();
                break;
            case 'ArrowRight':
                this.next();
                break;
        }
    }
}

// Singleton instance
const tour = new InteractiveTour();

/**
 * Eksportowane funkcje
 */
export function initHelp() {
    console.log('[Help] Initializing...');
    tour.init();
    
    // Inicjalizuj radio buttony trybu pomocy
    const helpModeRadios = document.querySelectorAll('input[name="helpMode"]');
    const savedMode = localStorage.getItem('helpMode') || 'glass';
    
    helpModeRadios.forEach(radio => {
        // Ustaw zaznaczenie zgodnie z zapisanym trybem
        if (radio.value === savedMode) {
            radio.checked = true;
        }
        
        // Nasłuchuj zmian
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                tour.setMode(e.target.value);
            }
        });
    });
}

export function startTour() {
    tour.start();
}

export function stopTour() {
    tour.stop();
}

export function setHelpMode(mode) {
    tour.setMode(mode);
}

// Export dla window
window.startInteractiveTour = startTour;
window.stopInteractiveTour = stopTour;
window.setHelpMode = setHelpMode;

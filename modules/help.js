// Help & Interactive Tour System
// Interaktywny przewodnik po aplikacji z spotlight effect

/**
 * Tour steps - kroki przewodnika
 * Każdy krok pokazuje konkretny element interfejsu
 */
const TOUR_STEPS = [
    {
        selector: '[data-section="1"]',
        title: '📥 Sekcja: Dane',
        description: 'Tutaj pobierasz dane z API Sejmu RP. Wybierz instytucję, kadencję, zakres posiedzeń i zaznacz interesujące Cię dane.'
    },
    {
        selector: '#etlFetchBtn',
        title: '🚀 Przycisk pobierania',
        description: 'Kliknij ten przycisk aby rozpocząć pobieranie danych. Pipeline ETL automatycznie pobierze, przetworzy i zapisze dane do lokalnej bazy SQLite.'
    },
    {
        selector: '[data-section="2"]',
        title: '📊 Sekcja: Podsumowanie',
        description: 'Sprawdź statystyki pobranych danych - liczbę posłów, wypowiedzi, głosowań i innych rekordów. Zobacz co znajduje się w bazie danych.'
    },
    {
        selector: '[data-section="3"]',
        title: '🤖 Sekcja: AI Asystent',
        description: 'Rozmawiaj z lokalnym modelem AI o danych parlamentarnych. Model działa w przeglądarce (WebLLM) - wszystko pozostaje prywatne!'
    },
    {
        selector: '[data-section="4"]',
        title: '📈 Sekcja: Wykresy',
        description: 'Przeglądaj interaktywne wykresy i wizualizacje danych. Możesz zmieniać kolejność, ukrywać niepotrzebne i odświeżać wykresy.'
    },
    {
        selector: '.charts-control-panel',
        title: '🎛️ Panel zarządzania wykresami',
        description: 'Przeciągnij wykresy aby zmienić kolejność, zaznacz/odznacz aby pokazać/ukryć. Twoja konfiguracja jest automatycznie zapisywana!'
    },
    {
        selector: '[data-section="6"]',
        title: '🔮 Sekcja: Predykcja',
        description: 'Modele predykcyjne analizują wzorce i przewidują zachowania: dyscyplina klubowa, potencjalni buntownicy, koalicje i trends aktywności.'
    },
    {
        selector: '#importDbBtn',
        title: '📥 Import bazy',
        description: 'Możesz zaimportować wcześniej zapisaną bazę danych SQLite. Przydatne gdy chcesz załadować backup lub dane z innego komputera.'
    },
    {
        selector: '#exportDbBtn',
        title: '📤 Export bazy',
        description: 'Zapisz całą bazę danych do pliku .sqlite na dysku. Tworzenie backupów, przenoszenie danych lub analiza w zewnętrznych narzędziach.'
    },
    {
        selector: '[data-section="5"]',
        title: '⚙️ Sekcja: Ustawienia',
        description: 'Dostosuj interfejs: zmień styl konsoli, język, zarządzaj pamięcią przeglądarki i widocznością elementów UI.'
    }
];

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
        console.log(`[Tour] Started in ${this.mode} mode`);
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
        if (this.currentStep < TOUR_STEPS.length - 1) {
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
        if (stepIndex < 0 || stepIndex >= TOUR_STEPS.length) return;
        
        this.currentStep = stepIndex;
        const step = TOUR_STEPS[stepIndex];
        
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
        if (counterEl) counterEl.textContent = `${stepIndex + 1} / ${TOUR_STEPS.length}`;
        
        // Aktualizuj przyciski nawigacji
        const prevBtn = document.getElementById('tourPrev');
        const nextBtn = document.getElementById('tourNext');
        
        if (prevBtn) prevBtn.disabled = stepIndex === 0;
        if (nextBtn) {
            if (stepIndex === TOUR_STEPS.length - 1) {
                nextBtn.textContent = 'Zakończ ✓';
                nextBtn.onclick = this.stop;
            } else {
                nextBtn.textContent = 'Dalej →';
                nextBtn.onclick = this.next;
            }
        }
        
        // Scroll do elementu jeśli nie jest widoczny
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        console.log(`[Tour] Step ${stepIndex + 1}/${TOUR_STEPS.length}: ${step.title}`);
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

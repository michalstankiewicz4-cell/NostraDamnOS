# 📚 NostraDamnOS Wiki

Witaj w wiki projektu **NostraDamnOS** - systemu analizy parlamentarnej!

---

## 🎨 Design & Mockupy

### UI Mockupy
- 🎨 **ETL Panel** - główny interfejs pobierania danych
  - Lokalizacja: `index.html` (linie 95-310)
  - Opis: Panel z checkboxami, progress bar, floating console
  - Status: ✅ Zaimplementowany

- 🎨 **Floating Console** - konsola logów
  - Lokalizacja: `index.html` (linie 380-432)
  - Opis: Przycisk 📋 w prawym dolnym rogu
  - Status: ✅ Zaimplementowany

### Komponenty UI
- 📊 **Progress Bar** - dynamiczny tracking 0-100%
- 📋 **Console Interceptor** - przechwytuje wszystkie logi
- 🔒 **RODO Checkbox** - filtr danych wrażliwych
- ⚙️ **Range Selector** - radio buttons (ostatnie X / zakres od-do)

---

## 🖼️ Screenshots & Demos

### Live Demo
🔗 **[michalstankiewicz4-cell.github.io/NostraDamnOS](https://michalstankiewicz4-cell.github.io/NostraDamnOS/)**

### Lokalna wersja
```bash
cd C:\Users\micha\source\repos\NostraDamnOS
npx http-server -p 8766
# Otwórz: http://localhost:8766
```

---

## 📐 Architecture Diagrams

### System Flow
```
UI (ETL Panel) + Checkbox RODO
    ↓
Pipeline v2.0
    ↓
Fetcher v2.0 (12 modules) → Raw JSON
    ↓
🛡️ RODO Filter (optional) → Filtered JSON
    ↓
Normalizer v2.0 (11 modules) → SQL Records
    ↓
Database v2.0 (12 tables + indexes)
```

📄 Szczegóły: [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)

---

## 🎯 Use Cases & User Stories

### User Story 1: Pobranie danych z 2 posiedzeń
```
JAKO analityk parlamentarny
CHCĘ pobrać dane z ostatnich 2 posiedzeń
ABY zobaczyć najnowsze wypowiedzi i głosowania

KROKI:
1. Otwórz aplikację
2. Zostaw domyślne ustawienia (Sejm, kadencja 10, ostatnie 2)
3. Zaznacz: Wypowiedzi ✅, Głosowania ✅
4. Kliknij "📥 Pobierz dane z API"
5. Obserwuj progress bar (0-100%)
6. Sprawdź logi w konsoli

WYNIK:
✅ Baza zawiera ~1200 wypowiedzi
✅ Baza zawiera ~80 głosowań
✅ Czas: ~15-20s
```

### User Story 2: Filtr RODO aktywny
```
JAKO użytkownik dbający o prywatność
CHCĘ aby dane wrażliwe były usuwane automatycznie
ABY chronić informacje osobowe

KROKI:
1. Sprawdź checkbox "🔒 Filtr RODO" (domyślnie ✅)
2. Pobierz dane
3. Sprawdź logi: "🛡️ RODO: removing sensitive fields..."

WYNIK:
✅ Baza NIE zawiera: email, telefon, PESEL, adresów
✅ Zgodność z RODO
```

---

## 🔗 Quick Links

### Dokumentacja
- 📖 [README.md](../README.md) - Główna dokumentacja
- 📝 [CHANGELOG.md](../CHANGELOG.md) - Historia wersji
- 🗂️ [PROJECT-CONTEXT.md](../PROJECT-CONTEXT.md) - Pełny kontekst projektu

### Architektura
- 🏗️ [ARCHITECTURE.md](../docs/ARCHITECTURE.md) - System overview
- 🗄️ [DATABASE-V2.md](../docs/DATABASE-V2.md) - Schema (12 tables)
- 🔄 [PIPELINE-V2.md](../docs/PIPELINE-V2.md) - ETL orchestration

### ETL Components
- 🚰 [FETCHER-V2.md](../docs/FETCHER-V2.md) - Data fetching (12 modules)
- 🔄 [NORMALIZER-V2.md](../docs/NORMALIZER-V2.md) - Transformation (11 modules)
- 🚀 [INCREMENTAL-CACHE.md](../docs/INCREMENTAL-CACHE.md) - Smart caching

### Features
- 🌍 [GEO.md](../docs/GEO.md) - Geolocation (Europe only)
- 📁 [FILE-STRUCTURE.md](../docs/FILE-STRUCTURE.md) - Project structure

---

## 🛠️ Development Tools

### CSS Utilities
- **fix-height.js** - Quick CSS height adjustments
  ```bash
  node fix-height.js 50vh
  ```

### ETL Bridge
- **etl-bridge.js** - UI ↔ Pipeline synchronization
  - Obsługuje checkboxy
  - Aktualizuje estymację rozmiaru
  - Przekazuje konfigurację do Pipeline

---

## 💡 Tips & Tricks

### 1. Przyspieszenie pobierania
- Odznacz niepotrzebne moduły (np. Komisje)
- Użyj trybu "Meta" zamiast "Full" (plan)
- Incremental cache pobiera tylko nowe dane (10× szybciej)

### 2. Debugowanie
- Otwórz DevTools (F12)
- Zakładka Console - wszystkie logi
- Floating console (📋) - logi w UI

### 3. Czyszczenie
- Przycisk "🗑️ Wyczyść cache" - usuwa dane
- F5 - resetuje SQLite (in-memory)
- localStorage.clear() - usuwa metadata

---

## 🎨 Design Guidelines

### Kolory
- Primary: `#667eea` → `#764ba2` (gradient)
- Background: `#f7fafc`
- Text: `#2d3748`
- Border: `#e2e8f0`

### Spacing
- Margin: `12px` (unified)
- Padding: `6px` (form controls)
- Border radius: `6px`

### Icons
- 📥 Pobierz
- 🗑️ Wyczyść
- 🔒 RODO
- 📋 Console
- 🏛️ Parlament

---

## 🤝 Contributing

Zainteresowany rozwojem projektu? Zobacz [PROJECT-CONTEXT.md](../PROJECT-CONTEXT.md) sekcja "Do zrobienia (v2.2)".

---

**Ostatnia aktualizacja:** 2026-01-26  
**Wersja:** 2.1.0  
**Status:** Production-ready ✅

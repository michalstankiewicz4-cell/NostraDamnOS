# 🌍 Moduł Geolokalizacji

## Status: ❌ NIEAKTYWNY (gotowy do włączenia)

---

## 📋 Opis

Moduł `geo.js` ogranicza dostęp do aplikacji tylko dla użytkowników z Europy.

### Jak działa:

1. **Sprawdzenie strefy czasowej** (natychmiastowe)
   - Jeśli `Europe/Warsaw`, `Europe/Berlin`, etc. → ✅ przepuszcza

2. **Sprawdzenie języka przeglądarki** (natychmiastowe)
   - Jeśli polski, niemiecki, francuski, etc. → ✅ przepuszcza

3. **Sprawdzenie IP** (wymaga API)
   - Używa `https://ipapi.co/json/`
   - Jeśli kraj z Europy → ✅ przepuszcza
   - Jeśli kraj spoza Europy → ❌ **BLOKUJE**

4. **Fallback**
   - Jeśli API nie działa → ❌ **BLOKUJE** (bezpieczna opcja)

---

## 🚀 Jak włączyć

### Opcja 1: W `index.html` (najszybsza)

Znajdź w `<head>` sekcję:
```html
<!-- ⚠️ GEOLOKALIZACJA - NIEAKTYWNA -->
```

**Usuń komentarze wokół:**
```html
<script type="module">
    import { enforceEuropeOnly } from "./modules/geo.js";
    enforceEuropeOnly();
</script>
```

### Opcja 2: W module inicjalizacyjnym (np. w index.html) 

Na początku pliku dodaj:
```javascript
import { enforceEuropeOnly } from './modules/geo.js';
await enforceEuropeOnly();
```

---

## 🌍 Kraje europejskie (obsługiwane)

```
PL, DE, FR, ES, IT, PT, NL, BE, LU, AT, CZ, SK, HU, SI, HR,
RO, BG, GR, DK, SE, FI, NO, EE, LV, LT, IE, CY, MT, IS, LI, CH
```

---

## 🛡️ Co zobaczy użytkownik

### Z Europy:
- Strona działa normalnie ✅
- W konsoli: `✅ Przepuszczono: strefa czasowa Europa`

### Spoza Europy:
```
🌍 Dostęp ograniczony

Ta strona jest dostępna wyłącznie dla użytkowników z Europy.
Poproś o dostęp tel.: 797 486 355

Powód: Wykryto kraj spoza Europy (IP)
```

---

## ⚙️ Konfiguracja

### Zmiana listy krajów

W `modules/geo.js`, edytuj:
```javascript
const EUROPE = ["PL","DE","FR", ...];
```

### Zmiana komunikatu blokady

W `modules/geo.js`, funkcja `blockAccess()`:
```javascript
function blockAccess(reason) {
    document.body.innerHTML = `<div>Twoja wiadomość</div>`;
}
```

---

## ⚠️ Ważne uwagi

### API ipapi.co
- **Darmowy limit:** 1,000 requestów/dzień
- **Backup:** jeśli limit się skończy, blokuje ostrożnościowo

### Omijanie
To **grzecznościowe** ograniczenie, nie system bezpieczeństwa.
Użytkownicy mogą użyć VPN do Europy.

### RODO
Sprawdzanie IP = przetwarzanie danych osobowych.
Dodaj informację w polityce prywatności.

---

## 📝 Powiązane pliki

- `modules/geo.js` - kod modułu
- `index.html` - miejsce aktywacji (zakomentowane)
- `docs/GEO.md` - ta dokumentacja

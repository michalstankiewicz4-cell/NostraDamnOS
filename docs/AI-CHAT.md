# 🤖 AI Chat Assistant - Dokumentacja

## Przegląd

AI Chat Assistant to nowa funkcja w Parlament "puppy" umożliwiająca rozmowę z asystentem AI, który może odpowiadać na pytania o dane parlamentarne przechowywane w lokalnej bazie danych.

## ✨ Funkcje

- **3 modele AI do wyboru:**
  - OpenAI GPT-4 Turbo
  - Anthropic Claude 3.5 Sonnet
  - Google Gemini Pro

- **Zapytania w języku naturalnym** - zadawaj pytania po polsku
- **Automatyczne generowanie SQL** - AI tworzy zapytania do bazy danych
- **Wykonywanie zapytań** - wyniki są automatycznie pobierane i formatowane
- **Lokalne przechowywanie kluczy API** - klucze zapisywane w localStorage

## 🚀 Jak używać

### 1. Otwórz okno chatu

Kliknij floating button **🤖** (zielony przycisk z robotem) po prawej stronie ekranu.

### 2. Wybierz model AI

W górnej części okna wybierz model AI z listy rozwijanej:
- **OpenAI GPT-4** - wymaga klucza API z platform.openai.com
- **Anthropic Claude** - wymaga klucza API z console.anthropic.com  
- **Google Gemini** - wymaga klucza API z makersuite.google.com

### 3. Wygeneruj klucz API

Kliknij link **🔑 Wygeneruj klucz API** - otworzy się strona wybranego providera, gdzie możesz wygenerować klucz.

### 4. Wprowadź klucz API

Wklej swój klucz API w pole "Klucz API". Klucz zostanie zapisany w localStorage i załadowany przy następnym otwarciu.

### 5. Zadawaj pytania

Wpisz pytanie w polu tekstowym na dole okna, np.:
- "Ile posłów jest w bazie danych?"
- "Pokaż wszystkich posłów z klubu PiS"
- "Ile głosowań odbyło się na posiedzeniu numer 50?"
- "Kto najczęściej zabierał głos w Sejmie?"

Wciśnij **Enter** lub kliknij przycisk **📤** aby wysłać.

## 🔐 Bezpieczeństwo

- **Klucze API** są przechowywane **tylko w Twojej przeglądarce** (localStorage)
- **Nie są wysyłane** na żaden serwer oprócz wybranego providera AI
- **Baza danych** jest lokalna - dane nie opuszczają Twojego komputera
- Możesz w każdej chwili usunąć klucz API czyszcząc localStorage przeglądarki

## 📊 Jak to działa

1. **Użytkownik** zadaje pytanie po polsku
2. **AI** analizuje pytanie i schemat bazy danych
3. **AI** generuje zapytanie SQL
4. **System** wykonuje SQL na lokalnej bazie SQLite
5. **Wyniki** są formatowane i wyświetlane w oknie chatu

## 💡 Przykłady zapytań

```
👤 Użytkownik: Ile posłów jest w bazie?
🤖 AI: SELECT COUNT(*) FROM poslowie
      Wynik: 460 posłów

👤 Użytkownik: Pokaż listę klubów
🤖 AI: SELECT DISTINCT club FROM poslowie ORDER BY club
      Wynik: KO, Lewica, PiS, PSL, Konfederacja...

👤 Użytkownik: Kto najczęściej zabierał głos?
🤖 AI: SELECT firstName, lastName, COUNT(*) as speeches 
      FROM wypowiedzi w 
      JOIN poslowie p ON w.speakerId = p.id 
      GROUP BY speakerId 
      ORDER BY speeches DESC 
      LIMIT 10
```

## ⚙️ Konfiguracja

### Zmiana modelu
Możesz w każdej chwili zmienić model AI - wystarczy wybrać inny z listy rozwijanej.

### Zapisywanie preferencji
System automatycznie zapisuje:
- Wybrany model AI
- Klucz API
- Historię konwersacji (w pamięci - resetuje się po odświeżeniu)

### Skróty klawiszowe
- **Enter** - wyślij wiadomość
- **Shift + Enter** - nowa linia w textarea

## 🎨 Pozycjonowanie

Przycisk AI Chat jest **przeciągalny** (drag & drop):
1. Przytrzymaj przycisk przez **2 sekundy**
2. Przeciągnij w wybrane miejsce
3. Pozycja zostanie zapisana

## 🔧 Wymagania

- **Klucz API** wybranego providera (OpenAI/Claude/Gemini)
- **Wypełniona baza danych** - chat działa na danych w SQLite
- **Przeglądarka** z obsługą ES6 modules i localStorage

## ⚠️ Uwagi

- **Koszty API**: Każde zapytanie do AI jest płatne (według cennika providera)
- **Limity**: Providery mają limity requestów i tokenów
- **Prywatność**: Pytania i schemat bazy są wysyłane do providera AI
- **Dokładność**: AI może popełniać błędy w SQL - zawsze weryfikuj wyniki

## 🆘 Rozwiązywanie problemów

### Błąd: "Proszę podać klucz API"
- Upewnij się, że wkleiłeś klucz w pole "Klucz API"

### Błąd: "API request failed"
- Sprawdź czy klucz API jest poprawny
- Sprawdź czy masz wystarczający kredyt u providera
- Sprawdź limity API

### Nie ma wyników SQL
- Upewnij się, że baza danych jest wypełniona
- Sprawdź logi w konsoli przeglądarki (F12)

### Okno chatu nie otwiera się
- Sprawdź konsolę przeglądarki (F12) pod kątem błędów
- Odśwież stronę (Ctrl+F5)

## 📝 Pliki

- `modules/ai-chat.js` - główna logika chatu
- `index.html` - HTML okna chatu
- `style.css` - style CSS (sekcja "AI Chat Assistant")

## 🔮 Przyszłe ulepszenia

- [ ] WebLLM - lokalne modele AI bez API
- [ ] Historia konwersacji (persist)
- [ ] Sugestie zapytań
- [ ] Eksport konwersacji
- [ ] Wykresy i wizualizacje wyników

---

**Wersja:** 3.5.3  
**Data:** 2026-02-05  
**Autor:** Michał Stankiewicz

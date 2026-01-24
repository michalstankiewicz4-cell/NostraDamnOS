# 📋 TODO - Przyszłe rozszerzenia systemu

## 🧠 Dane do dodania (opcjonalne, ale wartościowe)

### 🟦 A) Interpelacje poselskie

**API:** `https://api.sejm.gov.pl/sejm/term10/interpellations`

**Co dostępne:**
- Treść interpelacji
- Odpowiedzi ministerstw
- Daty złożenia i odpowiedzi
- Autorzy (posłowie)
- Numery spraw
- Status (oczekuje/odpowiedziano)

**Zastosowania:**
- ✅ Analiza problemów zgłaszanych przez posłów
- ✅ Analiza reaktywności rządu (czas odpowiedzi)
- ✅ Mapowanie tematów na regiony (interpelacje lokalne)
- ✅ Trendy tematyczne w czasie
- ✅ NLP: wykrywanie najpopularniejszych problemów

**Dane tekstowe:** Ogromny zbiór - często bardziej szczegółowe niż wypowiedzi.

---

### 🟦 B) Oświadczenia poselskie

**API:** Endpoint do ustalenia

**Co dostępne:**
- Treść oświadczenia
- Autor
- Data
- Kontekst (po jakim głosowaniu/debacie)

**Zastosowania:**
- ✅ Analiza retoryki osobistej
- ✅ Analiza tematów lokalnych/regionalnych
- ✅ Wykrywanie konfliktów wewnątrz klubów
- ✅ Sentiment analysis (często emocjonalne)

**Cechy:** Krótsza forma, bardziej osobista niż wypowiedzi plenarne.

---

### 🟦 C) Zapytania i pytania w sprawach bieżących

**API:** `https://api.sejm.gov.pl/sejm/term10/questions` (?)

**Co dostępne:**
- Treść pytania
- Adresat (minister)
- Odpowiedź
- Daty

**Zastosowania:**
- ✅ Analiza relacji poseł ↔ minister
- ✅ Analiza tematów konfliktowych
- ✅ Mapowanie kompetencji ministerstw
- ✅ Wykrywanie "gorących tematów"

**Cechy:** Krótkie, konkretne, kierowane bezpośrednio do rządu.

---

### 🟦 D) Komisje sejmowe

**API:** `https://api.sejm.gov.pl/sejm/term10/committees`

**Co dostępne:**
- Lista komisji (stałe, nadzwyczajne, śledcze)
- Składy komisji (członkowie)
- Harmonogramy posiedzeń
- Protokoły (czasem dostępne)
- Listy obecności

**Zastosowania:**
- ✅ Analiza specjalizacji posłów (w jakich komisjach zasiadają)
- ✅ Analiza aktywności poza plenarną
- ✅ Analiza wpływu komisji na projekty ustaw
- ✅ Sieć powiązań (kto z kim pracuje)
- ✅ Ranking aktywności komisyjnej

**Wartość:** Komisje to "laboratorium" Sejmu - tam dzieje się praca merytoryczna.

---

### 🟦 E) Projekty ustaw

**API:** `https://api.sejm.gov.pl/sejm/term10/prints` (druki sejmowe)

**Co dostępne:**
- Treść projektów ustaw
- Uzasadnienia (często długie teksty)
- Autorzy (kluby, posłowie, rząd, obywatele)
- Przebieg procesu legislacyjnego
- Wyniki głosowań nad ustawą (I, II, III czytanie)
- Poprawki Senatu

**Zastosowania:**
- ✅ Analiza procesu legislacyjnego (czas trwania, zmiany)
- ✅ Analiza wpływu klubów na prawo
- ✅ Analiza tematyczna ustaw (kategoryzacja)
- ✅ NLP: porównywanie pierwotnych projektów z finalnymi wersjami
- ✅ Wykrywanie "kontrowersyjnych" ustaw (długie debaty, dużo poprawek)

**Wartość:** To jest **główny produkt** pracy Sejmu - prawodawstwo.

---

### 🟦 F) Oświadczenia majątkowe

**Dostępność:** Publiczne, ale trudniejsze do parsowania (często PDF/skan)

**Co dostępne:**
- Majątek posłów (nieruchomości, pojazdy, oszczędności)
- Dochody
- Zobowiązania finansowe
- Aktualizacje roczne

**Zastosowania:**
- ✅ Analiza majątkowa posłów
- ✅ Korelacje z głosowaniami (np. głosy za podatkami)
- ✅ Analiza zmian majątku w czasie (trend wzrostowy?)
- ✅ Wykrywanie konfliktów interesów

**Trudność:** Format niejednolity, wymaga OCR lub ręcznego parsowania.

---

### 🟦 G) Frekwencja posłów

**API:** Można wyliczyć z głosowań, ale możliwe że osobny endpoint

**Co dostępne:**
- Obecność na posiedzeniach
- Obecność przy głosowaniach
- Usprawiedliwienia

**Zastosowania:**
- ✅ Ranking aktywności posłów
- ✅ Analiza dyscypliny klubowej
- ✅ Wykrywanie "martwych dusz" (rzadko obecni)
- ✅ Korelacje z innymi metrykami (wypowiedzi, interpelacje)

**Wartość:** Prosta, ale ważna metryka obywatelska.

---

### 🟦 H) Wystąpienia w komisjach (stenogramy komisji)

**Status:** Najbardziej niedoceniony zbiór danych!

**API:** `https://api.sejm.gov.pl/sejm/term10/committee-sittings` (?)

**Co dostępne:**
- Stenogramy posiedzeń komisji
- Wypowiedzi posłów w komisjach
- Wypowiedzi ekspertów, lobbystów, przedstawicieli organizacji
- Pytania i odpowiedzi

**Zastosowania:**
- ✅ Analiza merytoryczna (komisje = głębsza dyskusja)
- ✅ Analiza ekspercka (kto jest zapraszany)
- ✅ Analiza wpływu lobbingu (kto przemawia, co mówi)
- ✅ NLP: wykrywanie argumentacji eksperckiej vs. politycznej
- ✅ Sieć wpływów (kto konsultuje z kim)

**Wartość:** 🌟 **NAJWYŻSZA** - komisje to miejsce rzeczywistej pracy legislacyjnej!

---

## 🔄 Kolejność implementacji (rekomendacja)

### Faza 1: Podstawowe (wartość/nakład pracy = wysoki)
1. ✅ **Komisje** - struktura, składy, posiedzenia
2. ✅ **Projekty ustaw** - proces legislacyjny
3. ✅ **Frekwencja** - prosta metryka

### Faza 2: Tekstowe (wartość/nakład = średni)
4. ✅ **Interpelacje** - duży zbiór tekstów
5. ✅ **Oświadczenia** - retoryka osobista
6. ✅ **Pytania** - relacje z rządem

### Faza 3: Zaawansowane (wartość/nakład = wymagający)
7. ✅ **Stenogramy komisji** - głęboka analiza
8. ✅ **Oświadczenia majątkowe** - trudne parsowanie

---

## 📊 Szacunkowa wartość danych

| Typ danych | Wartość analityczna | Trudność implementacji | Priorytet |
|------------|---------------------|------------------------|-----------|
| Komisje (struktury) | ⭐⭐⭐⭐⭐ | ⭐⭐ | 🔥 Wysoki |
| Projekty ustaw | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 🔥 Wysoki |
| Interpelacje | ⭐⭐⭐⭐ | ⭐⭐ | 🔥 Wysoki |
| Stenogramy komisji | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 🟡 Średni |
| Frekwencja | ⭐⭐⭐ | ⭐ | 🟡 Średni |
| Oświadczenia | ⭐⭐⭐ | ⭐⭐ | 🟡 Średni |
| Pytania | ⭐⭐⭐ | ⭐⭐ | 🟢 Niski |
| Oświadczenia majątkowe | ⭐⭐ | ⭐⭐⭐⭐⭐ | 🟢 Niski |

---

## 🛠️ Przykładowe endpointy do zbadania

```bash
# Interpelacje
GET https://api.sejm.gov.pl/sejm/term10/interpellations
GET https://api.sejm.gov.pl/sejm/term10/interpellations/{num}

# Druki (projekty ustaw)
GET https://api.sejm.gov.pl/sejm/term10/prints
GET https://api.sejm.gov.pl/sejm/term10/prints/{num}

# Komisje
GET https://api.sejm.gov.pl/sejm/term10/committees
GET https://api.sejm.gov.pl/sejm/term10/committees/{code}
GET https://api.sejm.gov.pl/sejm/term10/committees/{code}/sittings

# Proces legislacyjny
GET https://api.sejm.gov.pl/sejm/term10/processes
GET https://api.sejm.gov.pl/sejm/term10/processes/{num}

# TODO: Zweryfikować dostępność każdego endpointu
```

---

## 💡 Pomysły na analizy (gdy dane będą dostępne)

### 1. **"Mapka wpływów"**
- Kto z kim pracuje w komisjach?
- Kto jest najbardziej wpływowy w procesie legislacyjnym?
- Sieci powiązań posłów-ekspertów-lobbystów

### 2. **"Ranking ekspertów"**
- Kto najczęściej jest zapraszany do komisji?
- Jakie organizacje mają największy wpływ?

### 3. **"Ścieżka ustawy"**
- Jak zmienia się projekt od wpłynięcia do uchwalenia?
- Średni czas procesu legislacyjnego
- Które komisje blokują/przyspieszają projekty?

### 4. **"Analiza lobbingu"**
- Kto przemawia w komisjach? (firmy, NGO, eksperci)
- Jakie argumenty są najskuteczniejsze?

### 5. **"Posłowie specjaliści"**
- Kto jest ekspertem w jakich tematach?
- Analiza wypowiedzi + komisje + interpelacje

---

## 📝 Status

**Utworzono:** 2025-01-23  
**Ostatnia aktualizacja:** 2025-01-23  
**Priorytet ogólny:** 🟡 Średni (najpierw dokończyć podstawową wersję)

**Do dyskusji:**
- Które dane dodać najpierw?
- Czy skupić się na głębi (stenogramy komisji) czy szerokości (wszystkie typy)?
- Czy potrzebne są dane historyczne (kadencje wcześniejsze)?

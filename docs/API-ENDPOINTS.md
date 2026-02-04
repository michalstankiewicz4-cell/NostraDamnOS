# 🌐 API Sejmu - Mapa Endpointów

## 📋 Spis treści
- [Używane Endpointy](#-używane-endpointy-status-200)
- [Niedziałające Endpointy](#-endpointy-nie-działające-404204)
- [Opcjonalne](#-opcjonalne-low-priority)
- [Podsumowanie](#-podsumowanie)

---

## ✅ Używane Endpointy (Status 200)

### 1️⃣ Posłowie

**Endpointy:**
- **Lista**: `/sejm/term{N}/MP`
- **Szczegóły**: `/sejm/term{N}/MP/{id}`
- **Oświadczenia**: `/sejm/term{N}/MP/{id}/statements`

**Moduł:** `fetcher/modules/poslowie.js`, `oswiadczenia.js`

**Dane:**
- Podstawowe info (imię, nazwisko, klub, okręg)
- Historia klubów
- Biura poselskie
- Oświadczenia majątkowe (metadata + PDF)

**Przykłady:**
```
GET https://api.sejm.gov.pl/sejm/term10/MP
GET https://api.sejm.gov.pl/sejm/term10/MP/389
GET https://api.sejm.gov.pl/sejm/term10/MP/389/statements
```

---

### 2️⃣ Posiedzenia

**Endpointy:**
- **Lista**: `/sejm/term{N}/proceedings`
- **Szczegóły**: `/sejm/term{N}/proceedings/{num}`

**Moduł:** `fetcher/modules/posiedzenia.js`

**Dane:**
- Numer posiedzenia
- Daty rozpoczęcia/zakończenia
- Dni obrad
- Link do stenogramów

**Przykłady:**
```
GET https://api.sejm.gov.pl/sejm/term10/proceedings
GET https://api.sejm.gov.pl/sejm/term10/proceedings/1
```

---

### 3️⃣ Wypowiedzi (Stenogramy)

**Endpointy:**
- **Stenogramy**: `/sejm/term{N}/proceedings/{num}/{date}/transcripts/{day}`

**Moduł:** `fetcher/modules/wypowiedzi.js`

**Dane:**
- Pełne stenogramy z posiedzeń
- Wypowiedzi posłów
- Interwencje
- Wystąpienia

**Przykłady:**
```
GET https://api.sejm.gov.pl/sejm/term10/proceedings/1/2023-11-13/transcripts/1
```

---

### 4️⃣ Głosowania

**Endpointy:**
- **Lista**: `/sejm/term{N}/votings`
- **Per posiedzenie**: `/sejm/term{N}/votings/{sitting}`
- **Głosy indywidualne**: `/sejm/term{N}/votings/{sitting}/{voting}`

**Moduły:** `fetcher/modules/glosowania.js`, `glosy.js`

**Dane:**
- Wyniki głosowań (za/przeciw/wstrzymało się)
- Temat głosowania
- Głosy indywidualne posłów (tak/nie/wstrzymuję/nieobecny)

**Przykłady:**
```
GET https://api.sejm.gov.pl/sejm/term10/votings
GET https://api.sejm.gov.pl/sejm/term10/votings/1
GET https://api.sejm.gov.pl/sejm/term10/votings/1/1
```

---

### 5️⃣ Interpelacje

**Endpointy:**
- **Lista**: `/sejm/term{N}/interpellations`
- **Szczegóły**: `/sejm/term{N}/interpellations/{num}`

**Moduł:** `fetcher/modules/interpelacje.js`

**Dane:**
- Interpelacje poselskie
- Zapytania
- Odpowiedzi rządowe
- Status (przyjęta/odrzucona)

**Przykłady:**
```
GET https://api.sejm.gov.pl/sejm/term10/interpellations
GET https://api.sejm.gov.pl/sejm/term10/interpellations/1234
```

---

### 6️⃣ Projekty ustaw

**Endpointy:**
- **Druki**: `/sejm/term{N}/prints`
- **Druk szczegóły**: `/sejm/term{N}/prints/{num}`
- **Procesy legislacyjne**: `/sejm/term{N}/processes`
- **Proces szczegóły**: `/sejm/term{N}/processes/{num}`

**Moduł:** `fetcher/modules/projekty_ustaw.js`

**Dane:**
- Druki sejmowe
- Projekty ustaw
- Etapy procesu legislacyjnego
- Status (w pracach/przyjęty/odrzucony)

**Przykłady:**
```
GET https://api.sejm.gov.pl/sejm/term10/prints
GET https://api.sejm.gov.pl/sejm/term10/prints/1
GET https://api.sejm.gov.pl/sejm/term10/processes
```

---

### 7️⃣ Komisje

**Endpointy:**
- **Lista komisji**: `/sejm/term{N}/committees`
- **Posiedzenia komisji**: `/sejm/term{N}/committees/{code}/sittings`
- **Stenogramy komisji**: `/sejm/term{N}/committees/{code}/sittings/{num}/transcripts`

**Moduły:** `fetcher/modules/komisje.js`, `komisje_posiedzenia.js`, `komisje_wypowiedzi.js`

**Dane:**
- Lista komisji sejmowych
- Skład komisji (przewodniczący, członkowie)
- Posiedzenia komisji
- Stenogramy z posiedzeń komisji

**Przykłady:**
```
GET https://api.sejm.gov.pl/sejm/term10/committees
GET https://api.sejm.gov.pl/sejm/term10/committees/FIN/sittings
GET https://api.sejm.gov.pl/sejm/term10/committees/FIN/sittings/1/transcripts
```

---

### 8️⃣ Zapytania pisemne

**Endpointy:**
- **Lista**: `/sejm/term{N}/writtenQuestions`
- **Szczegóły**: `/sejm/term{N}/writtenQuestions/{num}`
- **Treść zapytania**: `/sejm/term{N}/writtenQuestions/{num}/body`
- **Treść odpowiedzi**: `/sejm/term{N}/writtenQuestions/{num}/reply/{key}/body`

**Moduł:** `fetcher/modules/zapytania.js`

**Dane:**
- Zapytania pisemne posłów
- Odpowiedzi ministerstw (termin: 7 dni)
- Status opóźnień odpowiedzi

**Różnica vs Interpelacje:**
- **Zapytania**: krótsze, odpowiedź w 7 dni
- **Interpelacje**: dłuższe, odpowiedź w 21 dni

**Przykłady:**
```
GET https://api.sejm.gov.pl/sejm/term10/writtenQuestions
GET https://api.sejm.gov.pl/sejm/term10/writtenQuestions/1234
GET https://api.sejm.gov.pl/sejm/term10/writtenQuestions/1234/body
```

---

## ❌ Endpointy NIE działające (404/204)

**NIE UŻYWAĆ - endpointy zwracają błędy:**

| Endpoint | Status | Powód |
|----------|--------|-------|
| `/sejm/term{N}/clubs/{id}` | 404 | Szczegóły klubów niedostępne |
| `/sejm/term{N}/committees/{id}` | 204 | Brak treści (no content) |
| `/sejm/term{N}/videos/{id}` | 404/204 | Szczegóły nagrań niedostępne |
| `/sejm/term{N}/votings/{id}/{id}` | 404/204 | Niepoprawny wzorzec |

**Objaśnienia:**
- **clubs/{id}**: Lista klubów (`/clubs`) działa, ale szczegóły pojedynczego klubu → 404
- **committees/{id}**: Lista komisji działa, szczegóły → 204 (puste)
- **videos/{id}**: API nie udostępnia szczegółów nagrań
- **votings/{id}/{id}**: Niepoprawny wzorzec zagnieżdżenia

---

## ⚠️ Opcjonalne (low priority)

### `/clubs` - Kluby parlamentarne
```
Endpoint: /sejm/term{N}/clubs
Status:   200 OK (lista działa)
Użyteczność: NISKA - dane klubów już są w /MP
```

**Dlaczego opcjonalny:**
- Każdy poseł w `/MP` ma już `club` (nazwa klubu)
- Osobny moduł byłby redundantny
- Brak szczegółów klubu (`/clubs/{id}` → 404)

**Rekomendacja:** SKIP - niepotrzebne

---

### `/videos` - Nagrania wideo
```
Endpoint: /sejm/term{N}/videos
Status:   200 OK (lista działa)
Użyteczność: BARDZO NISKA
```

**Dlaczego opcjonalny:**
- Brak szczegółów nagrania (`/videos/{id}` → 404)
- Duże dane (video URLs)
- Niepotrzebne dla analiz tekstowych/danych

**Rekomendacja:** SKIP - niepotrzebne

---

## 📊 Podsumowanie

### ✅ Kompletność

```
Zaimplementowane moduły:  12
Pokrycie API:            ~95% użytecznych endpointów
Redundancja:             Brak
Problematyczne:          Prawidłowo pominięte
```

### 📈 Status modułów

| Kategoria | Endpoint | Moduł | Status |
|-----------|----------|-------|--------|
| Posłowie | `/MP` | ✅ `poslowie.js` | Działa |
| Posiedzenia | `/proceedings` | ✅ `posiedzenia.js` | Działa |
| Wypowiedzi | `/proceedings/.../transcripts` | ✅ `wypowiedzi.js` | Działa |
| Głosowania | `/votings` | ✅ `glosowania.js` | Działa |
| Głosy | `/votings/{s}/{v}` | ✅ `glosy.js` | Działa |
| Interpelacje | `/interpellations` | ✅ `interpelacje.js` | Działa |
| Zapytania pisemne | `/writtenQuestions` | ✅ `zapytania.js` | Działa |
| Projekty ustaw | `/prints`, `/processes` | ✅ `projekty_ustaw.js` | Działa |
| Komisje | `/committees` | ✅ `komisje.js` | Działa |
| Komisje posiedzenia | `/committees/.../sittings` | ✅ `komisje_posiedzenia.js` | Działa |
| Komisje wypowiedzi | `/committees/.../transcripts` | ✅ `komisje_wypowiedzi.js` | Działa |
| Oświadczenia | `/MP/{id}/statements` | ✅ `oswiadczenia.js` | Działa |

---

## 🔗 Zobacz także

- [FETCHER-V2.md](FETCHER-V2.md) - Dokumentacja fetcher
- [NORMALIZER-V2.md](NORMALIZER-V2.md) - Dokumentacja normalizer
- [PIPELINE-V2.md](PIPELINE-V2.md) - Pipeline ETL
- [DATA-TYPES.json](DATA-TYPES.json) - Struktura danych (JSON)
- [api-audit-2026-02.csv](api-audit-2026-02.csv) - Audyt API (archiwum)

---

## 📅 Ostatnia aktualizacja

**Data:** 2026-02-03  
**Audyt API:** 1459 endpointów przeanalizowanych  
**Źródło:** Oficjalne API Sejmu RP

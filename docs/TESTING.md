# 🧪 Testowanie GitHub Pages

## URLs do sprawdzenia:

### 1. Strona testowa (nowa)
```
https://michalstankiewicz4-cell.github.io/NostraDamnOS/test.html
```

**Co sprawdza:**
- ✅ Czy manifest.json ładuje się poprawnie
- ✅ Czy data-loader odczytuje ścieżki z manifestu
- ✅ Czy pliki z `/data/final/` są dostępne
- ✅ Czy role są poprawnie rozpoznane
- ✅ Statystyki danych

**Oczekiwany rezultat:**
```
✅ Manifest wczytany: v0.3.0
📊 Statystyki:
  - Posłowie: 498
  - Wypowiedzi: 577
  - Głosowania: 14
  - Głosy: 6440
  
👥 Statystyki ról:
  - poseł: 530
  - wiceminister: 31
  - minister: 10
  - premier: 2
  - prokurator: 2
  - przewodniczący: 1
  - prezydent: 1
```

---

### 2. Główna aplikacja
```
https://michalstankiewicz4-cell.github.io/NostraDamnOS/
```

**Co sprawdza:**
- ✅ Przycisk "🚀 Wczytaj dane z serwera"
- ✅ Automatyczne ładowanie z progress barem
- ✅ Wyświetlanie statystyk

**Jak przetestować:**
1. Otwórz link
2. Kliknij "🚀 Wczytaj dane z serwera"
3. Poczekaj na progress bar
4. Sprawdź czy pokazuje statystyki

---

## Troubleshooting

### Problem: 404 Not Found
**Przyczyna:** GitHub Pages jeszcze nie zaktualizował plików  
**Rozwiązanie:** Poczekaj 2-5 minut i odśwież stronę

### Problem: CORS Error
**Przyczyna:** Niepoprawna konfiguracja GitHub Pages  
**Rozwiązanie:** Sprawdź Settings → Pages → Source: `main` branch, `/ (root)`

### Problem: Manifest nie ładuje się
**Przyczyna:** Niepoprawna ścieżka w data-loader  
**Rozwiązanie:** Sprawdź w konsoli deweloperskiej (F12) jaki URL jest pobierany

### Problem: Pliki z /final/ nie ładują się
**Przyczyna:** Pliki nie zostały wysłane na GitHub  
**Rozwiązanie:** 
```bash
git add data/final/*.jsonl
git commit -m "Add final data files"
git push
```

---

## Weryfikacja lokalnie (przed GitHub Pages)

```bash
# 1. Uruchom lokalny serwer
python -m http.server 8765

# 2. Otwórz w przeglądarce
http://localhost:8765/test.html

# 3. Sprawdź konsolę deweloperską (F12)
# Powinno być:
# ✅ Manifest loaded: {version: '0.3.0', ...}
# ✅ Loaded poslowie.jsonl: 498 records
# ✅ Loaded wypowiedzi.jsonl: 577 records
# ...
```

---

## Checklist przed deploymentem

- [x] Pliki w `/data/final/` są na GitHubie
- [x] `manifest.json` wskazuje na `final/*.jsonl`
- [x] `data-loader.js` czyta `path` z manifestu
- [x] `test.html` utworzony
- [x] Wszystko scommitowane i wysłane
- [x] Projekt oczyszczony (usunięto OLD, backupy, duplikaty)
- [x] `.gitignore` dodany
- [x] GitHub Pages deployment zakończony
- [ ] Test na `test.html` przeszedł (sprawdź!)
- [ ] Główna aplikacja działa (sprawdź!)

---

## Status: ✅ Gotowe do testowania

**Ostatni commit:** `97bb165` - Clean up project  
**Data:** 2025-01-23  

**Sprawdź teraz:**
```
https://michalstankiewicz4-cell.github.io/NostraDamnOS/test.html
```
https://michalstankiewicz4-cell.github.io/NostraDamnOS/test.html
```

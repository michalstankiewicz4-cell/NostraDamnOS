# SZYBKI FIX - Dodaj nagłówek do ETL Panel

Otwórz `index.html` i znajdź linię ~22:

```html
        <main>
            <!-- ETL PANEL -->
            <div class="etl-panel">
```

Zamień na:

```html
        <main>
            <!-- ETL PANEL -->
            <h2 style="margin-bottom: 1.5rem; color: #2d3748; font-size: 1.8rem;">
                📥 Import Danych z API Sejmu
            </h2>
            
            <div class="etl-panel">
```

Zapisz i odśwież stronę!

---

✅ CSS już naprawiony - wysokość zmniejszona z 80vh → 65vh
✅ Sidebar nie będzie wymagał przewijania

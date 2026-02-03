# 🔄 Jak aktualizować wersję i nazwę projektu

## 📦 Single Source of Truth: `project.json`

Wszystkie metadane projektu (nazwa, wersja, autor) są w pliku **`project.json`**.

```json
{
  "name": "Parlament \"puppy\"",
  "version": "2.1.1",
  "author": { ... },
  ...
}
```

---

## 🤖 GitHub Actions - Automatyczna Aktualizacja

**Jak działa:**
1. Edytujesz **tylko** plik `project.json`
2. Commitujesz i pushujesz na GitHub
3. GitHub Action automatycznie:
   - Odczytuje nazwę i wersję z `project.json`
   - Aktualizuje wszystkie pliki
   - Commituje zmiany z komunikatem "🤖 Auto-update version to vX.X.X"

**Przykład:**
```bash
# Edytuj project.json (zmień version: "2.2.0")
nano project.json

# Commit i push
git add project.json
git commit -m "Bump version to 2.2.0"
git push origin main

# GitHub Action zrobi resztę automatycznie!
```

**Konfiguracja:** `.github/workflows/update-version.yml`

**Status:** ✅ Aktywne - GitHub Action jest skonfigurowane i działa automatycznie

---

## 📂 Które pliki się aktualizują?

| Plik | Co się zmienia |
|------|----------------|
| `project.json` | **SOURCE** - nazwa, wersja, metadata |
| `index.html` | `<title>`, `<h1>`, version badge |
| `README.md` | Header `# 🏛️`, subtitle version |
| `PROJECT-CONTEXT.md` | **Oficjalna nazwa**, **Wersja** |
| `LICENSE` | **Projekt**, **Wersja**, **Data** |

---

## 🎯 Best Practices

### ✅ DO:
- Zawsze aktualizuj przez `update-version.ps1` lub GitHub Action
- Commit message: `Bump version to vX.X.X`
- Update `project.json` → "updated" date automatycznie się zmienia
- Używaj semantic versioning (2.1.1 → 2.2.0 → 3.0.0)

### ❌ DON'T:
- Nie edytuj wersji manualnie w każdym pliku
- Nie commituj `project.json` bez update innych plików
- Nie zapominaj o zmianie daty w LICENSE

---

## 🔍 Weryfikacja
**Edytuj tylko `project.json`** - GitHub Action zrobi resztę
- Commit message: `Bump version to vX.X.X` lub `Update project name`
- Używaj semantic versioning (2.1.1 → 2.2.0 → 3.0.0)
- Czekaj 30-60s po push - Action musi się wykonać

### ❌ DON'T:
- **Nie edytuj** wersji/nazwy ręcznie w innych plikach (index.html, README, etc.)
- Nie rób `git pull` zaraz po push (czekaj aż Action zakończy)
- Nie commituj wielu zmian `project.json` naraz (jedno push = jedna aktualizacja),LICENSE -Pattern "v2.1.1"
```

---

## 🚀 Przykładowy Workflow

### Zmiana wersji (np. 2.1.1 → 2.2.0):

```bash
# 1. Edytuj project.json (zmień "version": "2.2.0")
nano project.json

# 2. Commit tylko project.json
git add project.json
git commit -m "Bump version to 2.2.0"

# 3. Push na GitHub
git push origin main

# 4. Czekaj 30-60s - GitHub Action zaktualizuje:
#    - index.html
#    - README.md
#    - PROJECT-CONTEXT.md
#    - LICENSE
#
# 5. Zrób git pull żeby pobrać zmiany od GitHub Action
git pull origin main
```

### Zmiana nazwy (np. "Parlament puppy" → "Parlament Pro"):

```bash
# 1. Edytuj project.json (zmień "name": "Parlament Pro")
nano project.json

# 2. Commit i push
git add project.json
git commit -m "Update project name to Parlament Pro"
git push origin main

# 3. Czekaj na GitHub Action
# 4. Git pull
git pull origin main
```

---

## 💡 Wskazówki
 (edytujesz TEN plik)
- `.github/workflows/update-version.yml` - GitHub Action (automatyczny update)
- `CHANGELOG.md` - historia zmian

## ⚙️ Jak to działa?

1. **Ty:** Edytujesz `project.json` → commit → push
2. **GitHub:** Wykrywa zmianę w `project.json` → uruchamia Action
3. **Action:** Odczytuje nazwę i wersję → aktualizuje wszystkie pliki → commituje
4. **Ty:** Robisz `git pull` → masz wszystkie pliki zaktualizowane! ✅king changes

**Semantic Versioning:**
```
MAJOR.MINOR.PATCH
  3  . 2  .  1

MAJOR - Breaking changes (API incompatible)
MINOR - New features (backwards compatible)
PATCH - Bug fixes (backwards compatible)
```

---

## 🔗 Zobacz też:

- `project.json` - metadata projektu
- `update-version.ps1` - skrypt PowerShell
- `.github/workflows/update-version.yml` - GitHub Action
- `CHANGELOG.md` - historia zmian

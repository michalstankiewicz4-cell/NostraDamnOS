# 📋 TODO - Status implementacji

## ✅ ZREALIZOWANE (v2.0.0 - 2026-01-24)

### ETL System v2.0
- [x] **Fetcher v2.0** - 12 modułów fetch
- [x] **Normalizer v2.0** - 11 modułów transform
- [x] **Pipeline v2.0** - Complete orchestration
- [x] **Database v2.0** - 12 tabel + indexes
- [x] **Incremental Cache** - 10× szybsze kolejne pobrania
- [x] **Dynamic Progress** - 0-100% tracking

### Zaimplementowane typy danych (12/12)
1. [x] Posłowie/Senatorowie
2. [x] Posiedzenia
3. [x] Wypowiedzi
4. [x] Głosowania
5. [x] Głosy indywidualne
6. [x] Interpelacje
7. [x] Projekty ustaw
8. [x] Komisje
9. [x] Posiedzenia komisji
10. [x] Wypowiedzi komisji
11. [x] Oświadczenia majątkowe
12. [x] Metadata (cache)

### UI
- [x] ETL Panel z 11 checkboxami
- [x] Header sekcji: "📥 Import Danych z API Sejmu"
- [x] Panel height: 50vh (no scroll)
- [x] Progress bar + detailed logs
- [x] Geolocation (Europe only)

---

## 🚧 W TRAKCIE (Faza 2)

### AI Integration
- [ ] **WebLLM 4B** - model lokalny
  - [ ] Inicjalizacja w przeglądarce
  - [ ] Inference pipeline
  - [ ] Memory management
- [ ] **Transformers.js**
  - [ ] Sentiment analysis
  - [ ] Topic modeling
  - [ ] Embeddings

### Analysis Features
- [ ] **Sentiment Analysis**
  - [ ] Per-speech sentiment
  - [ ] Trend visualization
  - [ ] Club comparison
- [ ] **Topic Detection**
  - [ ] Clustering wypowiedzi
  - [ ] Topic timeline
  - [ ] Keyword extraction
- [ ] **Summarization**
  - [ ] Per-sitting summary
  - [ ] Per-speaker summary
  - [ ] Abstractive vs extractive
- [ ] **Comparison**
  - [ ] Speaker comparison
  - [ ] Club comparison
  - [ ] Time period comparison

---

## 📅 PLANOWANE (Faza 3)

### Persistence
- [ ] IndexedDB integration
  - [ ] Migrate from in-memory SQLite
  - [ ] Persistent storage
  - [ ] Schema migrations
- [ ] Export features
  - [ ] Export to .db
  - [ ] Export to .csv
  - [ ] Export to JSON

### Advanced Queries
- [ ] Query Builder UI
  - [ ] Filter by date range
  - [ ] Filter by speaker
  - [ ] Filter by club
  - [ ] Filter by topic
- [ ] Saved queries
- [ ] Query history

### Visualizations
- [ ] Charts & graphs
  - [ ] Activity timeline
  - [ ] Club distribution
  - [ ] Topic trends
- [ ] Network graphs
  - [ ] Speaker interactions
  - [ ] Committee connections
- [ ] Heatmaps
  - [ ] Voting patterns
  - [ ] Speaking frequency

---

## 🔄 Rozszerzenia danych (Opcjonalne)

### Priorytet: 🔥 WYSOKI
- [x] Komisje (struktury, składy, posiedzenia) ✅ **DONE**
- [x] Projekty ustaw (proces legislacyjny) ✅ **DONE**
- [x] Interpelacje (teksty, odpowiedzi) ✅ **DONE**

### Priorytet: 🟡 ŚREDNI  
- [ ] **Stenogramy komisji** (głęboka analiza)
- [ ] **Frekwencja** (obecność, usprawiedliwienia)
- [ ] **Oświadczenia poselskie** (retoryka osobista)
- [x] **Oświadczenia majątkowe** ✅ **DONE**

### Priorytet: 🟢 NISKI
- [ ] **Pytania w sprawach bieżących**
- [ ] **Dane historyczne** (kadencje 1-9)

---

## 🛠️ Techniczne

### Optimizations
- [ ] Web Workers dla AI models
- [ ] Lazy loading modułów
- [ ] Code splitting
- [ ] Service Worker cache

### Testing
- [ ] Unit tests (fetcher, normalizer)
- [ ] Integration tests (pipeline)
- [ ] E2E tests (UI workflow)
- [ ] Performance benchmarks

### DevOps
- [ ] CI/CD pipeline
- [ ] Automated testing
- [ ] Version tagging
- [ ] Release notes automation

---

## 📊 Progress Tracking

**Overall Progress:** 40% (core system done, AI + advanced features remaining)

```
ETL System:        ████████████████████ 100% ✅
Database:          ████████████████████ 100% ✅
UI Integration:    ████████████████████ 100% ✅
AI Models:         ░░░░░░░░░░░░░░░░░░░░   0% 🚧
Analysis:          ░░░░░░░░░░░░░░░░░░░░   0% 🚧
Persistence:       ░░░░░░░░░░░░░░░░░░░░   0% 📅
Visualizations:    ░░░░░░░░░░░░░░░░░░░░   0% 📅
```

---

## 💡 Ideas for Future

### "Mapka wpływów"
- Network graph: posłowie ↔ komisje ↔ projekty ustaw
- Influence score based on activity
- Committee specialization detection

### "Ranking ekspertów"
- Most invited to committees
- Organizations with highest impact
- Expert-topic mapping

### "Ścieżka ustawy"
- Legislative process timeline
- Changes tracking (original vs final)
- Bottleneck detection

### "Analiza lobbingu"
- Committee speeches analysis
- Organization representation
- Argument effectiveness

### "Posłowie specjaliści"
- Topic expertise detection (speeches + committees + interpellations)
- Cross-club expert comparison
- Specialization trends

---

## 📝 Notes

**Ostatnia aktualizacja:** 2026-01-24  
**Wersja systemu:** 2.0.0  
**Status:** Production-ready ETL ✅, AI features in development 🚧

**Priorities:**
1. AI models integration (WebLLM + Transformers.js)
2. Basic analysis features (sentiment, topics)
3. Persistence (IndexedDB)
4. Advanced features (visualizations, queries)

Zaktualizowano strukturę danych do 11 kategorii plików:

1. poslowie.jsonl - posłowie + senatorowie (global)
2. posiedzenia.jsonl - posiedzenia Sejmu + Senatu  
3. wypowiedzi.jsonl - stenogramy plenarne
4. glosowania.jsonl - wyniki głosowań
5. glosy.jsonl - głosy indywidualne
6. interpelacje.jsonl - interpelacje + zapytania
7. projekty_ustaw.jsonl - druki + procesy legislacyjne
8. komisje.jsonl - lista komisji + składy
9. komisje_posiedzenia.jsonl - posiedzenia komisji
10. komisje_wypowiedzi.jsonl - stenogramy komisji
11. oswiadczenia_majatkowe.jsonl - oświadczenia (metadata)

Hierarchy:
- Global: poslowie, komisje, interpelacje, projekty_ustaw, oswiadczenia_majatkowe
- Kadencja → Posiedzenie: posiedzenia, wypowiedzi, glosowania, glosy
- Komisja → Posiedzenie: komisje_posiedzenia, komisje_wypowiedzi

Manifest v2 utworzony: data/manifest-v2.json

TODO: Zaktualizować fetch.html z checkboxami dla wszystkich 11 typów.

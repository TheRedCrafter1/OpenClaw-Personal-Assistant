# D3: Fortschritt → Trello (strukturierte Antworten)

Gilt nur für Nachrichten, die **`parseStructuredProgress`** erkennt (`done`, `blocked`, `in_progress`).  
**`NOTE:` / freie Sprache** → nur Memory, kein automatisches Trello.

## Verhalten

| Erkennung | Memory | Trello |
|-----------|--------|--------|
| **erledigt** (`done`) | Status / Progress Notes | Best passende Task-Card → Liste **`TRELLO_LIST_DONE`** |
| **blockiert** (`blocked`) | ja | Gleiche Card: Blocker-Zeile an **Beschreibung** anhängen |
| **noch unterwegs** (`in_progress`) | ja | **keine** Trello-Aktion |

## Neue / bestehende ENV

| Variable | Pflicht für D3 | Bedeutung |
|----------|----------------|-----------|
| `TRELLO_KEY`, `TRELLO_TOKEN` | ja | wie bisher |
| `TRELLO_LIST_TASKS` | ja | hier werden Cards für Matching gesucht |
| `TRELLO_LIST_SHOPPING` | ja | unverändert für SHOP ADD |
| **`TRELLO_LIST_DONE`** | für **erledigt** | Listen-ID der „Done“-/Erledigt-Liste |
| **`TRELLO_PROGRESS_MIN_SCORE`** | nein | Mindest-Score fürs Namens-Matching (Default **3**). Bei zu wenig Treffern: erhöhen. |

Ohne `TRELLO_LIST_DONE` bleibt bei „erledigt“ nur der Memory-Eintrag (kein Fehler-Popup für den Nutzer).

## Card-Map (E1)

Nach **`TASK ADD`** speichert der Server **Card-ID + Titel** pro Nutzer (`data/trello-card-map.json`). Bei Fortschritt wird **zuerst** die Map genutzt, danach erst Fuzzy-Matching auf der Liste.

## Matching (sicherer Fallback)

- Ohne Map-Treffer: nur Cards auf **`TRELLO_LIST_TASKS`** per Score.
- Score aus: Wort-Überlappung **Card-Titel ↔ Nutzertext** und **Card-Titel ↔ Ziele** (Short/Mid/Long im Memory).
- Zusätzlicher Bonus, wenn der **volle Card-Titel** im Nutzertext vorkommt.
- Kein Treffer über dem Mindest-Score → **keine** Trello-Aktion (nur Memory).

## Tests

1. Task anlegen: `TASK ADD: Budget Test April`
2. WhatsApp: kurze Antwort mit **„Budget … erledigt“** (Wörter aus dem Titel helfen dem Match).
3. Card sollte in der Done-Liste landen.
4. Für Blocker: **„Budget blockiert weil …“** → Beschreibung der gematchten Card wächst um einen Abschnitt mit Datum.

Bei falschem Card-Match: **`TRELLO_PROGRESS_MIN_SCORE`** erhöhen oder Task-Titel eindeutiger wählen.

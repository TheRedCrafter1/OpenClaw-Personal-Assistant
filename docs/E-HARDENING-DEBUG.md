# Milestone E1: Hardening light – Übersicht & Debug

## Was drin ist

| Thema | Verhalten |
|-------|-----------|
| **Reminder-Dedupe** | Pro User: letzter Versand + Hash des Texts in `data/reminder-state.json` (nicht im Git). |
| **Cooldown** | Standard **48 h** zwischen „echten“ Remindern (`/reminder/dispatch`, `/reminder/broadcast` mit `record`). |
| **Gleicher Text** | Optional: identischer Reminder-Text blockiert zusätzlich für `REMINDER_IDENTICAL_TEXT_HOURS` (Default **168**), *nachdem* der Cooldown abgelaufen ist. |
| **Zeitfenster** | Nur bei **record=true**: Stunde muss zwischen `REMINDER_HOUR_START` und `REMINDER_HOUR_END` in `REMINDER_TZ` liegen (Default **8–21**, **Europe/Berlin**). |
| **Preview** | `/reminder/preview` **ohne** Fenster/Dedupe – nur zum Testen des Textes. |
| **Logging** | Mit `ASSISTANT_LOG=1` eine JSON-Zeile pro Ereignis auf stdout. |
| **Trello-Map** | Nach jedem `TASK ADD` wird Card-ID + Titel in `data/trello-card-map.json` gespeichert; Fortschritt nutzt zuerst die Map, dann Fuzzy-Match. |
| **Trello-Fehler** | Kurzantwort ohne HTML-Schnipsel aus API-Fehlern. |

## Umgebungsvariablen

| Variable | Default | Bedeutung |
|----------|---------|-----------|
| `REMINDER_DEDUPE` | an (`0` = aus) | Cooldown/State komplett deaktivieren |
| `REMINDER_COOLDOWN_HOURS` | `48` | Mindestabstand zwischen Remindern pro User |
| `REMINDER_IDENTICAL_TEXT_HOURS` | `168` | Block gleicher Text (Hash) nach Ablauf des Cooldowns |
| `REMINDER_WINDOW_DISABLED` | `0` | `1` = kein Zeitfenster |
| `REMINDER_TZ` | `Europe/Berlin` | IANA-Zeitzone |
| `REMINDER_HOUR_START` / `END` | `8` / `21` | Erlaubte lokale Stunden (inkl.) |
| `ASSISTANT_LOG` | aus | `1` oder `true` oder `info` → strukturierte Logs |
| `TRELLO_MAP_DISABLED` | aus | `1` = keine Card-Map, nur Fuzzy |
| `TRELLO_MAP_MIN_TOKEN_HITS` | `2` | Mindest-Token-Treffer Map→Text |

## Log-Tags (bei `ASSISTANT_LOG=1`)

- `reminder_preview` / `reminder_dispatch`
- `reminder_skip` mit `reason`: `outside_window`, `no_goals`, `cooldown`, `duplicate_text`
- `reminder_outbound` / `reminder_outbound_fail`
- `trello_progress_match` (`source`: `card_map` | `fuzzy`)
- `trello_progress_match_miss`
- `trello_progress_ok` / `trello_progress_fail`

## API: neue Skip-Gründe

`skipped` in JSON kann jetzt zusätzlich sein:

- `outside_window` – außerhalb des Sendezeitfensters
- `cooldown` – Cooldown aktiv
- `duplicate_text` – gleicher Reminder-Text noch im Sperrfenster

## Live-Checks

1. **Journald / PM2 / Docker logs** mit `ASSISTANT_LOG=1` filtern: `grep reminder_` bzw. JSON parsen.  
2. State löschen zum Testen: `data/reminder-state.json` entfernen (VPS).  
3. Map prüfen: `data/trello-card-map.json` (User-Keys = `User:`-Zeile aus Memory).  
4. Preview vs Dispatch: Preview liefert immer Text (wenn Ziele da); Dispatch kann `skipped` liefern.

## n8n

Workflow weiter wie in [N8N-D2-REMINDER.md](./N8N-D2-REMINDER.md). Bei `skipped` **keinen** WhatsApp-Versand auslösen (leerer `reply`).

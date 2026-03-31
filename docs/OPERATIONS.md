# Operations Guide

## Architektur (Produktiv)

- Twilio WhatsApp -> n8n Webhook -> Assistant `POST /message`
- Assistant schreibt Memory pro User (`data/users/*.md`)
- `/message` und `/webhook` funktionieren auch mit nur `{ "text": "..." }` (Fallback auf User `global`)
- Für echte Multi-User-Trennung sollte n8n trotzdem `userId` (oder Twilio `From`) an den Server durchreichen
- Reminder:
  - `POST /reminder/preview` (nur Text)
  - `POST /reminder/dispatch` (ein User)
  - `POST /reminder/broadcast` (alle User)
  - Optional `POST /reminder/mark-sent` (wenn n8n selbst an Twilio sendet)
- `GET /memory` ist standardmäßig deaktiviert und braucht entweder `ASSISTANT_ADMIN_SECRET` oder explizit `MEMORY_READ_ENABLED=1`

## Wichtigste Commands (User)

- `HELP`
- `GOAL SET: ...`
- `STATUS`
- `GOAL CHECK`
- `TASK ADD: ...`
- `TASK MOVE: ... -> done`
- `TASK UPDATE: ... | note: ...`
- `SHOP ADD: ...`
- `NOTE: ...`
- `PAUSE REMINDER 3d` / `RESUME REMINDER`

## Wichtige ENV (Server)

- Core:
  - `PORT`
  - `REMINDER_RUN_SECRET`
  - `ASSISTANT_LOG=1` (empfohlen produktiv)
  - `ASSISTANT_ADMIN_SECRET` (empfohlen, wenn `/memory` genutzt wird)
  - `MEMORY_READ_ENABLED=1` nur für bewusst erlaubten Debug-Zugriff
- Trello:
  - `TRELLO_KEY`, `TRELLO_TOKEN`
  - `TRELLO_LIST_TASKS`, `TRELLO_LIST_SHOPPING`, `TRELLO_LIST_DONE`
- Reminder Hardening:
  - `REMINDER_TZ`, `REMINDER_HOUR_START`, `REMINDER_HOUR_END`
  - `REMINDER_DEDUPE`, `REMINDER_COOLDOWN_HOURS`
  - `REMINDER_IDENTICAL_TEXT_HOURS`
  - `REMINDER_MIN_PROGRESS_AGE_DAYS`
- Optional Outbound:
  - `REMINDER_OUTBOUND_URL`
  - `REMINDER_OUTBOUND_SECRET`

## n8n Empfehlung

- Erst `preview` testen.
- Bei `broadcast` nur senden, wenn `reply` nicht leer und kein problematisches `skipped`.
- Wenn `send: false` verwendet wird: nach erfolgreichem Twilio-Versand `mark-sent` aufrufen.
- n8n sollte `userId` explizit durchreichen (oder `From`), damit nicht alles im `global`-Memory landet.

## Logs

- Journal/PM2/Docker:
  - `ASSISTANT_LOG=1` aktivieren
  - Nach Tags filtern: `reminder_`, `trello_progress_`


# Troubleshooting

## 1) Twilio kommt an, aber keine Antwort

- Prüfen: n8n Execution erfolgreich?
- Prüfen: HTTP Request Body enthält `text` und `userId` korrekt?
- Prüfen: Assistant `/message` antwortet lokal mit curl/Postman?
- Wenn `error: userId_required`: n8n/Twilio Mapping liefert keine stabile Absender-ID

## 2) Trello `401` / `invalid token`

- `TRELLO_KEY` / `TRELLO_TOKEN` im Service gesetzt?
- systemd `EnvironmentFile` geladen?
- Dienst nach ENV-Änderung neu gestartet?

## 3) Reminder wird ständig geskippt

- `skipped: outside_window` -> `REMINDER_TZ` / Stunden prüfen
- `skipped: recent_progress` -> `REMINDER_MIN_PROGRESS_AGE_DAYS` zu streng?
- `skipped: cooldown_active` -> `REMINDER_COOLDOWN_HOURS` prüfen
- `skipped: duplicate_text_blocked` -> gleicher Text + `REMINDER_IDENTICAL_TEXT_HOURS`
- `skipped: paused` -> User hat Reminder pausiert

## 4) Reminder wird nicht als gesendet gezählt

- Wenn `send: true`: Outbound muss `ok=true` liefern.
- Wenn n8n selbst Twilio sendet (`send:false`): danach `POST /reminder/mark-sent` aufrufen.

## 5) D3 findet keine Trello-Karte

- Nutzerantwort enthält keine klaren Titelwörter.
- Task mit `TASK ADD` neu erstellen (füllt Card-Map).
- `TRELLO_PROGRESS_MIN_SCORE` ggf. senken (vorsichtig).
- Logs prüfen: `trello_progress_match_miss`.

## 6) Memory wird nicht aktualisiert

- Schreibrechte auf `data/users/` und `data/` prüfen.
- Prozess-User in systemd prüfen.
- `GET /memory?userId=...` nur mit `ASSISTANT_ADMIN_SECRET` oder bewusstem `MEMORY_READ_ENABLED=1` testen.


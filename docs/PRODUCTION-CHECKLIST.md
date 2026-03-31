# Production Checklist

## Server / systemd

- [ ] `WorkingDirectory` korrekt
- [ ] `EnvironmentFile` gesetzt und lesbar
- [ ] Dienst-User hat Schreibrechte auf `data/` und `data/users/`
- [ ] Restart-Policy aktiv (`Restart=always`)
- [ ] Healthcheck erreichbar (`/health`)

## Secrets / ENV

- [ ] `REMINDER_RUN_SECRET` gesetzt
- [ ] `ASSISTANT_ADMIN_SECRET` gesetzt, falls `/memory` gebraucht wird
- [ ] Trello-ENV (`TRELLO_KEY`, `TRELLO_TOKEN`, Listen-IDs) gesetzt
- [ ] Reminder-Hardening-ENV gesetzt (Fenster, Cooldown, recent progress)
- [ ] Optional Outbound-ENV gesetzt (falls genutzt)
- [ ] `MEMORY_READ_ENABLED` nur bewusst gesetzt; sonst `/memory` deaktiviert lassen

## Runtime-Daten

- [ ] `data/users/` vorhanden
- [ ] `data/reminder-state.json` beschreibbar
- [ ] `data/trello-card-map.json` beschreibbar
- [ ] optional `data/archive/progress/` beschreibbar

## Observability

- [ ] `ASSISTANT_LOG=1` aktiv
- [ ] Log-Zugriff dokumentiert (`journalctl`/PM2/Docker)
- [ ] Alarmierung für wiederholte `outbound_failed` vorhanden
- [ ] Alarmierung/Monitoring für `userId_required` und `memory_read_disabled` Fehler vorhanden

## Backup

- [ ] Backup von `data/users/*.md`
- [ ] Backup von `data/reminder-state.json`
- [ ] Backup von `data/trello-card-map.json`
- [ ] Restore einmal getestet


# End-to-End Checklist

Einmal komplett durchlaufen und abhaken.

## Goal & Memory

- [ ] `GOAL SET: langfristig fitter werden`
- [ ] freie Sprache: `kurzfristig Bewerbungsfoto machen`
- [ ] Duplicate wird erkannt
- [ ] `STATUS` zeigt korrekten Stand
- [ ] `GOAL CHECK` liefert sinnvolle Check-Frage

## Trello MVP

- [ ] `TASK ADD: Test Task | due: 2 weeks` erstellt Card
- [ ] `TASK ADD` ohne due funktioniert
- [ ] `SHOP ADD: Milch, Eier` erstellt mehrere Cards
- [ ] bei fehlender Trello-ENV kommt klare Fehlantwort

## Reminder

- [ ] `/reminder/preview` (ein User) liefert Text
- [ ] `/reminder/dispatch` funktioniert
- [ ] `/reminder/broadcast` funktioniert
- [ ] skip `outside_window` validiert
- [ ] skip `cooldown_active` validiert
- [ ] skip `duplicate_text_blocked` validiert
- [ ] skip `recent_progress` validiert
- [ ] skip `paused` validiert

## Progress

- [ ] `NOTE: ...` schreibt Progress-Note
- [ ] `NOTIZ: ...` schreibt Progress-Note
- [ ] strukturierter Text `... erledigt` wird erkannt
- [ ] strukturierter Text `... blockiert` wird erkannt
- [ ] strukturierter Text `... noch nicht` wird erkannt

## D3 Trello Follow-up

- [ ] `done` verschiebt auf Done-Liste
- [ ] `blocked` ergänzt Description
- [ ] `in_progress` bleibt Memory-only
- [ ] kein Match -> sauberer Fallback ohne Crash

## Hardening

- [ ] `/message` Rate-Limit liefert 429 bei Abuse
- [ ] `/reminder/*` Rate-Limit liefert 429 bei Abuse
- [ ] `REMINDER_RUN_SECRET` schützt Reminder-Routen
- [ ] `ASSISTANT_LOG=1` zeigt strukturierte JSON-Logs


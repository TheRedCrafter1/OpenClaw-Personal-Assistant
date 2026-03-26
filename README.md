# PRD: OpenClaw Personal Assistant (WhatsApp, Memory, Trello)

## 1) Kurzfassung (TL;DR)
Wir bauen einen OpenClaw-Agenten, der über WhatsApp-DM mit dem Nutzer kommuniziert, langfristige/mittelfristige/kurzfristige Ziele als "Memory" pflegt, ein konfigurierbares Trello-Board aktuell hält (Tasks & Shopping-/Listen) und den Nutzer zeitgesteuert an Fortschritt erinnert bzw. strukturiert nachfragt (z.B. wöchentlich + on-demand).

## 2) Ziel & Erfolgskriterien

### Ziel
Ein "konzentrationsarmer" Assistant, der:
- Goals versteht, in Memory strukturiert ablegt und nachhält
- Trello als ausführbare Aufgaben-/Listenfläche nutzt (Cards mit Kontext)
- dich regelmäßig checkt ("Wie weit bist du?") und nach Bedarf neue Tasks vorschlägt/aktualisiert
- zuverlässig auf WhatsApp reagiert (inkl. verständlicher, kurzer Nachrichten)

### Erfolgskriterien (messbar)
1. Setup-Stabilität: `/openclaw-gateway` läuft via systemd dauerhaft, Pipeline-Check besteht.
2. WhatsApp-Funktion: Eine Nachricht vom erlaubten Absender führt innerhalb eines akzeptablen SLAs (z.B. < 60s) zu einer passenden Antwort (DM).
3. Memory-Korrektheit: Nach "Goal"-Eingaben ist Memory (`MEMORY.md`) konsistent aktualisiert (keine Duplikate, klare Priorisierung).
4. Trello-CRUD: Erstellung/Aktualisierung von Cards funktioniert für mindestens 3 Card-Typen (Task, Goal-Task, Shopping-Item-Liste).
5. Reminder-Delivery: Goal-Checks werden planmäßig ausgelöst und führen zu nachvollziehbaren Folgeaktionen (z.B. Memory-Update + Trello-Updates).
6. Sicherheit/Rate-Limits: Kein Spam, keine unbeabsichtigten Proaktivanfragen außerhalb definierter Regeln.

## 3) Nutzer & Annahmen
- Nutzer auf WhatsApp.
- "Junior Dev" soll v.a. die OpenClaw-Konfiguration + Agent-Workspace + Memory-Workflow + Trello-API Integration lernen.

Annahmen (falls noch offen):
- Trello-Board/Listen/Label-Konventionen werden zu Beginn einmalig definiert.
- Reminders laufen auf einem konservativen Intervall (Kosten & Spam verhindern).

## 4) Scope

### In Scope
- OpenClaw-Agent für WhatsApp-DM (direkter Chat).
- Memory-Strategie für:
  - langfristige Ziele (long-term)
  - mittelfristige Ziele (mid-term)
  - kurzfristige Ziele (short-term)
  - Fortschritts-/Statusnotizen
- Trello-Integration:
  - Tasks/Cards anlegen
  - Cards aktualisieren (Beschreibung/Labels/Fälligkeitsdatum)
  - Cards in passende Listen bewegen
  - Shopping-/Listen-Items verwalten
- Reminder/Progress Checks:
  - zeitgesteuert (Heartbeat oder Cron)
  - kontextbasiert (liest Memory + fragt gezielt nach Status)
  - folgt auf Nutzerantwort mit Memory-/Trello-Updates
- DigitalOcean Deployment:
  - droplet + systemd openclaw-gateway
  - Repo deploy via GitHub Actions vorhandenes Pattern
  - WhatsApp Login/Session Management

### Out of Scope (Non-Goals)
- Keine E-Mail-Logik (Gmail/Sheets) für diesen Assistant.
- Keine "Blind"-Automatisierung: Trello Aktionen nur nach klarer Nutzerintention oder explizitem "Auto"-Modus.
- Keine Kalender- oder Finanzintegration (außer später).

## 5) User Journeys (Beispiele)
1. Goal erfassen:
   - Nutzer: "Mein Ziel ist langfristig X, mittelfristig Y, kurzfristig Z."
   - Assistant: bestätigt Struktur, erstellt ggf. zugehörige Trello Tasks, aktualisiert Memory.
2. Trello Task erstellen:
   - Nutzer: "Mach mir eine Task 'Budget-Plan für April' in Trello, mit Kontext... und due in 2 Wochen."
   - Assistant: Card anlegen + DM Bestätigung.
3. Fortschritt-Check:
   - Reminder auslösen (z.B. wöchentlich): "Wie bist du bei Ziel Y vorangekommen?"
   - Nutzer antwortet: Assistant aktualisiert Memory und verschiebt/markiert Trello Cards.
4. Shopping-Liste:
   - Nutzer: "Kaufliste: Milch, Eier, ..."
   - Assistant: Cards/Items in der Shopping-Liste aktualisieren.

## 6) Funktionale Anforderungen

### 6.1 WhatsApp Channel (DM)
- Kommunikation ausschließlich über WhatsApp-DM an deine Nummer.
- OpenClaw nutzt den WhatsApp Channel via Gateway; WhatsApp darf nur von erlaubten Quellen/Sessionn funktionieren.

Repo-Relevante Referenzen:
- `docs/openclaw.json` enthält WhatsApp `channels.whatsapp` (allowlist, policies) und `plugins.entries.whatsapp`.
- `server-etc/openclaw/openclaw.overlay.json` definiert Agent-Liste/Default + `heartbeat` Intervalle.
- Beispiel-Routing/Operationen sind in `docs/SETUP-UND-STATUS.md` dokumentiert (inkl. 440/Conflict Troubleshooting).

Anforderungen an das System:
- Der Assistant muss in der Lage sein, DM-Antworten zu senden (nicht nur Gruppen).
- Nachrichten sollen kurz und handlungsorientiert sein (keine langen Essays).

### 6.2 Memory: Goals & Fortschritt
Memory-Granularität:
- `MEMORY.md`: kuratiert, langfristige/mittelfristige/kurzfristige Ziele + Regeln/Prinzipien + "state" (z.B. "Ziel Y aktuell: blockiert bei ...").
- Optional: tägliche Logs (je nach Agent-Setup) im `memory/`-Ordner.

Wichtiges Verhaltensmuster (aus dem Repo übernehmen/anzupassen):
- Es gibt eine definierte Regel, wie Memory gelesen/geschrieben wird und wann Sync passiert.
- Im Template `server-etc/workspace/akin/AGENTS.md` steht z.B. "Memory updates ALWAYS go to `MEMORY.md`" und "after write run lobster sync".

Anforderungen:
- Wenn der Nutzer Goals erwähnt, wird Memory strukturiert aktualisiert.
- Memory-Update Flow:
  1. vollständige `MEMORY.md` laden
  2. neue Regel/Abschnitt ergänzen/aktualisieren (keine Teilpatches)
  3. danach Memory-Sync triggern (`workflows/sync-memory-to-git.lobster`).

Repo-Relevante Referenzen:
- Memory sync: `workflows/sync-memory-to-git.lobster` und `scripts/sync-memory.sh`.
- Agent-Policies/Memory: `server-etc/workspace/akin/AGENTS.md`.

### 6.3 Trello Integration (Tasks, Kontext, Shopping)
Status im Repo:
- Es gibt aktuell keine Trello-Referenz/Integration (keine Treffer für "trello" in den Code-/Dokumentsuchen).

Daraus folgt: Wir müssen Trello neu integrieren.

Anforderungen:
- Trello API Client (z.B. Node/TypeScript) + Auth (Token) wird benötigt.
- Es muss eine klare Mapping-Strategie geben:
  - Card-Typen: `task`, `goal_task`, `shopping_item` (oder äquivalente Klassifikation)
  - Labels oder einheitliche Prefixe in `title` / `description`
  - List-Zuordnung anhand Card-Typ

Minimaler Trello Featureumfang (MVP):
1. `Create Task Card`: aus WhatsApp Text oder via "Goal"-Update.
2. `Update Task Card`: Status/Context aktualisieren.
3. `Move Card`: z.B. "ToDo" -> "In Progress" -> "Done".
4. `Shopping List`: Einfügen/Entfernen (Entfernen optional im MVP; kann als "Mark as bought" umgesetzt werden).

Sicherheits-/Sinn-Regel (Challenge):
- "Auto-move" im Trello nur, wenn Nutzer explizit zustimmt oder wenn eine Status-Änderung sehr klar aus Nutzerantworten ableitbar ist.

### 6.4 Reminder & Goal Checks
Scheduling-Optionen in OpenClaw:
- Heartbeat: promptbasiertes, periodisches "check-in". (Im Repo sind Heartbeat-Konzept und "HEARTBEAT.md" beschrieben.)
- Cron: präziser für einmalige oder exakte Zeitpläne.

Repo-Relevante Referenzen:
- `docs/prompt-archive/2026-02-17/HEARTBEAT.md`:
  - Heartbeat kann aktiv genutzt werden (oder leer lassen -> HEARTBEAT_OK).
- `server-etc/openclaw/openclaw.overlay.json`:
  - derzeit `heartbeat.every` ist auf `0m` gesetzt (=> deaktiviert).
- `docs/USAGE-KOSTEN-OPTIMIERUNG.md`:
  - Hinweis: Heartbeat/Tool-Runden kosten und können "zu aktiv" werden.

Anforderungen:
- Reminder-Rhythmus MVP: konservativ (z.B. 1x/Tag oder 2-3x/Woche) + wöchentlicher "Goal Check".
- Pro Reminder:
  - liest Memory (Goals + last update)
  - ermittelt 1-2 konkrete Punkte (z.B. "kurzfristiges Ziel Z: Status?")
  - sendet DM mit kurzen Fragen oder Auswahloptionen
- Nach Antwort:
  - Memory aktualisieren
  - ggf. Trello Cards anpassen (move/status)

### 6.5 Gesprächs-/Command-Design (für deterministische Tool-Nutzung)
Ziel:
- Das System soll nicht "spammy" sein, sondern kontextsensitiv und vorhersagbar.

Vorgeschlagene Command-Optionen (MVP):
- `GOAL SET: <text>`
- `GOAL CHECK:` (manuell)
- `TASK ADD: <title> | context: <...> | due: <...>`
- `SHOP ADD: <items>`
- `SHOP DONE: <items>` (optional)
- `STATUS:` (Zusammenfassung aktueller Ziele + offene Cards)

Challenge:
- Falls OpenClaw in eurer Umgebung Tool-Calls deterministisch über Agent-Policies erwartet (ähnlich wie im `AGENTS.md` Template "hard rule: no conversational output"), muss das Assistant-Workspace entsprechend angepasst werden.
- Das PRD muss den Junior anweisen, die Output- und Tool-Disziplin für Trello/Reminder einzuhalten.

## 7) Datenmodell & Konventionen

### 7.1 Memory Schema (inhaltlich)
Beispielstruktur in `MEMORY.md`:
- Long-term
  - Goal: ...
  - Why/values: ...
  - Success criteria: ...
  - Status: ...
- Mid-term
- Short-term
- Reminder rules
  - Check frequency
  - Wochentage/Zeitslots

### 7.2 Trello Mapping
Beispiel:
- List `Inbox`
- List `ThisWeek`
- List `Doing`
- List `Done`
- Labels: `type:task`, `type:goal_task`, `type:shopping`
- Due date: aus "due in ..." oder aus Goal-Timing.

## 8) Architektur / Systemdesign

```mermaid
flowchart LR
  User[WhatsApp Nutzer] -->|DM| WhatsAppChannel[OpenClaw WhatsApp Channel]
  WhatsAppChannel --> Gateway[OpenClaw Gateway (systemd)]
  Gateway --> Agent[OpenClaw Agent: PersonalAssistant]

  Agent --> MemoryRead[Memory: read/write MEMORY.md]
  Agent --> TrelloTools[Trello Tool/CLI: CRUD Cards]
  Agent --> Scheduler[Heartbeat/Cron: Reminder triggers]

  Scheduler --> Agent
  Agent -->|DM| WhatsAppChannel
```

## 9) Deployment auf DigitalOcean (für den Junior)

### 9.1 Server-Basisschritte (DigitalOcean)
- Droplet erstellen (Ubuntu 22.04 oder kompatibel), Root login.
- Firewall/Ports: mindestens `18789` nur intern/über SSH-Tunnel (oder via Tailscale), plus ggf. reverse proxy falls ihr das nutzt.

Repo-Relevante Referenzen:
- Architektur & Dienste in `docs/SETUP-UND-STATUS.md` (Gateway Port, Tailcale Funnel für Gmail; für den Personal Assistant ist aber primär DM relevant).
- DigitalOcean Account-/Snapshot-Pattern: `docs/MOVE-DROPLET-NEW-ACCOUNT.md`.

### 9.2 OpenClaw Gateway systemd
- systemd unit: `server-etc/systemd/openclaw-gateway.service`.
- Services:
  - `openclaw-gateway`
  - Optional (nur falls ihr öffentliche Endpoints nutzt): Tailscale Funnel / Nginx.

### 9.3 Repo ausrollen & Konfiguration
- Clone `openclaw-taximeister` nach `/root/openclaw-taximeister`.
- Deploy-Konzept:
  - GitHub Actions Workflow `/.github/workflows/deploy.yml` baut TypeScript und kopiert `dist/`.
  - Auf dem Server: `scripts/apply-server-config.sh` synchronisiert non-secret overlay + workspace + restarts Gateway.

Repo-Relevante Referenzen:
- `scripts/apply-server-config.sh`
- `.github/workflows/deploy.yml`
- `server-etc/openclaw/openclaw.overlay.json` (Agent/Heartbeat)

### 9.4 Secrets
- Secrets nur auf dem Server, nicht im Git.
- Beispielpfad:
  - `/root/.openclaw/secrets.env` (z.B. API keys, gateway token).
- Hinweis: OpenClaw Gateway systemd lädt `EnvironmentFile=-/root/.openclaw/secrets.env`.

### 9.5 WhatsApp Login / Session
- WhatsApp muss initial verknüpft werden.
- Typisches Troubleshooting: Status `440 (Conflict)` und "nur eine WhatsApp Web Session erlaubt".

Repo-Relevante Referenzen:
- WhatsApp Abschnitt in `docs/SETUP-UND-STATUS.md`.
- `scripts/check-pipeline.sh` liefert WhatsApp Logs und 440-Fehlerhinweise.

## 10) Challenge-Sachen / Risiken / Lücken (muss im PRD stehen)

1. Trello ist nicht im Repo vorhanden.
   - Entscheidung nötig: Trello API direkt (Node/TypeScript CLI) vs. OpenClaw Tool-Extension.
   - MVP sollte schnell valide CRUD können; alles andere danach.
2. WhatsApp Routing zu "dem richtigen Agenten".
   - In diesem Repo ist `akin` aktuell "Default"-Agent und verarbeitet Gmail-Mappings.
   - Für einen neuen PersonalAssistant müssen wir sicherstellen, dass WhatsApp-DM tatsächlich beim neuen Agenten landet, ohne bestehende IHK/Gmail-Funktionen zu stören.
   - Akzeptanztest: Sende DM -> richtige Antwort/Memory/Trello-Updates.
3. Heartbeat ist deaktiviert.
   - `server-etc/openclaw/openclaw.overlay.json` setzt `heartbeat.every: "0m"`.
   - Für Reminder muss aktiviert/angepasst werden (konservativ, um Kosten und Spam zu reduzieren).
4. Kostenkontrolle.
   - Heartbeat + viele Tool-Runden treiben Kosten.
   - `docs/USAGE-KOSTEN-OPTIMIERUNG.md` gibt Hinweise.
5. Output-Disziplin & Tool-Aufrufe.
   - Das Template im Repo ist sehr "safety/discipline"-getrieben (z.B. keine Claim-Ausgaben, message tool als einzige "user-visible" Ausgabe).
   - Für den PersonalAssistant müssen diese Regeln sauber übernommen/angepasst werden.
6. WhatsApp DM Ziel-Format.
   - Gruppen verwenden `@g.us`; DM braucht ein korrektes Zielformat.
   - Das PRD soll den Junior anweisen, das Zielformat anhand OpenClaw Doku/Repo-Konvention zu verifizieren.

## 11) Lernen: Aufgaben für den Junior Developer

### Lernen (OpenClaw/Agent Workspace)
- Agent-Workspace Struktur verstehen:
  - `server-etc/workspace/<agentId>/{SOUL.md, USER.md, IDENTITY.md, AGENTS.md, TOOLS.md, MEMORY.md, BOOTSTRAP.md}`
- Memory-Workflow verstehen:
  - read full `MEMORY.md`, overwrite write-back, dann `lobster` sync.

### Lernen (Deployment/Operations)
- systemd Unit `server-etc/systemd/openclaw-gateway.service` lesen und anpassen.
- `scripts/apply-server-config.sh` für overlay/workspace verstehen.
- WhatsApp 440-Fehlerbild nachstellen und fixen.

### Lernen (Trello Integration)
- Trello OAuth/Token Setup (konzeptionell)
- Board/List/Label Konventionen definieren
- Implementieren von CRUD Operationen via Node CLI/Service

### Lernen (Reminder Scheduling)
- Heartbeat vs cron entscheiden (MVP: heartbeat klein halten; cron für fixe Check-In-Slots)
- Verlässliche Trigger -> Memory/Trello Updates -> DM Antwort

## 12) Definition of Done (Milestones)

1. Milestone A — DM Assistant MVP
   - Neuer Agent-Workspace existiert.
   - Test: DM -> antwortet, schreibt Memory (z.B. "last check in was ...").
2. Milestone B — Goal Memory
   - `GOAL SET`/Goal Erfassung aktualisiert `MEMORY.md` sauber.
   - Memory Sync Workflow läuft nach jedem relevanten Update.
3. Milestone C — Trello MVP
   - Task- und Shopping-Card Creation funktioniert.
   - Jede Operation führt zu einer nachvollziehbaren DM Bestätigung (inkl. Card-URL/ID falls möglich).
4. Milestone D — Reminder & Progress Check
   - Reminder-Trigger laufen (Heartbeat/Cron), senden DM.
   - Nutzerantwort führt zu Memory-/Trello Updates.
5. Milestone E — Hardening
   - Rate limiting/Spam Guard.
   - Logs/Fehlerpfade: wenn Trello API fehlschlägt, DM enthält klare nächste Schritte.
   - Dokumentation: "So debuggt man live" (Ports, logs, pipeline script).

## 13) Appendix: Repo-Dateien die der Junior kennen muss
- Agent Policies/Memory Templates:
  - `server-etc/workspace/akin/AGENTS.md`
  - `server-etc/workspace/akin/MEMORY.md`
  - `server-etc/workspace/akin/SOUL.md`
- Memory Sync:
  - `workflows/sync-memory-to-git.lobster`
  - `scripts/sync-memory.sh`
- OpenClaw Server Config:
  - `server-etc/openclaw/openclaw.overlay.json`
  - `scripts/apply-server-config.sh`
  - `server-etc/systemd/openclaw-gateway.service`
- WhatsApp & Ops:
  - `docs/SETUP-UND-STATUS.md`
  - `scripts/check-pipeline.sh`
- Kosten/Heartbeat:
  - `docs/USAGE-KOSTEN-OPTIMIERUNG.md`
- Heartbeat Konzept:
  - `docs/prompt-archive/2026-02-17/HEARTBEAT.md`



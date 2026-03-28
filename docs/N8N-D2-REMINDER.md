# n8n: Reminder scheduling (Milestone D2)

Konservativer Ablauf: erst testen, dann produktiv. Server-Endpunkte sind bereits implementiert (`/reminder/*`).

## Voraussetzungen

| Variable (Server) | Bedeutung |
|-------------------|-----------|
| `REMINDER_RUN_SECRET` | Optional. Wenn gesetzt: jeder Reminder-Request braucht denselben Wert als Bearer oder Header. |
| `REMINDER_OUTBOUND_URL` | Optional. Wenn `send: true`: Server POSTet `{ "userId", "text" }` dorthin (z. B. zweiter n8n-Webhook). |
| `REMINDER_OUTBOUND_SECRET` | Optional. Dann `Authorization: Bearer …` beim Outbound-POST. |

Basis-URL ersetzen: `https://DEIN_HOST:3000` (oder nur intern `http://127.0.0.1:3000`, wenn n8n auf demselben VPS läuft).

## Gemeinsame HTTP-Optionen (n8n „HTTP Request“)

- **Method:** POST  
- **URL:** siehe unten je Schritt  
- **Body Content Type:** JSON  
- **Authentication:** None (Secret manuell als Header)

### Header wenn `REMINDER_RUN_SECRET` gesetzt

Eine der beiden Varianten:

| Name | Value |
|------|--------|
| `Authorization` | `Bearer DEIN_GEHEIMNIS` |
| `X-Reminder-Secret` | `DEIN_GEHEIMNIS` |

---

## Phase 1 – Ein Nutzer, nur Text (ohne Versand)

**Ziel:** Prüfen, ob der Reminder-Text passt.

1. **Manual Trigger** (oder Test-Workflow).
2. **HTTP Request**  
   - **URL:** `https://DEIN_HOST:3000/reminder/preview`  
   - **Body (JSON):**

```json
{
  "userId": "whatsapp:+491234567890"
}
```

**Antwort:** `{ "reply": "…" }` oder `{ "reply": "", "skipped": "no_goals" }`.

---

## Phase 2 – Ein Nutzer, optional Outbound

**URL:** `https://DEIN_HOST:3000/reminder/dispatch`

**Body (nur Text zurück, kein externer Webhook):**

```json
{
  "userId": "whatsapp:+491234567890",
  "send": false
}
```

**Body (zusätzlich Server → `REMINDER_OUTBOUND_URL`):**

```json
{
  "userId": "whatsapp:+491234567890",
  "send": true
}
```

Wenn du **kein** `REMINDER_OUTBOUND_URL` nutzt, musst du den Text selbst an WhatsApp schicken (siehe Phase 4).

---

## Phase 3 – Alle Nutzer mit Zielen (`broadcast`)

**URL:** `https://DEIN_HOST:3000/reminder/broadcast`

**Body:**

```json
{
  "send": false
}
```

**Antwort (vereinfacht):**

```json
{
  "count": 2,
  "results": [
    { "userId": "whatsapp:+49…", "reply": "…Check-in-Text…", "outbound": null }
  ]
}
```

Mit `"send": true` und gesetztem `REMINDER_OUTBOUND_URL` enthält jedes `result.outbound` z. B. `{ "ok": true, "status": 200 }` (oder `ok: false` bei Fehler).

---

## Phase 4 – WhatsApp über Twilio (ohne Outbound-URL)

Typischer zweiter Schritt nach `broadcast`:

1. **HTTP Request** → `POST /reminder/broadcast`, `send: false`.  
2. **Split Out** (oder **Code**): `results` aus dem JSON in ein Item pro Zeile.  
3. **IF / Filter:** `reply` nicht leer (optional `skipped` prüfen, falls du Preview-Logik nachziehst).  
4. **HTTP Request** zu Twilio (gleiches Muster wie dein bestehender Assistant), z. B.  
   - `To` = `{{ $json.userId }}`  
   - `Body` = `{{ $json.reply }}`  
   - Sandbox-/Production-From wie bei euren anderen Flows.

So bleibt der **Reminder-Text** beim Assistant-Server; **Versand** liegt sichtbar in n8n (gut zum Debuggen).

---

## Produktiver Zeitplan (empfohlen: 2× pro Woche)

1. **Schedule Trigger**  
   - Zwei Regeln oder Cron, z. B. **Montag** und **Donnerstag**, **17:00** in deiner Zeitzone (n8n: „Timezone“ des Triggers setzen).  
   - Nicht täglich starten, bis du Logik und Texte gut findest.

2. **HTTP Request** → `POST /reminder/broadcast` mit `send: false` **oder** `send: true`, je nachdem ob du `REMINDER_OUTBOUND_URL` nutzt.

3. Optional: **Error Trigger** / **Execution Data** in n8n aktivieren, um fehlgeschlagene Läufe zu sehen.

---

## Spam / Stabilität (kurz)

- Erst **Preview** / **dispatch** für eine Nummer, dann **broadcast**.  
- Broadcast nur für Nutzer mit mindestens einem Ziel in Short/Mid/Long (andere werden serverseitig übersprungen).  
- Frequenz lieber **wöchentlich 2×** als täglich, bis du Feedback hast.  
- `REMINDER_RUN_SECRET` setzen, sobald der Port aus dem Internet erreichbar ist.

---

## Kurz: Minimal-Workflow „live“

```
Schedule (Mo + Do 17:00) → HTTP POST /reminder/broadcast { "send": false }
  → Split results → Twilio HTTP (To=userId, Body=reply)
```

Mit Outbound statt Split/Twilio:

```
Schedule → HTTP POST /reminder/broadcast { "send": true }
```

(vorausgesetzt `REMINDER_OUTBOUND_URL` zeigt auf einen Webhook, der pro `{ userId, text }` WhatsApp auslöst.)

import express from "express";
import { handleMessage } from "./handleMessage.js";
import { ensureMemoryFile, readMemoryContent } from "./memory.js";
import { messageRateLimit, reminderRateLimit } from "./rateLimit.js";
import { recordReminderSent } from "./reminderState.js";
import {
  postReminderOutbound,
  reminderAuthMiddleware,
  runReminderForUser,
  runRemindersForAllUsers
} from "./reminderRunner.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

function readBearerSecret(req) {
  return req.headers.authorization?.replace(/^Bearer\s+/i, "")?.trim() || "";
}

function requireBodyUserId(req, res, next) {
  const userId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
  if (!userId) {
    return res.status(400).json({ error: "userId_required" });
  }
  return next();
}

function adminAuthMiddleware(req, res, next) {
  if (process.env.MEMORY_READ_ENABLED?.trim() === "1") {
    return next();
  }

  const secret = process.env.ASSISTANT_ADMIN_SECRET?.trim();
  if (!secret) {
    return res.status(403).json({ error: "memory_read_disabled" });
  }

  const header = readBearerSecret(req) || String(req.headers["x-admin-secret"] ?? "").trim();
  if (header !== secret) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.send("Personal Assistant server läuft.");
});

app.post("/message", messageRateLimit(), requireBodyUserId, async (req, res) => {
  const text = req.body?.text ?? "";
  const userId = req.body?.userId ?? "global";
  try {
    const reply = await handleMessage({ text, userId });
    return res.json({ reply });
  } catch (err) {
    console.error("POST /message:", err);
    return res.status(500).json({ reply: "Da ist gerade etwas schiefgelaufen." });
  }
});

app.post("/webhook", messageRateLimit(), requireBodyUserId, async (req, res) => {
  const text = req.body?.text ?? "";
  const userId = req.body?.userId ?? "global";
  try {
    const reply = await handleMessage({ text, userId });
    return res.json({ reply });
  } catch (err) {
    console.error("POST /webhook:", err);
    return res.status(500).json({ reply: "Da ist gerade etwas schiefgelaufen." });
  }
});

app.get("/memory", adminAuthMiddleware, async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
  if (!userId) {
    return res.status(400).json({ error: "userId_required" });
  }
  try {
    await ensureMemoryFile(userId);
    const memoryContent = await readMemoryContent(userId);
    return res.type("text/plain").send(memoryContent);
  } catch {
    return res.status(500).send("Konnte Memory-Datei nicht laden.");
  }
});

app.post(
  "/reminder/preview",
  reminderRateLimit(),
  reminderAuthMiddleware,
  requireBodyUserId,
  async (req, res) => {
    const userId = req.body.userId.trim();
    try {
      const r = await runReminderForUser(userId, { enforceGuards: false });
      if (!r.text) {
        return res.json({ reply: "", skipped: r.skipped ?? "no_goals" });
      }
      return res.json({ reply: r.text });
    } catch (err) {
      console.error("POST /reminder/preview:", err);
      return res.status(500).json({ error: "reminder_preview_failed" });
    }
  }
);

app.post(
  "/reminder/dispatch",
  reminderRateLimit(),
  reminderAuthMiddleware,
  requireBodyUserId,
  async (req, res) => {
    const userId = req.body.userId.trim();
    const send = req.body?.send === true;
    try {
      const r = await runReminderForUser(userId, { enforceGuards: true });
      if (!r.text) {
        return res.json({ reply: "", skipped: r.skipped, outbound: null });
      }
      let outbound = null;
      if (send) {
        outbound = await postReminderOutbound(userId, r.text);
        if (outbound.ok) {
          await recordReminderSent(userId, r.text);
        } else {
          return res.json({ reply: "", skipped: "outbound_failed", outbound });
        }
      }
      return res.json({ reply: r.text, outbound });
    } catch (err) {
      console.error("POST /reminder/dispatch:", err);
      return res.status(500).json({ error: "reminder_dispatch_failed" });
    }
  }
);

app.post("/reminder/broadcast", reminderRateLimit(), reminderAuthMiddleware, async (req, res) => {
  const send = req.body?.send === true;
  try {
    const list = await runRemindersForAllUsers({ enforceGuards: true });
    const results = [];
    for (const { userId: uid, text } of list) {
      let outbound = null;
      let skipped;
      if (send) {
        outbound = await postReminderOutbound(uid, text);
        if (outbound.ok) {
          await recordReminderSent(uid, text);
        } else {
          skipped = "outbound_failed";
        }
      }
      results.push({ userId: uid, reply: skipped ? "" : text, outbound, skipped });
    }
    return res.json({ count: results.length, results });
  } catch (err) {
    console.error("POST /reminder/broadcast:", err);
    return res.status(500).json({ error: "reminder_broadcast_failed" });
  }
});

app.post(
  "/reminder/mark-sent",
  reminderRateLimit(),
  reminderAuthMiddleware,
  requireBodyUserId,
  async (req, res) => {
    const userId = req.body.userId.trim();
    const text = String(req.body?.text ?? "").trim();
    if (!text) {
      return res.status(400).json({ error: "text_required" });
    }
    try {
      await recordReminderSent(userId, text);
      return res.json({ ok: true });
    } catch (err) {
      console.error("POST /reminder/mark-sent:", err);
      return res.status(500).json({ error: "mark_sent_failed" });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});

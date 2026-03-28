import express from "express";
import { handleMessage } from "./handleMessage.js";
import { ensureMemoryFile, readMemoryContent } from "./memory.js";
import {
  postReminderOutbound,
  reminderAuthMiddleware,
  runReminderForUser,
  runRemindersForAllUsers
} from "./reminderRunner.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.send("Personal Assistant server läuft.");
});

app.post("/message", async (req, res) => {
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

app.post("/webhook", async (req, res) => {
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

app.get("/memory", async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : "global";
  try {
    await ensureMemoryFile(userId);
    const memoryContent = await readMemoryContent(userId);
    return res.type("text/plain").send(memoryContent);
  } catch {
    return res.status(500).send("Konnte Memory-Datei nicht laden.");
  }
});

app.post("/reminder/preview", reminderAuthMiddleware, async (req, res) => {
  const userId = req.body?.userId ?? "global";
  try {
    const r = await runReminderForUser(userId, { record: false });
    if (!r.text) {
      return res.json({ reply: "", skipped: r.skipped ?? "no_goals" });
    }
    return res.json({ reply: r.text });
  } catch (err) {
    console.error("POST /reminder/preview:", err);
    return res.status(500).json({ error: "reminder_preview_failed" });
  }
});

app.post("/reminder/dispatch", reminderAuthMiddleware, async (req, res) => {
  const userId = req.body?.userId ?? "global";
  const send = req.body?.send === true;
  try {
    const r = await runReminderForUser(userId, { record: true });
    if (!r.text) {
      return res.json({ reply: "", skipped: r.skipped, outbound: null });
    }
    const outbound = send ? await postReminderOutbound(userId, r.text) : null;
    return res.json({ reply: r.text, outbound });
  } catch (err) {
    console.error("POST /reminder/dispatch:", err);
    return res.status(500).json({ error: "reminder_dispatch_failed" });
  }
});

app.post("/reminder/broadcast", reminderAuthMiddleware, async (req, res) => {
  const send = req.body?.send === true;
  try {
    const list = await runRemindersForAllUsers({ record: true });
    const results = [];
    for (const { userId: uid, text } of list) {
      const outbound = send ? await postReminderOutbound(uid, text) : null;
      results.push({ userId: uid, reply: text, outbound });
    }
    return res.json({ count: results.length, results });
  } catch (err) {
    console.error("POST /reminder/broadcast:", err);
    return res.status(500).json({ error: "reminder_broadcast_failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});

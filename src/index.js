import express from "express";
import { handleMessage } from "./handleMessage.js";
import { ensureMemoryFile, readMemoryContent } from "./memory.js";

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

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});

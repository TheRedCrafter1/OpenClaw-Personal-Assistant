import express from "express";
import { readFile } from "node:fs/promises";
import { handleMessage } from "./handleMessage.js";
import { ensureMemoryFile, MEMORY_PATH } from "./memory.js";

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
  try {
    const reply = await handleMessage(text);
    return res.json({ reply });
  } catch {
    return res.status(500).json({ reply: "Fehler bei der Verarbeitung der Nachricht." });
  }
});

app.post("/webhook", async (req, res) => {
  const text = req.body?.text ?? "";
  try {
    const reply = await handleMessage(text);
    return res.json({ reply });
  } catch {
    return res.status(500).json({ reply: "Fehler bei der Webhook-Verarbeitung." });
  }
});

app.get("/memory", async (_req, res) => {
  try {
    await ensureMemoryFile();
    const memoryContent = await readFile(MEMORY_PATH, "utf8");
    return res.type("text/plain").send(memoryContent);
  } catch {
    return res.status(500).send("Konnte MEMORY.md nicht laden.");
  }
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});

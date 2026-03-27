import express from "express";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const app = express();
const PORT = process.env.PORT || 3000;
const MEMORY_PATH = path.join(process.cwd(), "memory", "MEMORY.md");
const MEMORY_TEMPLATE = `# MEMORY

## Long-term
- 

## Mid-term
- 

## Short-term
- 

## Notes
- 
`;

app.use(express.json());

async function ensureMemoryFile() {
  await mkdir(path.dirname(MEMORY_PATH), { recursive: true });

  try {
    await readFile(MEMORY_PATH, "utf8");
  } catch {
    await writeFile(MEMORY_PATH, MEMORY_TEMPLATE, "utf8");
  }
}

function addGoalToSection(content, section, goalText) {
  const lines = content.split("\n");
  const sectionHeader = `## ${section}`;
  const sectionIndex = lines.findIndex((line) => line.trim() === sectionHeader);

  if (sectionIndex === -1) {
    return `${content.trimEnd()}\n\n${sectionHeader}\n- ${goalText}\n`;
  }

  let nextSectionIndex = lines.length;
  for (let i = sectionIndex + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith("## ")) {
      nextSectionIndex = i;
      break;
    }
  }

  for (let i = sectionIndex + 1; i < nextSectionIndex; i += 1) {
    if (lines[i].trim() === "-") {
      lines[i] = `- ${goalText}`;
      return lines.join("\n");
    }
  }

  lines.splice(nextSectionIndex, 0, `- ${goalText}`);
  return lines.join("\n");
}

function parseGoalMessage(text) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (lower.startsWith("goal set:")) {
    const goal = trimmed.slice("goal set:".length).trim();
    if (!goal) {
      return null;
    }
    return { section: "Long-term", goal, reply: "Langfristiges Ziel gespeichert." };
  }

  if (!lower.startsWith("ziel:")) {
    return null;
  }

  const rawGoal = trimmed.slice("ziel:".length).trim();
  if (!rawGoal) {
    return null;
  }

  const goalLower = rawGoal.toLowerCase();
  if (goalLower.startsWith("langfristig")) {
    return {
      section: "Long-term",
      goal: rawGoal.replace(/^langfristig[\s:-]*/i, "").trim() || rawGoal,
      reply: "Langfristiges Ziel gespeichert."
    };
  }
  if (goalLower.startsWith("mittelfristig")) {
    return {
      section: "Mid-term",
      goal: rawGoal.replace(/^mittelfristig[\s:-]*/i, "").trim() || rawGoal,
      reply: "Mittelfristiges Ziel gespeichert."
    };
  }
  if (goalLower.startsWith("kurzfristig")) {
    return {
      section: "Short-term",
      goal: rawGoal.replace(/^kurzfristig[\s:-]*/i, "").trim() || rawGoal,
      reply: "Kurzfristiges Ziel gespeichert."
    };
  }

  return { section: "Notes", goal: rawGoal, reply: "Ziel gespeichert." };
}

async function saveGoal(section, goalText) {
  await ensureMemoryFile();
  const memoryContent = await readFile(MEMORY_PATH, "utf8");
  const nextContent = addGoalToSection(memoryContent, section, goalText);
  await writeFile(MEMORY_PATH, nextContent, "utf8");
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.send("Personal Assistant server läuft.");
});

app.post("/message", async (req, res) => {
  const text = req.body?.text ?? "";
  const parsedGoal = parseGoalMessage(text);

  if (parsedGoal) {
    try {
      await saveGoal(parsedGoal.section, parsedGoal.goal);
      return res.json({ reply: parsedGoal.reply });
    } catch (error) {
      return res.status(500).json({ reply: "Fehler beim Speichern des Ziels." });
    }
  }

  if (text.toLowerCase().includes("ziel")) {
    return res.json({
      reply: "Okay, was ist dein langfristiges Ziel?"
    });
  }

  return res.json({
    reply: text ? `Empfangen: ${text}` : "Keine Nachricht übergeben."
  });
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

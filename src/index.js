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
  const normalizedGoal = goalText.trim().toLowerCase();

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
    const line = lines[i].trim();
    if (line.startsWith("- ")) {
      const existingGoal = line.slice(2).trim().toLowerCase();
      if (existingGoal === normalizedGoal) {
        return content;
      }
    }

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
  if (nextContent === memoryContent) {
    return false;
  }
  await writeFile(MEMORY_PATH, nextContent, "utf8");
  return true;
}

function getSectionGoals(content, section) {
  const lines = content.split("\n");
  const sectionHeader = `## ${section}`;
  const sectionIndex = lines.findIndex((line) => line.trim() === sectionHeader);
  if (sectionIndex === -1) {
    return [];
  }

  let nextSectionIndex = lines.length;
  for (let i = sectionIndex + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith("## ")) {
      nextSectionIndex = i;
      break;
    }
  }

  const goals = [];
  for (let i = sectionIndex + 1; i < nextSectionIndex; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith("- ")) {
      continue;
    }

    const goal = line.slice(2).trim();
    if (goal) {
      goals.push(goal);
    }
  }

  return goals;
}

function buildStatusReply(memoryContent) {
  const longTerm = getSectionGoals(memoryContent, "Long-term");
  const midTerm = getSectionGoals(memoryContent, "Mid-term");
  const shortTerm = getSectionGoals(memoryContent, "Short-term");
  const notes = getSectionGoals(memoryContent, "Notes");

  const preview = (items) => (items.length ? items.slice(0, 2).join(" | ") : "keine");

  return [
    "Status:",
    `Long-term (${longTerm.length}): ${preview(longTerm)}`,
    `Mid-term (${midTerm.length}): ${preview(midTerm)}`,
    `Short-term (${shortTerm.length}): ${preview(shortTerm)}`,
    `Notes (${notes.length}): ${preview(notes)}`
  ].join("\n");
}

async function handleMessage(text) {
  const normalizedText = (text ?? "").trim();
  const parsedGoal = parseGoalMessage(normalizedText);

  if (normalizedText.toUpperCase() === "STATUS") {
    await ensureMemoryFile();
    const memoryContent = await readFile(MEMORY_PATH, "utf8");
    return buildStatusReply(memoryContent);
  }

  if (parsedGoal) {
    const isSaved = await saveGoal(parsedGoal.section, parsedGoal.goal);
    return isSaved ? parsedGoal.reply : "Ziel ist bereits gespeichert.";
  }

  if (normalizedText.toLowerCase().includes("ziel")) {
    return "Okay, was ist dein langfristiges Ziel?";
  }

  return normalizedText ? `Empfangen: ${normalizedText}` : "Keine Nachricht übergeben.";
}

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

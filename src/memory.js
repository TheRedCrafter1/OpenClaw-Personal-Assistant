import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
export const USERS_DIR = path.join(DATA_DIR, "users");
const LEGACY_MEMORY_PATH = path.join(process.cwd(), "memory", "MEMORY.md");

/** @param {string} [userId] */
export function sanitizeUserId(userId = "global") {
  const raw = String(userId ?? "global").trim() || "global";
  let safe = raw.replace(/^whatsapp:/i, "whatsapp_").replace(/[^\w-]/g, "_");
  if (!safe) return "global";
  return safe;
}

/** @param {string} userId raw id for display in file header */
function memoryTemplate(userLabel) {
  return `# Memory
User: ${userLabel}

## Long-term
- 

## Mid-term
- 

## Short-term
- 

## Notes
- 
`;
}

/** @param {string} [userId] */
export function getMemoryPath(userId = "global") {
  const safe = sanitizeUserId(userId);
  return path.join(USERS_DIR, `${safe}.md`);
}

/**
 * @param {string} [userId]
 * @returns {Promise<string>} absolute file path
 */
export async function ensureMemoryFile(userId = "global") {
  await mkdir(USERS_DIR, { recursive: true });
  const filePath = getMemoryPath(userId);

  try {
    await readFile(filePath, "utf8");
    return filePath;
  } catch {
    const displayId = String(userId ?? "global").trim() || "global";

    if (sanitizeUserId(userId) === "global") {
      try {
        const legacy = await readFile(LEGACY_MEMORY_PATH, "utf8");
        await writeFile(filePath, legacy, "utf8");
        return filePath;
      } catch {
        /* no legacy file */
      }
    }

    await writeFile(filePath, memoryTemplate(displayId), "utf8");
    return filePath;
  }
}

/** @param {string} [userId] */
export async function readMemoryContent(userId = "global") {
  await ensureMemoryFile(userId);
  return readFile(getMemoryPath(userId), "utf8");
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

export function getSectionGoals(content, section) {
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

const SECTIONS = ["Long-term", "Mid-term", "Short-term", "Notes"];

export function isMemoryEmpty(memoryContent) {
  return SECTIONS.every((s) => getSectionGoals(memoryContent, s).length === 0);
}

export function buildStatusBody(memoryContent) {
  const longTerm = getSectionGoals(memoryContent, "Long-term");
  const midTerm = getSectionGoals(memoryContent, "Mid-term");
  const shortTerm = getSectionGoals(memoryContent, "Short-term");
  const notes = getSectionGoals(memoryContent, "Notes");

  const preview = (items) => (items.length ? items.slice(0, 2).join(" | ") : "keine");

  return [
    `Long-term (${longTerm.length}): ${preview(longTerm)}`,
    `Mid-term (${midTerm.length}): ${preview(midTerm)}`,
    `Short-term (${shortTerm.length}): ${preview(shortTerm)}`,
    `Notes (${notes.length}): ${preview(notes)}`
  ].join("\n");
}

export async function goalAlreadyExists(userId, section, goalText) {
  const memoryContent = await readMemoryContent(userId);
  const normalized = goalText.trim().toLowerCase();
  return getSectionGoals(memoryContent, section).some(
    (g) => g.trim().toLowerCase() === normalized
  );
}

export async function saveGoal(userId, section, goalText) {
  await ensureMemoryFile(userId);
  const filePath = getMemoryPath(userId);
  const memoryContent = await readFile(filePath, "utf8");
  const nextContent = addGoalToSection(memoryContent, section, goalText);
  if (nextContent === memoryContent) {
    return false;
  }
  await writeFile(filePath, nextContent, "utf8");
  return true;
}

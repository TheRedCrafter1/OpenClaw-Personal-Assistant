import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const MEMORY_PATH = path.join(process.cwd(), "memory", "MEMORY.md");

export const MEMORY_TEMPLATE = `# MEMORY

## Long-term
- 

## Mid-term
- 

## Short-term
- 

## Notes
- 
`;

export async function ensureMemoryFile() {
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

export async function goalAlreadyExists(section, goalText) {
  await ensureMemoryFile();
  const memoryContent = await readFile(MEMORY_PATH, "utf8");
  const normalized = goalText.trim().toLowerCase();
  return getSectionGoals(memoryContent, section).some(
    (g) => g.trim().toLowerCase() === normalized
  );
}

export async function saveGoal(section, goalText) {
  await ensureMemoryFile();
  const memoryContent = await readFile(MEMORY_PATH, "utf8");
  const nextContent = addGoalToSection(memoryContent, section, goalText);
  if (nextContent === memoryContent) {
    return false;
  }
  await writeFile(MEMORY_PATH, nextContent, "utf8");
  return true;
}

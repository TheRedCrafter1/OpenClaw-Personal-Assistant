import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MEMORY_SECTION_ORDER,
  parseMemoryDocument,
  renderMemoryDocument,
  ensureAllSections
} from "./memoryDocument.js";
import { triggerMemorySync } from "./syncTrigger.js";

const DATA_DIR = path.join(process.cwd(), "data");
export const USERS_DIR = path.join(DATA_DIR, "users");
const LEGACY_MEMORY_PATH = path.join(process.cwd(), "memory", "MEMORY.md");

const GOAL_SECTIONS = ["Long-term", "Mid-term", "Short-term"];

/** @param {string} [userId] */
export function sanitizeUserId(userId = "global") {
  const raw = String(userId ?? "global").trim() || "global";
  let safe = raw.replace(/^whatsapp:/i, "whatsapp_").replace(/[^\w-]/g, "_");
  if (!safe) return "global";
  return safe;
}

/** @param {string} userLabel */
function memoryTemplate(userLabel) {
  const doc = {
    userLine: `User: ${userLabel}`,
    sections: Object.fromEntries(MEMORY_SECTION_ORDER.map((k) => [k, []]))
  };
  return renderMemoryDocument(doc, `User: ${userLabel}`);
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

/**
 * Load → normalize sections → return doc + fallback user line for render.
 * @param {string} userId
 */
export async function loadMemoryDoc(userId) {
  await ensureMemoryFile(userId);
  const raw = await readFile(getMemoryPath(userId), "utf8");
  const doc = parseMemoryDocument(raw);
  ensureAllSections(doc);
  const fallbackUser = String(userId ?? "global").trim() || "global";
  if (!doc.userLine) {
    doc.userLine = `User: ${fallbackUser}`;
  }
  return doc;
}

/**
 * Full document rewrite (PRD: no partial patches).
 * @param {import("./memoryDocument.js").MemoryDoc} doc
 * @param {string} userId
 */
export async function writeMemoryDoc(doc, userId) {
  await ensureMemoryFile(userId);
  ensureAllSections(doc);
  const fallbackUser = String(userId ?? "global").trim() || "global";
  const out = renderMemoryDocument(doc, `User: ${fallbackUser}`);
  const filePath = getMemoryPath(userId);
  await writeFile(filePath, out, "utf8");
  await triggerMemorySync();
}

export function getSectionGoalsFromDoc(doc, section) {
  return doc.sections[section] || [];
}

export function getSectionGoals(content, section) {
  const doc = parseMemoryDocument(content);
  ensureAllSections(doc);
  return getSectionGoalsFromDoc(doc, section);
}

export function isMemoryEmptyFromDoc(doc) {
  return GOAL_SECTIONS.every((s) => getSectionGoalsFromDoc(doc, s).length === 0);
}

export function isMemoryEmpty(memoryContent) {
  const doc = parseMemoryDocument(memoryContent);
  ensureAllSections(doc);
  return isMemoryEmptyFromDoc(doc);
}

export function buildStatusBodyFromDoc(doc) {
  const preview = (items) => (items.length ? items.slice(0, 2).join(" | ") : "keine");

  const longTerm = getSectionGoalsFromDoc(doc, "Long-term");
  const midTerm = getSectionGoalsFromDoc(doc, "Mid-term");
  const shortTerm = getSectionGoalsFromDoc(doc, "Short-term");
  const statusNotes = getSectionGoalsFromDoc(doc, "Status / Progress Notes");
  const reminderRules = getSectionGoalsFromDoc(doc, "Reminder Rules");

  return [
    `Long-term (${longTerm.length}): ${preview(longTerm)}`,
    `Mid-term (${midTerm.length}): ${preview(midTerm)}`,
    `Short-term (${shortTerm.length}): ${preview(shortTerm)}`,
    `Status/Notes (${statusNotes.length}): ${preview(statusNotes)}`,
    `Reminder Rules (${reminderRules.length}): ${preview(reminderRules)}`
  ].join("\n");
}

export function buildStatusBody(memoryContent) {
  const doc = parseMemoryDocument(memoryContent);
  ensureAllSections(doc);
  return buildStatusBodyFromDoc(doc);
}

export async function goalAlreadyExists(userId, section, goalText) {
  const doc = await loadMemoryDoc(userId);
  const normalized = goalText.trim().toLowerCase();
  return getSectionGoalsFromDoc(doc, section).some(
    (g) => g.trim().toLowerCase() === normalized
  );
}

export async function saveGoal(userId, section, goalText) {
  const doc = await loadMemoryDoc(userId);
  const list = getSectionGoalsFromDoc(doc, section);
  const normalized = goalText.trim().toLowerCase();
  if (list.some((g) => g.trim().toLowerCase() === normalized)) {
    return false;
  }
  doc.sections[section] = [...list, goalText.trim()];
  await writeMemoryDoc(doc, userId);
  return true;
}

/**
 * @param {string} userId
 * @returns {Promise<string>} WhatsApp-ready check-in text
 */
export async function buildGoalCheckMessage(userId) {
  const doc = await loadMemoryDoc(userId);
  if (isMemoryEmptyFromDoc(doc)) {
    return "";
  }

  const lines = ["*Goal-Check:* Wo stehst du gerade?\n"];
  for (const s of GOAL_SECTIONS) {
    const items = getSectionGoalsFromDoc(doc, s);
    if (items.length === 0) continue;
    const label =
      s === "Long-term" ? "Langfristig" : s === "Mid-term" ? "Mittelfristig" : "Kurzfristig";
    lines.push(`*${label}:* ${items.slice(0, 3).join(" · ")}`);
  }
  const notes = getSectionGoalsFromDoc(doc, "Status / Progress Notes").slice(0, 2);
  if (notes.length) {
    lines.push(`*Notizen:* ${notes.join(" · ")}`);
  }
  lines.push("", "Schreib kurz, was du als Nächstes anpacken willst.");
  return lines.join("\n");
}

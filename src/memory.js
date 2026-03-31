import { createHash } from "node:crypto";
import { appendFile, mkdir, readdir, readFile, rename } from "node:fs/promises";
import path from "node:path";
import {
  MEMORY_SECTION_ORDER,
  parseMemoryDocument,
  renderMemoryDocument,
  ensureAllSections
} from "./memoryDocument.js";
import { atomicWriteFile, withKeyedLock } from "./fileStore.js";
import { triggerMemorySync } from "./syncTrigger.js";

const DATA_DIR = path.join(process.cwd(), "data");
export const USERS_DIR = path.join(DATA_DIR, "users");
const LEGACY_MEMORY_PATH = path.join(process.cwd(), "memory", "MEMORY.md");
const PROGRESS_ARCHIVE_DIR = path.join(DATA_DIR, "archive", "progress");

const GOAL_SECTIONS = ["Long-term", "Mid-term", "Short-term"];

/** @param {string} [userId] */
export function sanitizeUserId(userId = "global") {
  const raw = String(userId ?? "global").trim() || "global";
  if (raw === "global") return "global";
  const safe = raw.replace(/^whatsapp:/i, "whatsapp_").replace(/[^\w-]/g, "_").slice(0, 48) || "user";
  const hash = createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 12);
  return `${safe}__${hash}`;
}

/** @param {string} [userId] */
function legacySanitizeUserId(userId = "global") {
  const raw = String(userId ?? "global").trim() || "global";
  const safe = raw.replace(/^whatsapp:/i, "whatsapp_").replace(/[^\w-]/g, "_");
  return safe || "global";
}

/** @param {string} [userId] */
function getLegacyMemoryPath(userId = "global") {
  return path.join(USERS_DIR, `${legacySanitizeUserId(userId)}.md`);
}

/** @param {string} [userId] */
function memoryLockKey(userId = "global") {
  return `memory:${sanitizeUserId(userId)}`;
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
    return withKeyedLock(memoryLockKey(userId), async () => {
      try {
        await readFile(filePath, "utf8");
        return filePath;
      } catch {
        const displayId = String(userId ?? "global").trim() || "global";
        const legacyUserPath = getLegacyMemoryPath(userId);

        if (legacyUserPath !== filePath) {
          try {
            await readFile(legacyUserPath, "utf8");
            await rename(legacyUserPath, filePath);
            return filePath;
          } catch {
            /* no legacy user file */
          }
        }

        if (legacySanitizeUserId(userId) === "global") {
          try {
            const legacy = await readFile(LEGACY_MEMORY_PATH, "utf8");
            await atomicWriteFile(filePath, legacy);
            return filePath;
          } catch {
            /* no legacy file */
          }
        }

        await atomicWriteFile(filePath, memoryTemplate(displayId));
        return filePath;
      }
    });
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
  await atomicWriteFile(filePath, out);
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
  return withKeyedLock(memoryLockKey(userId), async () => {
    const doc = await loadMemoryDoc(userId);
    const list = getSectionGoalsFromDoc(doc, section);
    const normalized = goalText.trim().toLowerCase();
    if (list.some((g) => g.trim().toLowerCase() === normalized)) {
      return false;
    }
    doc.sections[section] = [...list, goalText.trim()];
    await writeMemoryDoc(doc, userId);
    return true;
  });
}

const STATUS_SECTION = "Status / Progress Notes";

/**
 * Eine Zeile in Status / Progress Notes (mit Datum o. Ä. im Text).
 * @param {string} userId
 * @param {string} line
 */
export async function appendStatusProgressNote(userId, line) {
  const note = String(line).trim();
  if (!note) {
    return false;
  }
  return withKeyedLock(memoryLockKey(userId), async () => {
    const doc = await loadMemoryDoc(userId);
    const prev = getSectionGoalsFromDoc(doc, STATUS_SECTION);
    const maxNotes = parseInt(process.env.MEMORY_PROGRESS_NOTES_MAX ?? "120", 10);
    const limit = Number.isFinite(maxNotes) && maxNotes > 10 ? maxNotes : 120;
    const next = [...prev, note];

    if (next.length > limit) {
      const overflow = next.slice(0, next.length - limit);
      doc.sections[STATUS_SECTION] = next.slice(-limit);
      try {
        await mkdir(PROGRESS_ARCHIVE_DIR, { recursive: true });
        const f = path.join(PROGRESS_ARCHIVE_DIR, `${sanitizeUserId(userId)}.log`);
        await appendFile(f, `${overflow.join("\n")}\n`, "utf8");
      } catch {
        // archive errors must not block note writes
      }
    } else {
      doc.sections[STATUS_SECTION] = next;
    }
    await writeMemoryDoc(doc, userId);
    return true;
  });
}

/**
 * Letzten ISO-Datumspräfix-Eintrag aus Status / Progress Notes lesen.
 * Erwartet Notizen wie `YYYY-MM-DD: ...`.
 * @param {string} userId
 * @returns {Promise<Date | null>}
 */
export async function getLastProgressNoteDate(userId) {
  const doc = await loadMemoryDoc(userId);
  const notes = getSectionGoalsFromDoc(doc, STATUS_SECTION);
  for (let i = notes.length - 1; i >= 0; i -= 1) {
    const m = String(notes[i]).match(/^(\d{4}-\d{2}-\d{2})\b/);
    if (!m) continue;
    const d = new Date(`${m[1]}T00:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) {
      return d;
    }
  }
  return null;
}

/** User-IDs aus `User:`-Zeile jeder `data/users/*.md` */
export async function listMemoryUserIds() {
  await mkdir(USERS_DIR, { recursive: true });
  let names;
  try {
    names = await readdir(USERS_DIR);
  } catch {
    return [];
  }
  const ids = [];
  for (const f of names) {
    if (!f.endsWith(".md")) continue;
    try {
      const raw = await readFile(path.join(USERS_DIR, f), "utf8");
      const m = raw.match(/^User:\s*(.+)$/m);
      if (m) {
        ids.push(m[1].trim());
      }
    } catch {
      /* skip */
    }
  }
  return [...new Set(ids)].filter(Boolean);
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
  const notes = getSectionGoalsFromDoc(doc, "Status / Progress Notes").slice(-2);
  if (notes.length) {
    lines.push(`*Notizen:* ${notes.join(" · ")}`);
  }
  lines.push("", "Schreib kurz, was du als Nächstes anpacken willst.");
  return lines.join("\n");
}

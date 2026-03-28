import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const STATE_PATH = path.join(DATA_DIR, "reminder-state.json");

function dedupeEnabled() {
  return process.env.REMINDER_DEDUPE?.trim() !== "0";
}

function cooldownMs() {
  const h = parseFloat(process.env.REMINDER_COOLDOWN_HOURS ?? "48");
  const hours = Number.isFinite(h) && h > 0 ? h : 48;
  return hours * 3600 * 1000;
}

/** @typedef {{ lastSentAt: string, lastTextHash: string }} ReminderEntry */

/**
 * @returns {Promise<Record<string, ReminderEntry>>}
 */
async function loadRaw() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    const j = JSON.parse(raw);
    return typeof j === "object" && j !== null && !Array.isArray(j) ? j : {};
  } catch {
    return {};
  }
}

async function saveRaw(/** @type Record<string, ReminderEntry> */ data) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(data, null, 2), "utf8");
}

function hashText(text) {
  return createHash("sha256").update(String(text), "utf8").digest("hex").slice(0, 24);
}

/**
 * @param {string} userId
 * @param {string} nextText Reminder-Text (für Hash-Vergleich)
 * @returns {Promise<{ skip: boolean, reason?: string }>}
 */
export async function shouldSkipReminderDedupe(userId, nextText) {
  if (!dedupeEnabled()) {
    return { skip: false };
  }
  const uid = String(userId ?? "global").trim() || "global";
  const data = await loadRaw();
  const prev = data[uid];
  if (!prev?.lastSentAt) {
    return { skip: false };
  }

  const elapsed = Date.now() - new Date(prev.lastSentAt).getTime();
  if (elapsed < cooldownMs()) {
    return { skip: true, reason: "cooldown" };
  }

  const identicalBlockH = parseFloat(process.env.REMINDER_IDENTICAL_TEXT_HOURS ?? "168");
  if (Number.isFinite(identicalBlockH) && identicalBlockH > 0) {
    const blockMs = identicalBlockH * 3600 * 1000;
    if (hashText(nextText) === prev.lastTextHash && elapsed < blockMs) {
      return { skip: true, reason: "duplicate_text" };
    }
  }

  return { skip: false };
}

/**
 * Nach erfolgreichem Reminder-Versand (dispatch/broadcast mit record).
 * @param {string} userId
 * @param {string} text
 */
export async function recordReminderSent(userId, text) {
  if (!dedupeEnabled()) return;
  const uid = String(userId ?? "global").trim() || "global";
  const data = await loadRaw();
  data[uid] = {
    lastSentAt: new Date().toISOString(),
    lastTextHash: hashText(text)
  };
  await saveRaw(data);
}

import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { atomicWriteFile, withKeyedLock } from "./fileStore.js";

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

/** @typedef {{ lastSentAt?: string, lastTextHash?: string, pauseUntil?: string }} ReminderEntry */

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
  await atomicWriteFile(STATE_PATH, JSON.stringify(data, null, 2));
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
    return { skip: true, reason: "cooldown_active" };
  }

  const identicalBlockH = parseFloat(process.env.REMINDER_IDENTICAL_TEXT_HOURS ?? "168");
  if (Number.isFinite(identicalBlockH) && identicalBlockH > 0) {
    const blockMs = identicalBlockH * 3600 * 1000;
    if (hashText(nextText) === prev.lastTextHash && elapsed < blockMs) {
      return { skip: true, reason: "duplicate_text_blocked" };
    }
  }

  return { skip: false };
}

/**
 * Nach bestätigtem Reminder-Versand (Outbound ok oder mark-sent).
 * @param {string} userId
 * @param {string} text
 */
export async function recordReminderSent(userId, text) {
  if (!dedupeEnabled()) return;
  const uid = String(userId ?? "global").trim() || "global";
  await withKeyedLock(`reminder-state:${uid}`, async () => {
    const data = await loadRaw();
    data[uid] = {
      ...(data[uid] || {}),
      lastSentAt: new Date().toISOString(),
      lastTextHash: hashText(text)
    };
    await saveRaw(data);
  });
}

/**
 * @param {string} userId
 * @returns {Promise<{ paused: boolean, until?: string }>}
 */
export async function getReminderPauseStatus(userId) {
  const uid = String(userId ?? "global").trim() || "global";
  return withKeyedLock(`reminder-state:${uid}`, async () => {
    const data = await loadRaw();
    const until = data[uid]?.pauseUntil;
    if (!until) return { paused: false };
    const ms = new Date(until).getTime();
    if (!Number.isFinite(ms) || ms <= Date.now()) {
      // stale pause -> clear
      if (data[uid]) {
        delete data[uid].pauseUntil;
        await saveRaw(data);
      }
      return { paused: false };
    }
    return { paused: true, until };
  });
}

/**
 * @param {string} userId
 * @param {number} hours
 * @returns {Promise<string>} ISO end
 */
export async function setReminderPause(userId, hours) {
  const uid = String(userId ?? "global").trim() || "global";
  const h = Number.isFinite(hours) && hours > 0 ? hours : 72;
  const until = new Date(Date.now() + h * 3600 * 1000).toISOString();
  await withKeyedLock(`reminder-state:${uid}`, async () => {
    const data = await loadRaw();
    data[uid] = {
      ...(data[uid] || {}),
      pauseUntil: until
    };
    await saveRaw(data);
  });
  return until;
}

/**
 * @param {string} userId
 * @returns {Promise<boolean>} true if changed
 */
export async function clearReminderPause(userId) {
  const uid = String(userId ?? "global").trim() || "global";
  return withKeyedLock(`reminder-state:${uid}`, async () => {
    const data = await loadRaw();
    if (!data[uid]?.pauseUntil) return false;
    delete data[uid].pauseUntil;
    await saveRaw(data);
    return true;
  });
}

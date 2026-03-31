import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { atomicWriteFile, withKeyedLock } from "./fileStore.js";

const DATA_DIR = path.join(process.cwd(), "data");
const MAP_PATH = path.join(DATA_DIR, "trello-card-map.json");
const MAX_PER_USER = 40;

/** @typedef {{ id: string, title: string, ts: string }} MappedCard */

/**
 * @returns {Promise<Record<string, MappedCard[]>>}
 */
async function loadAll() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(MAP_PATH, "utf8");
    const j = JSON.parse(raw);
    return typeof j === "object" && j !== null && !Array.isArray(j) ? j : {};
  } catch {
    return {};
  }
}

async function saveAll(/** @type Record<string, MappedCard[]> */ data) {
  await atomicWriteFile(MAP_PATH, JSON.stringify(data, null, 2));
}

function norm(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-zäöüß0-9]+/g, " ")
    .trim();
}

/** @param {string} s */
function tokens(s) {
  const m = norm(s).match(/[a-zäöüß0-9]+/g);
  return m || [];
}

/**
 * Nach TASK ADD – Card-ID für spätere Progress-Zuordnung.
 * @param {string} userId
 * @param {string} cardId
 * @param {string} title
 */
export async function registerTaskCard(userId, cardId, title) {
  if (process.env.TRELLO_MAP_DISABLED?.trim() === "1") return;
  const uid = String(userId ?? "global").trim() || "global";
  await withKeyedLock(`trello-map:${uid}`, async () => {
    const data = await loadAll();
    const list = Array.isArray(data[uid]) ? data[uid] : [];
    const entry = {
      id: String(cardId),
      title: String(title).trim(),
      ts: new Date().toISOString()
    };
    const next = [entry, ...list.filter((c) => c.id !== entry.id)].slice(0, MAX_PER_USER);
    data[uid] = next;
    await saveAll(data);
  });
}

/**
 * @param {string} userId
 * @param {string} userText
 * @returns {Promise<{ id: string, name: string } | null>}
 */
export async function findMappedCardForProgress(userId, userText) {
  if (process.env.TRELLO_MAP_DISABLED?.trim() === "1") return null;
  const uid = String(userId ?? "global").trim() || "global";
  const data = await loadAll();
  const list = data[uid];
  if (!Array.isArray(list) || list.length === 0) return null;

  const ut = norm(userText);
  const utoks = new Set(tokens(userText));
  let best = null;
  let bestScore = 0;

  for (const c of list) {
    const tn = norm(c.title);
    if (tn.length >= 4 && ut.includes(tn)) {
      return { id: c.id, name: c.title };
    }
    let score = 0;
    for (const t of tokens(c.title)) {
      if (t.length < 3) continue;
      if (utoks.has(t)) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  const minTok = parseInt(process.env.TRELLO_MAP_MIN_TOKEN_HITS ?? "2", 10);
  const threshold = Number.isFinite(minTok) && minTok > 0 ? minTok : 2;
  if (best && bestScore >= threshold) {
    return { id: best.id, name: best.title };
  }
  return null;
}

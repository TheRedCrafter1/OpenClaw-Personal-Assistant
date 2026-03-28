import { getSectionGoalsFromDoc, loadMemoryDoc } from "./memory.js";
import {
  getCard,
  listCardsOnList,
  moveCardToList,
  updateCardDescription
} from "./trelloClient.js";
import { isTrelloConfigured } from "./trelloService.js";

function listTasksId() {
  return process.env.TRELLO_LIST_TASKS?.trim() ?? "";
}

function listDoneId() {
  return process.env.TRELLO_LIST_DONE?.trim() ?? "";
}

function minMatchScore() {
  const n = parseInt(process.env.TRELLO_PROGRESS_MIN_SCORE ?? "3", 10);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

/** @param {string} s */
function tokenize(s) {
  const m = String(s).toLowerCase().match(/[a-zäöüß0-9]+/g);
  return m || [];
}

/**
 * @param {string} cardName
 * @param {string} userText
 * @param {string[]} goals
 */
export function scoreCardMatch(cardName, userText, goals) {
  const ct = tokenize(cardName);
  const ut = new Set(tokenize(userText));
  const goalTokens = tokenize(goals.join(" "));
  let score = 0;
  for (const t of ct) {
    if (t.length < 3) continue;
    if (ut.has(t)) score += 2;
    if (goalTokens.includes(t)) score += 1;
  }
  if (cardName.length > 0 && userText.toLowerCase().includes(cardName.toLowerCase())) {
    score += 4;
  }
  return score;
}

/**
 * @param {{ id: string, name: string }[]} cards
 * @param {string} userText
 * @param {string[]} goals
 */
export function pickBestMatchingCard(cards, userText, goals) {
  const minS = minMatchScore();
  let best = null;
  let bestScore = 0;
  for (const c of cards) {
    const s = scoreCardMatch(c.name, userText, goals);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  if (!best || bestScore < minS) {
    return null;
  }
  return best;
}

async function goalTitlesForUser(userId) {
  const doc = await loadMemoryDoc(userId);
  const titles = [];
  for (const section of ["Short-term", "Mid-term", "Long-term"]) {
    titles.push(...getSectionGoalsFromDoc(doc, section));
  }
  return titles;
}

/**
 * D3: Nur bei parseStructuredProgress-States (done / blocked). in_progress → kein Trello.
 * @param {"done"|"blocked"|"in_progress"} kind
 * @param {string} userText
 * @param {string} userId
 * @returns {Promise<{ moved?: string, noted?: string, skipped?: string }>}
 */
export async function applyStructuredProgressToTrello(kind, userText, userId) {
  if (!isTrelloConfigured()) {
    return { skipped: "trello_off" };
  }
  if (kind === "in_progress") {
    return { skipped: "no_trello_for_in_progress" };
  }

  const listId = listTasksId();
  if (!listId) {
    return { skipped: "no_task_list" };
  }

  const goals = await goalTitlesForUser(userId);
  let cards;
  try {
    cards = await listCardsOnList(listId);
  } catch {
    return { skipped: "list_failed" };
  }

  const match = pickBestMatchingCard(cards, userText, goals);
  if (!match) {
    return { skipped: "no_card_match" };
  }

  if (kind === "done") {
    const doneId = listDoneId();
    if (!doneId) {
      return { skipped: "no_done_list" };
    }
    try {
      await moveCardToList(match.id, doneId);
      return { moved: match.name };
    } catch {
      return { skipped: "move_failed" };
    }
  }

  if (kind === "blocked") {
    try {
      const full = await getCard(match.id);
      const stamp = new Date().toISOString().slice(0, 10);
      const snippet = String(userText).replace(/\s+/g, " ").trim().slice(0, 280);
      const suffix = `\n\n---\n[${stamp}] Blocker (WhatsApp): ${snippet}`;
      await updateCardDescription(match.id, `${full.desc || ""}${suffix}`);
      return { noted: match.name };
    } catch {
      return { skipped: "update_failed" };
    }
  }

  return { skipped: "unknown_kind" };
}

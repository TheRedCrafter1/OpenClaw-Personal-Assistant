import { logAssistant } from "./assistantLog.js";
import { getSectionGoalsFromDoc, loadMemoryDoc } from "./memory.js";
import {
  getCard,
  listCardsOnList,
  moveCardToList,
  updateCardDescription
} from "./trelloClient.js";
import { isTrelloConfigured } from "./trelloService.js";
import { findMappedCardForProgress } from "./trelloUserMap.js";

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
  let userTokenHits = 0;
  for (const t of ct) {
    if (t.length < 3) continue;
    if (ut.has(t)) {
      score += 2;
      userTokenHits += 1;
    }
    if (goalTokens.includes(t)) score += 1;
  }
  let exactTitleHit = false;
  if (cardName.length > 0 && userText.toLowerCase().includes(cardName.toLowerCase())) {
    score += 4;
    exactTitleHit = true;
  }
  return { score, userTokenHits, exactTitleHit };
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
  let bestEvidence = null;
  for (const c of cards) {
    const evidence = scoreCardMatch(c.name, userText, goals);
    if (evidence.score > bestScore) {
      bestScore = evidence.score;
      best = c;
      bestEvidence = evidence;
    }
  }
  if (!best || !bestEvidence || bestScore < minS) {
    return null;
  }
  // Auto-actions need direct user-text evidence, not just overlap with stored goals.
  if (!bestEvidence.exactTitleHit && bestEvidence.userTokenHits === 0) {
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

  let match = await findMappedCardForProgress(userId, userText);
  if (match) {
    logAssistant("trello_progress_match", { userId, source: "card_map", cardId: match.id });
  } else {
    let cards;
    try {
      cards = await listCardsOnList(listId);
    } catch (err) {
      logAssistant("trello_progress_list_fail", { userId, err: String(err).slice(0, 80) });
      return { skipped: "list_failed" };
    }
    match = pickBestMatchingCard(cards, userText, goals);
    if (match) {
      logAssistant("trello_progress_match", { userId, source: "fuzzy", cardId: match.id });
    }
  }

  if (!match) {
    logAssistant("trello_progress_match_miss", { userId });
    return { skipped: "trello_match_not_found" };
  }

  if (kind === "done") {
    const doneId = listDoneId();
    if (!doneId) {
      return { skipped: "no_done_list" };
    }
    try {
      await moveCardToList(match.id, doneId);
      logAssistant("trello_progress_ok", { userId, action: "moved_done", cardId: match.id });
      return { moved: match.name };
    } catch (err) {
      logAssistant("trello_progress_fail", {
        userId,
        action: "move",
        err: String(err).slice(0, 100)
      });
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
      logAssistant("trello_progress_ok", { userId, action: "blocked_note", cardId: match.id });
      return { noted: match.name };
    } catch (err) {
      logAssistant("trello_progress_fail", {
        userId,
        action: "desc",
        err: String(err).slice(0, 100)
      });
      return { skipped: "update_failed" };
    }
  }

  return { skipped: "unknown_kind" };
}

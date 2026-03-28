/** @param {string} text */
export function normalizeText(text = "") {
  return String(text)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const WEAK_GOAL_WORDS = new Set([
  "werden",
  "sein",
  "bleiben",
  "machen",
  "haben",
  "tun",
  "nur",
  "noch",
  "mal",
  "gern",
  "gerne"
]);

/**
 * @param {string} text
 * @returns {"status"|"delete_goal"|"update_goal"|"list_goals"|"add_goal"|"unknown"}
 */
export function detectIntent(text) {
  const t = normalizeText(text);

  if (t === "status") return "status";
  if (t.startsWith("delete ")) return "delete_goal";
  if (t.startsWith("update ")) return "update_goal";

  const listish =
    t === "liste" ||
    t.startsWith("liste ") ||
    /\bziele\b/.test(t) ||
    t === "list" ||
    t.startsWith("list ");
  if (listish) return "list_goals";

  if (
    t.includes("langfristig") ||
    t.includes("mittelfristig") ||
    t.includes("kurzfristig")
  ) {
    return "add_goal";
  }

  if (t.startsWith("goal set:") || /\bziel\b/.test(t)) return "add_goal";

  return "unknown";
}

/**
 * @param {string} text
 * @returns {{ type: string, content: string } | null}
 */
export function parseGoal(text) {
  const original = String(text).trim();
  const lower = normalizeText(text);

  let type = null;
  if (lower.startsWith("goal set:")) {
    type = "Long-term";
  } else if (lower.includes("langfristig")) {
    type = "Long-term";
  } else if (lower.includes("mittelfristig")) {
    type = "Mid-term";
  } else if (lower.includes("kurzfristig")) {
    type = "Short-term";
  }

  let content = original;

  if (lower.startsWith("goal set:")) {
    content = original.slice("goal set:".length).trim();
  } else {
    content = original.replace(/^ziel\s*:/i, "").trim();
    content = content.replace(/\blangfristig\s*:?/gi, "").trim();
    content = content.replace(/\bmittelfristig\s*:?/gi, "").trim();
    content = content.replace(/\bkurzfristig\s*:?/gi, "").trim();
  }

  content = content.replace(/^[-–:]\s*/, "").trim();

  if (!type) {
    if (/^ziel\s*:/i.test(original) || /\bziel\s*:/i.test(original)) {
      type = "Notes";
    } else {
      return null;
    }
  }

  if (!content || content.length < 4) return null;

  const words = content.split(/\s+/).filter(Boolean);
  if (words.length === 1 && WEAK_GOAL_WORDS.has(words[0].toLowerCase())) {
    return null;
  }
  if (words.length > 0 && words.every((w) => WEAK_GOAL_WORDS.has(w.toLowerCase()))) {
    return null;
  }

  return { type, content };
}

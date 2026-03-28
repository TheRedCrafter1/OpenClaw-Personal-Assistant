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
 * @returns {"status"|"goal_check"|"progress_note"|"task_add"|"shop_add"|"delete_goal"|"update_goal"|"list_goals"|"add_goal"|"unknown"}
 */
export function detectIntent(text) {
  const trimmed = String(text).trim();
  const t = normalizeText(text);
  const cmd = t.replace(/:\s*$/, "").trim();

  if (/^(note|notiz|fortschritt)\s*:/i.test(trimmed)) return "progress_note";

  if (cmd === "status") return "status";
  if (cmd.startsWith("goal check")) return "goal_check";
  if (t.startsWith("task add:")) return "task_add";
  if (t.startsWith("shop add:")) return "shop_add";
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
      type = "Status / Progress Notes";
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

function endOfDayUTC(d) {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x.toISOString();
}

/**
 * @param {string} phrase
 * @returns {string | null} ISO due for Trello
 */
export function parseDueToISO(phrase) {
  const p = String(phrase).trim().toLowerCase();
  if (!p) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) {
    const d = new Date(`${p}T23:59:59.000Z`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const now = new Date();
  if (p === "tomorrow") {
    now.setUTCDate(now.getUTCDate() + 1);
    return endOfDayUTC(now);
  }

  const weeks = p.match(/^(\d+)\s*weeks?$/);
  if (weeks) {
    now.setUTCDate(now.getUTCDate() + 7 * parseInt(weeks[1], 10));
    return endOfDayUTC(now);
  }

  const days = p.match(/^(\d+)\s*days?$/);
  if (days) {
    now.setUTCDate(now.getUTCDate() + parseInt(days[1], 10));
    return endOfDayUTC(now);
  }

  return null;
}

/**
 * TASK ADD: Titel | due: 2 weeks | extra wird zu Beschreibung
 * @returns {{ title: string, desc: string, dueISO: string | null } | null}
 */
export function parseTaskAdd(text) {
  const original = String(text).trim();
  const m = original.match(/^\s*task\s+add\s*:\s*(.+)$/i);
  if (!m) return null;
  const rest = m[1].trim();
  if (!rest) return null;

  const parts = rest
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  const title = parts[0] ?? "";
  if (!title) return null;

  let desc = "";
  let dueISO = null;
  for (let i = 1; i < parts.length; i += 1) {
    const seg = parts[i];
    const dueMatch = seg.match(/^due\s*:\s*(.+)$/i);
    if (dueMatch) {
      dueISO = parseDueToISO(dueMatch[1].trim());
      continue;
    }
    desc = desc ? `${desc}\n${seg}` : seg;
  }

  return { title, desc, dueISO };
}

/**
 * SHOP ADD: Milch, Eier, Brot
 * @returns {string[] | null}
 */
export function parseShopAdd(text) {
  const original = String(text).trim();
  const m = original.match(/^\s*shop\s+add\s*:\s*(.+)$/i);
  if (!m) return null;
  const items = m[1]
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : null;
}

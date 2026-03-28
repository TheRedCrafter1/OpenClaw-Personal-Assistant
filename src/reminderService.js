import {
  getSectionGoalsFromDoc,
  isMemoryEmptyFromDoc,
  loadMemoryDoc
} from "./memory.js";

const FOCUS_ORDER = ["Short-term", "Mid-term", "Long-term"];

/**
 * @param {{ sections: Record<string, string[]> }} doc
 * @param {number} max
 */
export function pickFocusGoals(doc, max = 2) {
  /** @type {{ section: string, item: string }[]} */
  const out = [];
  for (const section of FOCUS_ORDER) {
    const items = getSectionGoalsFromDoc(doc, section);
    for (const item of items) {
      if (item && out.length < max) {
        out.push({ section, item });
      }
    }
  }
  return out;
}

function sectionLabelDE(section) {
  if (section === "Short-term") return "kurzfristig";
  if (section === "Mid-term") return "mittelfristig";
  return "langfristig";
}

/**
 * Kurzer Reminder für WhatsApp (1–2 Ziele, nicht spammy).
 * @returns {Promise<string | null>} null wenn keine Ziele
 */
export async function buildReminderMessage(userId) {
  const doc = await loadMemoryDoc(userId);
  if (isMemoryEmptyFromDoc(doc)) {
    return null;
  }

  const picks = pickFocusGoals(doc, 2);
  if (picks.length === 0) {
    return null;
  }

  const lines = ["*Check-in:* Kurz von mir."];

  if (picks.length === 1) {
    const { section, item } = picks[0];
    lines.push(
      "",
      `Wie läuft es bei deinem ${sectionLabelDE(section)}en Ziel *${item}*?`
    );
  } else {
    lines.push("", `Wie stehts bei *${picks[0].item}*?`);
    lines.push(`Und bei *${picks[1].item}*?`);
  }

  lines.push(
    "",
    "Eine kurze Antwort reicht – oder *NOTE:* … für eine eigene Notiz."
  );

  return lines.join("\n");
}

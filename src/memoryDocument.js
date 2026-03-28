/** PRD-aligned memory: parse entire file → mutate → full render (no line patches). */

export const MEMORY_SECTION_ORDER = [
  "Long-term",
  "Mid-term",
  "Short-term",
  "Status / Progress Notes",
  "Reminder Rules"
];

/**
 * @param {string} title
 */
export function canonicalSectionTitle(title) {
  const t = title.trim();
  const lower = t.toLowerCase();
  if (lower === "notes") return "Status / Progress Notes";
  if (MEMORY_SECTION_ORDER.includes(t)) return t;
  if (lower.includes("reminder")) return "Reminder Rules";
  if (lower.includes("progress") || (lower.includes("status") && lower.includes("note"))) {
    return "Status / Progress Notes";
  }
  return "Status / Progress Notes";
}

/**
 * @typedef {{ userLine: string, sections: Record<string, string[]> }} MemoryDoc
 * @param {string} raw
 * @returns {MemoryDoc}
 */
export function parseMemoryDocument(raw) {
  const text = String(raw).replace(/\r\n/g, "\n");
  const lines = text.split("\n");

  /** @type {Record<string, string[]>} */
  const sections = Object.fromEntries(MEMORY_SECTION_ORDER.map((k) => [k, []]));

  let userLine = "";
  /** @type {string | null} */
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      const title = trimmed.slice(3).trim();
      current = canonicalSectionTitle(title);
      if (!MEMORY_SECTION_ORDER.includes(current)) {
        current = "Status / Progress Notes";
      }
      continue;
    }

    if (trimmed.startsWith("User:")) {
      userLine = trimmed;
      continue;
    }

    if (current && trimmed.startsWith("- ")) {
      const item = trimmed.slice(2).trim();
      if (item) {
        sections[current].push(item);
      }
    }
  }

  return { userLine, sections };
}

/**
 * @param {MemoryDoc} doc
 * @param {string} [fallbackUserLine]
 */
export function renderMemoryDocument(doc, fallbackUserLine = "User: global") {
  const userLine = doc.userLine?.trim() || fallbackUserLine;
  const parts = ["# Memory", "", userLine, ""];

  for (const key of MEMORY_SECTION_ORDER) {
    const items = doc.sections[key] || [];
    parts.push(`## ${key}`);
    if (items.length === 0) {
      parts.push("- ", "");
    } else {
      for (const g of items) {
        parts.push(`- ${g}`);
      }
      parts.push("");
    }
  }

  return parts.join("\n").trimEnd() + "\n";
}

/**
 * @param {MemoryDoc} doc
 */
export function ensureAllSections(doc) {
  for (const key of MEMORY_SECTION_ORDER) {
    if (!Array.isArray(doc.sections[key])) {
      doc.sections[key] = [];
    }
  }
}

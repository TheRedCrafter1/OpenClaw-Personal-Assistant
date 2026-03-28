import { normalizeText } from "./parser.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function oneLine(s) {
  return String(s).replace(/\s+/g, " ").trim().slice(0, 220);
}

/**
 * NOTE: / NOTIZ: / FORTSCHRITT: → freier Text für Status / Progress Notes
 * @returns {string | null}
 */
export function parseProgressNoteCommand(text) {
  const t = String(text).trim();
  const m = t.match(/^(note|notiz|fortschritt)\s*:\s*(.*)$/i);
  if (!m) return null;
  const body = m[2].trim();
  return body || null;
}

/**
 * Erkennt kurze Check-in-Antworten (kein Ersatz für NOTE:).
 * @returns {{ kind: string, label: string, line: string } | null}
 */
export function parseStructuredProgress(text) {
  const t = String(text).trim();
  if (!t || t.length > 400) return null;
  if (/^(note|notiz|fortschritt)\s*:/i.test(t)) return null;

  const lower = normalizeText(t);
  if (/\b(hallo|hi|hey|status|ziel|help)\b/i.test(t) && t.length < 15) return null;

  const blocked =
    /\b(blockiert|stecke fest|komm(e)? nicht weiter|geht nicht|keine zeit gerade)\b/i.test(
      lower
    );
  const notYet =
    /\b(noch nicht|nicht fertig|brauche noch|nächste woche|später|morgen mehr)\b/i.test(lower);
  const done =
    /\b(erledigt|geschafft|fertig|habs?\s+geschafft|ist\s+drin|^done$)\b/i.test(lower);

  const date = todayISO();
  const snippet = oneLine(t);

  if (blocked) {
    return {
      kind: "blocked",
      label: "blockiert",
      line: `${date}: Check-in – blockiert: ${snippet}`
    };
  }
  if (notYet) {
    return {
      kind: "in_progress",
      label: "läuft noch",
      line: `${date}: Check-in – noch unterwegs: ${snippet}`
    };
  }
  if (done) {
    return {
      kind: "done",
      label: "erledigt",
      line: `${date}: Check-in – erledigt: ${snippet}`
    };
  }

  return null;
}

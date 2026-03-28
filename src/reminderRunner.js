import { logAssistant } from "./assistantLog.js";
import { getLastProgressNoteDate, listMemoryUserIds } from "./memory.js";
import { getReminderPauseStatus, shouldSkipReminderDedupe } from "./reminderState.js";
import { buildReminderMessage } from "./reminderService.js";
import {
  isReminderWindowEnforced,
  isWithinReminderSendWindow
} from "./reminderWindow.js";

/**
 * Optional: Schutz für /reminder/* (n8n/Cron).
 * Ohne REMINDER_RUN_SECRET ist der Endpunkt offen wie /message – nur setzen, wenn der Port nicht öffentlich ist.
 */
export function reminderAuthMiddleware(req, res, next) {
  const secret = process.env.REMINDER_RUN_SECRET?.trim();
  if (!secret) {
    return next();
  }
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "")?.trim();
  const header = bearer || req.headers["x-reminder-secret"];
  if (header !== secret) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
}

/**
 * @param {string} userId
 * @param {{ enforceGuards?: boolean }} [options]
 * @returns {Promise<{ userId: string, text: string | null, skipped?: string }>}
 */
function minProgressAgeDays() {
  const n = parseInt(process.env.REMINDER_MIN_PROGRESS_AGE_DAYS ?? "5", 10);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

export async function runReminderForUser(userId, options = {}) {
  const enforceGuards = options.enforceGuards !== false;

  if (enforceGuards && isReminderWindowEnforced() && !isWithinReminderSendWindow()) {
    logAssistant("reminder_skip", { userId, reason: "outside_window" });
    return { userId, text: null, skipped: "outside_window" };
  }

  if (enforceGuards) {
    const p = await getReminderPauseStatus(userId);
    if (p.paused) {
      logAssistant("reminder_skip", { userId, reason: "paused" });
      return { userId, text: null, skipped: "paused" };
    }
  }

  const text = await buildReminderMessage(userId);
  if (!text) {
    logAssistant("reminder_skip", { userId, reason: "no_goals" });
    return { userId, text: null, skipped: "no_goals" };
  }

  if (enforceGuards) {
    const lastProgress = await getLastProgressNoteDate(userId);
    if (lastProgress) {
      const ageMs = Date.now() - lastProgress.getTime();
      const minAge = minProgressAgeDays() * 24 * 3600 * 1000;
      if (ageMs < minAge) {
        logAssistant("reminder_skip", { userId, reason: "recent_progress" });
        return { userId, text: null, skipped: "recent_progress" };
      }
    }

    const d = await shouldSkipReminderDedupe(userId, text);
    if (d.skip) {
      logAssistant("reminder_skip", { userId, reason: d.reason });
      return { userId, text: null, skipped: d.reason };
    }
    logAssistant("reminder_candidate", { userId, textLen: text.length });
  } else {
    logAssistant("reminder_preview", { userId, textLen: text.length });
  }

  return { userId, text };
}

/**
 * @param {{ enforceGuards?: boolean }} [options]
 * @returns {Promise<{ userId: string, text: string }[]>}
 */
export async function runRemindersForAllUsers(options = {}) {
  const ids = await listMemoryUserIds();
  const out = [];
  for (const uid of ids) {
    const r = await runReminderForUser(uid, options);
    if (r.text) {
      out.push({ userId: r.userId, text: r.text });
    }
  }
  return out;
}

/**
 * @returns {Promise<{ ok: boolean, status?: number }>}
 */
export async function postReminderOutbound(userId, text) {
  const url = process.env.REMINDER_OUTBOUND_URL?.trim();
  if (!url) {
    return { ok: false };
  }

  const secret = process.env.REMINDER_OUTBOUND_SECRET?.trim();
  /** @type {Record<string, string>} */
  const headers = { "Content-Type": "application/json" };
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, text })
    });
    logAssistant("reminder_outbound", { userId, ok: res.ok, status: res.status });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.error("REMINDER_OUTBOUND_URL failed:", err);
    logAssistant("reminder_outbound_fail", { userId, err: String(err).slice(0, 120) });
    return { ok: false };
  }
}

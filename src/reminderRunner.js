import { listMemoryUserIds } from "./memory.js";
import { buildReminderMessage } from "./reminderService.js";

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
 * @returns {Promise<{ userId: string, text: string | null, skipped?: string }>}
 */
export async function runReminderForUser(userId) {
  const text = await buildReminderMessage(userId);
  if (!text) {
    return { userId, text: null, skipped: "no_goals" };
  }
  return { userId, text };
}

/**
 * Nur Nutzer, bei denen ein Reminder-Text existiert.
 * @returns {Promise<{ userId: string, text: string }[]>}
 */
export async function runRemindersForAllUsers() {
  const ids = await listMemoryUserIds();
  const out = [];
  for (const userId of ids) {
    const r = await runReminderForUser(userId);
    if (r.text) {
      out.push({ userId: r.userId, text: r.text });
    }
  }
  return out;
}

/**
 * Optional zweiter Schritt nach Generierung (z. B. eigener Webhook).
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
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.error("REMINDER_OUTBOUND_URL failed:", err);
    return { ok: false };
  }
}

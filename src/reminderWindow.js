/**
 * Sendezeitfenster für Reminder (lokale Stunde in REMINDER_TZ).
 * Mit REMINDER_WINDOW_DISABLED=1 oder fehlenden Grenzen → keine Einschränkung.
 */

function parseHour(name, fallback) {
  const n = parseInt(process.env[name] ?? String(fallback), 10);
  return Number.isFinite(n) ? Math.min(23, Math.max(0, n)) : fallback;
}

/** Stunde 0–23 in der angegebenen IANA-Zeitzone */
export function currentHourInTimeZone(timeZone) {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    hour12: false
  });
  const parts = fmt.formatToParts(d);
  const h = parts.find((p) => p.type === "hour");
  return h ? parseInt(h.value, 10) : d.getUTCHours();
}

export function isReminderWindowEnforced() {
  if (process.env.REMINDER_WINDOW_DISABLED?.trim() === "1") {
    return false;
  }
  return true;
}

/**
 * Erlaubt, wenn aktuelle Stunde in [start, end] liegt (inkl. Endstunde).
 * Default 8–21 in Europe/Berlin.
 */
export function isWithinReminderSendWindow() {
  if (!isReminderWindowEnforced()) {
    return true;
  }
  const tz = process.env.REMINDER_TZ?.trim() || "Europe/Berlin";
  const start = parseHour("REMINDER_HOUR_START", 8);
  const end = parseHour("REMINDER_HOUR_END", 21);
  const h = currentHourInTimeZone(tz);
  return h >= start && h <= end;
}

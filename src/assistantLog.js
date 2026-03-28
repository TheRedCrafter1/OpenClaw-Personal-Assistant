/**
 * Strukturierte Logs für Live-Betrieb.
 * Aktiv mit ASSISTANT_LOG=1 (optional zusätzlich REMINDER_LOG=1 – gleiche Wirkung).
 */
export function isAssistantLogEnabled() {
  const v = process.env.ASSISTANT_LOG?.trim() || process.env.REMINDER_LOG?.trim();
  return v === "1" || v === "true" || v === "info";
}

/**
 * @param {string} tag
 * @param {Record<string, unknown>} [data]
 */
export function logAssistant(tag, data = {}) {
  if (!isAssistantLogEnabled()) return;
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      tag,
      ...data
    })
  );
}

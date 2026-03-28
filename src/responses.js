/**
 * WhatsApp nutzt *fett* mit einfachen Sternchen.
 * @param {string} kind
 * @param {Record<string, string>} [data]
 */
export function buildReply(kind, data = {}) {
  switch (kind) {
    case "goal_saved":
      return `Hab ich gespeichert: *${data.typeLabel} – ${data.content}*.`;
    case "goal_duplicate":
      return `Das Ziel ist schon drin: *${data.typeLabel} – ${data.content}*.`;
    case "goal_invalid":
      return (
        "Ich konnte kein klares Ziel erkennen. Schreib z. B. " +
        "„kurzfristig Bewerbungsfoto machen“ oder „langfristig fitter werden“."
      );
    case "status_empty":
      return "Ich habe aktuell noch keine Ziele gespeichert.";
    case "status_intro":
      return `Hier ist dein aktueller Stand:\n\n${data.body}`;
    case "unknown":
      return (
        "Das habe ich noch nicht ganz verstanden. " +
        "Probiers mit „langfristig …“, „STATUS“ oder „meine Ziele“."
      );
    case "command_wip":
      return (
        "DELETE und UPDATE kommen als Nächstes. " +
        "Bis dahin: STATUS oder neue Ziele mit „kurz-/mittel-/langfristig …“."
      );
    case "empty_message":
      return "Ich habe keine Nachricht bekommen – schreib mir einfach nochmal.";
    default:
      return "Okay.";
  }
}

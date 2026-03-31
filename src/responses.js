/**
 * WhatsApp nutzt *fett* mit einfachen Sternchen.
 * @param {string} kind
 * @param {Record<string, string>} [data]
 */
export function buildReply(kind, data = {}) {
  switch (kind) {
    case "goal_saved":
      return `${data.goalLabel ?? "Ziel"} gespeichert: ${data.content}.`;
    case "goal_duplicate":
      return `${data.goalLabel ?? "Ziel"} ist schon gespeichert: ${data.content}.`;
    case "goal_invalid":
      return (
        "Ich konnte kein klares Ziel erkennen. Schreib z. B. " +
        "*GOAL SET:* …, „kurzfristig …“, oder *STATUS:* für den Überblick."
      );
    case "status_empty":
      return "Ich habe aktuell noch keine Ziele gespeichert.";
    case "status_intro":
      return `Hier ist dein aktueller Stand:\n\n${data.body}`;
    case "help":
      return (
        "*Befehle:*\n" +
        "- *GOAL SET:* langfristig fitter werden\n" +
        "- *STATUS* / *GOAL CHECK*\n" +
        "- *TASK ADD:* Titel | due: 2 weeks\n" +
        "- *TASK MOVE:* Titel -> done\n" +
        "- *TASK UPDATE:* Titel | note: Text\n" +
        "- *SHOP ADD:* Milch, Eier\n" +
        "- *NOTE:* Freie Fortschrittsnotiz\n" +
        "- *PAUSE REMINDER 3d* / *RESUME REMINDER*"
      );
    case "goal_check_empty":
      return "Für einen Goal-Check brauche ich erst Ziele – schreib z. B. „GOAL SET: …“ oder „kurzfristig …“.";
    case "trello_not_configured":
      return (
        "Trello ist auf dem Server noch nicht konfiguriert. " +
        "Setze TRELLO_KEY, TRELLO_TOKEN, TRELLO_LIST_TASKS, TRELLO_LIST_SHOPPING (und für done-moves TRELLO_LIST_DONE)."
      );
    case "trello_error":
      return `Trello meldet einen Fehler: ${data.detail ?? "unbekannt"}`;
    case "task_invalid":
      return "TASK ADD braucht einen Titel, z. B. *TASK ADD: Budget April* oder *TASK ADD: Steuer | due: 2 weeks*.";
    case "shop_invalid":
      return "SHOP ADD braucht Einträge, z. B. *SHOP ADD: Milch, Eier, Brot*.";
    case "task_created":
      return `Task in Trello: *${data.name}*${data.dueHint ?? ""}`;
    case "task_move_invalid":
      return "Nutze z. B. *TASK MOVE: Budget April -> done*.";
    case "task_move_done":
      return `Task verschoben: *${data.name}* -> Done.`;
    case "task_move_not_found":
      return "Ich konnte keine passende Task auf der Task-Liste finden.";
    case "task_update_invalid":
      return "Nutze z. B. *TASK UPDATE: Budget April | note: warte auf Zahlen*.";
    case "task_update_saved":
      return `Task aktualisiert: *${data.name}* (Notiz ergänzt).`;
    case "task_update_not_found":
      return "Ich konnte keine passende Task für das Update finden.";
    case "shop_added":
      return `Zur Einkaufsliste (${data.count}): *${data.items}*.`;
    case "note_invalid":
      return "Schreib eine Notiz nach *NOTE:*, z. B. *NOTE: Budget-Plan noch offen, mache ich Montag.*";
    case "progress_saved":
      return "Hab ich als Fortschrittsnotiz gespeichert.";
    case "progress_auto_saved":
      return `Als Fortschritt notiert (*${data.label}*).${data.trelloHint ?? ""}`;
    case "reminder_paused":
      return `Reminder pausiert für *${data.forLabel}* (bis ${data.untilDate}).`;
    case "reminder_resumed":
      return "Reminder sind wieder aktiv.";
    case "reminder_already_resumed":
      return "Reminder waren bereits aktiv.";
    case "reminder_no_goals":
      return "Keine Ziele für einen Reminder – erst Goals anlegen.";
    case "unknown":
      return (
        "Das habe ich noch nicht ganz verstanden. " +
        "Befehle: *GOAL SET:*, *STATUS:*, *GOAL CHECK:*, *NOTE:*, *TASK ADD:*, *SHOP ADD:*, plus Zeitfenster-Ziele."
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

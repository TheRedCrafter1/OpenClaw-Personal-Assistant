import {
  detectIntent,
  parseGoal,
  parsePauseReminder,
  parseShopAdd,
  parseTaskAdd,
  parseTaskMove,
  parseTaskUpdate
} from "./parser.js";
import { parseProgressNoteCommand, parseStructuredProgress } from "./progressParser.js";
import { buildReply } from "./responses.js";
import { applyStructuredProgressToTrello } from "./trelloProgressService.js";
import {
  appendTaskNoteByTitle,
  createShoppingCards,
  createTaskCard,
  isTrelloConfigured,
  moveTaskByTitleToDone
} from "./trelloService.js";
import { registerTaskCard } from "./trelloUserMap.js";
import { clearReminderPause, setReminderPause } from "./reminderState.js";
import {
  appendStatusProgressNote,
  buildGoalCheckMessage,
  buildStatusBody,
  goalAlreadyExists,
  isMemoryEmpty,
  readMemoryContent,
  saveGoal
} from "./memory.js";

const TYPE_LABEL = {
  "Long-term": "langfristig",
  "Mid-term": "mittelfristig",
  "Short-term": "kurzfristig",
  "Status / Progress Notes": "Status/Notiz",
  "Reminder Rules": "Reminder-Regel"
};

function resolveUserId(userId) {
  const s = String(userId ?? "global").trim();
  return s || "global";
}

async function statusReplyForUser(userId) {
  const memoryContent = await readMemoryContent(userId);
  if (isMemoryEmpty(memoryContent)) {
    return buildReply("status_empty");
  }
  return buildReply("status_intro", { body: buildStatusBody(memoryContent) });
}

/**
 * @param {{ text?: string, userId?: string } | string} input
 * Legacy: `handleMessage("text")` still works (uses user `global`).
 */
export async function handleMessage(input) {
  const payload = typeof input === "string" ? { text: input } : input ?? {};
  const userId = resolveUserId(payload.userId);
  const raw = String(payload.text ?? "").trim();

  if (!raw) {
    return buildReply("empty_message");
  }

  const intent = detectIntent(raw);

  if (intent === "status" || intent === "list_goals") {
    return statusReplyForUser(userId);
  }

  if (intent === "help") {
    return buildReply("help");
  }

  if (intent === "reminder_pause") {
    const p = parsePauseReminder(raw);
    if (!p) {
      return "Nutze z. B. *PAUSE REMINDER 3d* oder *SNOOZE 24h*.";
    }
    const until = await setReminderPause(userId, p.hours);
    const untilDate = new Date(until).toLocaleString("de-DE");
    return buildReply("reminder_paused", { forLabel: p.label, untilDate });
  }

  if (intent === "reminder_resume") {
    const changed = await clearReminderPause(userId);
    return changed ? buildReply("reminder_resumed") : buildReply("reminder_already_resumed");
  }

  if (intent === "goal_check") {
    const msg = await buildGoalCheckMessage(userId);
    return msg.trim() ? msg : buildReply("goal_check_empty");
  }

  if (
    intent === "task_add" ||
    intent === "shop_add" ||
    intent === "task_move" ||
    intent === "task_update"
  ) {
    if (!isTrelloConfigured()) {
      return buildReply("trello_not_configured");
    }
  }

  if (intent === "task_add") {
    const task = parseTaskAdd(raw);
    if (!task) {
      return buildReply("task_invalid");
    }
    try {
      const card = await createTaskCard(task);
      let dueHint = "";
      if (task.dueISO) {
        try {
          const d = new Date(task.dueISO);
          dueHint = ` (Fällig ${d.toLocaleDateString("de-DE")})`;
        } catch {
          dueHint = "";
        }
      }
      try {
        await registerTaskCard(userId, card.id, card.name || task.title);
      } catch {
        /* Map ist optional; Task bleibt gültig */
      }
      return buildReply("task_created", { name: card.name || task.title, dueHint });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      const safe = detail.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
      return buildReply("trello_error", { detail: safe });
    }
  }

  if (intent === "shop_add") {
    const items = parseShopAdd(raw);
    if (!items) {
      return buildReply("shop_invalid");
    }
    try {
      await createShoppingCards(items);
      return buildReply("shop_added", {
        count: String(items.length),
        items: items.join(", ")
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      const safe = detail.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
      return buildReply("trello_error", { detail: safe });
    }
  }

  if (intent === "task_move") {
    const parsed = parseTaskMove(raw);
    if (!parsed) {
      return buildReply("task_move_invalid");
    }
    try {
      const moved = await moveTaskByTitleToDone(parsed.title);
      if (!moved) {
        return buildReply("task_move_not_found");
      }
      return buildReply("task_move_done", { name: moved.name });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      const safe = detail.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
      return buildReply("trello_error", { detail: safe });
    }
  }

  if (intent === "task_update") {
    const parsed = parseTaskUpdate(raw);
    if (!parsed) {
      return buildReply("task_update_invalid");
    }
    try {
      const updated = await appendTaskNoteByTitle(parsed.title, parsed.note);
      if (!updated) {
        return buildReply("task_update_not_found");
      }
      return buildReply("task_update_saved", { name: updated.name });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      const safe = detail.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
      return buildReply("trello_error", { detail: safe });
    }
  }

  if (intent === "progress_note") {
    const body = parseProgressNoteCommand(raw);
    if (!body) {
      return buildReply("note_invalid");
    }
    const date = new Date().toISOString().slice(0, 10);
    await appendStatusProgressNote(userId, `${date}: ${body}`);
    return buildReply("progress_saved");
  }

  if (intent === "delete_goal" || intent === "update_goal") {
    return buildReply("command_wip");
  }

  if (intent === "add_goal") {
    const parsed = parseGoal(raw);
    if (!parsed) {
      return buildReply("goal_invalid");
    }

    const typeLabel = TYPE_LABEL[parsed.type] ?? parsed.type;
    const exists = await goalAlreadyExists(userId, parsed.type, parsed.content);
    if (exists) {
      return buildReply("goal_duplicate", {
        typeLabel,
        content: parsed.content
      });
    }

    const saved = await saveGoal(userId, parsed.type, parsed.content);
    if (!saved) {
      return buildReply("goal_duplicate", {
        typeLabel,
        content: parsed.content
      });
    }

    return buildReply("goal_saved", {
      typeLabel,
      content: parsed.content
    });
  }

  const structured = parseStructuredProgress(raw);
  if (structured) {
    await appendStatusProgressNote(userId, structured.line);
    let trelloHint = "";
    try {
      const tr = await applyStructuredProgressToTrello(structured.kind, raw, userId);
      if (tr.moved) {
        trelloHint = ` Trello: Karte *${tr.moved}* nach Erledigt verschoben.`;
      } else if (tr.noted) {
        trelloHint = ` Trello: Blocker bei *${tr.noted}* in der Beschreibung ergänzt.`;
      }
    } catch (err) {
      console.error("Trello progress follow-up:", err);
      trelloHint = " (Trello-Anpassung ist fehlgeschlagen – nur Memory.)";
    }
    return buildReply("progress_auto_saved", { label: structured.label, trelloHint });
  }

  return buildReply("unknown");
}

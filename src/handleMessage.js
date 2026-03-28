import { detectIntent, parseGoal, parseShopAdd, parseTaskAdd } from "./parser.js";
import { parseProgressNoteCommand, parseStructuredProgress } from "./progressParser.js";
import { buildReply } from "./responses.js";
import { createShoppingCards, createTaskCard, isTrelloConfigured } from "./trelloService.js";
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

  if (intent === "goal_check") {
    const msg = await buildGoalCheckMessage(userId);
    return msg.trim() ? msg : buildReply("goal_check_empty");
  }

  if (intent === "task_add" || intent === "shop_add") {
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
      return buildReply("task_created", { name: card.name || task.title, dueHint });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return buildReply("trello_error", { detail: detail.slice(0, 120) });
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
      return buildReply("trello_error", { detail: detail.slice(0, 120) });
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
    return buildReply("progress_auto_saved", { label: structured.label });
  }

  return buildReply("unknown");
}

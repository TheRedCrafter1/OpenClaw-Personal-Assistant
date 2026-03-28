import { detectIntent, parseGoal } from "./parser.js";
import { buildReply } from "./responses.js";
import {
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
  Notes: "Notiz"
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

  return buildReply("unknown");
}

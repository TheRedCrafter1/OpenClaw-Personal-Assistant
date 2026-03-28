import { readFile } from "node:fs/promises";
import { detectIntent, parseGoal } from "./parser.js";
import { buildReply } from "./responses.js";
import {
  MEMORY_PATH,
  buildStatusBody,
  ensureMemoryFile,
  goalAlreadyExists,
  isMemoryEmpty,
  saveGoal
} from "./memory.js";

const TYPE_LABEL = {
  "Long-term": "langfristig",
  "Mid-term": "mittelfristig",
  "Short-term": "kurzfristig",
  Notes: "Notiz"
};

async function statusReplyFromDisk() {
  await ensureMemoryFile();
  const memoryContent = await readFile(MEMORY_PATH, "utf8");
  if (isMemoryEmpty(memoryContent)) {
    return buildReply("status_empty");
  }
  return buildReply("status_intro", { body: buildStatusBody(memoryContent) });
}

/** @param {string} text */
export async function handleMessage(text) {
  const raw = String(text ?? "").trim();
  if (!raw) {
    return buildReply("empty_message");
  }

  const intent = detectIntent(raw);

  if (intent === "status" || intent === "list_goals") {
    return statusReplyFromDisk();
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
    const exists = await goalAlreadyExists(parsed.type, parsed.content);
    if (exists) {
      return buildReply("goal_duplicate", {
        typeLabel,
        content: parsed.content
      });
    }

    const saved = await saveGoal(parsed.type, parsed.content);
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

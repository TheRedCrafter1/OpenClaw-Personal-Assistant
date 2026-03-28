/**
 * Loads all app modules (not index.js — that starts the HTTP server).
 */
import {
  detectIntent,
  parseGoal,
  parseShopAdd,
  parseTaskAdd
} from "../src/parser.js";
import { parseProgressNoteCommand, parseStructuredProgress } from "../src/progressParser.js";
import { buildReply } from "../src/responses.js";

await import("../src/memoryDocument.js");
await import("../src/syncTrigger.js");
await import("../src/trelloClient.js");
await import("../src/trelloService.js");
await import("../src/memory.js");
await import("../src/reminderRunner.js");
const { buildReminderMessage } = await import("../src/reminderService.js");
const { handleMessage } = await import("../src/handleMessage.js");

if (detectIntent("NOTE: hi") !== "progress_note") throw new Error("detectIntent progress_note");
if (!parseProgressNoteCommand("NOTE: x")) throw new Error("parseProgressNoteCommand");
if (!parseStructuredProgress("ist leider blockiert")) throw new Error("parseStructuredProgress");

if (detectIntent("TASK ADD: x") !== "task_add") throw new Error("detectIntent task_add");
if (detectIntent("SHOP ADD: a, b") !== "shop_add") throw new Error("detectIntent shop_add");
if (detectIntent("STATUS:") !== "status") throw new Error("detectIntent status:");
if (!parseTaskAdd("TASK ADD: T | due: 1 days")?.title) throw new Error("parseTaskAdd");
if (!parseShopAdd("SHOP ADD: x, y")?.length) throw new Error("parseShopAdd");
if (!parseGoal("kurzfristig etwas tun")) throw new Error("parseGoal");

if (!buildReply("trello_error", {}).includes("unbekannt")) {
  throw new Error("trello_error fallback");
}

const r1 = await handleMessage({ text: "STATUS", userId: "verify_user_xyz" });
if (typeof r1 !== "string" || r1.length < 5) throw new Error("STATUS reply invalid");

const r2 = await handleMessage({ text: "TASK ADD: Verify smoke" });
if (typeof r2 !== "string" || !r2.includes("Trello")) throw new Error("TASK reply invalid");

const r3 = await handleMessage({ text: "GOAL CHECK", userId: "verify_user_xyz" });
if (typeof r3 !== "string") throw new Error("GOAL CHECK reply type");

const rid = "verify_reminder_user";
await handleMessage({ text: "kurzfristig reminder smoke goal", userId: rid });
const rm = await buildReminderMessage(rid);
if (!rm || !rm.includes("Check-in")) throw new Error("buildReminderMessage");

const r4 = await handleMessage({ text: "NOTE: verify notiz zeile", userId: rid });
if (!r4.includes("gespeichert")) throw new Error("NOTE save");

const r5 = await handleMessage({ text: "habe es erledigt", userId: rid });
if (!r5.includes("Fortschritt")) throw new Error("structured progress");

console.log("verify-imports: OK");

import { createCard } from "./trelloClient.js";
import {
  listCardsOnList,
  moveCardToList,
  updateCardDescription,
  getCard
} from "./trelloClient.js";

export function isTrelloConfigured() {
  return Boolean(
    process.env.TRELLO_KEY?.trim() &&
      process.env.TRELLO_TOKEN?.trim() &&
      process.env.TRELLO_LIST_TASKS?.trim() &&
      process.env.TRELLO_LIST_SHOPPING?.trim()
  );
}

function listTasks() {
  return process.env.TRELLO_LIST_TASKS?.trim() ?? "";
}

function listShopping() {
  return process.env.TRELLO_LIST_SHOPPING?.trim() ?? "";
}

function listDone() {
  return process.env.TRELLO_LIST_DONE?.trim() ?? "";
}

function norm(s) {
  return String(s).toLowerCase().replace(/\s+/g, " ").trim();
}

function pickByTitle(cards, title) {
  const t = norm(title);
  let exact = cards.find((c) => norm(c.name) === t);
  if (exact) return exact;
  return cards.find((c) => norm(c.name).includes(t) || t.includes(norm(c.name)));
}

/**
 * @param {{ title: string, desc?: string, dueISO?: string | null }} task
 */
export async function createTaskCard(task) {
  return createCard({
    name: task.title,
    desc: task.desc || "",
    idList: listTasks(),
    due: task.dueISO || null
  });
}

/**
 * @param {string[]} items
 */
export async function createShoppingCards(items) {
  const idList = listShopping();
  const results = [];
  for (const name of items) {
    const card = await createCard({ name, idList });
    results.push(card);
  }
  return results;
}

/**
 * @param {string} title
 * @returns {Promise<{ id: string, name: string } | null>}
 */
export async function moveTaskByTitleToDone(title) {
  const tasks = await listCardsOnList(listTasks());
  const card = pickByTitle(tasks, title);
  if (!card) return null;
  const done = listDone();
  if (!done) return null;
  await moveCardToList(card.id, done);
  return { id: card.id, name: card.name };
}

/**
 * @param {string} title
 * @param {string} note
 * @returns {Promise<{ id: string, name: string } | null>}
 */
export async function appendTaskNoteByTitle(title, note) {
  const tasks = await listCardsOnList(listTasks());
  const card = pickByTitle(tasks, title);
  if (!card) return null;
  const full = await getCard(card.id);
  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = `\n\n---\n[${stamp}] Update (WhatsApp): ${note}`;
  await updateCardDescription(card.id, `${full.desc || ""}${suffix}`);
  return { id: card.id, name: card.name };
}

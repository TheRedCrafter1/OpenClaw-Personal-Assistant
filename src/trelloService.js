import { createCard } from "./trelloClient.js";

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

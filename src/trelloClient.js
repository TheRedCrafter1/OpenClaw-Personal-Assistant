const BASE = "https://api.trello.com/1";

function authParams() {
  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;
  return { key, token };
}

function requireAuth() {
  const { key, token } = authParams();
  if (!key || !token) {
    throw new Error("TRELLO_KEY oder TRELLO_TOKEN fehlt");
  }
  return new URLSearchParams({ key, token });
}

async function parseJsonResponse(res) {
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(bodyText.slice(0, 200) || `HTTP ${res.status}`);
  }
  try {
    return JSON.parse(bodyText);
  } catch {
    throw new Error(`Trello: ungültige JSON-Antwort (HTTP ${res.status})`);
  }
}

/**
 * Offene Cards auf einer Liste (für Fortschritt-Matching).
 * @param {string} idList
 * @returns {Promise<{ id: string, name: string, desc: string }[]>}
 */
export async function listCardsOnList(idList) {
  const params = requireAuth();
  params.set("fields", "id,name,desc");
  const res = await fetch(`${BASE}/lists/${encodeURIComponent(idList)}/cards?${params}`, {
    method: "GET"
  });
  const data = await parseJsonResponse(res);
  return Array.isArray(data) ? data : [];
}

/**
 * @param {string} cardId
 */
export async function getCard(cardId) {
  const params = requireAuth();
  params.set("fields", "id,name,desc");
  const res = await fetch(`${BASE}/cards/${encodeURIComponent(cardId)}?${params}`, {
    method: "GET"
  });
  return parseJsonResponse(res);
}

/**
 * @param {string} cardId
 * @param {string} idList
 */
export async function moveCardToList(cardId, idList) {
  const params = requireAuth();
  params.set("idList", idList);
  const res = await fetch(`${BASE}/cards/${encodeURIComponent(cardId)}?${params.toString()}`, {
    method: "PUT"
  });
  return parseJsonResponse(res);
}

/**
 * @param {string} cardId
 * @param {string} desc
 */
export async function updateCardDescription(cardId, desc) {
  const params = requireAuth();
  params.set("desc", desc);
  const res = await fetch(`${BASE}/cards/${encodeURIComponent(cardId)}?${params.toString()}`, {
    method: "PUT"
  });
  return parseJsonResponse(res);
}

/**
 * @param {{ name: string, desc?: string, idList: string, due?: string | null }} opts
 */
export async function createCard({ name, desc = "", idList, due = null }) {
  const params = requireAuth();
  params.set("name", name);
  params.set("idList", idList);
  if (desc) params.set("desc", desc);
  if (due) params.set("due", due);

  const res = await fetch(`${BASE}/cards?${params.toString()}`, { method: "POST" });
  return parseJsonResponse(res);
}

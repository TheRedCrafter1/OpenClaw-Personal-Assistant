const BASE = "https://api.trello.com/1";

function authParams() {
  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;
  return { key, token };
}

/**
 * @param {{ name: string, desc?: string, idList: string, due?: string | null }} opts
 */
export async function createCard({ name, desc = "", idList, due = null }) {
  const { key, token } = authParams();
  if (!key || !token) {
    throw new Error("TRELLO_KEY oder TRELLO_TOKEN fehlt");
  }

  const params = new URLSearchParams({
    key,
    token,
    name,
    idList
  });
  if (desc) params.set("desc", desc);
  if (due) params.set("due", due);

  const res = await fetch(`${BASE}/cards?${params.toString()}`, { method: "POST" });
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

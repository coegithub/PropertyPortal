// Anonymous per-browser id, sent with API calls so each browser only sees its
// own orders. Replace with the authenticated user once login exists.
const KEY = 'eoi-portal-client-id';
let cached = null;

export function getClientId() {
  if (cached) return cached;
  try {
    cached = localStorage.getItem(KEY);
  } catch {
    /* storage blocked */
  }
  if (!cached) {
    cached = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    try {
      localStorage.setItem(KEY, cached);
    } catch {
      /* storage blocked: id lasts for this tab only */
    }
  }
  return cached;
}

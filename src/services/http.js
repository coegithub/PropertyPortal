// The one fetch wrapper. Page-level API functions live in api.js (and auth.js with --auth).
import { getClientId } from './clientId.js';

export async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': getClientId(), ...options.headers },
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const data = await res.json().catch(() => null);
  // Lets AuthContext drop a signed-in user whose session expired. Harmless without auth.
  if (res.status === 401) window.dispatchEvent(new Event('auth:expired'));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}
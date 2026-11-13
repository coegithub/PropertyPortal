// Page-level API functions. Every request goes through http.js, the only place that calls fetch.
import { request } from './http.js';

export const getCatalog = () => request('/catalog');
export const getEois = () => request('/eois');
export const getEoi = (id) => request(`/eois/${encodeURIComponent(id)}`);
export const createEoi = (eoi) => request('/eois', { method: 'POST', body: JSON.stringify(eoi) });
export const withdrawEoi = (id) => request(`/eois/${encodeURIComponent(id)}/withdraw`, { method: 'POST' });

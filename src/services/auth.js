// Account calls. Same rule as api.js: every request goes through http.js.
import { request } from './http.js';

const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });

export const getMe = () => request('/auth/me');
export const register = (body) => post('/auth/register', body);
export const login = (body) => post('/auth/login', body);
export const logout = () => post('/auth/logout');
export const changePassword = (body) => post('/auth/password', body);
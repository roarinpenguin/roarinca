import axios from 'axios';

const base = import.meta.env.VITE_API_BASE || '/api';

export const api = axios.create({
  baseURL: base,
  withCredentials: true,
});

export async function login(username, password) {
  const res = await api.post('/auth/login', { username, password });
  return res.data;
}

export async function logout() {
  const res = await api.post('/auth/logout');
  return res.data;
}

export async function fetchMe() {
  const res = await api.get('/auth/me');
  return res.data;
}

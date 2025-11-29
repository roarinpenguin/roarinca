import { api } from './api.js';

export async function getCaSettings() {
  const res = await api.get('/ca/settings');
  return res.data;
}

export async function saveCaSettings(payload) {
  const res = await api.post('/ca/settings', payload);
  return res.data;
}

export async function initCa() {
  const res = await api.post('/ca/init');
  return res.data;
}

import { api } from './api.js';

export async function createCsr(payload) {
  const res = await api.post('/csr', payload);
  return res.data;
}

export async function listCsrs() {
  const res = await api.get('/csr');
  return res.data;
}

export async function getCsr(id) {
  const res = await api.get(`/csr/${id}`);
  return res.data;
}

export async function deleteCsr(id) {
  const res = await api.delete(`/csr/${id}`);
  return res.data;
}

export function downloadCsrUrl(id) {
  const base = import.meta.env.VITE_API_BASE || '';
  return `${base}/csr/${id}/download/csr`;
}

export function downloadKeyUrl(id) {
  const base = import.meta.env.VITE_API_BASE || '';
  return `${base}/csr/${id}/download/key`;
}

// Helper to trigger download via fetch (needed for auth cookie)
export async function downloadFile(url, filename) {
  const res = await api.get(url, { responseType: 'blob' });
  const blob = new Blob([res.data]);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export async function downloadCsr(id, commonName) {
  const filename = `${commonName.replace(/[^a-zA-Z0-9.-]/g, '_')}.csr.pem`;
  await downloadFile(`/csr/${id}/download/csr`, filename);
}

export async function downloadCsrKey(id, commonName) {
  const filename = `${commonName.replace(/[^a-zA-Z0-9.-]/g, '_')}.key.pem`;
  await downloadFile(`/csr/${id}/download/key`, filename);
}

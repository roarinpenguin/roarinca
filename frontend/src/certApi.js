import { api } from './api.js';

export async function listCertificates() {
  const res = await api.get('/certificates');
  return res.data;
}

export async function getCertificate(id) {
  const res = await api.get(`/certificates/${id}`);
  return res.data;
}

export async function importCertificate(payload) {
  const res = await api.post('/certificates/import', payload);
  return res.data;
}

export async function signCsr(csrId, days = 365) {
  const res = await api.post(`/certificates/sign/${csrId}`, { days });
  return res.data;
}

export async function deleteCertificate(id) {
  const res = await api.delete(`/certificates/${id}`);
  return res.data;
}

// Helper to trigger download via fetch (needed for auth cookie)
async function downloadFile(url, filename) {
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

export async function downloadCert(id, commonName) {
  const filename = `${commonName.replace(/[^a-zA-Z0-9.-]/g, '_')}.cert.pem`;
  await downloadFile(`/certificates/${id}/download/cert`, filename);
}

export async function downloadCertKey(id, commonName) {
  const filename = `${commonName.replace(/[^a-zA-Z0-9.-]/g, '_')}.key.pem`;
  await downloadFile(`/certificates/${id}/download/key`, filename);
}

export async function downloadChain(id, commonName) {
  const filename = `${commonName.replace(/[^a-zA-Z0-9.-]/g, '_')}.chain.pem`;
  await downloadFile(`/certificates/${id}/download/chain`, filename);
}

export async function downloadFullchain(id, commonName) {
  const filename = `${commonName.replace(/[^a-zA-Z0-9.-]/g, '_')}.fullchain.pem`;
  await downloadFile(`/certificates/${id}/download/fullchain`, filename);
}

export async function exportPkcs12(id, commonName, password) {
  const res = await api.post(`/certificates/${id}/export/pkcs12`, { password }, { responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'application/x-pkcs12' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${commonName.replace(/[^a-zA-Z0-9.-]/g, '_')}.p12`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export async function downloadCaCert() {
  await downloadFile('/ca/cert', 'ca.cert.pem');
}

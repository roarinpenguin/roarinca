import React, { useState, useEffect } from 'react';
import { login, logout, fetchMe } from './api.js';
import { getCaSettings, saveCaSettings, initCa } from './caApi.js';
import { createCsr, listCsrs, deleteCsr, downloadCsr, downloadCsrKey } from './csrApi.js';
import {
  listCertificates,
  importCertificate,
  signCsr,
  deleteCertificate,
  downloadCert,
  downloadCertKey,
  downloadFullchain,
  exportPkcs12,
  downloadCaCert,
} from './certApi.js';

const sections = ['settings', 'requests', 'certificates'];

const CSR_PRESETS = {
  server_tls: {
    label: 'Server TLS',
    description: 'HTTPS servers, APIs, web services',
    icon: '🌐',
  },
  client_tls: {
    label: 'Client TLS',
    description: 'mTLS client authentication',
    icon: '🔐',
  },
  code_signing: {
    label: 'Code Signing',
    description: 'Sign executables, scripts, packages',
    icon: '📦',
  },
};

function App() {
  const [active, setActive] = useState('settings');

  // Auth state
  const [authChecking, setAuthChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('ca_admin');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  // CA settings state
  const [caLoading, setCaLoading] = useState(false);
  const [caSaving, setCaSaving] = useState(false);
  const [caInitializing, setCaInitializing] = useState(false);
  const [caError, setCaError] = useState('');
  const [caSettings, setCaSettings] = useState({
    common_name: '',
    organization: '',
    organizational_unit: '',
    country: '',
    state: '',
    locality: '',
    key_type: 'RSA',
    key_size: 2048,
    initialized: false,
  });

  // CSR state
  const [csrList, setCsrList] = useState([]);
  const [csrLoading, setCsrLoading] = useState(false);
  const [csrCreating, setCsrCreating] = useState(false);
  const [csrError, setCsrError] = useState('');
  const [csrForm, setCsrForm] = useState({
    preset: 'server_tls',
    common_name: '',
    organization: '',
    organizational_unit: '',
    country: '',
    state: '',
    locality: '',
    email: '',
    san: '',
    key_size: 2048,
  });

  // Certificates state
  const [certList, setCertList] = useState([]);
  const [certLoading, setCertLoading] = useState(false);
  const [certError, setCertError] = useState('');
  const [certImporting, setCertImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importForm, setImportForm] = useState({ cert_pem: '', key_pem: '', chain_pem: '' });
  const [showPkcs12Modal, setShowPkcs12Modal] = useState(false);
  const [pkcs12CertId, setPkcs12CertId] = useState(null);
  const [pkcs12CertName, setPkcs12CertName] = useState('');
  const [pkcs12Password, setPkcs12Password] = useState('');
  const [pkcs12Exporting, setPkcs12Exporting] = useState(false);

  // Check auth on load
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchMe();
        if (mounted && data && data.user) {
          setUser(data.user);
        }
      } catch {
        // not logged in is fine
      } finally {
        if (mounted) setAuthChecking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Load CA settings once authenticated
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    setCaLoading(true);
    setCaError('');
    (async () => {
      try {
        const data = await getCaSettings();
        if (mounted && data && data.settings) {
          setCaSettings(prev => ({ ...prev, ...data.settings }));
        }
      } catch (err) {
        if (mounted) {
          const msg =
            (err.response && err.response.data && err.response.data.error) ||
            'Unable to load CA settings';
          setCaError(msg);
        }
      } finally {
        if (mounted) setCaLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  async function handleLogin(e) {
    e.preventDefault();
    setAuthError('');
    setAuthBusy(true);
    try {
      const data = await login(username.trim(), password);
      if (data && data.username) {
        setUser({ username: data.username });
        setPassword('');
      }
    } catch (err) {
      const msg =
        (err.response && err.response.data && err.response.data.error) ||
        'Unable to authenticate';
      setAuthError(msg);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    setAuthBusy(true);
    try {
      await logout();
      setUser(null);

      // Reset CA-related state on logout
      setCaSettings({
        common_name: '',
        organization: '',
        organizational_unit: '',
        country: '',
        state: '',
        locality: '',
        key_type: 'RSA',
        key_size: 2048,
        initialized: false,
      });
      setCaError('');
      setCaLoading(false);
      setCaSaving(false);
      setCaInitializing(false);
    } catch {
      // ignore
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSaveCa(e) {
    e.preventDefault();
    setCaError('');
    setCaSaving(true);
    try {
      await saveCaSettings(caSettings);
    } catch (err) {
      const msg =
        (err.response && err.response.data && err.response.data.error) ||
        'Unable to save CA settings';
      setCaError(msg);
    } finally {
      setCaSaving(false);
    }
  }

  async function handleInitCa() {
    setCaError('');
    setCaInitializing(true);
    try {
      await initCa();
      setCaSettings(prev => ({ ...prev, initialized: true }));
    } catch (err) {
      const msg =
        (err.response && err.response.data && err.response.data.error) ||
        'Failed to initialize CA';
      setCaError(msg);
    } finally {
      setCaInitializing(false);
    }
  }

  // Load CSR list
  async function loadCsrs() {
    setCsrLoading(true);
    setCsrError('');
    try {
      const data = await listCsrs();
      setCsrList(data.csrs || []);
    } catch (err) {
      setCsrError('Failed to load CSRs');
    } finally {
      setCsrLoading(false);
    }
  }

  // Load certificates list
  async function loadCertificates() {
    setCertLoading(true);
    setCertError('');
    try {
      const data = await listCertificates();
      setCertList(data.certificates || []);
    } catch (err) {
      setCertError('Failed to load certificates');
    } finally {
      setCertLoading(false);
    }
  }

  // Load CSRs and certs when user logs in or tab changes
  useEffect(() => {
    if (user && active === 'requests') {
      loadCsrs();
    }
  }, [user, active]);

  useEffect(() => {
    if (user && active === 'certificates') {
      loadCertificates();
    }
  }, [user, active]);

  // CSR form handlers
  async function handleCreateCsr(e) {
    e.preventDefault();
    setCsrError('');
    setCsrCreating(true);
    try {
      await createCsr(csrForm);
      setCsrForm({
        preset: 'server_tls',
        common_name: '',
        organization: '',
        organizational_unit: '',
        country: '',
        state: '',
        locality: '',
        email: '',
        san: '',
        key_size: 2048,
      });
      await loadCsrs();
    } catch (err) {
      const msg =
        (err.response && err.response.data && err.response.data.error) ||
        'Failed to create CSR';
      setCsrError(msg);
    } finally {
      setCsrCreating(false);
    }
  }

  async function handleDeleteCsr(id) {
    if (!confirm('Delete this CSR? This cannot be undone.')) return;
    try {
      await deleteCsr(id);
      await loadCsrs();
    } catch {
      setCsrError('Failed to delete CSR');
    }
  }

  async function handleDownloadCsr(id, cn) {
    try {
      await downloadCsr(id, cn);
    } catch {
      setCsrError('Failed to download CSR');
    }
  }

  async function handleDownloadCsrKey(id, cn) {
    try {
      await downloadCsrKey(id, cn);
    } catch {
      setCsrError('Failed to download key');
    }
  }

  // Certificate handlers
  async function handleSignCsr(csrId) {
    if (!caSettings.initialized) {
      setCsrError('Initialize the CA first before signing CSRs');
      return;
    }
    try {
      await signCsr(csrId);
      await loadCsrs();
      await loadCertificates();
      setActive('certificates');
    } catch (err) {
      const msg =
        (err.response && err.response.data && err.response.data.error) ||
        'Failed to sign CSR';
      setCsrError(msg);
    }
  }

  async function handleImportCert(e) {
    e.preventDefault();
    setCertImporting(true);
    setCertError('');
    try {
      await importCertificate(importForm);
      setShowImportModal(false);
      setImportForm({ cert_pem: '', key_pem: '', chain_pem: '' });
      await loadCertificates();
    } catch (err) {
      const msg =
        (err.response && err.response.data && err.response.data.error) ||
        'Failed to import certificate';
      setCertError(msg);
    } finally {
      setCertImporting(false);
    }
  }

  async function handleDeleteCert(id) {
    if (!confirm('Delete this certificate? This cannot be undone.')) return;
    try {
      await deleteCertificate(id);
      await loadCertificates();
    } catch {
      setCertError('Failed to delete certificate');
    }
  }

  async function handleDownloadCert(id, cn) {
    try {
      await downloadCert(id, cn);
    } catch {
      setCertError('Failed to download certificate');
    }
  }

  async function handleDownloadCertKey(id, cn) {
    try {
      await downloadCertKey(id, cn);
    } catch {
      setCertError('Failed to download key');
    }
  }

  async function handleDownloadFullchain(id, cn) {
    try {
      await downloadFullchain(id, cn);
    } catch {
      setCertError('Failed to download fullchain');
    }
  }

  function openPkcs12Modal(id, cn) {
    setPkcs12CertId(id);
    setPkcs12CertName(cn);
    setPkcs12Password('');
    setShowPkcs12Modal(true);
  }

  async function handleExportPkcs12(e) {
    e.preventDefault();
    setPkcs12Exporting(true);
    try {
      await exportPkcs12(pkcs12CertId, pkcs12CertName, pkcs12Password);
      setShowPkcs12Modal(false);
      setPkcs12Password('');
    } catch (err) {
      const msg =
        (err.response && err.response.data && err.response.data.error) ||
        'Failed to export PKCS#12';
      setCertError(msg);
    } finally {
      setPkcs12Exporting(false);
    }
  }

  async function handleDownloadCaCert() {
    try {
      await downloadCaCert();
    } catch {
      setCertError('Failed to download CA certificate');
    }
  }

  return (
    <div className="min-h-screen flex flex-col text-slate-50 relative">
      {/* Purple ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-rpurple-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-rpurple-600/8 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-3 border-b border-rpurple-500/20 bg-slate-950/80 backdrop-blur-xl shadow-glossy sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <img 
            src="/roarinca.png" 
            alt="Roarin CA Logo" 
            className="h-10 w-10 rounded-xl shadow-lg shadow-rpurple-500/30 bg-white/95 p-0.5"
          />
          <div className="leading-tight">
            <div className="text-xs uppercase tracking-[0.25em] text-rpurple-300 font-medium">
              Roarin CA
            </div>
            <div className="text-sm sm:text-base font-semibold bg-gradient-to-r from-slate-50 to-rpurple-200 bg-clip-text text-transparent">
              Digital Certificate Studio
            </div>
          </div>
        </div>

        {/* Top-right clean tab nav */}
        <nav className="hidden sm:flex items-center gap-2 bg-slate-950/90 border border-rpurple-500/20 rounded-2xl px-2 py-1 shadow-glossy">
          {sections.map(s => (
            <button
              key={s}
              onClick={() => setActive(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-xl capitalize transition-all duration-200 ${
                active === s
                  ? 'btn-glow text-white'
                  : 'text-slate-300 hover:text-rpurple-200 hover:bg-rpurple-500/10'
              }`}
            >
              {s}
            </button>
          ))}
        </nav>
      </header>

      {/* Main */}
      <main className="flex-1 px-3 sm:px-6 lg:px-10 py-6 sm:py-8 relative z-10">
        <div className="max-w-6xl mx-auto grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] items-start">
          {/* Primary panel */}
          <section className="glossy-card rounded-3xl p-4 sm:p-6 lg:p-7">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div>
                <h1 className="text-lg sm:text-xl font-semibold tracking-tight flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-2xl btn-glow text-xs font-bold">
                    {active === 'settings' ? 'CA' : active === 'requests' ? 'CSR' : 'CRT'}
                  </span>
                  <span className="capitalize bg-gradient-to-r from-slate-50 to-rpurple-200 bg-clip-text text-transparent">{active}</span>
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-400">
                  {active === 'settings' &&
                    'Define how your Certificate Authority presents and protects itself.'}
                  {active === 'requests' &&
                    'Craft CSRs with sensible presets, ready for external signing.'}
                  {active === 'certificates' &&
                    'Import, issue, sign and export digital certificates with confidence.'}
                </p>
              </div>
            </div>

            <div className="mt-4 sm:mt-6 text-sm text-slate-300">
              {active === 'settings' && (
                <>
                  {!user ? (
                    // Logged OUT: locked card, no CA details
                    <div className="h-40 sm:h-56 rounded-2xl border border-rpurple-500/40 bg-gradient-to-br from-slate-950/60 via-slate-950/40 to-rpurple-900/40 flex flex-col items-center justify-center text-xs sm:text-sm text-slate-400 gap-2">
                      <div className="inline-flex items-center gap-1 rounded-full bg-slate-800/70 text-slate-200 px-3 py-1 border border-slate-500/60 text-[11px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        CA settings are locked
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-400 max-w-md text-center">
                        Sign in as <span className="font-mono text-rpurple-200">ca_admin</span>{' '}
                        to view and manage your Certificate Authority identity and key material.
                      </p>
                    </div>
                  ) : (
                    // Logged IN: full CA form
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-900/60 px-2 py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                          <span className="uppercase tracking-[0.16em] text-slate-300">
                            CA Settings
                          </span>
                        </span>
                        {caSettings.initialized ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 text-emerald-200 px-2 py-1 border border-emerald-400/40 text-[11px]">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                            Initialized
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-200 px-2 py-1 border border-amber-400/40 text-[11px]">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                            Not initialized
                          </span>
                        )}
                      </div>

                      <form onSubmit={handleSaveCa} className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-3">
                          <label className="block space-y-1 text-xs">
                            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                              Common Name
                            </span>
                            <input
                              className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-2.5 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80 focus:border-rpurple-400/80"
                              value={caSettings.common_name}
                              onChange={e =>
                                setCaSettings(prev => ({
                                  ...prev,
                                  common_name: e.target.value,
                                }))
                              }
                              placeholder="Roarin CA Root"
                            />
                          </label>

                          <label className="block space-y-1 text-xs">
                            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                              Organization
                            </span>
                            <input
                              className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-2.5 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80 focus:border-rpurple-400/80"
                              value={caSettings.organization}
                              onChange={e =>
                                setCaSettings(prev => ({
                                  ...prev,
                                  organization: e.target.value,
                                }))
                              }
                              placeholder="RoarinPenguin"
                            />
                          </label>

                          <label className="block space-y-1 text-xs">
                            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                              Organizational Unit
                            </span>
                            <input
                              className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-2.5 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80 focus:border-rpurple-400/80"
                              value={caSettings.organizational_unit}
                              onChange={e =>
                                setCaSettings(prev => ({
                                  ...prev,
                                  organizational_unit: e.target.value,
                                }))
                              }
                              placeholder="Security Operations"
                            />
                          </label>
                        </div>

                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <label className="space-y-1">
                              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                                Country
                              </span>
                              <input
                                className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-2 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80 focus:border-rpurple-400/80"
                                value={caSettings.country}
                                onChange={e =>
                                  setCaSettings(prev => ({
                                    ...prev,
                                    country: e.target.value,
                                  }))
                                }
                                placeholder="IT"
                                maxLength={2}
                              />
                            </label>

                            <label className="space-y-1">
                              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                                State
                              </span>
                              <input
                                className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-2 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80 focus:border-rpurple-400/80"
                                value={caSettings.state}
                                onChange={e =>
                                  setCaSettings(prev => ({
                                    ...prev,
                                    state: e.target.value,
                                  }))
                                }
                                placeholder="MI"
                              />
                            </label>

                            <label className="space-y-1">
                              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                                Locality
                              </span>
                              <input
                                className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-2 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80 focus:border-rpurple-400/80"
                                value={caSettings.locality}
                                onChange={e =>
                                  setCaSettings(prev => ({
                                    ...prev,
                                    locality: e.target.value,
                                  }))
                                }
                                placeholder="Milan"
                              />
                            </label>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <label className="space-y-1">
                              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                                Key Type
                              </span>
                              <select
                                className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-2 py-1.5 text-xs text-slate-50 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80 focus:border-rpurple-400/80"
                                value={caSettings.key_type}
                                onChange={e =>
                                  setCaSettings(prev => ({
                                    ...prev,
                                    key_type: e.target.value,
                                  }))
                                }
                              >
                                <option value="RSA">RSA</option>
                              </select>
                            </label>

                            <label className="space-y-1">
                              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                                Key Size
                              </span>
                              <select
                                className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-2 py-1.5 text-xs text-slate-50 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80 focus:border-rpurple-400/80"
                                value={caSettings.key_size}
                                onChange={e =>
                                  setCaSettings(prev => ({
                                    ...prev,
                                    key_size: Number(e.target.value),
                                  }))
                                }
                              >
                                <option value={2048}>2048</option>
                                <option value={4096}>4096</option>
                              </select>
                            </label>
                          </div>
                        </div>

                        <div className="sm:col-span-2 flex flex-wrap items-center gap-3 mt-1">
                          <button
                            type="submit"
                            disabled={caSaving || !user}
                            className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-rpurple-500 to-rpurple-600 hover:from-rpurple-400 hover:to-rpurple-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium px-4 py-1.5 shadow-glossy"
                          >
                            {caSaving ? 'Saving ...' : 'Save CA settings'}
                          </button>
                          <button
                            type="button"
                            disabled={caInitializing || !user || !caSettings.common_name}
                            onClick={handleInitCa}
                            className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-rpurple-400/70 bg-slate-950/80 hover:bg-slate-900/80 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium px-4 py-1.5"
                          >
                            {caInitializing ? 'Initializing ...' : 'Initialize CA'}
                          </button>
                          {caLoading && (
                            <span className="text-[11px] text-slate-500">
                              Loading CA settings ...
                            </span>
                          )}
                          {caError && (
                            <span className="text-[11px] text-rose-300">{caError}</span>
                          )}
                        </div>
                      </form>
                    </div>
                  )}
                </>
              )}

              {active === 'requests' && (
                <>
                  {!user ? (
                    <div className="h-40 sm:h-56 rounded-2xl border border-rpurple-500/40 bg-gradient-to-br from-slate-950/60 via-slate-950/40 to-rpurple-900/40 flex flex-col items-center justify-center text-xs sm:text-sm text-slate-400 gap-2">
                      <div className="inline-flex items-center gap-1 rounded-full bg-slate-800/70 text-slate-200 px-3 py-1 border border-slate-500/60 text-[11px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        CSR generation locked
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-400 max-w-md text-center">
                        Sign in as <span className="font-mono text-rpurple-200">ca_admin</span> to create and manage certificate signing requests.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Preset selector */}
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(CSR_PRESETS).map(([key, preset]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setCsrForm(prev => ({ ...prev, preset: key }))}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${
                              csrForm.preset === key
                                ? 'border-rpurple-400/70 bg-rpurple-500/20 text-rpurple-100'
                                : 'border-white/10 bg-slate-900/50 text-slate-300 hover:bg-slate-900/70'
                            }`}
                          >
                            <span className="text-base">{preset.icon}</span>
                            <div className="text-left">
                              <div className="font-medium">{preset.label}</div>
                              <div className="text-[10px] text-slate-400">{preset.description}</div>
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* CSR Form */}
                      <form onSubmit={handleCreateCsr} className="grid gap-3 sm:grid-cols-2">
                        <label className="block space-y-1 text-xs">
                          <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Common Name *</span>
                          <input
                            className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-2.5 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80"
                            value={csrForm.common_name}
                            onChange={e => setCsrForm(prev => ({ ...prev, common_name: e.target.value }))}
                            placeholder="example.com"
                            required
                          />
                        </label>
                        <label className="block space-y-1 text-xs">
                          <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Organization</span>
                          <input
                            className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-2.5 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80"
                            value={csrForm.organization}
                            onChange={e => setCsrForm(prev => ({ ...prev, organization: e.target.value }))}
                            placeholder="Acme Inc"
                          />
                        </label>
                        <label className="block space-y-1 text-xs">
                          <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Organizational Unit</span>
                          <input
                            className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-2.5 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80"
                            value={csrForm.organizational_unit}
                            onChange={e => setCsrForm(prev => ({ ...prev, organizational_unit: e.target.value }))}
                            placeholder="IT Department"
                          />
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <label className="block space-y-1 text-xs">
                            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Country</span>
                            <input
                              className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-2 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80"
                              value={csrForm.country}
                              onChange={e => setCsrForm(prev => ({ ...prev, country: e.target.value }))}
                              placeholder="US"
                              maxLength={2}
                            />
                          </label>
                          <label className="block space-y-1 text-xs">
                            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">State</span>
                            <input
                              className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-2 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80"
                              value={csrForm.state}
                              onChange={e => setCsrForm(prev => ({ ...prev, state: e.target.value }))}
                              placeholder="CA"
                            />
                          </label>
                          <label className="block space-y-1 text-xs">
                            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Locality</span>
                            <input
                              className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-2 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80"
                              value={csrForm.locality}
                              onChange={e => setCsrForm(prev => ({ ...prev, locality: e.target.value }))}
                              placeholder="San Francisco"
                            />
                          </label>
                        </div>
                        <label className="block space-y-1 text-xs sm:col-span-2">
                          <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Subject Alternative Names (comma-separated)</span>
                          <input
                            className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-2.5 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80"
                            value={csrForm.san}
                            onChange={e => setCsrForm(prev => ({ ...prev, san: e.target.value }))}
                            placeholder="www.example.com, api.example.com, 192.168.1.1"
                          />
                        </label>
                        <div className="sm:col-span-2 flex flex-wrap items-center gap-3 mt-1">
                          <button
                            type="submit"
                            disabled={csrCreating || !csrForm.common_name}
                            className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-rpurple-500 to-rpurple-600 hover:from-rpurple-400 hover:to-rpurple-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium px-4 py-1.5 shadow-glossy"
                          >
                            {csrCreating ? 'Generating ...' : 'Generate CSR'}
                          </button>
                          {csrError && <span className="text-[11px] text-rose-300">{csrError}</span>}
                        </div>
                      </form>

                      {/* CSR List */}
                      <div className="mt-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xs uppercase tracking-[0.16em] text-slate-400">Generated CSRs</h3>
                          {csrLoading && <span className="text-[10px] text-slate-500">Loading...</span>}
                        </div>
                        {csrList.length === 0 ? (
                          <div className="text-xs text-slate-500 py-4 text-center border border-dashed border-white/10 rounded-xl">
                            No CSRs yet. Generate one above.
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {csrList.map(csr => (
                              <div
                                key={csr.id}
                                className="flex items-center justify-between gap-2 p-3 rounded-xl border border-white/10 bg-slate-900/50"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">{CSR_PRESETS[csr.preset]?.icon || '📄'}</span>
                                    <span className="font-medium text-xs truncate">{csr.common_name}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                      csr.status === 'signed'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                        : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                                    }`}>
                                      {csr.status}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">
                                    {CSR_PRESETS[csr.preset]?.label} · {new Date(csr.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {csr.status === 'pending' && caSettings.initialized && (
                                    <button
                                      onClick={() => handleSignCsr(csr.id)}
                                      className="text-[10px] px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 hover:bg-emerald-500/30"
                                      title="Sign with CA"
                                    >
                                      Sign
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDownloadCsr(csr.id, csr.common_name)}
                                    className="text-[10px] px-2 py-1 rounded-lg bg-slate-800/70 text-slate-300 border border-white/10 hover:bg-slate-800"
                                    title="Download CSR"
                                  >
                                    CSR
                                  </button>
                                  <button
                                    onClick={() => handleDownloadCsrKey(csr.id, csr.common_name)}
                                    className="text-[10px] px-2 py-1 rounded-lg bg-slate-800/70 text-slate-300 border border-white/10 hover:bg-slate-800"
                                    title="Download Key"
                                  >
                                    Key
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCsr(csr.id)}
                                    className="text-[10px] px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-400/40 hover:bg-rose-500/30"
                                    title="Delete"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {active === 'certificates' && (
                <>
                  {!user ? (
                    <div className="h-40 sm:h-56 rounded-2xl border border-rpurple-500/40 bg-gradient-to-br from-slate-950/60 via-slate-950/40 to-rpurple-900/40 flex flex-col items-center justify-center text-xs sm:text-sm text-slate-400 gap-2">
                      <div className="inline-flex items-center gap-1 rounded-full bg-slate-800/70 text-slate-200 px-3 py-1 border border-slate-500/60 text-[11px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Certificate management locked
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-400 max-w-md text-center">
                        Sign in as <span className="font-mono text-rpurple-200">ca_admin</span> to manage certificates.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Actions bar */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setShowImportModal(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-slate-900/60 text-xs text-slate-200 hover:bg-slate-900/80"
                        >
                          <span>📥</span> Import Certificate
                        </button>
                        {caSettings.initialized && (
                          <button
                            onClick={handleDownloadCaCert}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rpurple-400/40 bg-rpurple-500/10 text-xs text-rpurple-200 hover:bg-rpurple-500/20"
                          >
                            <span>🏛️</span> Download CA Cert
                          </button>
                        )}
                      </div>

                      {certError && (
                        <div className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-500/40 rounded-xl px-2.5 py-1.5">
                          {certError}
                        </div>
                      )}

                      {/* Certificate List */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xs uppercase tracking-[0.16em] text-slate-400">Certificates</h3>
                          {certLoading && <span className="text-[10px] text-slate-500">Loading...</span>}
                        </div>
                        {certList.length === 0 ? (
                          <div className="text-xs text-slate-500 py-8 text-center border border-dashed border-white/10 rounded-xl">
                            No certificates yet. Sign a CSR or import an existing certificate.
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-80 overflow-y-auto">
                            {certList.map(cert => (
                              <div
                                key={cert.id}
                                className="p-3 rounded-xl border border-white/10 bg-slate-900/50"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm">{cert.source === 'imported' ? '📥' : '✅'}</span>
                                      <span className="font-medium text-xs truncate">{cert.common_name}</span>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                        cert.source === 'signed'
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                          : 'bg-blue-500/20 text-blue-300 border border-blue-400/40'
                                      }`}>
                                        {cert.source}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1 space-y-0.5">
                                      <div>Serial: {cert.serial_number?.substring(0, 20)}...</div>
                                      <div>Valid: {cert.not_before} → {cert.not_after}</div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-1 mt-2 pt-2 border-t border-white/5">
                                  <button
                                    onClick={() => handleDownloadCert(cert.id, cert.common_name)}
                                    className="text-[10px] px-2 py-1 rounded-lg bg-slate-800/70 text-slate-300 border border-white/10 hover:bg-slate-800"
                                  >
                                    Cert
                                  </button>
                                  <button
                                    onClick={() => handleDownloadCertKey(cert.id, cert.common_name)}
                                    className="text-[10px] px-2 py-1 rounded-lg bg-slate-800/70 text-slate-300 border border-white/10 hover:bg-slate-800"
                                  >
                                    Key
                                  </button>
                                  <button
                                    onClick={() => handleDownloadFullchain(cert.id, cert.common_name)}
                                    className="text-[10px] px-2 py-1 rounded-lg bg-slate-800/70 text-slate-300 border border-white/10 hover:bg-slate-800"
                                  >
                                    Fullchain
                                  </button>
                                  <button
                                    onClick={() => openPkcs12Modal(cert.id, cert.common_name)}
                                    className="text-[10px] px-2 py-1 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-400/40 hover:bg-amber-500/30"
                                  >
                                    PKCS#12
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCert(cert.id)}
                                    className="text-[10px] px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-400/40 hover:bg-rose-500/30 ml-auto"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Sidebar */}
          <aside className="space-y-4 sm:space-y-5">
            {/* Session card */}
            <div className="glossy-card rounded-3xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-[0.2em] text-rpurple-300 font-medium">
                  Session
                </span>
                <span
                  className={
                    'h-2 w-2 rounded-full shadow-[0_0_12px_rgba(52,211,153,0.9)] transition-colors ' +
                    (user ? 'bg-emerald-400' : 'bg-slate-500')
                  }
                />
              </div>

              {authChecking ? (
                <p className="text-sm text-slate-400">Checking your session ...</p>
              ) : user ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-300">
                      Signed in as
                      <span className="ml-1 font-semibold text-rpurple-200">
                        {user.username}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={authBusy}
                      className="text-[11px] px-2 py-1 rounded-xl border border-rpurple-400/50 bg-slate-900/60 hover:bg-slate-900/90 text-rpurple-100 disabled:opacity-60"
                    >
                      {authBusy ? 'Signing out ...' : 'Sign out'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    Your authenticated session gates CA initialization, certificate issuance
                    and key export operations.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-3">
                  <div className="grid gap-2 text-xs">
                    <label className="space-y-1">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                        Username
                      </span>
                      <input
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-2.5 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80 focus:border-rpurple-400/80"
                        autoComplete="username"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                        Password
                      </span>
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-2.5 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80 focus:border-rpurple-400/80"
                        autoComplete="current-password"
                      />
                    </label>
                  </div>
                  {authError && (
                    <div className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-500/40 rounded-xl px-2.5 py-1.5">
                      {authError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={authBusy || !password}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-rpurple-500 to-rpurple-600 hover:from-rpurple-400 hover:to-rpurple-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium px-3 py-1.5 shadow-glossy"
                  >
                    {authBusy ? 'Signing in ...' : 'Sign in as ca_admin'}
                  </button>
                  <p className="text-[11px] text-slate-500">
                    Use the password configured as{' '}
                    <span className="font-mono text-rpurple-200">CA_ADMIN_PASSWORD</span> in
                    your <span className="font-mono">.env</span>.
                  </p>
                </form>
              )}
            </div>

            {/* CA Lens card */}
            <div className="glossy-card rounded-3xl p-4 sm:p-5 flex flex-col gap-3 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-rpurple-500/10 via-transparent to-rpurple-600/5 pointer-events-none" />
              <div className="relative flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-[0.25em] text-rpurple-200 font-medium">
                  CA Lens
                </div>
                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-rpurple-100">
                  <span className="h-1.5 w-6 rounded-full bg-gradient-to-r from-rpurple-400 to-rpurple-600 shadow-[0_0_8px_rgba(130,36,255,0.5)]" />
                  live
                </div>
              </div>
              <p className="relative text-xs sm:text-sm text-slate-300">
                High-level view of your CA: identity, key material posture, and certificate
                lifecycle health.
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-4 sm:mt-6 border-t border-rpurple-500/20 bg-slate-950/80 backdrop-blur-xl relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-3 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span>Digitally crafted with</span>
            <span className="relative inline-flex items-center justify-center h-3.5 w-3.5">
              <span className="absolute inset-0 rounded-full bg-rpurple-500/40 blur-[3px]" />
              <svg viewBox="0 0 24 24" className="relative h-3.5 w-3.5 text-rpurple-200">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  d="M12.1 5.08c-.78-1.02-2.05-1.83-3.7-1.83C5.38 3.25 3.5 5.42 3.5 8c0 4.28 4.6 7.36 7.94 9.94.34.27.72.56 1.06.86.34-.3.72-.59 1.06-.86C15.9 15.36 20.5 12.28 20.5 8c0-2.58-1.88-4.75-4.9-4.75-1.65 0-2.92.81-3.7 1.83z"
                />
              </svg>
            </span>
            <span>by RoarinPenguin</span>
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500">
            CA Settings · CSR Generation · Certificate Management
          </div>
        </div>
      </footer>

      {/* Import Certificate Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-950 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-100">Import Certificate</h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-200 text-lg"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleImportCert} className="space-y-3">
              <label className="block space-y-1 text-xs">
                <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Certificate PEM *</span>
                <textarea
                  className="w-full h-24 rounded-xl bg-slate-900/70 border border-white/10 px-2.5 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80 font-mono"
                  value={importForm.cert_pem}
                  onChange={e => setImportForm(prev => ({ ...prev, cert_pem: e.target.value }))}
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  required
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Private Key PEM (optional)</span>
                <textarea
                  className="w-full h-20 rounded-xl bg-slate-900/70 border border-white/10 px-2.5 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80 font-mono"
                  value={importForm.key_pem}
                  onChange={e => setImportForm(prev => ({ ...prev, key_pem: e.target.value }))}
                  placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Chain PEM (optional)</span>
                <textarea
                  className="w-full h-20 rounded-xl bg-slate-900/70 border border-white/10 px-2.5 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80 font-mono"
                  value={importForm.chain_pem}
                  onChange={e => setImportForm(prev => ({ ...prev, chain_pem: e.target.value }))}
                  placeholder="Intermediate/CA certificates"
                />
              </label>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={certImporting || !importForm.cert_pem}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-rpurple-500 to-rpurple-600 hover:from-rpurple-400 hover:to-rpurple-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium px-4 py-1.5 shadow-glossy"
                >
                  {certImporting ? 'Importing ...' : 'Import'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="text-xs px-3 py-1.5 rounded-xl border border-white/10 text-slate-300 hover:bg-slate-900/50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PKCS#12 Export Modal */}
      {showPkcs12Modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-950 border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-100">Export PKCS#12</h2>
              <button
                onClick={() => setShowPkcs12Modal(false)}
                className="text-slate-400 hover:text-slate-200 text-lg"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Export <span className="text-rpurple-200 font-medium">{pkcs12CertName}</span> as a password-protected PKCS#12 bundle.
            </p>
            <form onSubmit={handleExportPkcs12} className="space-y-3">
              <label className="block space-y-1 text-xs">
                <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Password *</span>
                <input
                  type="password"
                  className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-2.5 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rpurple-400/80"
                  value={pkcs12Password}
                  onChange={e => setPkcs12Password(e.target.value)}
                  placeholder="Enter export password"
                  required
                />
              </label>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={pkcs12Exporting || !pkcs12Password}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium px-4 py-1.5 shadow-glossy text-slate-900"
                >
                  {pkcs12Exporting ? 'Exporting ...' : 'Export .p12'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPkcs12Modal(false)}
                  className="text-xs px-3 py-1.5 rounded-xl border border-white/10 text-slate-300 hover:bg-slate-900/50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
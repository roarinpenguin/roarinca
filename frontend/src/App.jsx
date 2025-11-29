import React, { useState, useEffect } from 'react';
import { login, logout, fetchMe } from './api.js';
import { getCaSettings, saveCaSettings, initCa } from './caApi.js';

const sections = ['settings', 'requests', 'certificates'];

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

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-rpurple-950 text-slate-50">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-white/5 bg-slate-950/60 backdrop-blur-xl shadow-glossy sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-2xl bg-gradient-to-br from-rpurple-400 via-rpurple-500 to-rpurple-700 shadow-lg shadow-rpurple-900/70" />
          <div className="leading-tight">
            <div className="text-xs uppercase tracking-[0.25em] text-rpurple-300/80">
              Roarin CA
            </div>
            <div className="text-sm sm:text-base font-semibold text-slate-50/95">
              Digital Certificate Studio
            </div>
          </div>
        </div>

        {/* Top-right clean tab nav */}
        <nav className="hidden sm:flex items-center gap-2 bg-slate-950/80 border border-white/5 rounded-2xl px-2 py-1 shadow-glossy">
          {sections.map(s => (
            <button
              key={s}
              onClick={() => setActive(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-xl capitalize transition-colors ${
                active === s
                  ? 'bg-rpurple-500/80 text-white shadow-glossy'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              {s}
            </button>
          ))}
        </nav>
      </header>

      {/* Main */}
      <main className="flex-1 px-3 sm:px-6 lg:px-10 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] items-start">
          {/* Primary panel */}
          <section className="bg-slate-950/70 border border-white/5 rounded-3xl shadow-glossy p-4 sm:p-6 lg:p-7">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div>
                <h1 className="text-lg sm:text-xl font-semibold tracking-tight flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-2xl bg-gradient-to-br from-rpurple-400 to-rpurple-600 text-xs shadow-md shadow-rpurple-900/70">
                    {active === 'settings' ? 'CA' : active === 'requests' ? 'CSR' : 'CRT'}
                  </span>
                  <span className="capitalize">{active}</span>
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

              {active !== 'settings' && (
                <div className="h-40 sm:h-56 rounded-2xl border border-dashed border-rpurple-500/40 bg-gradient-to-br from-slate-950/60 via-slate-950/40 to-rpurple-900/40 flex items-center justify-center text-xs sm:text-sm text-slate-500">
                  Section{' '}
                  <span className="mx-1 font-semibold capitalize text-rpurple-200">
                    {active}
                  </span>{' '}
                  UI coming next.
                </div>
              )}
            </div>
          </section>

          {/* Sidebar */}
          <aside className="space-y-4 sm:space-y-5">
            {/* Session card */}
            <div className="bg-slate-950/70 border border-white/5 rounded-3xl shadow-glossy p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-[0.2em] text-rpurple-300/90">
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
            <div className="bg-gradient-to-br from-slate-950 via-slate-950 to-rpurple-950 border border-rpurple-500/40 rounded-3xl shadow-glossy p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-[0.25em] text-rpurple-200/90">
                  CA Lens
                </div>
                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-rpurple-100/90">
                  <span className="h-1.5 w-6 rounded-full bg-gradient-to-r from-rpurple-300 to-rpurple-500" />
                  live
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-300">
                High-level view of your CA: identity, key material posture, and certificate
                lifecycle health.
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-4 sm:mt-6 border-t border-white/5 bg-slate-950/80 backdrop-blur-xl">
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
            Settings wired to backend – Requests/Certificates to follow.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
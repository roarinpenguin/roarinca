import React, { useState } from 'react';

const sections = ['settings', 'requests', 'certificates'];

function App() {
  const [active, setActive] = useState('settings');

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-rpurple-950 text-slate-50">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-white/5 bg-slate-950/60 backdrop-blur-xl shadow-glossy sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-2xl bg-gradient-to-br from-rpurple-400 via-rpurple-500 to-rpurple-700 shadow-lg shadow-rpurple-900/70" />
          <div className="leading-tight">
            <div className="text-xs uppercase tracking-[0.25em] text-rpurple-300/80">Roarin CA</div>
            <div className="text-sm sm:text-base font-semibold text-slate-50/95">Digital Certificate Studio</div>
          </div>
        </div>
        <button
          className="relative inline-flex flex-col items-center justify-center gap-[5px] h-10 w-10 rounded-2xl border border-rpurple-400/40 bg-slate-900/70 hover:bg-slate-900/90 shadow-glossy transition-all duration-200 group"
          aria-label="Main areas"
        >
          <span className="h-[2px] w-4 rounded-full bg-gradient-to-r from-rpurple-200 via-rpurple-100 to-rpurple-300 group-hover:scale-x-110 origin-center transition-transform" />
          <span className="h-[2px] w-4 rounded-full bg-gradient-to-r from-rpurple-200/80 via-rpurple-100/80 to-rpurple-300/80 group-hover:scale-x-125 origin-center transition-transform" />
          <span className="h-[2px] w-4 rounded-full bg-gradient-to-r from-rpurple-200 via-rpurple-100 to-rpurple-300 group-hover:scale-x-110 origin-center transition-transform" />
          <div className="absolute right-12 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-2 bg-slate-900/95 border border-white/5 rounded-2xl px-3 py-2 shadow-xl shadow-black/70">
            {sections.map((s) => (
              <button
                key={s}
                onClick={() => setActive(s)}
                className={`text-xs font-medium px-2 py-1 rounded-xl capitalize transition-colors ${
                  active === s
                    ? 'bg-rpurple-500/80 text-white shadow-glossy'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </button>
      </header>

      <main className="flex-1 px-3 sm:px-6 lg:px-10 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] items-start">
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
                  {active === 'settings' && 'Define how your Certificate Authority presents and protects itself.'}
                  {active === 'requests' && 'Craft precise CSRs ready to be sent to external authorities.'}
                  {active === 'certificates' && 'Import, issue, sign and export digital certificates with confidence.'}
                </p>
              </div>
            </div>
            <div className="mt-4 sm:mt-6 text-sm text-slate-300">
              {/* TODO: mount Settings / Requests / Certificates views here */}
              <div className="h-40 sm:h-56 rounded-2xl border border-dashed border-rpurple-500/40 bg-gradient-to-br from-slate-950/60 via-slate-950/40 to-rpurple-900/40 flex items-center justify-center text-xs sm:text-sm text-slate-500">
                Section <span className="mx-1 font-semibold capitalize text-rpurple-200">{active}</span> UI coming next.
              </div>
            </div>
          </section>

          <aside className="space-y-4 sm:space-y-5">
            <div className="bg-slate-950/70 border border-white/5 rounded-3xl shadow-glossy p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-[0.2em] text-rpurple-300/90">Session</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
              </div>
              <p className="text-sm text-slate-300">
                Minimal authentication and CA key protection will appear here, including quick session and CA status.
              </p>
            </div>
            <div className="bg-gradient-to-br from-slate-950 via-slate-950 to-rpurple-950 border border-rpurple-500/40 rounded-3xl shadow-glossy p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-[0.25em] text-rpurple-200/90">CA Lens</div>
                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-rpurple-100/90">
                  <span className="h-1.5 w-6 rounded-full bg-gradient-to-r from-rpurple-300 to-rpurple-500" />
                  live
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-300">
                High-level view of your CA: identity, key material posture, and certificate lifecycle health.
              </p>
            </div>
          </aside>
        </div>
      </main>

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
            UI prototype – certificate engine and OpenSSL integration to follow.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

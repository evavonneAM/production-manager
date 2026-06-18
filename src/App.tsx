import { isSupabaseConfigured } from './lib/supabase'

function App() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 bg-slate-900 px-6 py-12 text-slate-100">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-700 text-2xl font-bold tracking-tight shadow-lg">
        PM
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Production Manager</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-400">
          Phone-first production tracking for furniture work orders. Sprint 0 —
          the foundation is up and running.
        </p>
      </div>

      <div className="w-full max-w-xs rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Supabase</span>
          {isSupabaseConfigured ? (
            <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400">
              Connected
            </span>
          ) : (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
              Not configured
            </span>
          )}
        </div>
        {!isSupabaseConfigured && (
          <p className="mt-2 text-xs text-slate-500">
            Add your keys to <code className="text-slate-400">.env</code> to connect.
          </p>
        )}
      </div>
    </main>
  )
}

export default App

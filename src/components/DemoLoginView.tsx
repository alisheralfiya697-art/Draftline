import { AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import type { SeededUser } from '../types/document';

interface DemoLoginViewProps {
  accounts: SeededUser[];
  loading: boolean;
  signingInId: string | null;
  error: string | null;
  onSignIn: (userId: string) => void;
}

export function DemoLoginView({
  accounts,
  loading,
  signingInId,
  error,
  onSignIn,
}: DemoLoginViewProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            Draftline
          </span>
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap shrink-0">
            Simulated Demo Auth
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Sign in to Draftline
            </h1>
            <p className="text-sm leading-relaxed text-slate-600">
              Select a seeded workspace account below. Selecting an account issues a server-signed session token so you can create, edit, import, and share documents across users.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {[1, 2, 3, 4].map((row) => (
                <div
                  key={row}
                  className="p-4 flex items-center justify-between gap-4 animate-pulse"
                >
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                  <div className="h-9 bg-slate-100 rounded w-24" />
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
              {accounts.map((account) => {
                const isBusy = signingInId === account.id;
                return (
                  <div
                    key={account.id}
                    className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-lg bg-slate-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                        {account.initials}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {account.name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {account.email} · {account.role}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={signingInId !== null}
                      onClick={() => onSignIn(account.id)}
                      className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                    >
                      <span>{isBusy ? 'Signing in...' : 'Sign in'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-500 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <span>
              Sessions use HMAC-signed Bearer tokens kept in memory rather than browser storage. Documents, edits, and sharing permissions persist in SQLite across server restarts and refreshes.
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

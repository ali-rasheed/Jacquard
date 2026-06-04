/**
 * Full-screen password gate when `VITE_ACCESS_PASSWORD` is set.
 * Unlock state persists in localStorage (digest only, not the password).
 */
import { useState } from 'react';
import { motion } from 'motion/react';
import { useAccessGate } from '../auth/useAccessGate.js';

export default function AccessGate({ children }) {
  const { enabled, status, error, unlock } = useAccessGate();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!enabled || status === 'unlocked') {
    return children;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting || !password.trim()) return;
    setSubmitting(true);
    try {
      await unlock(password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-surface px-6">
      <motion.div
        className="w-full max-w-sm rounded-md border border-border bg-surface-elevated p-6 shadow-lg"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="text-base font-medium text-text tracking-tight">
          ENS Warp&amp;Weft
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Enter the access password to continue.
        </p>
        <form className="mt-5 flex flex-col gap-3" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-text-muted uppercase tracking-wide">
              Password
            </span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              autoFocus={status === 'locked'}
              disabled={status === 'checking' || submitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-sm border border-border bg-surface-input px-3 py-2 text-base text-text outline-none focus:border-accent disabled:opacity-60"
              placeholder={status === 'checking' ? 'Checking…' : 'Password'}
            />
          </label>
          {error ? (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={status === 'checking' || submitting || !password.trim()}
            className="mt-1 w-full rounded-sm bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:pointer-events-none"
          >
            {status === 'checking' ? 'Checking…' : submitting ? 'Unlocking…' : 'Continue'}
          </button>
        </form>
        <p className="mt-4 text-xs text-text-muted leading-relaxed">
          This device remembers unlock in local storage. Clear site data or use a private window to sign out.
        </p>
      </motion.div>
    </div>
  );
}

/**
 * React hook for the optional access gate — checks localStorage digest on mount.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  isAccessGateEnabled,
  isAccessUnlocked,
  lockAccess,
  unlockAccess,
} from './accessGate.js';

/**
 * @returns {{
 *   enabled: boolean,
 *   status: 'checking' | 'locked' | 'unlocked',
 *   error: string | null,
 *   unlock: (password: string) => Promise<boolean>,
 *   lock: () => void,
 * }}
 */
export function useAccessGate() {
  const enabled = isAccessGateEnabled();
  const [status, setStatus] = useState(enabled ? 'checking' : 'unlocked');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setStatus('unlocked');
      return undefined;
    }
    let cancelled = false;
    isAccessUnlocked()
      .then((ok) => {
        if (!cancelled) setStatus(ok ? 'unlocked' : 'locked');
      })
      .catch(() => {
        if (!cancelled) setStatus('locked');
      });
    return () => { cancelled = true; };
  }, [enabled]);

  const unlock = useCallback(async (password) => {
    setError(null);
    const ok = await unlockAccess(password);
    if (ok) {
      setStatus('unlocked');
      return true;
    }
    setError('Incorrect password');
    return false;
  }, []);

  const lock = useCallback(() => {
    lockAccess();
    setStatus('locked');
    setError(null);
  }, []);

  return { enabled, status, error, unlock, lock };
}

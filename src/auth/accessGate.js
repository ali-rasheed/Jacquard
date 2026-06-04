/**
 * Client-side access gate — no server or database.
 * When `VITE_ACCESS_PASSWORD` is set at build time, the app shows a password screen
 * until the user enters it once; unlock persists via a SHA-256 digest in localStorage.
 * Omit the env var (or leave it empty) to disable the gate (local dev).
 */

export const ACCESS_STORAGE_KEY = 'shaderbox-access-v1';

/** @returns {string | null} Build-time password, or null when gate is off. */
export function getAccessPasswordFromEnv() {
  const raw = import.meta.env.VITE_ACCESS_PASSWORD;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Gate is active only when a non-empty password was baked into the build. */
export function isAccessGateEnabled() {
  return getAccessPasswordFromEnv() != null;
}

/** @param {string} text */
export async function hashAccessSecret(text) {
  const bytes = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * @param {Pick<Storage, 'getItem'>} [storage]
 * @returns {Promise<boolean>}
 */
export async function isAccessUnlocked(storage = localStorage) {
  if (!isAccessGateEnabled()) return true;
  const stored = storage.getItem(ACCESS_STORAGE_KEY);
  if (!stored) return false;
  const expected = await hashAccessSecret(getAccessPasswordFromEnv());
  return stored === expected;
}

/**
 * @param {string} password
 * @param {Storage} [storage]
 * @returns {Promise<boolean>} true when password matched and digest was saved
 */
export async function unlockAccess(password, storage = localStorage) {
  const expected = getAccessPasswordFromEnv();
  if (!expected) return true;
  if (password !== expected) return false;
  const digest = await hashAccessSecret(password);
  storage.setItem(ACCESS_STORAGE_KEY, digest);
  return true;
}

/** @param {Storage} [storage] */
export function lockAccess(storage = localStorage) {
  storage.removeItem(ACCESS_STORAGE_KEY);
}

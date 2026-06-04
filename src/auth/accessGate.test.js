/**
 * Unit tests for access gate helpers (no React).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ACCESS_STORAGE_KEY,
  hashAccessSecret,
  isAccessUnlocked,
  unlockAccess,
  lockAccess,
} from './accessGate.js';

describe('accessGate', () => {
  const storage = {
    data: /** @type {Record<string, string>} */ ({}),
    getItem(key) {
      return this.data[key] ?? null;
    },
    setItem(key, value) {
      this.data[key] = value;
    },
    removeItem(key) {
      delete this.data[key];
    },
  };

  beforeEach(() => {
    storage.data = {};
    vi.stubEnv('VITE_ACCESS_PASSWORD', 'test-secret');
  });

  it('hashAccessSecret is stable hex', async () => {
    const a = await hashAccessSecret('x');
    const b = await hashAccessSecret('x');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('isAccessUnlocked is false before unlock', async () => {
    expect(await isAccessUnlocked(storage)).toBe(false);
  });

  it('unlockAccess stores digest and unlocks', async () => {
    expect(await unlockAccess('test-secret', storage)).toBe(true);
    expect(storage.data[ACCESS_STORAGE_KEY]).toBeTruthy();
    expect(await isAccessUnlocked(storage)).toBe(true);
  });

  it('unlockAccess rejects wrong password', async () => {
    expect(await unlockAccess('wrong', storage)).toBe(false);
    expect(await isAccessUnlocked(storage)).toBe(false);
  });

  it('lockAccess clears storage', async () => {
    await unlockAccess('test-secret', storage);
    lockAccess(storage);
    expect(await isAccessUnlocked(storage)).toBe(false);
  });
});

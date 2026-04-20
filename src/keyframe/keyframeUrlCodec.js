/**
 * Serialize keyframe snapshots (plain objects) for URL query params as base64url(JSON).
 * Used for Animate A/B state: `kfa` / `kfb`. Falls back to omitting blobs when over URL length budget.
 */

/** @param {unknown} obj @returns {string} Encoded token, or '' if not serializable / empty. */
export function encodeKeyframeSnapshot(obj) {
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) return '';
  try {
    const json = JSON.stringify(obj);
    if (!json || json === '{}') return '';
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return b64;
  } catch {
    return '';
  }
}

/** @param {string | null | undefined} encoded @returns {Record<string, unknown> | null} */
export function decodeKeyframeSnapshot(encoded) {
  if (encoded == null || typeof encoded !== 'string' || encoded.length === 0) return null;
  try {
    let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = decodeURIComponent(escape(atob(b64)));
    const o = JSON.parse(json);
    return typeof o === 'object' && o != null && !Array.isArray(o) ? o : null;
  } catch {
    return null;
  }
}

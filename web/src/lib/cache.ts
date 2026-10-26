// Saved copies of page data for this browser tab, so a refresh shows the
// last view at once while fresh data loads quietly. Cleared on sign-out.
const PREFIX = 'tx-cache:';

export function readCache<T>(key: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch { return undefined; }
}

export function writeCache(key: string, value: unknown) {
  try { sessionStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* full or private mode: skip */ }
}

export function clearCache() {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith(PREFIX)) sessionStorage.removeItem(k);
  } catch { /* ignore */ }
}

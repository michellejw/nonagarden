const KEY = "nonagarden.cleared.v1";

export interface ClearedStore {
  version: 1;
  ids: string[];
}

export function defaultCleared(): ClearedStore {
  return { version: 1, ids: [] };
}

function isClearedStore(v: unknown): v is ClearedStore {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    s.version === 1 &&
    Array.isArray(s.ids) &&
    s.ids.every((x) => typeof x === "string")
  );
}

export function loadCleared(): ClearedStore {
  if (typeof window === "undefined") return defaultCleared();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultCleared();
    const parsed: unknown = JSON.parse(raw);
    return isClearedStore(parsed) ? parsed : defaultCleared();
  } catch {
    return defaultCleared();
  }
}

function save(store: ClearedStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // quota / privacy-mode — fail silently.
  }
}

export function recordCleared(id: string): ClearedStore {
  const cur = loadCleared();
  if (cur.ids.includes(id)) return cur;
  const next: ClearedStore = { version: 1, ids: [...cur.ids, id] };
  save(next);
  return next;
}

export function isCleared(store: ClearedStore, id: string): boolean {
  return store.ids.includes(id);
}

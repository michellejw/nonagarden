import type { Cell } from "@/lib/nonogram";

const KEY = "nonagarden.library.v1";

export interface LibraryBoard {
  cells: Cell[][];
  completed: boolean;
  elapsedMs: number;
}

export interface LibraryStore {
  version: 1;
  boards: Record<string, LibraryBoard>;
}

export function defaultLibraryStore(): LibraryStore {
  return { version: 1, boards: {} };
}

function isBoard(v: unknown): v is LibraryBoard {
  if (typeof v !== "object" || v === null) return false;
  const b = v as Record<string, unknown>;
  return (
    Array.isArray(b.cells) &&
    typeof b.completed === "boolean" &&
    typeof b.elapsedMs === "number"
  );
}

function isLibraryStore(v: unknown): v is LibraryStore {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  if (s.version !== 1 || typeof s.boards !== "object" || s.boards === null) return false;
  return Object.values(s.boards as Record<string, unknown>).every(isBoard);
}

export function loadLibraryStore(): LibraryStore {
  if (typeof window === "undefined") return defaultLibraryStore();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultLibraryStore();
    const parsed: unknown = JSON.parse(raw);
    return isLibraryStore(parsed) ? parsed : defaultLibraryStore();
  } catch {
    return defaultLibraryStore();
  }
}

function save(store: LibraryStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // quota / privacy-mode — fail silently.
  }
}

export function saveBoard(id: string, board: LibraryBoard): LibraryStore {
  const cur = loadLibraryStore();
  const next: LibraryStore = { version: 1, boards: { ...cur.boards, [id]: board } };
  save(next);
  return next;
}

export function dropBoard(id: string): LibraryStore {
  const cur = loadLibraryStore();
  if (!(id in cur.boards)) return cur;
  const boards = { ...cur.boards };
  delete boards[id];
  const next: LibraryStore = { version: 1, boards };
  save(next);
  return next;
}

export function boardFor(store: LibraryStore, id: string): LibraryBoard | undefined {
  return store.boards[id];
}

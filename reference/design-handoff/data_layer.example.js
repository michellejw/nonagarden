// ============================================================
// Puzzle data layer — the seam between the UI and storage.
//
// The prototypes (Nonogram Game/Editor .dc.html) talk to storage through three
// async functions: listPuzzles(), savePuzzle(entry), deletePuzzle(id).
// Today they read/write localStorage directly. Swap in the `remote` object
// below to move to Supabase with no UI changes — the shapes are identical.
//
// Puzzle entry shape (what both stores accept/return):
//   { id, title, size, rows: string[], difficulty, unique_solution?, created_at? }
// ============================================================

// ---------- Prototype: browser-local (matches the current .dc.html files) ----------
const KEY = 'nonogram_library';

export const local = {
  async listPuzzles() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  },
  async savePuzzle(p) {
    const all = (await this.listPuzzles()).filter((x) => x.id !== p.id);
    all.unshift(p);
    localStorage.setItem(KEY, JSON.stringify(all));
    return p;
  },
  async deletePuzzle(id) {
    const all = (await this.listPuzzles()).filter((x) => x.id !== id);
    localStorage.setItem(KEY, JSON.stringify(all));
  },
};

// ---------- Production: Supabase ----------
// npm i @supabase/supabase-js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const remote = {
  async listPuzzles() {
    const { data, error } = await supabase
      .from('puzzles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async savePuzzle(p) {
    // upsert by id; author_id is filled by RLS-aware client (set it from the session)
    const { data, error } = await supabase
      .from('puzzles')
      .upsert(p)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async deletePuzzle(id) {
    const { error } = await supabase.from('puzzles').delete().eq('id', id);
    if (error) throw error;
  },
};

// Pick one. Optionally key off an env flag so the prototype still runs offline.
export const store = process.env.NEXT_PUBLIC_SUPABASE_URL ? remote : local;

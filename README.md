# Nonagarden

A cozy nonogram (picture-cross / Picross) web game — the first **web** game in the
[Shroom Games](https://shroomgames.app) suite. Solve hidden pictures on a warm,
rounded board; the puzzle's name is a small surprise revealed only when you finish.

Part of the Shroom Games suite (alongside the iOS games Rootline and Shroomsweeper).
Built on the shared [`@shroomgames/tokens`](../shroomkit) design system.

## Status

**Slice 1 — Core Play: shipped.** A playable, accessible single-board nonogram
seeded from built-in puzzles. No backend yet. Built in vertical slices; later
slices add a Supabase puzzle library, a deterministic daily puzzle, a browsable
library, a local progress archive, and an authoring Studio.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4**, themed by `@shroomgames/tokens` (forest / twilight via `data-theme`)
- **Vitest** + Testing Library

## Develop

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Other scripts:

```bash
pnpm test       # watch tests        ·  pnpm test:run for a single run
pnpm typecheck  # tsc --noEmit
pnpm lint       # eslint
pnpm build      # production build
```

The design tokens come from `@shroomgames/tokens`, consumed as a local
`file:../shroomkit/tokens/dist` dependency — the sibling `shroomkit` repo must be
checked out alongside this one.

## How it plays

- Drag to paint a line; right-click (or two-finger tap) marks a cell with ×.
- The **Fill / Mark** toggle switches what a primary press does.
- Clues dim when a line is satisfied and tint terracotta where a line can't be
  satisfied as filled.
- Fully keyboard-playable (arrow keys to move, Space to fill, `x` to mark) and
  screen-reader friendly.

A puzzle is **won when every row and column clue is satisfied** — the game never
checks your board against the stored picture, so any valid solution wins (and the
built-in puzzles are verified to be solvable by logic alone, with a single solution).

## License

MIT © 2026 Michelle Weirathmueller

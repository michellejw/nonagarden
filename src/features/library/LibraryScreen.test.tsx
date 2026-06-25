// src/features/library/LibraryScreen.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LibraryScreen } from "./LibraryScreen";
import { recordCleared } from "@/lib/library/cleared";
import type { LibraryPuzzleRow } from "@/lib/content/content";

const row = (slug: string, size: number, id = slug): LibraryPuzzleRow => ({
  id,
  slug,
  name: slug,
  size,
  rows: Array(size).fill("#".repeat(size)),
  difficulty: "forager",
});

beforeEach(() => {
  window.localStorage.clear();
});

describe("LibraryScreen", () => {
  it("renders a tile per included puzzle with a cleared counter", async () => {
    render(<LibraryScreen puzzles={[row("a", 5), row("b", 10)]} schedule={[]} />);
    // after client mount, tiles appear
    expect(await screen.findByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
    expect(screen.getByText(/0\s*\/\s*2 cleared/i)).toBeInTheDocument();
  });

  it("reflects cleared count from the ledger", async () => {
    recordCleared("a");
    render(<LibraryScreen puzzles={[row("a", 5), row("b", 10)]} schedule={[]} />);
    expect(await screen.findByText(/1\s*\/\s*2 cleared/i)).toBeInTheDocument();
  });

  it("shows an empty state when nothing is browsable", async () => {
    render(<LibraryScreen puzzles={[]} schedule={[]} />);
    expect(await screen.findByText(/still growing/i)).toBeInTheDocument();
  });
});

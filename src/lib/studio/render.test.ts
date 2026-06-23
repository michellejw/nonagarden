import { describe, expect, it } from "vitest";
import { renderGridHtml } from "./render";
import type { Puzzle } from "../nonogram";

const P: Puzzle = { id: "p", name: "P", size: 2, rows: ["#.", ".#"] };

const count = (s: string, sub: string) => s.split(sub).length - 1;

describe("renderGridHtml", () => {
  it("emits a grid sized to the puzzle", () => {
    expect(renderGridHtml(P)).toContain("repeat(2,1fr)");
  });

  it("emits one cell per square with filled/empty matching '#'", () => {
    const html = renderGridHtml(P);
    expect(count(html, "sg-cell")).toBe(4);
    expect(count(html, "sg-cell filled")).toBe(2);
    expect(count(html, "sg-cell empty")).toBe(2);
  });
});

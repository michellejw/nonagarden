import { describe, expect, it } from "vitest";
import { buildGalleryHtml, gradeCandidates } from "./gallery";
import type { Puzzle } from "../nonogram";

const FULL: Puzzle = { id: "full", name: "Full", size: 2, rows: ["##", "##"] };
const AMB: Puzzle = { id: "amb", name: "Amb", size: 2, rows: ["#.", ".#"] };

describe("gradeCandidates", () => {
  it("marks valid and invalid candidates with difficulty/reason", () => {
    const items = gradeCandidates([FULL, AMB]);
    expect(items[0]).toMatchObject({ valid: true, difficulty: "forager" });
    expect(items[1].valid).toBe(false);
    expect(items[1].reason).toBeTruthy();
  });
});

describe("buildGalleryHtml", () => {
  it("renders a full document with names, difficulty, validity count, and rejection reasons", () => {
    const html = buildGalleryHtml(gradeCandidates([FULL, AMB]));
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Full");
    expect(html).toContain("forager");
    expect(html).toContain("1/2 valid");
    expect(html).toContain("invalid");
    expect(html).toMatch(/line-solvable|solution/); // the rejection reason for AMB
  });

  it("escapes HTML-special characters in candidate name", () => {
    const tricky: Puzzle = { id: "x", name: "A & B <tag>", size: 2, rows: ["##", "##"] };
    const html = buildGalleryHtml(gradeCandidates([tricky]));
    expect(html).toContain("A &amp; B &lt;tag&gt;");
    expect(html).not.toContain("A & B <tag>");
  });
});

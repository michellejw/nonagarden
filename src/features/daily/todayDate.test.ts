import { describe, it, expect } from "vitest";
import { todayLocal } from "./todayDate";

describe("todayLocal", () => {
  it("formats a date as local YYYY-MM-DD with zero-padding", () => {
    expect(todayLocal(new Date(2026, 0, 5))).toBe("2026-01-05"); // Jan 5 2026, local
  });
  it("uses local calendar parts (not UTC)", () => {
    const d = new Date(2026, 5, 22, 23, 30); // local 11:30pm Jun 22
    expect(todayLocal(d)).toBe("2026-06-22");
  });
});

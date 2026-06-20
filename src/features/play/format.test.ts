import { describe, it, expect } from "vitest";
import { formatTime } from "./format";

describe("formatTime", () => {
  it("formats m:ss", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65000)).toBe("1:05");
  });
  it("clamps negatives", () => {
    expect(formatTime(-5)).toBe("0:00");
  });
});

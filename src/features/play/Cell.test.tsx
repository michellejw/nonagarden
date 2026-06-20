import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CellButton, cellLabel } from "./Cell";

describe("cellLabel", () => {
  it("describes position and state (1-indexed)", () => {
    expect(cellLabel(0, 0, 0)).toBe("Row 1, column 1, empty");
    expect(cellLabel(1, 2, 1)).toBe("Row 2, column 3, filled");
    expect(cellLabel(2, 0, 2)).toBe("Row 3, column 1, marked");
  });
});

describe("CellButton", () => {
  const noop = () => {};
  it("renders a gridcell button with an aria-label and × when marked", () => {
    render(
      <CellButton
        r={0}
        c={0}
        value={2}
        px={34}
        tabbable
        onPointerDown={noop}
        onPointerEnter={noop}
        registerRef={noop}
      />,
    );
    const btn = screen.getByRole("gridcell");
    expect(btn).toHaveAttribute("aria-label", "Row 1, column 1, marked");
    expect(btn).toHaveTextContent("×");
    expect(btn).toHaveAttribute("tabindex", "0");
  });

  it("is not tabbable when tabbable=false", () => {
    render(
      <CellButton
        r={0}
        c={1}
        value={0}
        px={34}
        tabbable={false}
        onPointerDown={noop}
        onPointerEnter={noop}
        registerRef={noop}
      />,
    );
    expect(screen.getByRole("gridcell")).toHaveAttribute("tabindex", "-1");
  });
});

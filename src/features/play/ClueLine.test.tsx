import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClueLine } from "./ClueLine";

describe("ClueLine", () => {
  it("renders numbers with an SR label", () => {
    render(<ClueLine items={[3, 1]} state="normal" orientation="row" label="Row 1 clues: 3, 1" />);
    const group = screen.getByLabelText("Row 1 clues: 3, 1");
    expect(group).toHaveTextContent("3");
    expect(group).toHaveTextContent("1");
  });

  it("shows a non-color cue when impossible and exposes the tint styling hook", () => {
    render(<ClueLine items={[2]} state="impossible" orientation="row" label="Row 1 clues: 2" />);
    const line = screen.getByLabelText("Row 1 clues: 2");
    // data attribute drives the non-color affordance + the terracotta tint
    expect(line).toHaveAttribute("data-state", "impossible");
    // .clue-line is the CSS hook that .clue-line[data-state="impossible"] tints
    expect(line).toHaveClass("clue-line");
  });

  it("renders nothing visible for an empty [0] clue", () => {
    const { container } = render(
      <ClueLine items={[0]} state="normal" orientation="row" label="Row 1 clues: 0" />,
    );
    expect(container.querySelectorAll("span")).toHaveLength(0);
  });
});

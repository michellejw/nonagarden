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

  it("shows a non-color cue when impossible", () => {
    render(<ClueLine items={[2]} state="impossible" orientation="row" label="Row 1 clues: 2" />);
    // data attribute carries the state for the non-color affordance + styling
    expect(screen.getByLabelText("Row 1 clues: 2")).toHaveAttribute("data-state", "impossible");
  });

  it("renders nothing visible for an empty [0] clue", () => {
    const { container } = render(
      <ClueLine items={[0]} state="normal" orientation="row" label="Row 1 clues: 0" />,
    );
    expect(container.querySelectorAll("span")).toHaveLength(0);
  });
});

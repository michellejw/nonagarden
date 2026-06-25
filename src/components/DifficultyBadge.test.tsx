import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DifficultyBadge } from "./DifficultyBadge";

describe("DifficultyBadge", () => {
  it("shows the difficulty label", () => {
    render(<DifficultyBadge difficulty="woodlander" />);
    expect(screen.getByText(/woodlander/i)).toBeInTheDocument();
  });

  it("applies a distinct class per difficulty", () => {
    const { container: a } = render(<DifficultyBadge difficulty="forager" />);
    const { container: b } = render(<DifficultyBadge difficulty="mycologist" />);
    expect(a.firstChild).not.toBeNull();
    expect((a.firstChild as HTMLElement).className).not.toEqual(
      (b.firstChild as HTMLElement).className,
    );
  });
});

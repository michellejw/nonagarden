import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("renders Daily and Archive nav links", () => {
    render(<AppHeader />);
    expect(screen.getByRole("link", { name: /daily/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /archive/i })).toHaveAttribute("href", "/archive");
  });

  it("renders the wordmark", () => {
    render(<AppHeader />);
    expect(screen.getByText(/nonagarden/i)).toBeInTheDocument();
  });
});

import { describe, it, expect } from "vitest";
import config from "./next.config";

describe("next.config redirects", () => {
  it("permanently redirects the retired library routes to /archive", async () => {
    const redirects = await config.redirects!();
    expect(redirects).toContainEqual({ source: "/library", destination: "/archive", permanent: true });
    expect(redirects).toContainEqual({ source: "/library/:slug", destination: "/archive", permanent: true });
  });
});

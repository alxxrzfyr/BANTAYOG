import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/providers/index", () => ({ Providers: () => null }));

import { metadata } from "./layout";

describe("root layout icons", () => {
  it("references icon files that ship with the app", () => {
    const icons = metadata.icons as { icon: string; apple: string };

    for (const path of [icons.icon, icons.apple]) {
      expect(path).toMatch(/^\/[^/]/);
      expect(existsSync(new URL(`../public${path}`, import.meta.url)),
        `Missing public icon: ${path}`).toBe(true);
    }
  });
});

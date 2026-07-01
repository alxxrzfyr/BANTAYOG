import { describe, it, expect } from "vitest";
import {
  getDefaultMaxCredits,
  getCriticalWindowMultiplier,
} from "./nutrition-policy";

describe("nutrition-policy domain", () => {
  describe("getDefaultMaxCredits", () => {
    it("returns 2000 for tier 1 (critical)", () => {
      expect(getDefaultMaxCredits(1)).toBe(2000);
    });

    it("returns 1200 for tier 2 (standard)", () => {
      expect(getDefaultMaxCredits(2)).toBe(1200);
    });

    it("returns 1200 for unknown tier", () => {
      expect(getDefaultMaxCredits(99 as 1 | 2)).toBe(1200);
    });
  });

  describe("getCriticalWindowMultiplier", () => {
    it("returns 1.5 for tier 1", () => {
      expect(getCriticalWindowMultiplier(1)).toBe(1.5);
    });

    it("returns 1.0 for tier 2", () => {
      expect(getCriticalWindowMultiplier(2)).toBe(1.0);
    });

    it("returns 1.0 for unknown tier", () => {
      expect(getCriticalWindowMultiplier(99 as 1 | 2)).toBe(1.0);
    });
  });
});

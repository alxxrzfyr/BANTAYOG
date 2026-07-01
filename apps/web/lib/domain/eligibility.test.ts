import { describe, it, expect } from "vitest";
import {
  computeTier,
  deriveBirthdateFromAgeMonths,
  formatAgeDetails,
} from "./eligibility";

describe("eligibility domain", () => {
  describe("deriveBirthdateFromAgeMonths", () => {
    it("returns a date approximately N months in the past", () => {
      const now = new Date();
      const result = deriveBirthdateFromAgeMonths(12);
      const diffMs = now.getTime() - result.getTime();
      const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30);
      expect(diffMonths).toBeCloseTo(12, 0);
    });
  });

  describe("computeTier", () => {
    it("returns tier 1 for infants under 1000 days (~33 months)", () => {
      const birthdate = deriveBirthdateFromAgeMonths(6);
      const { tier } = computeTier(birthdate);
      expect(tier).toBe(1);
    });

    it("returns tier 2 for children over 1000 days (~33 months)", () => {
      const birthdate = deriveBirthdateFromAgeMonths(60);
      const { tier } = computeTier(birthdate);
      expect(tier).toBe(2);
    });

    it("returns tier 1 exactly at 999 days boundary", () => {
      const birthdate = new Date();
      birthdate.setDate(birthdate.getDate() - 999);
      const { tier } = computeTier(birthdate);
      expect(tier).toBe(1);
    });

    it("returns tier 2 exactly at 1001 days", () => {
      const birthdate = new Date();
      birthdate.setDate(birthdate.getDate() - 1001);
      const { tier } = computeTier(birthdate);
      expect(tier).toBe(2);
    });
  });

  describe("formatAgeDetails", () => {
    it("formats 18 months with days", () => {
      const result = formatAgeDetails(18);
      expect(result).toContain("18 months");
      expect(result).toContain("days");
    });

    it("formats 6 months with days", () => {
      const result = formatAgeDetails(6);
      expect(result).toContain("6 months");
      expect(result).toContain("days");
    });

    it("formats 24 months with days", () => {
      const result = formatAgeDetails(24);
      expect(result).toContain("24 months");
      expect(result).toContain("days");
    });
  });
});

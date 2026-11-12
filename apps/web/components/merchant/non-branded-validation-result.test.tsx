import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { NonBrandedValidationDto } from "@bantayog/schema";
import { NonBrandedValidationResult } from "./non-branded-validation-result";

const banana: NonBrandedValidationDto = { isJustified: false, imageMatches: true,
  isChildFriendly: true, reasoning: "The image shows a banana.", flaggedIngredients: [],
  suggestedCategory: "FRUITS", priceStatus: "needs_weight", priceReasoning: "Enter the measured weight in grams.",
  researchedPriceMin: 70, researchedPriceMax: 110, researchedPriceUnit: "per kilo",
  referenceProductName: "Banana (Lakatan)", referenceSource: "Bantay Presyo (DA-AMAS)", referenceDate: "2026-07-07" };

describe("NonBrandedValidationResult", () => {
  it("shows the reference unit and date without calling a price issue a nutrition failure", () => {
    const html = renderToStaticMarkup(<NonBrandedValidationResult result={banana} />);
    expect(html).toContain("₱70 – ₱110 per kilo");
    expect(html).not.toContain("per piece");
    expect(html).toContain("2026-07-07");
    expect(html).toContain("not a live local market quote");
    expect(html).toContain("Enter the measured weight");
    expect(html).toContain("AI Image and Nutrition Review");
    expect(html).not.toContain("Purchase blocked");
  });

  it("does not invent a zero price estimate when there is no reference", () => {
    const html = renderToStaticMarkup(<NonBrandedValidationResult result={{ ...banana,
      priceStatus: "no_reference", researchedPriceMin: null, researchedPriceMax: null, researchedPriceUnit: null }} />);
    expect(html).not.toContain("Stored Price Reference");
    expect(html).not.toContain("₱0");
  });

  it("keeps nutrition and image failures blocked even with a valid price", () => {
    const nutrition = renderToStaticMarkup(<NonBrandedValidationResult result={{ ...banana,
      isJustified: true, isChildFriendly: false, priceStatus: "valid", flaggedIngredients: ["Added sugar"] }} />);
    expect(nutrition).toContain("Purchase blocked");
    expect(nutrition).toContain("Added sugar");
    expect(nutrition).not.toContain("✓ Validated");
    const image = renderToStaticMarkup(<NonBrandedValidationResult result={{ ...banana,
      imageMatches: false, mismatchReason: "The photo shows an onion." }} />);
    expect(image).toContain("The photo shows an onion.");
  });
});

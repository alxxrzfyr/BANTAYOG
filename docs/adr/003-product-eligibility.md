# ADR 003: Separation of Product Identification and Eligibility Logic

## Context

BANTAYOG implements an AI Image Scan flow that lets merchants photograph products. The system identifies what the product is and determines whether the product is eligible for LGU subsidies.

LLMs and Multimodal Vision Models (such as Gemini) are highly effective at reading text and visual layouts from images, but they:
1. Are non-deterministic (may return different structures or decisions for similar images).
2. Are prone to hallucinations (may classify a product as eligible when it isn't).
3. Do not have direct access to the live product catalog and price ranges stored in the database.

## Decision

We will isolate the multimodal vision model's scope to **Product Identification** only, while keeping **Eligibility Validation** strictly off-chain and catalog-backed:
1. Gemini Vision API identifies the brand and product name from the base64 image payload.
2. The server filters candidates by a confidence score threshold (default `0.7`).
3. For each high-confidence candidate, the server runs a case-insensitive fuzzy match (trigram similarity) against the database `products` table.
4. The eligibility status (`eligible` or `ineligible`) and pricing constraints are read directly from the matching database catalog record and returned to the merchant app.

## Consequences

### Benefits
- **Determinism**: Eligibility rules are consistent and 100% catalog-backed.
- **Maintainability**: Changing a product's subsidy status only requires updating a database row; no changes to prompt design or vision thresholds are needed.
- **Robustness**: Fuzzy matching handles minor spelling discrepancies between Gemini's output and the database catalog.
- **Security**: Merchants cannot manipulate prompts to bypass eligibility filters.

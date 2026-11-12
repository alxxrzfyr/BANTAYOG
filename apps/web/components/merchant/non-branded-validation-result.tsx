import type { NonBrandedValidationDto } from "@bantayog/schema";

export function NonBrandedValidationResult({ result }: { result: NonBrandedValidationDto }) {
  const approved = result.isJustified && result.isChildFriendly;
  return (
    <>
      <div className="mt-5 overflow-hidden rounded-2xl border border-[#b2dfdb] bg-white shadow-sm" aria-live="polite">
        <div className={`px-4 py-3 flex items-center justify-between border-b ${approved ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
          <span className="font-body text-xs font-bold uppercase tracking-wider text-[#034C52]">Product Validation Result</span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${approved ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
            {approved ? "✓ Validated" : "⚠ Review needed"}
          </span>
        </div>
        <div className="px-4 py-4 space-y-3">
          {!result.imageMatches && (
            <div className="rounded-xl bg-red-50 p-3 border border-red-100">
              <p className="font-body text-xs text-red-700 font-semibold leading-relaxed">{result.mismatchReason}</p>
            </div>
          )}
          <div>
            <h4 className="font-body text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Price Check</h4>
            <p className="mt-1 font-body text-sm text-gray-700 leading-relaxed">{result.priceReasoning}</p>
          </div>
          <div>
            <h4 className="font-body text-[10px] font-semibold text-gray-400 uppercase tracking-wider">AI Image and Nutrition Review</h4>
            <p className="mt-1 font-body text-sm text-gray-700 leading-relaxed">{result.reasoning}</p>
          </div>
          {result.researchedPriceMin !== null && result.researchedPriceMax !== null && result.researchedPriceUnit && (
            <div>
              <h4 className="font-body text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Stored Price Reference</h4>
              <p className="mt-1 font-body text-sm font-semibold text-[#034C52]">
                ₱{result.researchedPriceMin} – ₱{result.researchedPriceMax} {result.researchedPriceUnit}
              </p>
              <p className="mt-1 font-body text-xs text-gray-500">{result.referenceProductName} · {result.referenceSource} · {result.referenceDate}</p>
              <p className="mt-1 font-body text-xs text-gray-500">This stored reference is not a live local market quote.</p>
            </div>
          )}
          {result.flaggedIngredients.length > 0 && (
            <div>
              <h4 className="font-body text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Flagged Ingredients</h4>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {result.flaggedIngredients.map((ingredient, index) => (
                  <span key={index} className="inline-flex items-center rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 font-body text-xs font-medium text-amber-800">{ingredient}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {!result.isChildFriendly && (
        <div className="mt-4 rounded-xl bg-red-50 p-4 border border-red-100">
          <p className="font-body text-xs text-red-700 font-semibold leading-relaxed">
            ⚠ Purchase blocked: The AI food review flagged a nutrition concern. Review the food details above or take a clearer photo. A price issue alone does not mark food as unsuitable.
          </p>
        </div>
      )}
    </>
  );
}

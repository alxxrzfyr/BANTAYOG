// ---------------------------------------------------------------------------
// Eligibility Toggle — Good for Children / Not Good for Children
// ---------------------------------------------------------------------------

type EligibilityValue = "eligible" | "ineligible" | null;

interface EligibilityToggleProps {
  value: EligibilityValue;
  onChange: (value: "eligible" | "ineligible") => void;
}

export function EligibilityToggle({
  value,
  onChange,
}: EligibilityToggleProps) {
  const isEligible = value === "eligible";
  const isIneligible = value === "ineligible";

  return (
    <div>
      <label className="mb-2 block font-body text-xs font-medium text-gray-600">
        Category/Validation
      </label>
      <div className="grid grid-cols-2 gap-3">
        {/* Eligible option */}
        <button
          type="button"
          onClick={() => onChange("eligible")}
          className={`flex items-center gap-2 rounded-xl border-2 px-3 py-3 transition-all ${
            isEligible
              ? "border-[#10b981] bg-[#ecfdf5]"
              : "border-gray-200 bg-gray-50"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              isEligible
                ? "/merchantLogos/green_correct.png"
                : "/merchantLogos/gray_correct.png"
            }
            alt=""
            className="h-5 w-5 flex-shrink-0"
          />
          <div className="text-left">
            <p
              className={`font-body text-xs font-semibold leading-tight ${
                isEligible ? "text-[#065f46]" : "text-gray-400"
              }`}
            >
              Good for Children
            </p>
            <p
              className={`font-body text-[10px] ${
                isEligible ? "text-[#059669]" : "text-gray-400"
              }`}
            >
              (Nutritious)
            </p>
          </div>
        </button>

        {/* Ineligible option */}
        <button
          type="button"
          onClick={() => onChange("ineligible")}
          className={`flex items-center gap-2 rounded-xl border-2 px-3 py-3 transition-all ${
            isIneligible
              ? "border-[#ef4444] bg-[#fef2f2]"
              : "border-gray-200 bg-gray-50"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              isIneligible
                ? "/merchantLogos/red_wrong.png"
                : "/merchantLogos/gray_wrong.png"
            }
            alt=""
            className="h-5 w-5 flex-shrink-0"
          />
          <div className="text-left">
            <p
              className={`font-body text-xs font-semibold leading-tight ${
                isIneligible ? "text-[#991b1b]" : "text-gray-400"
              }`}
            >
              Not Good for Children
            </p>
            <p
              className={`font-body text-[10px] ${
                isIneligible ? "text-[#dc2626]" : "text-gray-400"
              }`}
            >
              (Not Nutritious)
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

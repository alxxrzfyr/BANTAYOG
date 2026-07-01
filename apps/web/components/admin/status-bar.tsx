"use client";

/* ─────────────────────────────────────────────────────────
   StatusBar — shared across all admin pages.
   Shows: building icon | "LGU Registry and Intervention Portal"
   heading | district subtext | "Database Online" pill on the right.
   Sampled from mockups 2.png, 6.png, 10.png.
   ───────────────────────────────────────────────────────── */

interface StatusBarProps {
  /** Override the district label. Defaults to the mock text. */
  district?: string;
  /** Override the online/offline status. Defaults to "Database Online". */
  status?: "online" | "offline";
}

export function StatusBar({
  district = "Metro Manila City - District 2 (Municipal Nutrition Office)",
  status = "online",
}: StatusBarProps) {
  return (
    <div className="w-full bg-bg-card/80 backdrop-blur-sm rounded-2xl border border-border-input/30 px-6 py-4 flex items-center justify-between gap-4 shadow-sm">
      {/* Left: icon + heading + subtext */}
      <div className="flex items-center gap-4">
        {/* Building / grid icon — sampled from mock */}
        <div className="flex-shrink-0">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-brand-darkTeal"
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </div>
        <div>
          <p className="font-bold text-brand-darkTeal text-sm leading-tight">
            LGU Registry and Intervention Portal
          </p>
          <p className="text-brand-darkTeal/55 text-xs mt-0.5 leading-tight">
            {district}
          </p>
        </div>
      </div>

      {/* Right: Database Online pill */}
      <div
        className={`
          flex-shrink-0 flex items-center gap-2.5
          px-5 py-2.5 rounded-full border
          text-xs font-semibold
          ${status === "online"
            ? "bg-badge-status-bg border-brand-sageBorder/50 text-brand-darkTeal"
            : "bg-red-50 border-red-200 text-red-700"
          }
        `}
      >
        {/* Database / cylinder icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
        {status === "online" ? "Database Online" : "Database Offline"}
      </div>
    </div>
  );
}

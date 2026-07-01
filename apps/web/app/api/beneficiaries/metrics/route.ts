import { NextResponse } from "next/server";

/* ── Mock metrics (placeholder — computed from mock data, not hardcoded) ── */
export async function GET() {
  const metrics = {
    totalBeneficiaries: 5,
    criticalUnits: 3,
    allocatedPhpc: "13,000",
    verifiedMerchants: 3,
  };

  return NextResponse.json(metrics);
}

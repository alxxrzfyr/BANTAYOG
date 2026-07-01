import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  /* Placeholder — in production this would insert into Supabase + generate QR */
  const childAgeMonths = body.childAgeMonths ?? 0;
  const tier = childAgeMonths <= 36 ? "TIER_1_CRITICAL" : "TIER_2_STANDARD";

  const cardSerial = `BTG-2026-${String(Math.floor(Math.random() * 900) + 100)}`;

  return NextResponse.json(
    {
      success: true,
      childName: body.childName ?? "Unknown",
      guardianName: body.guardianName ?? "Unknown",
      cardSerial,
      tier,
      alert_banner:
        tier === "TIER_1_CRITICAL"
          ? "⚠ Critical 1,000-Day Window: This child is within the critical first 1,000 days of development."
          : null,
      qrToken: {
        jwsCompact: `mock-jws-${cardSerial}`,
        cardSerial,
      },
    },
    { status: 201 },
  );
}

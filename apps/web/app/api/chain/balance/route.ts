import { NextResponse } from "next/server";

/* ── Mock chain balance (placeholder — in production reads from Ronin) ── */
export async function GET() {
  return NextResponse.json({
    formatted: "1250.00",
    balance: 1250,
  });
}

import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  /* Placeholder — in production this would insert into Supabase */
  return NextResponse.json(
    {
      success: true,
      storeName: body.storeName ?? "Unknown Store",
      ownerName: body.ownerName ?? "Unknown Owner",
      message: "Merchant registered successfully (mock)",
    },
    { status: 201 },
  );
}

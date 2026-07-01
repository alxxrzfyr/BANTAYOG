import { NextResponse, type NextRequest } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  /* Placeholder — in production this would update Supabase + trigger chain tx */
  return NextResponse.json({
    success: true,
    beneficiaryId: id,
    amountAdded: body.amount ?? 0,
    message: "Credits added successfully (mock)",
  });
}

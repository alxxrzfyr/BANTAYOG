import { NextResponse } from "next/server";

/* ── Mock merchant data (placeholder until real API is built) ── */
const mockMerchants = [
  {
    id: "m001",
    storeName: "Aling Nena's Sari-Sari Store",
    ownerName: "Nena Ramos",
    mobileNumberE164: "+639171234567",
    status: "APPROVED" as const,
  },
  {
    id: "m002",
    storeName: "Mang Tony's Groceries",
    ownerName: "Tony Dela Cruz",
    mobileNumberE164: "+639181234567",
    status: "APPROVED" as const,
  },
  {
    id: "m003",
    storeName: "Barangay 3 Mini Mart",
    ownerName: "Rosa Garcia",
    mobileNumberE164: "+639191234567",
    status: "PENDING" as const,
  },
];

export async function GET() {
  return NextResponse.json(mockMerchants);
}

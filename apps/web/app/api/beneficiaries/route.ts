import { NextResponse } from "next/server";

/* ── Mock beneficiary data (placeholder until real API is built) ── */
const mockBeneficiaries = [
  {
    id: "b001",
    cardSerial: "BTG-2026-001",
    childName: "Jose Santos",
    guardianName: "Maria Santos",
    ageDetails: "~24 months\n(730 days)",
    creditBalance: 2500,
    tier: "TIER_1_CRITICAL" as const,
    birthdate: "2024-06-15",
    jwsCompact: "mock-jws-token-001",
  },
  {
    id: "b002",
    cardSerial: "BTG-2026-002",
    childName: "Luna Reyes",
    guardianName: "Ana Reyes",
    ageDetails: "~18 months\n(548 days)",
    creditBalance: 1800,
    tier: "TIER_1_CRITICAL" as const,
    birthdate: "2024-12-20",
    jwsCompact: "mock-jws-token-002",
  },
  {
    id: "b003",
    cardSerial: "BTG-2026-003",
    childName: "Miguel Cruz",
    guardianName: "Elena Cruz",
    ageDetails: "~36 months\n(1095 days)",
    creditBalance: 3200,
    tier: "TIER_2_STANDARD" as const,
    birthdate: "2023-06-10",
    jwsCompact: "mock-jws-token-003",
  },
  {
    id: "b004",
    cardSerial: "BTG-2026-004",
    childName: "Isabella Bautista",
    guardianName: "Sofia Bautista",
    ageDetails: "~12 months\n(365 days)",
    creditBalance: 1500,
    tier: "TIER_1_CRITICAL" as const,
    birthdate: "2025-06-28",
    jwsCompact: "mock-jws-token-004",
  },
  {
    id: "b005",
    cardSerial: "BTG-2026-005",
    childName: "Carlos Villanueva",
    guardianName: "Carmen Villanueva",
    ageDetails: "~30 months\n(913 days)",
    creditBalance: 4000,
    tier: "TIER_2_STANDARD" as const,
    birthdate: "2023-12-25",
    jwsCompact: "mock-jws-token-005",
  },
];

export async function GET() {
  return NextResponse.json(mockBeneficiaries);
}

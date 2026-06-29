"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Badge, SectionHeading } from "@/components/ui";

/* ───────────────────────────────────────────
   Slide 3 — Beneficiary Registry View
   Data-table grid with records, metrics, QR status
   ─────────────────────────────────────────── */

interface BeneficiaryRecord {
  id: string;
  motherName: string;
  childName: string;
  ageMonths: number;
  barangay: string;
  heightCm: number;
  weightKg: number;
  stuntingStatus: "normal" | "stunted" | "severely-stunted";
  qrStatus: "generated" | "pending" | "printed";
  registeredAt: string;
}

// Mock data — in production this comes from Supabase/API
const mockRecords: BeneficiaryRecord[] = [
  {
    id: "BN-2026-001",
    motherName: "Maria Santos",
    childName: "Jose Santos",
    ageMonths: 24,
    barangay: "Barangay 1",
    heightCm: 85.5,
    weightKg: 11.2,
    stuntingStatus: "normal",
    qrStatus: "generated",
    registeredAt: "2026-06-28",
  },
  {
    id: "BN-2026-002",
    motherName: "Ana Reyes",
    childName: "Luna Reyes",
    ageMonths: 18,
    barangay: "Barangay 2",
    heightCm: 76.0,
    weightKg: 8.5,
    stuntingStatus: "stunted",
    qrStatus: "generated",
    registeredAt: "2026-06-28",
  },
  {
    id: "BN-2026-003",
    motherName: "Elena Cruz",
    childName: "Miguel Cruz",
    ageMonths: 30,
    barangay: "Barangay 3",
    heightCm: 82.0,
    weightKg: 10.0,
    stuntingStatus: "severely-stunted",
    qrStatus: "printed",
    registeredAt: "2026-06-27",
  },
  {
    id: "BN-2026-004",
    motherName: "Sofia Bautista",
    childName: "Isabella Bautista",
    ageMonths: 12,
    barangay: "Barangay 1",
    heightCm: 72.0,
    weightKg: 9.0,
    stuntingStatus: "normal",
    qrStatus: "pending",
    registeredAt: "2026-06-27",
  },
  {
    id: "BN-2026-005",
    motherName: "Carmen Villanueva",
    childName: "Carlos Villanueva",
    ageMonths: 36,
    barangay: "Barangay 4",
    heightCm: 88.0,
    weightKg: 13.5,
    stuntingStatus: "normal",
    qrStatus: "generated",
    registeredAt: "2026-06-26",
  },
  {
    id: "BN-2026-006",
    motherName: "Diana Mercado-Yñigo",
    childName: "Rafael Mercado",
    ageMonths: 20,
    barangay: "Barangay 2",
    heightCm: 78.5,
    weightKg: 9.2,
    stuntingStatus: "stunted",
    qrStatus: "printed",
    registeredAt: "2026-06-26",
  },
];

const stuntingConfig = {
  normal: { label: "Normal", variant: "success" as const },
  stunted: { label: "Stunted", variant: "warning" as const },
  "severely-stunted": { label: "Severe", variant: "coral" as const },
};

const qrConfig = {
  generated: { label: "QR Generated", variant: "success" as const },
  pending: { label: "QR Pending", variant: "warning" as const },
  printed: { label: "QR Printed", variant: "info" as const },
};

type SortField = "id" | "motherName" | "barangay" | "stuntingStatus" | "registeredAt";
type SortDir = "asc" | "desc";

export default function RegistryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("registeredAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  /* ── Summary Stats ── */
  const totalRecords = mockRecords.length;
  const stuntedCount = mockRecords.filter(
    (r) => r.stuntingStatus === "stunted" || r.stuntingStatus === "severely-stunted"
  ).length;
  const withQr = mockRecords.filter(
    (r) => r.qrStatus === "generated" || r.qrStatus === "printed"
  ).length;

  /* ── Filter & Sort ── */
  const filtered = mockRecords
    .filter((r) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        r.motherName.toLowerCase().includes(q) ||
        r.childName.toLowerCase().includes(q) ||
        r.barangay.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aVal = String(a[sortField]);
      const bVal = String(b[sortField]);
      const cmp = aVal.localeCompare(bVal);
      return sortDir === "asc" ? cmp : -cmp;
    });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return (
      <span className="inline-block ml-1 text-xs">
        {sortDir === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  return (
    <div className="space-y-6 stagger-children">
      {/* Header with back navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary-500)] hover:text-[var(--color-primary-600)] transition-colors mb-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to Dashboard
          </Link>
          <SectionHeading
            title="Beneficiary Registry"
            subtitle="Complete list of registered mother-child pairs and QR subsidy card status"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="!p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center text-[var(--color-primary-500)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-black text-[var(--color-primary-600)]">{totalRecords}</p>
              <p className="text-xs font-medium text-[var(--color-text-muted)]">Total Beneficiaries</p>
            </div>
          </div>
        </Card>
        <Card className="!p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-warning-bg)] flex items-center justify-center text-[var(--color-warning)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-black text-[var(--color-warning)]">{stuntedCount}</p>
              <p className="text-xs font-medium text-[var(--color-text-muted)]">Stunting Flagged</p>
            </div>
          </div>
        </Card>
        <Card className="!p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-success-bg)] flex items-center justify-center text-[var(--color-success)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <rect x="9" y="9" width="6" height="6" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-black text-[var(--color-success)]">{withQr}</p>
              <p className="text-xs font-medium text-[var(--color-text-muted)]">QR Cards Ready</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search by name, ID, or barangay..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto rounded-2xl">
        <Card className="!p-0 overflow-hidden">
          <div className="min-w-[900px]">
            {/* Table Header */}
            <div className="grid grid-cols-[100px_1fr_1fr_100px_100px_130px_130px_130px] gap-2 px-5 py-3.5 bg-[var(--color-surface-muted)] border-b border-[var(--color-border-light)] text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
              <button
                onClick={() => toggleSort("id")}
                className="flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
              >
                ID <SortIcon field="id" />
              </button>
              <button
                onClick={() => toggleSort("motherName")}
                className="flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors cursor-pointer text-left"
              >
                Mother <SortIcon field="motherName" />
              </button>
              <span className="truncate">Child</span>
              <span>Age</span>
              <button
                onClick={() => toggleSort("barangay")}
                className="flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
              >
                Barangay <SortIcon field="barangay" />
              </button>
              <span>Metrics</span>
              <button
                onClick={() => toggleSort("stuntingStatus")}
                className="flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
              >
                Status <SortIcon field="stuntingStatus" />
              </button>
              <span>QR Pass</span>
            </div>

            {/* Table Body */}
            {filtered.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--color-surface-muted)] flex items-center justify-center text-[var(--color-text-muted)]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                  No records found for &quot;{searchQuery}&quot;
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Try a different search term or register a new beneficiary.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-light)]">
                {filtered.map((record, idx) => {
                  const stunting = stuntingConfig[record.stuntingStatus];
                  const qr = qrConfig[record.qrStatus];

                  return (
                    <div
                      key={record.id}
                      className="grid grid-cols-[100px_1fr_1fr_100px_100px_130px_130px_130px] gap-2 px-5 py-4 items-center text-sm hover:bg-[var(--color-surface-muted)]/50 transition-colors animate-fade-in"
                      style={{ animationDelay: `${idx * 0.03}s` }}
                    >
                      <span className="font-mono text-xs font-semibold text-[var(--color-primary-500)]">
                        {record.id}
                      </span>
                      <span className="font-semibold text-[var(--color-text-primary)] truncate">
                        {record.motherName}
                      </span>
                      <span className="text-[var(--color-text-secondary)] truncate">
                        {record.childName}
                      </span>
                      <span className="text-[var(--color-text-secondary)]">
                        {record.ageMonths}m
                      </span>
                      <span className="text-[var(--color-text-secondary)]">
                        {record.barangay}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)] font-mono">
                        {record.heightCm}cm / {record.weightKg}kg
                      </span>
                      <div>
                        <Badge variant={stunting.variant}>{stunting.label}</Badge>
                      </div>
                      <div>
                        <Badge variant={qr.variant}>{qr.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Pagination / Info */}
      <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)]">
        <p>
          Showing <span className="font-semibold text-[var(--color-text-secondary)]">{filtered.length}</span> of{" "}
          <span className="font-semibold text-[var(--color-text-secondary)]">{totalRecords}</span> records
        </p>
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary-500)] hover:text-[var(--color-primary-600)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

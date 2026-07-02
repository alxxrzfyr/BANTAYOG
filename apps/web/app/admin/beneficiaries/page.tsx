"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { authFetch } from "@/lib/api";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { StatusBar } from "@/components/admin/status-bar";
import { AddCreditsModal } from "@/components/admin/add-credits-modal";
import { QrPassModal, type QrPassData } from "@/components/admin/qr-pass-modal";

/* ─────────────────────────────────────────────────────────
   Beneficiaries Page — mock 6.png. Default admin landing.

   Structure:
   1. StatusBar
   2. Four metric cards (from API — never computed client-side)
   3. TanStack Table — "Active Beneficiary Directory"
      Columns: ID | Child Name | Guardian Name | Age Details |
               Remaining Balance | Add Credits | Intervention Tier | Action
   4. Dot-indicator pagination
   ───────────────────────────────────────────────────────── */

/* ── API response shape for a single beneficiary row ── */
interface BeneficiaryRow {
  id: string;
  cardSerial: string;
  childName: string;
  guardianName: string;
  /** e.g. "~14 months (445 days)" — formatted by server */
  ageDetails: string;
  /** Numeric PHPC balance */
  creditBalance: number;
  /** "TIER_1_CRITICAL" | "TIER_2_STANDARD" — from API, NEVER computed */
  tier: "TIER_1_CRITICAL" | "TIER_2_STANDARD";
  birthdate: string;
  /** The signed JWT for QR encoding — included in list response */
  jwsCompact?: string;
}

/* ── Metrics card shape from GET /api/beneficiaries/metrics ── */
interface Metrics {
  totalBeneficiaries: number;
  criticalUnits: number;
  allocatedPhpc: string;
  verifiedMerchants: number;
}

const PAGE_SIZE = 5;

export default function BeneficiariesPage() {
  /* ── State ── */
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [lguBalance, setLguBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  /* Modal state */
  const [creditsModal, setCreditsModal] = useState<{
    open: boolean;
    beneficiaryId: string;
    beneficiaryName: string;
  }>({ open: false, beneficiaryId: "", beneficiaryName: "" });
  const [qrModal, setQrModal] = useState<{ open: boolean; data: QrPassData | null }>({
    open: false,
    data: null,
  });

  /* ── Data fetching ── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [benefRes, metricsRes, balRes] = await Promise.allSettled([
        authFetch("/api/beneficiaries"),
        authFetch("/api/beneficiaries/metrics"),
        authFetch("/api/chain/balance"),
      ]);

      if (benefRes.status === "fulfilled" && benefRes.value.ok) {
        const data = await benefRes.value.json();
        /* API may return { beneficiaries: [...] } or bare array */
        setBeneficiaries(Array.isArray(data) ? data : (data.beneficiaries ?? data.data ?? []));
      }

      if (metricsRes.status === "fulfilled" && metricsRes.value.ok) {
        const m = await metricsRes.value.json();
        setMetrics(m);
      }

      if (balRes.status === "fulfilled" && balRes.value.ok) {
        const b = await balRes.value.json();
        const parsed = parseFloat(b?.formatted ?? b?.balance ?? "0");
        setLguBalance(isNaN(parsed) ? 0 : parsed);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* ── Min credit amount to enable Add Credits (500 per slider spec) ── */
  const MIN_CREDIT = 500;
  const canAddCredits = true;

  /* ── Open Add Credits modal ── */
  const openCredits = useCallback(
    (row: BeneficiaryRow) => {
      setCreditsModal({ open: true, beneficiaryId: row.id, beneficiaryName: row.childName });
    },
    []
  );

  /* ── Open QR Pass modal ── */
  const openQrPass = useCallback((row: BeneficiaryRow) => {
    setQrModal({
      open: true,
      data: {
        jwsCompact: row.jwsCompact ?? row.id, /* fallback to ID if JWT not in list response */
        cardSerial: row.cardSerial,
        childName: row.childName,
        guardianName: row.guardianName,
        birthdate: row.birthdate,
        tier: row.tier,
      },
    });
  }, []);

  /* ── TanStack Table columns ── */
  const columns = useMemo<ColumnDef<BeneficiaryRow>[]>(
    () => [
      {
        id: "cardSerial",
        accessorKey: "cardSerial",
        header: "BENEFICIARY ID",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-semibold text-brand-activeTeal">
            {String(getValue())}
          </span>
        ),
      },
      {
        id: "childName",
        accessorKey: "childName",
        header: "CHILD NAME",
        cell: ({ getValue }) => (
          <span className="font-bold text-brand-darkTeal text-sm">{String(getValue())}</span>
        ),
      },
      {
        id: "guardianName",
        accessorKey: "guardianName",
        header: "GUARDIAN NAME",
        cell: ({ getValue }) => (
          <span className="text-brand-darkTeal/60 text-sm">{String(getValue())}</span>
        ),
      },
      {
        id: "ageDetails",
        accessorKey: "ageDetails",
        header: "AGE DETAILS",
        cell: ({ getValue }) => {
          const val = String(getValue());
          /* Expects "~14 months\n(445 days)" or similar from server */
          const [main, sub] = val.split(/\n|\|/);
          return (
            <div>
              <p className="font-semibold text-brand-darkTeal text-sm leading-tight">
                {main?.trim()}
              </p>
              {sub && (
                <p className="text-brand-darkTeal/40 text-xs leading-tight">{sub.trim()}</p>
              )}
            </div>
          );
        },
      },
      {
        id: "creditBalance",
        accessorKey: "creditBalance",
        header: "REMAINING BALANCE",
        cell: ({ getValue }) => (
          <span className="font-semibold text-brand-darkTeal text-sm">
            {Number(getValue()).toLocaleString("en-PH")} PHPC
          </span>
        ),
      },
      {
        id: "addCredits",
        header: "ADD CREDITS",
        enableSorting: false,
        cell: ({ row }) => {
          if (!canAddCredits) {
            return (
              <span
                title="Insufficient LGU Balance"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-brand-sageBorder text-brand-darkTeal/30 text-xs font-semibold cursor-not-allowed select-none"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Add
              </span>
            );
          }
          return (
            <button
              onClick={() => openCredits(row.original)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-brand-darkTeal/50 text-brand-darkTeal text-xs font-semibold hover:bg-brand-darkTeal hover:text-white transition-all duration-150 cursor-pointer"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add
            </button>
          );
        },
      },
      {
        id: "tier",
        accessorKey: "tier",
        header: "INTERVENTION TIER",
        cell: ({ getValue }) => {
          /* Tier badge — value comes from API only, NEVER computed here */
          const tier = getValue() as BeneficiaryRow["tier"];
          const isCritical = tier === "TIER_1_CRITICAL";
          return (
            <span
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold
                border select-none
                ${isCritical
                  ? "bg-brand-coral/10 border-brand-coral/40 text-brand-coral"
                  : "bg-green-50 border-green-300 text-green-700"
                }
              `}
            >
              {isCritical ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
                  1K Days Window
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Standard
                </>
              )}
            </span>
          );
        },
      },
      {
        id: "action",
        header: "ACTION",
        enableSorting: false,
        cell: ({ row }) => (
          <button
            onClick={() => openQrPass(row.original)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-brand-darkTeal/30 text-brand-darkTeal text-xs font-semibold hover:bg-brand-darkTeal hover:text-white transition-all duration-150 cursor-pointer"
          >
            {/* QR icon */}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
              <line x1="14" y1="14" x2="14" y2="14" /><line x1="17" y1="14" x2="21" y2="14" /><line x1="14" y1="17" x2="14" y2="21" /><line x1="17" y1="17" x2="17" y2="17" /><line x1="21" y1="17" x2="21" y2="17" /><line x1="21" y1="21" x2="21" y2="21" />
            </svg>
            QR Pass
          </button>
        ),
      },
    ],
    [canAddCredits, openCredits, openQrPass]
  );

  /* ── TanStack Table instance ── */
  const table = useReactTable({
    data: beneficiaries,
    columns,
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
  });

  const { pageIndex } = table.getState().pagination;
  const pageCount = table.getPageCount();

  return (
    <>
      <div className="space-y-5 animate-fade-in">
        {/* Status bar */}
        <StatusBar />

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="BENEFICIARIES ONBOARDED"
          value={metrics?.totalBeneficiaries ?? "—"}
          subtext="+1 this week"
          subtextColor="text-green-600"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-brand-darkTeal/40">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            </svg>
          }
        />
        <MetricCard
          label="CRITICAL 1000-DAY UNITS"
          value={metrics?.criticalUnits ?? "—"}
          subtext="Requires urgent intervention"
          subtextColor="text-brand-coral/70"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-brand-coral/40">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
          valueColor="text-brand-coral"
        />
        <MetricCard
          label="ALLOCATED STABLECOIN (PHPC)"
          value={metrics ? `${metrics.allocatedPhpc} PHPC` : "—"}
          subtext="LGU Subsidy Fund Pool"
          subtextColor="text-brand-darkTeal/40"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-brand-darkTeal/40">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          }
          valueLarge
        />
        <MetricCard
          label="VERIFIED MERCHANTS"
          value={metrics ? `${metrics.verifiedMerchants} Stores` : "—"}
          subtext="Secured via Ronin Contract"
          subtextColor="text-brand-darkTeal/40"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-brand-darkTeal/40">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" />
            </svg>
          }
        />
      </div>

      {/* ── Active Beneficiary Directory ── */}
      <div className="bg-white rounded-2xl border border-brand-sageBorder/30 shadow-sm overflow-hidden">
        {/* Table header row */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-sageBorder/20">
          <div className="flex items-center gap-2.5">
            {/* Layers icon matching mock */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-darkTeal/50">
              <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
            </svg>
            <h2 className="font-bold text-brand-darkTeal text-sm">Active Beneficiary Directory</h2>
          </div>
          {/* Search input */}
          <div className="relative w-64">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-darkTeal/30" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search name or ID..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border-2 border-brand-sageBorder/50 rounded-full text-brand-darkTeal placeholder:text-brand-darkTeal/30 outline-none focus:border-brand-activeTeal transition-colors bg-brand-peachBg/30"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="bg-brand-peachBg/40 border-b border-brand-sageBorder/20">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                      className={`
                        px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-brand-darkTeal/50
                        ${header.column.getCanSort() ? "cursor-pointer select-none hover:text-brand-darkTeal transition-colors" : ""}
                      `}
                    >
                      <span className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" && <span className="text-brand-activeTeal">▲</span>}
                        {header.column.getIsSorted() === "desc" && <span className="text-brand-activeTeal">▼</span>}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-brand-sageBorder/10">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="animate-spin h-7 w-7 text-brand-activeTeal" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      <p className="text-sm text-brand-darkTeal/40 font-semibold">Loading beneficiaries…</p>
                    </div>
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center">
                    <p className="text-sm text-brand-darkTeal/40 font-semibold">
                      {globalFilter ? `No results for "${globalFilter}"` : "No beneficiaries registered yet."}
                    </p>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-brand-peachBg/20 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-5 py-3.5 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Dot-indicator pagination — matching mock 6.png ── */}
        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-3 py-5 border-t border-brand-sageBorder/10">
            {/* Prev arrow */}
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="w-8 h-8 rounded-full border border-brand-sageBorder/40 flex items-center justify-center text-brand-darkTeal/50 hover:text-brand-darkTeal hover:bg-brand-peachBg transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Previous page"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Page dots */}
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                onClick={() => table.setPageIndex(i)}
                className={`
                  rounded-full transition-all duration-200 cursor-pointer
                  ${i === pageIndex
                    ? "w-4 h-4 bg-brand-darkTeal"
                    : "w-2.5 h-2.5 bg-brand-sageBorder/50 hover:bg-brand-sageBorder"
                  }
                `}
                aria-label={`Go to page ${i + 1}`}
              />
            ))}

            {/* Next arrow */}
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="w-8 h-8 rounded-full border border-brand-sageBorder/40 flex items-center justify-center text-brand-darkTeal/50 hover:text-brand-darkTeal hover:bg-brand-peachBg transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Next page"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      </div>

      {/* ── Modals (rendered outside animation wrapper to avoid stacking context trap) ── */}
      <AddCreditsModal
        open={creditsModal.open}
        onClose={() => setCreditsModal((s) => ({ ...s, open: false }))}
        beneficiaryId={creditsModal.beneficiaryId}
        beneficiaryName={creditsModal.beneficiaryName}
        onSuccess={fetchAll}
      />
      <QrPassModal
        open={qrModal.open}
        onClose={() => setQrModal((s) => ({ ...s, open: false }))}
        data={qrModal.data}
      />
    </>
  );
}

/* ── Metric Card sub-component ── */
function MetricCard({
  label,
  value,
  subtext,
  subtextColor = "text-brand-darkTeal/40",
  icon,
  valueColor = "text-brand-darkTeal",
  valueLarge = false,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  subtextColor?: string;
  icon?: React.ReactNode;
  valueColor?: string;
  valueLarge?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-brand-sageBorder/30 px-5 py-4 shadow-sm flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <p className="text-[9px] font-bold uppercase tracking-widest text-brand-darkTeal/40 leading-tight">
          {label}
        </p>
        {icon}
      </div>
      <p className={`font-black leading-tight ${valueColor} ${valueLarge ? "text-2xl" : "text-3xl"}`}>
        {value}
      </p>
      {subtext && (
        <p className={`text-[10px] font-semibold leading-tight ${subtextColor}`}>
          {subtext}
        </p>
      )}
    </div>
  );
}

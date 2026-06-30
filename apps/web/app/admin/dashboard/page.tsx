"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, SectionHeading, Badge } from "@/components/ui";
import { MerchantConfirmationModal } from "@/components/admin/or-modal";

/* ───────────────────────────────────────────
   Slide 2 — LGU Hub Onboarding Dashboard
   Two primary action panels: Beneficiary + Merchant
   ─────────────────────────────────────────── */

interface BeneficiaryForm {
  motherName: string;
  childName: string;
  childAge: string;
  height: string;
  weight: string;
  barangay: string;
}

interface MerchantForm {
  businessName: string;
  ownerName: string;
  contact: string;
  barangay: string;
  address: string;
}

const initialBeneficiary: BeneficiaryForm = {
  motherName: "",
  childName: "",
  childAge: "",
  height: "",
  weight: "",
  barangay: "",
};

const initialMerchant: MerchantForm = {
  businessName: "",
  ownerName: "",
  contact: "",
  barangay: "",
  address: "",
};

export default function AdminDashboard() {
  const router = useRouter();
  const [beneficiary, setBeneficiary] = useState<BeneficiaryForm>(initialBeneficiary);
  const [merchant, setMerchant] = useState<MerchantForm>(initialMerchant);
  const [beneficiaryLoading, setBeneficiaryLoading] = useState(false);
  const [merchantLoading, setMerchantLoading] = useState(false);
  const [showMerchantModal, setShowMerchantModal] = useState(false);

  /* ── Beneficiary Submit ── */
  const handleBeneficiarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBeneficiaryLoading(true);
    // Simulate processing delay
    await new Promise((r) => setTimeout(r, 1000));
    setBeneficiaryLoading(false);
    // Route to registry page
    router.push("/admin/registry");
  };

  /* ── Merchant Submit ── */
  const handleMerchantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMerchantLoading(true);
    // Simulate onboarding delay
    await new Promise((r) => setTimeout(r, 1200));
    setMerchantLoading(false);
    // Show confirmation overlay
    setShowMerchantModal(true);
  };

  const updateBeneficiary = (field: keyof BeneficiaryForm, value: string) => {
    setBeneficiary((prev) => ({ ...prev, [field]: value }));
  };

  const updateMerchant = (field: keyof MerchantForm, value: string) => {
    setMerchant((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-8 stagger-children">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <SectionHeading
            title="LGU Onboarding Hub"
            subtitle="Register new beneficiaries and onboard local micro-merchants"
          />
        </div>
        <Badge variant="info" className="hidden sm:flex">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Session Active
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ═══ BENEFICIARY PANEL ═══ */}
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center text-[var(--color-primary-500)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                Beneficiary Registry
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Mother-child stunting tracking
              </p>
            </div>
          </div>

          <form onSubmit={handleBeneficiarySubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Mother's Full Name"
                placeholder="e.g. Maria Santos"
                value={beneficiary.motherName}
                onChange={(e) => updateBeneficiary("motherName", e.target.value)}
                required
              />
              <Input
                label="Child's Full Name"
                placeholder="e.g. Jose Santos"
                value={beneficiary.childName}
                onChange={(e) => updateBeneficiary("childName", e.target.value)}
                required
              />
              <Input
                label="Child Age (months)"
                type="number"
                placeholder="e.g. 24"
                value={beneficiary.childAge}
                onChange={(e) => updateBeneficiary("childAge", e.target.value)}
                required
              />
              <Input
                label="Barangay"
                placeholder="e.g. Barangay 1"
                value={beneficiary.barangay}
                onChange={(e) => updateBeneficiary("barangay", e.target.value)}
                required
              />
              <Input
                label="Height (cm)"
                type="number"
                step="0.1"
                placeholder="e.g. 85.5"
                value={beneficiary.height}
                onChange={(e) => updateBeneficiary("height", e.target.value)}
                required
              />
              <Input
                label="Weight (kg)"
                type="number"
                step="0.1"
                placeholder="e.g. 11.2"
                value={beneficiary.weight}
                onChange={(e) => updateBeneficiary("weight", e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              loading={beneficiaryLoading}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              }
            >
              + Onboard and generate QR ID card
            </Button>
          </form>
        </Card>

        {/* ═══ MERCHANT PANEL ═══ */}
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-light)] flex items-center justify-center text-[var(--color-accent-hover)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                Merchant Onboarding
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Register local sari-sari store partners
              </p>
            </div>
            <div className="ml-auto">
              <Badge variant="coral">AI Verify</Badge>
            </div>
          </div>

          <form onSubmit={handleMerchantSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Business Name"
                placeholder="e.g. Maria's Sari-Sari Store"
                value={merchant.businessName}
                onChange={(e) => updateMerchant("businessName", e.target.value)}
                required
              />
              <Input
                label="Owner's Name"
                placeholder="e.g. Juan Dela Cruz"
                value={merchant.ownerName}
                onChange={(e) => updateMerchant("ownerName", e.target.value)}
                required
              />
              <Input
                label="Contact Number"
                type="tel"
                placeholder="e.g. 0917xxxxxxx"
                value={merchant.contact}
                onChange={(e) => updateMerchant("contact", e.target.value)}
                required
              />
              <Input
                label="Barangay"
                placeholder="e.g. Barangay 3"
                value={merchant.barangay}
                onChange={(e) => updateMerchant("barangay", e.target.value)}
                required
              />
              <div className="sm:col-span-2">
                <Input
                  label="Store Address"
                  placeholder="e.g. 123 Rizal Street, Barangay 3"
                  value={merchant.address}
                  onChange={(e) => updateMerchant("address", e.target.value)}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="coral"
              size="lg"
              className="w-full mt-2"
              loading={merchantLoading}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              }
            >
              + Onboard Merchant
            </Button>
          </form>
        </Card>
      </div>

      {/* ═══ MERCHANT CONFIRMATION MODAL (Slide 4) ═══ */}
      <MerchantConfirmationModal
        open={showMerchantModal}
        onClose={() => setShowMerchantModal(false)}
        merchantName={merchant.businessName || "the merchant"}
        ownerName={merchant.ownerName || "the owner"}
        barangay={merchant.barangay || "the barangay"}
      />
    </div>
  );
}

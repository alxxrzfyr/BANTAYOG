"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/stores/auth-context";

const portalTabs = [
  { id: "lgu", label: "LGU Portal" },
  { id: "merchant", label: "Merchant Portal" },
];

export default function AuthPage() {
  const router = useRouter();
  const { state, setPortal, setWalletConnected, setUsername, authenticate } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  /* ── Wallet Connect ── */
  const handleConnectWallet = async () => {
    setWalletLoading(true);
    // Simulate wallet connection delay
    await new Promise((r) => setTimeout(r, 1200));
    setWalletConnected(true);
    setWalletLoading(false);
  };

  /* ── Authenticate ── */
  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!email.trim()) {
      setEmailError("Username or email is required");
      return;
    }
    setEmailError("");

    setAuthLoading(true);
    await new Promise((r) => setTimeout(r, 800));

    setUsername(email.trim());
    authenticate();

    // Route based on portal
    if (state.portal === "lgu") {
      router.push("/admin/dashboard");
    }
    // Merchant stays on page with "loading" state handled by context
    setAuthLoading(false);
  };

  /* ── Portal Tab Change ── */
  const handleTabChange = (tabId: string) => {
    setPortal(tabId as "lgu" | "merchant");
    setEmailError("");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#ffbeb3]">
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 lg:p-20">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        {/* ═══════ LEFT SIDE — Branding ═══════ */}
        <div className="animate-fade-in space-y-8 lg:col-span-7 order-2 lg:order-1">
          {/* DOH Pill Badge */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-brand-sageBorder bg-white/20 backdrop-blur-sm shadow-sm">
              <svg className="w-4 h-4 text-brand-activeTeal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span className="font-body text-xs font-bold text-brand-activeTeal tracking-wider uppercase">
                DOH SUPPORTED SOCIAL INITIATIVE
              </span>
            </div>
          </div>

          {/* Brand Title & Subtitle */}
          <div className="space-y-4">
            <h1 className="font-title text-5xl md:text-7xl font-extrabold tracking-tight text-brand-darkTeal">
              BANTAYOG
            </h1>
            {/* Descriptive Paragraph */}
            <p className="font-body text-base md:text-lg text-brand-darkTeal font-medium leading-relaxed max-w-2xl">
              Breaking the cycle of childhood stunting at the grassroots level. Bantayog leverages smart digital cards and automated AI receipt tracking to ensure that community health subsidies are spent exclusively on nutrient-dense foods—safeguarding a child's critical early development while instantly settling balances with local micro-merchants.
            </p>
          </div>

          {/* Feature Badges — side-by-side white containers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* LGU Beneficiary Registry */}
            <div className="flex items-start gap-4 p-6 rounded-3xl bg-white border border-brand-sageBorder/40 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_12px_40px_rgb(0,0,0,0.05)] hover:-translate-y-0.5">
              <div className="w-12 h-12 rounded-2xl bg-[#e3f0f2] flex items-center justify-center text-[#0a7b83] flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="font-body font-bold text-brand-darkTeal text-sm">LGU Beneficiary Registry</h3>
                <p className="font-body text-brand-darkTeal/75 text-xs leading-relaxed">
                  Onboard mother-child units, track stunting metrics, and issue unique secure QR passes.
                </p>
              </div>
            </div>

            {/* AI Merchant Verification */}
            <div className="flex items-start gap-4 p-6 rounded-3xl bg-white border border-brand-sageBorder/40 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_12px_40px_rgb(0,0,0,0.05)] hover:-translate-y-0.5">
              <div className="w-12 h-12 rounded-2xl bg-[#fbe9e8] flex items-center justify-center text-[#c27668] flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="font-body font-bold text-brand-darkTeal text-sm">AI Merchant Verification</h3>
                <p className="font-body text-brand-darkTeal/75 text-xs leading-relaxed">
                  Merchants scan QR cards, capture checkout photos, and filters nutritional products instantly.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ RIGHT SIDE — Portal Gateway Card ═══════ */}
        <div className="animate-slide-up lg:col-span-5 order-1 lg:order-2">
          <div className="w-full max-w-md mx-auto bg-white rounded-[2.5rem] p-8 md:p-10 shadow-[0_20px_50px_rgba(3,76,82,0.12)] border border-brand-sageBorder/20">
            {/* Header Titles */}
            <div className="text-center mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-brand-darkTeal font-body tracking-tight">
                Gateway Portal Access
              </h2>
              <p className="text-sm text-brand-mutedGray font-body mt-1">
                Select your portal pathway and authenticate
              </p>
            </div>

            {/* Tab Switcher — capsule with activeTeal active state */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex w-full bg-[#f4e2de]/70 rounded-2xl p-1 gap-1" role="tablist">
                {portalTabs.map((tab) => {
                  const isActive = state.portal === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={isActive}
                      className={`
                        flex-1 flex items-center justify-center py-3 text-xs md:text-sm font-bold rounded-xl transition-all duration-300 cursor-pointer font-body
                        ${
                          isActive
                            ? "bg-brand-activeTeal text-white shadow-md"
                            : "bg-transparent text-brand-darkTeal hover:text-brand-activeTeal"
                        }
                      `}
                      onClick={() => handleTabChange(tab.id)}
                    >
                      {tab.id === "lgu" ? (
                        <svg className="w-4 h-4 mr-2 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                          <path d="M9 22v-4h6v4" />
                          <path d="M8 6h2" />
                          <path d="M14 6h2" />
                          <path d="M8 10h2" />
                          <path d="M14 10h2" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 mr-2 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                          <line x1="3" y1="6" x2="21" y2="6" />
                          <path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                      )}
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Merchant Loading State */}
            {state.status === "loading-merchant" ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-sageBg/50 flex items-center justify-center animate-pulse-soft">
                  <svg
                    className="w-8 h-8 text-brand-activeTeal animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-brand-darkTeal font-body">
                  Loading Merchant Portal...
                </h3>
                <p className="text-sm text-brand-darkTeal/60 font-body">
                  Awaiting Co-worker Frontend
                </p>
                <button
                  type="button"
                  onClick={() => setPortal("lgu")}
                  className="mt-4 text-sm font-semibold text-brand-activeTeal hover:text-brand-darkTeal underline cursor-pointer"
                >
                  ← Back to portal selection
                </button>
              </div>
            ) : (
              <form onSubmit={handleAuthenticate} className="space-y-6">
                {/* ── Ronin Blockchain Auth Panel ── */}
                <div className="p-4 rounded-2xl bg-brand-sageBg/10 border border-brand-sageBorder/80">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-brand-darkTeal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
                        <line x1="2" y1="10" x2="22" y2="10" />
                      </svg>
                      <span className="text-xs font-bold text-brand-darkTeal font-body uppercase tracking-wider">
                        Ronin Blockchain Auth
                      </span>
                    </div>
                    <span className="bg-[#d1e7dd] text-[#0f5132] border border-[#a3cfbb] text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      STABLE COIN READY
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={state.walletConnected || walletLoading}
                    onClick={handleConnectWallet}
                    className={`
                      w-full py-3 px-4 rounded-xl font-body font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 border
                      ${
                        state.walletConnected
                          ? "bg-transparent border-[#a3cfbb] text-[#0f5132] bg-[#d1e7dd]/20"
                          : "bg-brand-darkTeal border-brand-darkTeal text-white hover:bg-brand-activeTeal hover:border-brand-activeTeal active:scale-[0.98]"
                      }
                      disabled:opacity-80 disabled:cursor-not-allowed
                    `}
                  >
                    {walletLoading ? (
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    ) : state.walletConnected ? (
                      <>
                        <svg className="w-4 h-4 text-[#0f5132]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Ronin Wallet Connected
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 text-brand-coral" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L2 12l10 10 10-10L12 2z" />
                        </svg>
                        Connect Ronin Wallet
                      </>
                    )}
                  </button>

                  {state.walletConnected && (
                    <p className="text-xs text-center mt-2 text-[#0f5132] font-semibold font-body animate-fade-in">
                      0x7b...3f2a · PHPC Balance: 1,250.00
                    </p>
                  )}
                </div>

                {/* ── Divider ── */}
                <div className="divider-text text-[10px] tracking-wider uppercase font-semibold text-brand-mutedGray">
                  OR SIGN IN WITH CREDENTIALS
                </div>

                {/* ── Web2 Auth Block ── */}
                <div className="space-y-4">
                  {/* Email/Username Input */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-brand-darkTeal tracking-wider uppercase mb-1.5 font-body">
                      Username / Email ID
                    </label>
                    <input
                      type="text"
                      placeholder="paangmanok@metromanilacity.gov.ph"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError("");
                      }}
                      className={`w-full px-4 py-3 rounded-2xl border ${
                        emailError ? "border-red-500 ring-1 ring-red-500" : "border-brand-sageBorder"
                      } focus:border-brand-activeTeal focus:ring-1 focus:ring-brand-activeTeal outline-none font-body text-sm text-brand-darkTeal placeholder-brand-mutedGray/50 bg-white transition-all`}
                    />
                    {emailError && (
                      <p className="text-xs text-red-500 font-semibold mt-1 font-body">{emailError}</p>
                    )}
                  </div>

                  {/* Password Input */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-brand-darkTeal tracking-wider uppercase mb-1.5 font-body">
                      Password
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-brand-sageBorder focus:border-brand-activeTeal focus:ring-1 focus:ring-brand-activeTeal outline-none font-body text-sm text-brand-darkTeal placeholder-brand-mutedGray/50 bg-white transition-all"
                    />
                  </div>
                </div>

                {/* ── Hero CTA Button ── */}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-brand-coral hover:bg-brand-coralHover text-white font-bold font-body py-4 px-6 rounded-2xl transition-colors duration-200 uppercase text-xs tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {authLoading ? (
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  ) : (
                    <>
                      <span>Authenticate and Enter</span>
                      <svg className="w-3.5 h-3.5 stroke-[3.5] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </>
                  )}
                </button>

                {/* Portal-specific hint */}
                <p className="text-xs text-center text-brand-mutedGray font-body leading-relaxed px-2">
                  {state.portal === "lgu"
                    ? "Authorized LGU personnel only. Secure access to beneficiary and merchant management."
                    : "Merchant partner portal for transaction history and verification status."}
                </p>
              </form>
            )}
          </div>
        </div>
        </div>
      </div>
      {/* Bottom Cream Footer Band */}
      <div className="h-[12vh] min-h-[80px] bg-[#fde2dc] w-full flex-shrink-0" />
    </div>
  );
}

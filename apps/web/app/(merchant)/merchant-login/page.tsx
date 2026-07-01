"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Inline validation schema (zod not available in web app dependencies)
// ---------------------------------------------------------------------------

interface LoginForm {
  ownerName: string;
  password: string;
}

interface FormErrors {
  ownerName?: string;
  password?: string;
}

function validate(form: LoginForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.ownerName.trim()) {
    errors.ownerName = "Owner name is required";
  }
  if (!form.password) {
    errors.password = "Password is required";
  } else if (form.password.length < 1) {
    errors.password = "Password cannot be empty";
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Merchant Login Page — matches merchantPages/12.png
// ---------------------------------------------------------------------------

export default function MerchantLoginPage() {
  const router = useRouter();

  const [form, setForm] = useState<LoginForm>({ ownerName: "", password: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  // Two distinct error branches per spec
  const [credentialError, setCredentialError] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  const updateField = (field: keyof LoginForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    // Clear server errors on any input change
    setCredentialError(false);
    setNetworkError(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Client-side validation
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setCredentialError(false);
    setNetworkError(false);

    try {
      const res = await fetch("/api/auth/merchant-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: form.ownerName.trim(),
          password: form.password,
        }),
      });

      if (res.ok) {
        // Successful login — redirect to dashboard
        router.push("/dashboard");
        return;
      }

      if (res.status === 401 || res.status === 403) {
        setCredentialError(true);
      } else {
        setNetworkError(true);
      }
    } catch {
      // Network failure or server unreachable
      setNetworkError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-start bg-[#034C52] px-6 pt-16 pb-12">
      {/* ── Logo ── */}
      <div className="mb-6 w-full max-w-[280px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/merchantLogos/whiteTitle.png"
          alt="BANTAYOG"
          className="h-auto w-full"
        />
      </div>

      {/* ── Welcome Text ── */}
      <h1 className="mb-2 text-center font-body text-3xl font-bold text-[#a8e6cf]">
        Welcome Back!
      </h1>
      <p className="mb-10 text-center font-body text-sm text-[#7cc9a8]">
        Log in to continue your wellness journey.
      </p>

      {/* ── Login Form ── */}
      <form onSubmit={handleSubmit} className="w-full max-w-[340px] space-y-6">
        {/* Owner Name Field */}
        <div className="relative rounded-xl border border-[#5ba89d] bg-transparent">
          <label
            htmlFor="ownerName"
            className="absolute -top-2.5 left-3 bg-[#034C52] px-1 font-body text-xs text-[#a8e6cf]"
          >
            Name of Owner
          </label>
          <div className="flex items-center gap-3 px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/merchantLogos/profile.png"
              alt=""
              className="h-7 w-7 flex-shrink-0 opacity-70"
            />
            <input
              id="ownerName"
              type="text"
              placeholder="Enter the name of the owner"
              value={form.ownerName}
              onChange={(e) => updateField("ownerName", e.target.value)}
              className="w-full bg-transparent font-body text-sm text-white placeholder-[#7cc9a8]/60 outline-none"
              autoComplete="username"
              disabled={loading}
            />
          </div>
        </div>
        {errors.ownerName && (
          <p className="font-body text-xs text-red-400">{errors.ownerName}</p>
        )}

        {/* Password Field */}
        <div className="relative rounded-xl border border-[#5ba89d] bg-transparent">
          <label
            htmlFor="password"
            className="absolute -top-2.5 left-3 bg-[#034C52] px-1 font-body text-xs text-[#a8e6cf]"
          >
            Password
          </label>
          <div className="flex items-center gap-3 px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/merchantLogos/lock.png"
              alt=""
              className="h-7 w-7 flex-shrink-0 opacity-70"
            />
            <input
              id="password"
              type="password"
              placeholder="Enter the password"
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
              className="w-full bg-transparent font-body text-sm text-white placeholder-[#7cc9a8]/60 outline-none"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
        </div>
        {errors.password && (
          <p className="font-body text-xs text-red-400">{errors.password}</p>
        )}

        {/* ── Error Messages ── */}
        {credentialError && (
          <div className="rounded-lg bg-red-500/10 px-4 py-3 text-center">
            <p className="font-body text-sm text-red-300">
              Invalid owner name or password. Please try again.
            </p>
          </div>
        )}

        {networkError && (
          <div className="rounded-lg bg-orange-500/10 px-4 py-3 text-center">
            <p className="font-body text-sm text-orange-300">
              Unable to connect. Please check your network and try again.
            </p>
          </div>
        )}

        {/* ── Login Button ── */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-[#f48d79] py-4 font-body text-sm font-bold uppercase tracking-wider text-[#034C52] transition-colors hover:bg-[#f9a899] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
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
              Signing in...
            </span>
          ) : (
            "Get Started"
          )}
        </button>
      </form>
    </div>
  );
}

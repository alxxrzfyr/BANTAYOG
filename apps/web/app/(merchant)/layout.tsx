"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useMerchantProfile } from "@/hooks/use-merchant-profile";
import { MERCHANT_TOKEN_KEY } from "@/lib/api";

export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/merchant-login";

  // Fetch profile. React Query will only perform the query if enabled is true.
  // We disable query on login page to avoid infinite redirect loop.
  const { data: profile, isError } = useMerchantProfile();

  useEffect(() => {
    if (isLoginPage) return;

    if (isError) {
      // Clear token and kick out
      window.localStorage.removeItem(MERCHANT_TOKEN_KEY);
      window.localStorage.removeItem(MERCHANT_TOKEN_KEY + "_expires");
      router.push("/merchant-login");
    }
  }, [isError, isLoginPage, router]);

  useEffect(() => {
    if (isLoginPage) return;

    if (profile && profile.status === "SUSPENDED") {
      // Clear token and kick out
      window.localStorage.removeItem(MERCHANT_TOKEN_KEY);
      window.localStorage.removeItem(MERCHANT_TOKEN_KEY + "_expires");
      router.push("/merchant-login");
    }
  }, [profile, isLoginPage, router]);

  return (
    <div className="min-h-dvh">
      <main>{children}</main>
    </div>
  );
}

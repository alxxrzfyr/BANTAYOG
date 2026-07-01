import { redirect } from "next/navigation";

/* ───────────────────────────────────────────
   /admin/login — Legacy route.
   Redirects to the single canonical login page at /login.
   ─────────────────────────────────────────── */
export default function AdminLoginPage() {
  redirect("/login");
}

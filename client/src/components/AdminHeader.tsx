import { MSAPLogo } from "@/components/MSAPLogo";
import { Link } from "wouter";

/**
 * Branded top bar for the admin/tracker pages. Mirrors the landing page
 * header so internal pages carry the same proportional, centered brand
 * treatment. The logo is sized via the container (w-36/w-40) and the
 * MSAPLogo component constrains the image with object-contain. The logo
 * links back to the admin dashboard.
 */
export function AdminHeader() {
  return (
    <header className="mb-4 flex items-center justify-between rounded-2xl border border-[#D9E4E1] bg-white/85 px-4 py-3 shadow-[0_16px_40px_-32px_rgba(27,53,94,.45)] backdrop-blur-sm sm:px-6">
      <Link
        href="/admin/dashboard"
        aria-label="Back to admin dashboard"
        className="flex min-w-0 items-center gap-3 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#138A73]"
      >
        <MSAPLogo variant="horizontal-compact" tone="brand" className="w-36 sm:w-40" />
        <span className="hidden rounded-full bg-[#1B355E] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white sm:inline-block">
          Admin Console
        </span>
      </Link>
      <nav className="flex items-center gap-2">
        <Link
          href="/admin/cards"
          className="rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#106E5B] transition-colors hover:bg-[#E7F4F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#138A73]"
        >
          Card Queue
        </Link>
        <span className="text-xs font-semibold uppercase tracking-wider text-[#8A9BAE]">
          Restricted
        </span>
      </nav>
    </header>
  );
}

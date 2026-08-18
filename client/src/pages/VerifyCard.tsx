import { trpc } from "@/lib/trpc";
import { MSAPLogo } from "@/components/MSAPLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { useSearch } from "wouter";

/**
 * Public card verification (the URL encoded in the card's QR code).
 * The server recomputes the HMAC over (membershipId|version|issuedAt) so only
 * genuinely issued cards verify — a forged QR cannot.
 */
export default function VerifyCard() {
  const params = new URLSearchParams(useSearch());
  const membershipId = params.get("m") || "";
  const token = params.get("t") || "";

  const verification = trpc.card.verify.useQuery(
    { membershipId, token },
    { retry: false, enabled: Boolean(membershipId && token) }
  );

  if (!membershipId || !token) {
    return (
      <Shell>
        <ResultIcon tone="error">
          <ShieldX className="h-10 w-10" />
        </ResultIcon>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-[#1B355E]">Missing data</h1>
        <p className="mt-2 text-sm text-[#5D7086]">
          This link is incomplete. Scan the full QR code on the card.
        </p>
      </Shell>
    );
  }

  if (verification.isLoading) {
    return (
      <Shell>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E7F4F0]">
          <Loader2 className="h-8 w-8 animate-spin text-[#106E5B]" />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-[#1B355E]">
          Verifying card…
        </h1>
      </Shell>
    );
  }

  const data = verification.data;
  const okData = data && data.valid === true ? data : null;
  const ok = Boolean(okData);

  return (
    <Shell>
      <ResultIcon tone={ok ? "ok" : "error"}>
        {ok ? <CheckCircle2 className="h-10 w-10" /> : <ShieldX className="h-10 w-10" />}
      </ResultIcon>

      <Badge
        className={`mt-5 border px-3 py-1 text-xs ${
          ok
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700"
        }`}
      >
        {ok ? "AUTHENTIC CARD" : "VERIFICATION FAILED"}
      </Badge>

      <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[#1B355E]">
        {ok ? "This membership card is genuine" : "This card could not be verified"}
      </h1>

      <div className="mt-5 w-full max-w-sm space-y-3 rounded-2xl border border-[#D9E4E1] bg-white p-5 text-left text-sm">
        <Row label="Membership ID" value={okData?.memberId ?? membershipId} mono />
        {okData && (
          <>
            <Row label="Holder" value={okData.name || "—"} />
            <Row
              label="Issued"
              value={
                okData.issuedAt
                  ? new Date(okData.issuedAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"
              }
            />
            <Row
              label="Expires"
              value={
                okData.expiresAt
                  ? new Date(okData.expiresAt).toLocaleDateString("en-GB", {
                      month: "short",
                      year: "numeric",
                    })
                  : "—"
              }
            />
            <Row label="Revision" value={String(okData.version ?? "")} />
          </>
        )}
      </div>

      {!ok && (
        <p className="mt-4 max-w-sm text-xs leading-5 text-[#66788D]">
          The token in this QR does not match an issued card. It may be a copy, expired, or the card
          was re-issued (old QRs stop verifying). Ask the holder to open their portal card.
        </p>
      )}

      <div className="mt-6">
        <a href="/" className="inline-block">
          <Button variant="outline" className="border-[#B9CBC6] text-[#1B355E]">
            Back to MSAP portal
          </Button>
        </a>
      </div>
    </Shell>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs uppercase tracking-wide text-[#8A9BAE]">{label}</span>
      <span
        className={`truncate font-semibold text-[#1B355E] ${
          mono ? "font-mono text-[13px]" : "text-sm"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ResultIcon({ tone, children }: { tone: "ok" | "error"; children: React.ReactNode }) {
  return (
    <div
      className={`flex h-20 w-20 items-center justify-center rounded-full border ${
        tone === "ok"
          ? "border-emerald-200 bg-emerald-50 text-emerald-600"
          : "border-red-200 bg-red-50 text-red-500"
      }`}
    >
      {children}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="msap-page min-h-screen flex items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="mb-8">
          <MSAPLogo variant="horizontal-expanded" className="mx-auto w-44" />
        </div>
        <div className="w-full rounded-[2rem] border border-[#D9E4E1] bg-white px-6 py-10 shadow-[0_30px_90px_-48px_rgba(27,53,94,.42)] sm:px-10">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-[#66788D]">
          Medical Students' Association of Pakistan · <ShieldCheck className="inline h-3 w-3" />{" "}
          Official card verification
        </p>
      </div>
    </div>
  );
}

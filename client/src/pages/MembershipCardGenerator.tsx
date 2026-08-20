import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import SignatureEditor from "@/components/SignatureEditor";
import { QRCodeCanvas } from "qrcode.react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileDown,
  IdCard,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  PenLine,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { toast } from "sonner";
import {
  MembershipCardFront,
  MembershipCardBack,
  formatDate,
  type CardData,
} from "@/components/MembershipCard";

function triggerPngDownload(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = filename;
  link.click();
}

export default function MembershipCardGenerator() {
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [editingSignature, setEditingSignature] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeFace, setActiveFace] = useState<"front" | "back">("front");
  const [presSigFailed, setPresSigFailed] = useState(false);

  const cardQuery = trpc.member.card.get.useQuery(undefined, { retry: false });
  const submitSignature = trpc.member.card.submitSignature.useMutation({
    onSuccess: () => {
      toast.success("Signature submitted — awaiting National Office approval.");
      setEditingSignature(false);
      cardQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const requestReissue = trpc.member.card.requestReissue.useMutation({
    onSuccess: () => {
      toast.success("Re-issuance requested — awaiting National Office approval.");
      cardQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const card: CardData | undefined = cardQuery.data ?? undefined;
  const sig = card?.holderSignature;

  const verifyUrl = card?.verificationToken
    ? `${window.location.origin}/verify?m=${encodeURIComponent(card.membershipId)}&t=${encodeURIComponent(card.verificationToken)}`
    : "";

  const downloadBoth = async () => {
    if (!frontRef.current || !backRef.current || !card) return;
    setDownloading(true);
    try {
      // Render both canvases first, then trigger both downloads back-to-back
      // so the browser treats them as one gesture (never loses the second).
      const CARD_W = 340;
      const CARD_H = 214;
      const [front, back] = await Promise.allSettled([
        import("html2canvas").then((m) =>
          m.default(frontRef.current as HTMLElement, {
            backgroundColor: null,
            scale: 3,
            useCORS: true,
            width: CARD_W,
            height: CARD_H,
            windowWidth: CARD_W,
            windowHeight: CARD_H,
          })
        ),
        import("html2canvas").then((m) =>
          m.default(backRef.current as HTMLElement, {
            backgroundColor: null,
            scale: 3,
            useCORS: true,
            width: CARD_W,
            height: CARD_H,
            windowWidth: CARD_W,
            windowHeight: CARD_H,
          })
        ),
      ]);
      if (front.status === "fulfilled") {
        triggerPngDownload(front.value, `MSAP-Card-FRONT-${card.membershipId || "member"}.png`);
      }
      if (back.status === "fulfilled") {
        triggerPngDownload(back.value, `MSAP-Card-BACK-${card.membershipId || "member"}.png`);
      }
      if (front.status === "fulfilled" || back.status === "fulfilled") {
        toast.success("Front & back downloaded — print at 100% (85.6 × 54 mm, 300 DPI).");
      } else {
        toast.error("Failed to download the card. Please try again.");
      }
    } catch {
      toast.error("Failed to download the card. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  if (cardQuery.isLoading) {
    return (
      <div className="msap-page min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#138A73]" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="msap-page min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-4xl">
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertDescription className="text-sm text-red-700">
              Your card could not be loaded. Please try again later.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="msap-page min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">
            Digital credentials
          </p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E] sm:text-4xl">
            National Membership Card
          </h1>
          <p className="mt-2 max-w-2xl text-[#66788D]">
            Your official card renders only <span className="font-semibold text-[#1B355E]">approved data</span> —
            identity fields come from the membership registry and every card change is issued by the
            National Office. The premium two-sided design is print-ready at CR80 size.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* ===== Left: status, signature, download ===== */}
          <div className="space-y-6 lg:col-span-1">
            {/* Card status */}
            <Card className="msap-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#1B355E]">
                  <IdCard className="h-5 w-5 text-[#138A73]" /> Card Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#5D7086]">Issuance</span>
                  {card.issued ? (
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Issued · Rev {card.version}
                    </Badge>
                  ) : (
                    <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                      <Clock className="mr-1 h-3 w-3" /> Pending issuance
                    </Badge>
                  )}
                </div>
                {card.issued && card.dataChangedSinceIssuance && (
                  <Alert
                    variant={card.reissueRequested ? "default" : "destructive"}
                    className={card.reissueRequested ? "border-amber-200 bg-amber-50" : "border-amber-300 bg-amber-50"}
                  >
                    <AlertDescription className="text-xs text-amber-800">
                      <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                      {card.reissueRequested
                        ? "Re-issuance requested — awaiting National Office approval. The card still shows the previously approved data."
                        : "Your membership data has changed since this card was issued. The card keeps showing the approved version until the National Office approves a re-issue."}
                    </AlertDescription>
                  </Alert>
                )}
                {card.issued && card.dataChangedSinceIssuance && !card.reissueRequested && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={requestReissue.isPending}
                    onClick={() => requestReissue.mutate()}
                    className="h-9 w-full border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  >
                    {requestReissue.isPending ? "Requesting…" : "Request re-issuance (National Office approval)"}
                  </Button>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#8A9BAE]">Issued</p>
                    <p className="font-semibold text-[#1B355E]">{formatDate(card.issuedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#8A9BAE]">Expires</p>
                    <p className="font-semibold text-[#1B355E]">
                      {formatDate(card.expiresAt, { month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-[#D9E4E1] bg-[#F6F9F8] p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#1B355E]">
                    Verification QR
                  </p>
                  {verifyUrl ? (
                    <div className="mt-3 flex items-center gap-4">
                      <div className="rounded-lg border border-[#D9E4E1] bg-white p-1.5 shadow-sm">
                        <QRCodeCanvas value={verifyUrl} size={76} level="M" bgColor="#ffffff" fgColor="#1B355E" />
                      </div>
                      <div className="text-xs leading-5 text-[#5D7086]">
                        <p>Encrypted with a National-Office HMAC. Anyone can scan to confirm this card
                          is authentic and currently issued.</p>
                        <a
                          href={verifyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block font-semibold text-[#106E5B] hover:text-[#0B4E40]"
                        >
                          Open verification page →
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs leading-5 text-[#5D7086]">
                      The QR appears once the National Office approves and issues your card.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    onClick={downloadBoth}
                    disabled={downloading}
                    className="msap-primary-action h-12 w-full text-white disabled:opacity-60"
                  >
                    {downloading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Download Front &amp; Back
                  </Button>
                  <a
                    href="/api/card-pdf"
                    className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-[#1B355E] bg-white text-sm font-semibold text-[#1B355E] shadow-sm transition-all hover:bg-[#F0F5F3] hover:shadow-md"
                    title="Print-ready PDF generated server-side"
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    PDF (Print)
                  </a>
                </div>
                <p className="text-[11px] leading-5 text-[#8A9BAE]">
                  PNGs export at exactly 300 DPI for the CR80 card (85.6 × 54 mm) — both sides print at
                  100% with bleed-safe margins designed in.
                </p>
              </CardContent>
            </Card>

            {/* Holder signature */}
            <Card className="msap-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#1B355E]">
                  <PenLine className="h-5 w-5 text-[#138A73]" /> Signature of Holder
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sig?.status === "approved" && sig.dataUrl ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl border border-[#BBD8CF] bg-[#E7F4F0] p-3">
                      <span className="text-xs font-semibold text-[#0B4E40]">
                        <ShieldCheck className="mr-1 inline h-3.5 w-3.5" /> Approved by National Office
                      </span>
                      <span className="text-[10px] text-[#5D7086]">
                        {formatDate(sig.reviewedAt)}
                      </span>
                    </div>
                    <div className="flex h-20 items-center justify-center rounded-xl border border-[#D9E4E1] bg-white">
                      <img
                        src={sig.dataUrl}
                        alt="Approved signature"
                        className="max-h-16 max-w-[80%] object-contain"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingSignature(true)}
                      className="h-9 w-full border-[#B9CBC6] text-[#1B355E]"
                    >
                      Replace signature (re-enters approval)
                    </Button>
                  </div>
                ) : sig?.status === "pending" ? (
                  <div className="space-y-3">
                    <Alert className="border-amber-200 bg-amber-50">
                      <AlertDescription className="text-xs text-amber-800">
                        <Clock className="mr-1 inline h-3.5 w-3.5" />
                        Submitted — awaiting National Office approval. The card will be re-issued
                        once approved.
                      </AlertDescription>
                    </Alert>
                    <div className="flex h-20 items-center justify-center rounded-xl border border-[#D9E4E1] bg-white">
                      {sig.dataUrl ? (
                        <img src={sig.dataUrl} alt="Pending signature" className="max-h-16 max-w-[80%] object-contain opacity-70" />
                      ) : null}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingSignature(true)}
                      className="h-9 w-full border-[#B9CBC6] text-[#1B355E]"
                    >
                      Replace signature
                    </Button>
                  </div>
                ) : sig?.status === "rejected" ? (
                  <div className="space-y-3">
                    <Alert variant="destructive" className="border-red-200 bg-red-50">
                      <AlertDescription className="text-xs text-red-700">
                        <ShieldX className="mr-1 inline h-3.5 w-3.5" />
                        Your signature was not accepted. Please draw it again clearly.
                      </AlertDescription>
                    </Alert>
                    {!editingSignature && (
                      <Button
                        size="sm"
                        onClick={() => setEditingSignature(true)}
                        className="msap-primary-action h-9 w-full text-white"
                      >
                        <PenLine className="mr-1.5 h-3.5 w-3.5" /> Draw again
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs leading-5 text-[#5D7086]">
                      Draw your signature below or upload an image of it — any light background is
                      removed automatically. It is submitted to the National Office for approval and
                      appears on the card only after approval.
                    </p>
                    {!editingSignature && (
                      <Button
                        size="sm"
                        onClick={() => setEditingSignature(true)}
                        className="msap-primary-action h-9 w-full text-white"
                      >
                        <PenLine className="mr-1.5 h-3.5 w-3.5" /> Add my signature
                      </Button>
                    )}
                  </div>
                )}

                {editingSignature && (
                  <div className="mt-3">
                    <SignatureEditor
                      saving={submitSignature.isPending}
                      onSave={(dataUrl) => submitSignature.mutate({ dataUrl })}
                      onCancel={() => setEditingSignature(false)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Approval & security notes */}
            <Card className="msap-card bg-[linear-gradient(135deg,#EAF7F3_0%,#F7FBFA_70%)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm text-[#1B355E]">
                  <Lock className="h-4 w-4 text-[#106E5B]" /> Approval &amp; Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs leading-5 text-[#42566E]">
                <p className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#106E5B]" />
                  Name, ID, council, institute and discipline are read from the approved membership
                  registry — they cannot be edited on this page.
                </p>
                <p className="flex gap-2">
                  <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#106E5B]" />
                  Every issued card carries a National-Office-signed QR. The card freezes the approved
                  data at issuance — signature or data changes require National Office approval and
                  re-issue the card with a new revision.
                </p>
                <p className="flex gap-2">
                  <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#106E5B]" />
                  Guilloché lines, microtext, metallic-foil seal, serial number, back-side barcode and
                  the HMAC QR deter forgery. The National President&apos;s handwritten signature is set by
                  the National Office.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ===== Right: card preview (front + back) ===== */}
          <div className="lg:col-span-2">
            {/* Face tabs */}
            <div className="mb-4 flex items-center gap-2">
              {(["front", "back"] as const).map((face) => (
                <button
                  key={face}
                  type="button"
                  aria-pressed={activeFace === face}
                  onClick={() => setActiveFace(face)}
                  className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-xs font-bold uppercase tracking-wider transition-all ${
                    activeFace === face
                      ? "bg-[#1B355E] text-white shadow-md"
                      : "border border-[#D9E4E1] bg-white text-[#5D7086] hover:border-[#B9CBC6] hover:text-[#1B355E]"
                  }`}
                >
                  {face === "front" ? <IdCard className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
                  {face === "front" ? "Front" : "Back"}
                </button>
              ))}
              <span className="ml-auto hidden text-[11px] text-[#8A9BAE] sm:block">
                CR80 · 85.6 × 54 mm · 300 DPI export
              </span>
            </div>

            <div className="flex items-center justify-center rounded-[2rem] border border-[#D9E4E1] bg-[linear-gradient(180deg,#E9F0EE_0%,#F7FAF9_60%,#E9F0EE_100%)] p-8 md:p-10">
              <div className="flex flex-wrap items-center justify-center gap-10">
                <div className="flex flex-col items-center gap-3">
                  <div
                    ref={frontRef}
                    className={`rounded-[1rem] transition-all duration-300 ${
                      activeFace === "front" ? "ring-2 ring-[#C9A227]/70 ring-offset-4 ring-offset-transparent" : "opacity-70"
                    }`}
                  >
                    <MembershipCardFront
                      card={card}
                      verifyUrl={verifyUrl}
                      signatureFailed={presSigFailed}
                      onSignatureFailed={() => setPresSigFailed(true)}
                    />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5D7086]">
                    Front — Identity
                  </span>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <div
                    ref={backRef}
                    className={`rounded-[1rem] transition-all duration-300 ${
                      activeFace === "back" ? "ring-2 ring-[#C9A227]/70 ring-offset-4 ring-offset-transparent" : "opacity-70"
                    }`}
                  >
                    <MembershipCardBack card={card} verifyUrl={verifyUrl} />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5D7086]">
                    Back — Verification
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: <IdCard className="h-4 w-4" />,
                  title: card.issued ? `Revision ${card.version}` : "Not yet issued",
                  desc: card.issued
                    ? "Issued with a signed verification QR."
                    : "Issued after the National Office approves your signature.",
                },
                {
                  icon: <ShieldCheck className="h-4 w-4" />,
                  title: card.status === "Active" ? "Active member" : card.status,
                  desc: card.graduationYear
                    ? `Valid through graduation year ${card.graduationYear}.`
                    : "Membership status from the approved registry.",
                },
                {
                  icon: <FileDown className="h-4 w-4" />,
                  title: "Print ready",
                  desc: "Front & back PNGs at 300 DPI (CR80) plus the server-side PDF — print at 100% and laminate.",
                },
              ].map((item) => (
                <div key={item.title} className="msap-card p-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E7F4F0] text-[#106E5B]">
                    {item.icon}
                  </div>
                  <h5 className="mt-2 text-sm font-semibold text-[#1B355E]">{item.title}</h5>
                  <p className="mt-0.5 text-xs leading-5 text-[#66788D]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

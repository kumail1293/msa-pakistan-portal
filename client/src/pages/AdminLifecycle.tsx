import { useAuth } from "@/_core/hooks/useAuth";
import { canAccessModule } from "@/_core/access";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  X,
  XCircle,
} from "lucide-react";

type Action = "suspend" | "terminate" | "reinstate";
type CaseStatus = "pending" | "approved" | "rejected" | "cancelled";
type StatusFilter = "all" | CaseStatus;
type ActionFilter = "all" | Action;

type LifecycleCase = {
  id: number;
  userId: number;
  membershipId: string | null;
  memberName: string | null;
  action: Action;
  reason: string;
  description: string | null;
  status: CaseStatus;
  evidence: { label: string; dataUrl: string }[] | null;
  requestedByName: string | null;
  requestedByEmail: string | null;
  requestedAt: Date;
  decidedByName: string | null;
  decidedByEmail: string | null;
  decidedAt: Date | null;
  decisionNotes: string | null;
  effectiveDate: Date | null;
  notificationQueued: boolean | null;
  timeline: {
    at: Date;
    byName: string;
    byEmail: string;
    action: string;
    detail?: string | null;
  }[] | null;
  createdAt: Date;
  updatedAt: Date;
};

const ACTION_META: Record<
  Action,
  { label: string; badge: string; icon: typeof ShieldAlert }
> = {
  suspend: { label: "Suspend membership", badge: "bg-amber-100 text-amber-700", icon: ShieldAlert },
  terminate: { label: "Terminate membership", badge: "bg-red-100 text-red-600", icon: XCircle },
  reinstate: { label: "Reinstate membership", badge: "bg-emerald-100 text-emerald-700", icon: BadgeCheck },
};

const STATUS_META: Record<CaseStatus, { label: string; badge: string; dot: string }> = {
  pending: { label: "Pending review", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  approved: { label: "Approved", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  rejected: { label: "Rejected", badge: "bg-red-100 text-red-600", dot: "bg-red-500" },
  cancelled: { label: "Cancelled", badge: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
};

const MAX_EVIDENCE_ITEMS = 4;
const MAX_EVIDENCE_BYTES = 500_000;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export default function AdminLifecycle() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  // ---- Filters (debounced free-text) ----
  const [status, setStatus] = useState<StatusFilter>("all");
  const [action, setAction] = useState<ActionFilter>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const list = trpc.admin.lifecycle.list.useQuery(
    {
      status: status === "all" ? undefined : status,
      action: action === "all" ? undefined : action,
      query: debouncedQuery || undefined,
    },
    { retry: false }
  );
  const counts = trpc.admin.lifecycle.counts.useQuery(undefined, { retry: false });

  const openCase = trpc.admin.lifecycle.open.useMutation({
    onSuccess: () => {
      toast.success("Case opened — nothing changes until it is approved.");
      setShowOpen(false);
      setIdentifier("");
      setReason("");
      setDescription("");
      setEvidence([]);
      list.refetch();
      counts.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const reviewCase = trpc.admin.lifecycle.review.useMutation({
    onSuccess: () => {
      toast.success("Decision recorded and audited.");
      list.refetch();
      counts.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const cancelCase = trpc.admin.lifecycle.cancel.useMutation({
    onSuccess: () => {
      toast.success("Case cancelled.");
      list.refetch();
      counts.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  // ---- "Open a case" form state ----
  const [showOpen, setShowOpen] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [actionKind, setActionKind] = useState<Action>("suspend");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<{ label: string; dataUrl: string }[]>([]);

  const handleEvidenceFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      toast.error("Evidence must be a PNG or JPEG image.");
      return;
    }
    if (file.size > MAX_EVIDENCE_BYTES) {
      toast.error("Evidence must be under 500KB.");
      return;
    }
    if (evidence.length >= MAX_EVIDENCE_ITEMS) {
      toast.error(`Maximum ${MAX_EVIDENCE_ITEMS} evidence items per case.`);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setEvidence((cur) => [
        ...cur,
        { label: file.name.slice(0, 120), dataUrl },
      ]);
    } catch {
      toast.error("Could not read that file.");
    }
  };

  const updateEvidenceLabel = (index: number, label: string) =>
    setEvidence((cur) => cur.map((item, i) => (i === index ? { ...item, label } : item)));
  const removeEvidence = (index: number) =>
    setEvidence((cur) => cur.filter((_, i) => i !== index));

  const handleOpen = (e: FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error("Enter the member's Membership ID or email.");
      return;
    }
    if (!reason.trim()) {
      toast.error("A reason is required for the case record.");
      return;
    }
    openCase.mutate({
      identifier: identifier.trim(),
      action: actionKind,
      reason: reason.trim(),
      description: description.trim() || undefined,
      evidence: evidence.map((item) => ({
        label: item.label.trim() || "Evidence",
        dataUrl: item.dataUrl,
      })),
    });
  };

  if (loading) {
    return (
      <div className="msap-page min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#138A73]" />
      </div>
    );
  }
  if (!user || !canAccessModule(user, "lifecycle")) {
    navigate("/official");
    return null;
  }

  const items = list.data ?? [];
  const countData = counts.data ?? { pending: 0, approved: 0, rejected: 0, cancelled: 0 };

  return (
    <div className="py-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="mb-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight text-[#1B355E] sm:text-4xl">
              <Scale className="h-8 w-8 text-[#106E5B]" />
              Membership Lifecycle
            </h1>
            <p className="max-w-2xl text-[#66788D]">
              Suspensions and terminations are never applied directly — every
              one is a case with a reason, evidence and an audit trail, and it
              only takes effect after an official with this module approves it.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-[#1B355E] text-[#1B355E] hover:bg-[#F0F5F3]"
            disabled={list.isFetching}
            onClick={() => {
              list.refetch();
              counts.refetch();
            }}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Open a case */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-[#D9E4E1] bg-white shadow-[0_14px_36px_-24px_rgba(27,53,94,.4)]">
          <button
            onClick={() => setShowOpen((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[#F6F9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#138A73]"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1B355E]">
                <Plus className="h-4 w-4 text-white" />
              </span>
              <span>
                <span className="block font-bold text-[#1B355E]">Open a lifecycle case</span>
                <span className="block text-xs text-[#5D7086]">
                  Records the reason and evidence for review — the member's status changes only on approval
                </span>
              </span>
            </span>
            <ChevronDown className={`h-5 w-5 text-[#5D7086] transition-transform ${showOpen ? "rotate-180" : ""}`} />
          </button>

          {showOpen && (
            <form onSubmit={handleOpen} className="space-y-5 border-t border-[#E7EFEC] px-5 py-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lc-identifier" className="text-xs font-bold text-[#1B355E]">
                    Membership ID or email
                  </Label>
                  <Input
                    id="lc-identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="MSAP-0123 or member@example.com"
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-[#1B355E]">Action</Label>
                  <Select value={actionKind} onValueChange={(v) => setActionKind(v as Action)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="suspend">Suspend membership</SelectItem>
                      <SelectItem value="terminate">Terminate membership</SelectItem>
                      <SelectItem value="reinstate">Reinstate membership</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lc-reason" className="text-xs font-bold text-[#1B355E]">
                    Reason <span className="font-normal text-[#8A9BAE]">(short)</span>
                  </Label>
                  <Input
                    id="lc-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Dues non-payment / By-law violation"
                    maxLength={120}
                    className="h-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lc-desc" className="text-xs font-bold text-[#1B355E]">
                  Description <span className="font-normal text-[#8A9BAE]">(optional)</span>
                </Label>
                <Textarea
                  id="lc-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Context, timeline of events and any additional detail for the reviewer."
                  maxLength={2000}
                  rows={3}
                />
              </div>

              {/* Evidence */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#5D7086]">
                  Evidence <span className="font-normal normal-case">(PNG/JPEG, max 500KB each, up to 4)</span>
                </p>
                <div className="space-y-2">
                  {evidence.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl border border-[#E7EFEC] bg-[#F6F9F8] p-2">
                      <img src={item.dataUrl} alt={item.label} className="h-12 w-16 shrink-0 rounded-lg border border-[#D9E4E1] bg-white object-cover" />
                      <Input
                        value={item.label}
                        onChange={(e) => updateEvidenceLabel(i, e.target.value)}
                        maxLength={120}
                        placeholder="Evidence label"
                        className="h-9"
                      />
                      <button
                        type="button"
                        onClick={() => removeEvidence(i)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#8A9BAE] transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove evidence"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {evidence.length < MAX_EVIDENCE_ITEMS && (
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#B9CBC6] bg-white/70 px-4 py-3 text-xs font-semibold text-[#5D7086] transition-colors hover:border-[#106E5B] hover:text-[#106E5B]">
                      <Paperclip className="h-4 w-4" />
                      Attach evidence image
                      <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleEvidenceFile} />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={openCase.isPending}
                  className="h-10 bg-[#1B355E] px-5 text-white transition-colors hover:bg-[#294A78] disabled:opacity-60"
                >
                  {openCase.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Open case for review
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 border-[#D9E4E1] text-[#5D7086]"
                  onClick={() => {
                    setShowOpen(false);
                    setEvidence([]);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Filters */}
        <Card className="card-cinematic mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#5D7086]">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA9B8]" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Name, ID, reason, requester…"
                    className="h-10 pl-9"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#5D7086]">
                  Action
                </label>
                <Select value={action} onValueChange={(v) => setAction(v as ActionFilter)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    <SelectItem value="suspend">Suspend</SelectItem>
                    <SelectItem value="terminate">Terminate</SelectItem>
                    <SelectItem value="reinstate">Reinstate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#5D7086]">
                  Status
                </label>
                <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-[#F0F5F3] px-3 py-1 font-semibold text-[#1B355E]">
                {items.length} shown
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 font-bold text-amber-700">
                {countData.pending} pending
              </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700">
                {countData.approved} approved
              </span>
              <span className="rounded-full bg-red-100 px-3 py-1 font-bold text-red-600">
                {countData.rejected} rejected
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-500">
                {countData.cancelled} cancelled
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Cases */}
        <Card className="card-cinematic">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1B355E]">
              Lifecycle cases
              {countData.pending > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                  {countData.pending} awaiting decision
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {list.isLoading ? (
              <p className="py-6 text-center text-sm text-[#8A9BAE]">Loading…</p>
            ) : items.length === 0 ? (
              <div className="py-10 text-center">
                <Scale className="mx-auto h-10 w-10 text-[#B9C6D0]" />
                <p className="mt-3 text-sm font-semibold text-[#1B355E]">
                  No lifecycle cases match these filters
                </p>
                <p className="mt-1 text-xs text-[#8A9BAE]">
                  Open a case above to start a suspend / terminate / reinstate workflow.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((lifecycleCase) => (
                  <LifecycleCaseRow
                    key={lifecycleCase.id}
                    lifecycleCase={lifecycleCase}
                    busy={reviewCase.isPending || cancelCase.isPending}
                    onDecide={(decision, notes) =>
                      reviewCase.mutate({ caseId: lifecycleCase.id, decision, notes })
                    }
                    onCancel={(notes) =>
                      cancelCase.mutate({ caseId: lifecycleCase.id, notes })
                    }
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LifecycleCaseRow({
  lifecycleCase,
  busy,
  onDecide,
  onCancel,
}: {
  lifecycleCase: LifecycleCase;
  busy: boolean;
  onDecide: (decision: "approve" | "reject", notes?: string) => void;
  onCancel: (notes?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const actionMeta = ACTION_META[lifecycleCase.action];
  const statusMeta = STATUS_META[lifecycleCase.status];
  const ActionIcon = actionMeta.icon;

  return (
    <div className="overflow-hidden rounded-xl border border-[#E7EFEC] bg-white transition-colors hover:border-[#A8D8CD]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${
              lifecycleCase.action === "terminate"
                ? "bg-gradient-to-br from-[#8C3A2E] to-[#A9523F]"
                : lifecycleCase.action === "suspend"
                  ? "bg-gradient-to-br from-[#A67C2E] to-[#C08A3E]"
                  : "bg-gradient-to-br from-[#106E5B] to-[#138A73]"
            }`}
          >
            <ActionIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-bold text-[#1B355E]">
                {lifecycleCase.memberName || "Unnamed member"}
              </p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${actionMeta.badge}`}>
                {actionMeta.label}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusMeta.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                {statusMeta.label}
              </span>
            </div>
            <p className="font-mono text-xs text-[#106E5B]">{lifecycleCase.membershipId || "—"}</p>
            <p className="mt-0.5 truncate text-xs text-[#66788D]">
              {lifecycleCase.reason}
              <span className="text-[#B9C6D0]"> · opened by {lifecycleCase.requestedByName || lifecycleCase.requestedByEmail || "an official"} on{" "}
                {new Date(lifecycleCase.requestedAt).toLocaleString()}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lifecycleCase.status === "pending" && (
            <>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => onDecide("approve", notes.trim() || undefined)}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve & apply
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onDecide("reject", notes.trim() || undefined)}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <XCircle className="mr-1.5 h-4 w-4" /> Reject
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            className="border-[#D9E4E1] text-[#5D7086] hover:bg-[#F6F9F8]"
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronDown className={`mr-1 h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            {open ? "Close" : "Details"}
          </Button>
        </div>
      </div>

      {open && (
        <div className="space-y-5 border-t border-[#E7EFEC] bg-[#FBFDFC] px-4 py-5">
          {lifecycleCase.description && (
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[#5D7086]">Description</p>
              <p className="text-sm leading-6 text-[#33475C]">{lifecycleCase.description}</p>
            </div>
          )}

          {(lifecycleCase.evidence ?? []).length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#5D7086]">Evidence</p>
              <div className="flex flex-wrap gap-3">
                {(lifecycleCase.evidence ?? []).map((item, i) => (
                  <a
                    key={i}
                    href={item.dataUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group w-36 overflow-hidden rounded-xl border border-[#D9E4E1] bg-white transition-shadow hover:shadow-md"
                  >
                    <img src={item.dataUrl} alt={item.label} className="h-20 w-full object-cover" />
                    <p className="truncate px-2 py-1.5 text-[11px] font-semibold text-[#1B355E]">
                      {item.label}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}          {lifecycleCase.status === "pending" && (
            <div>
              <Label htmlFor={`lc-notes-${lifecycleCase.id}`} className="text-xs font-bold text-[#1B355E]">
                Decision notes <span className="font-normal text-[#8A9BAE]">(optional, becomes part of the audit trail)</span>
              </Label>
              <Textarea
                id={`lc-notes-${lifecycleCase.id}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
                rows={2}
                className="mt-1.5"
                placeholder="Findings that justify the decision…"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onCancel(notes.trim() || undefined)}
                className="mt-3 border-[#B9C6D0] text-[#5D7086] hover:bg-slate-50"
              >
                <X className="mr-1.5 h-4 w-4" /> Cancel / withdraw case
              </Button>
            </div>
          )}

          {lifecycleCase.status !== "pending" && lifecycleCase.decidedAt && (
            <div className="rounded-xl border border-[#E7EFEC] bg-white p-3 text-xs text-[#33475C]">
              <p className="font-bold text-[#1B355E]">
                {statusMeta.label} by{" "}
                {lifecycleCase.decidedByName || lifecycleCase.decidedByEmail || "an official"} on{" "}
                {new Date(lifecycleCase.decidedAt).toLocaleString()}
              </p>
              {lifecycleCase.decisionNotes && (
                <p className="mt-1 text-[#5D7086]">Notes: {lifecycleCase.decisionNotes}</p>
              )}
              {lifecycleCase.notificationQueued && (
                <p className="mt-1 text-[#106E5B]">Member notification email queued.</p>
              )}
            </div>
          )}

          {/* Audit trail */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#5D7086]">
              <FileText className="h-3.5 w-3.5" /> Audit trail
            </p>
            <ol className="space-y-0 border-l border-[#D9E4E1] pl-4">
              {[...(lifecycleCase.timeline ?? [])].reverse().map((event, i) => (
                <li key={i} className="relative pb-3 last:pb-0">
                  <span className="absolute -left-[21.5px] top-1 h-2 w-2 rounded-full bg-[#138A73]" />
                  <p className="text-xs font-bold text-[#1B355E]">
                    {event.action.replace(/^case\./, "")}
                    <span className="ml-2 font-medium text-[#8A9BAE]">
                      {new Date(event.at).toLocaleString()}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-[#5D7086]">
                    by {event.byName || event.byEmail}
                    {event.detail ? ` — ${event.detail}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

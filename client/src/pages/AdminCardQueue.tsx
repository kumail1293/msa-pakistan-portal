import { useAuth } from "@/_core/hooks/useAuth";
import { canAccessModule } from "@/_core/access";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  CheckCircle,
  IdCard,
  PenLine,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";

type KindFilter = "all" | "signature" | "reissue";
type StatusFilter = "all" | "pending" | "approved" | "rejected";

const STATUS_META: Record<
  "pending" | "approved" | "rejected",
  { label: string; badge: string; dot: string }
> = {
  pending: {
    label: "Pending review",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
  },
  approved: {
    label: "Approved",
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
  },
  rejected: {
    label: "Rejected",
    badge: "bg-red-100 text-red-600",
    dot: "bg-red-500",
  },
};

export default function AdminCardQueue() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  const [kind, setKind] = useState<KindFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [query, setQuery] = useState("");
  const [council, setCouncil] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [debouncedCouncil, setDebouncedCouncil] = useState("");

  // Debounce the free-text fields so typing does not refetch per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setDebouncedCouncil(council.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [query, council]);

  const queue = trpc.admin.card.queue.useQuery(
    {
      kind: kind === "all" ? undefined : kind,
      status: status === "all" ? undefined : status,
      query: debouncedQuery || undefined,
      localCouncil: debouncedCouncil || undefined,
    },
    { retry: false }
  );

  const reviewCard = trpc.admin.card.review.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.card.issued
          ? `Card ${data.card.membershipId} issued (rev ${data.card.version}).`
          : "Request updated."
      );
      queue.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const councils = useMemo(
    () =>
      Array.from(
        new Set(
          (queue.data ?? [])
            .map((item) => item.localCouncil)
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [queue.data]
  );

  // Wait for the session before deciding access — otherwise the first render
  // (user still undefined) redirects admins to "/".
  if (loading) {
    return (
      <div className="msap-page min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#138A73]"></div>
      </div>
    );
  }

  if (!user || !canAccessModule(user, "card-queue")) {
    navigate("/official");
    return null;
  }

  const items = queue.data ?? [];
  const counts = {
    pending: items.filter((i) => i.status === "pending").length,
    approved: items.filter((i) => i.status === "approved").length,
    rejected: items.filter((i) => i.status === "rejected").length,
  };

  return (
    <div className="py-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1B355E] mb-2 flex items-center gap-3">
              <IdCard className="h-8 w-8 text-[#106E5B]" />
              Card Issuance Queue
            </h1>
            <p className="text-[#66788D]">
              Approve holder signatures and data-change re-issues. Cards only
              (re)issue on National Office approval.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-[#1B355E] text-[#1B355E] hover:bg-[#F0F5F3]"
            disabled={queue.isFetching}
            onClick={() => queue.refetch()}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${queue.isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card className="card-cinematic mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#5D7086]">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA9B8]" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Name, ID, email, institute…"
                    className="h-10 pl-9"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#5D7086]">
                  Request type
                </label>
                <Select
                  value={kind}
                  onValueChange={(v) => setKind(v as KindFilter)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All requests</SelectItem>
                    <SelectItem value="signature">Holder signature</SelectItem>
                    <SelectItem value="reissue">Data re-issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#5D7086]">
                  Status
                </label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as StatusFilter)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved / issued</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="all">All statuses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#5D7086]">
                  Local Council
                </label>
                {/* "all" is a sentinel — Radix Select forbids empty-string item
                    values (they mean "clear the selection"), so the empty
                    council filter is represented by this dedicated value. */}
                <Select
                  value={council === "" ? "all" : council}
                  onValueChange={(v) => setCouncil(v === "all" ? "" : v)}
                  disabled={councils.length === 0}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="All councils" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All councils</SelectItem>
                    {councils.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Summary chips */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-[#F0F5F3] px-3 py-1 font-semibold text-[#1B355E]">
                {items.length} shown
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 font-bold text-amber-700">
                {counts.pending} pending
              </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700">
                {counts.approved} approved
              </span>
              <span className="rounded-full bg-red-100 px-3 py-1 font-bold text-red-600">
                {counts.rejected} rejected
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Queue list */}
        <Card className="card-cinematic">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1B355E]">
              Requests
              {counts.pending > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                  {counts.pending} awaiting review
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {queue.isLoading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Loading…
              </p>
            ) : items.length === 0 ? (
              <div className="py-10 text-center">
                <IdCard className="mx-auto h-10 w-10 text-[#B9C6D0]" />
                <p className="mt-3 text-sm font-semibold text-[#1B355E]">
                  No requests match these filters
                </p>
                <p className="mt-1 text-xs text-[#8A9BAE]">
                  Try widening the status or request-type filters.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const meta = STATUS_META[item.status];
                  return (
                    <div
                      key={`${item.request}-${item.userId}`}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E7EFEC] bg-[#F6F9F8] p-4 transition-colors hover:border-[#A8D8CD]"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        {item.request === "reissue" ? (
                          <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50">
                            <AlertCircle className="h-5 w-5 text-amber-600" />
                          </div>
                        ) : item.signaturePreview ? (
                          <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg border border-[#D9E4E1] bg-white px-2">
                            <img
                              src={item.signaturePreview}
                              alt="Holder signature"
                              className="max-h-11 max-w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg border border-[#D9E4E1] bg-white">
                            <PenLine className="h-5 w-5 text-[#9AA9B8]" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-[#1B355E]">
                              {item.name || "Unnamed member"}
                            </p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                item.request === "reissue"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {item.request === "reissue"
                                ? "Data re-issue"
                                : "Signature"}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
                              />
                              {meta.label}
                            </span>
                          </div>
                          <p className="font-mono text-xs text-[#106E5B]">
                            {item.membershipId}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[#8A9BAE]">
                            {item.institution || "—"}
                            {item.localCouncil
                              ? ` · ${item.localCouncil}`
                              : ""}
                          </p>
                          <p className="mt-0.5 text-xs text-[#8A9BAE]">
                            {item.request === "reissue" ? "Requested" : "Submitted"}{" "}
                            {item.submittedAt
                              ? new Date(item.submittedAt).toLocaleString()
                              : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {item.status === "pending" ? (
                          <>
                            <Button
                              size="sm"
                              disabled={reviewCard.isPending}
                              onClick={() =>
                                reviewCard.mutate({
                                  userId: item.userId,
                                  decision: "approve",
                                  kind: item.request,
                                })
                              }
                              className="bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                              <CheckCircle className="mr-1.5 h-4 w-4" /> Approve
                              &amp; issue
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={reviewCard.isPending}
                              onClick={() =>
                                reviewCard.mutate({
                                  userId: item.userId,
                                  decision: "reject",
                                  kind: item.request,
                                })
                              }
                              className="border-red-200 text-red-600 hover:bg-red-50"
                            >
                              <XCircle className="mr-1.5 h-4 w-4" /> Reject
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs font-medium text-[#8A9BAE]">
                            {item.status === "approved"
                              ? "Card issued"
                              : "Not issued"}
                            {item.reviewedAt
                              ? ` · ${new Date(item.reviewedAt).toLocaleDateString()}`
                              : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

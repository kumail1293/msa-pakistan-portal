import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, FileText, CheckCircle2, Clock, AlertCircle, XCircle,
  Users, MapPin, Calendar, Award, ChevronDown, ChevronUp, Eye,
} from "lucide-react";
import { toast } from "sonner";

const STANDING_COMMITTEES = [
  { value: "SCOPH", label: "SCOPH — Public Health" },
  { value: "SCORA", label: "SCORA — Sexual & Reproductive Health" },
  { value: "SCOME", label: "SCOME — Medical Education" },
  { value: "SCORP", label: "SCORP — Human Rights & Peace" },
  { value: "SCOPE", label: "SCOPE — Professional Exchange" },
  { value: "SCORE", label: "SCORE — Research Exchange" },
];

const ACTIVITY_LEVELS = [
  { value: "local", label: "Local", desc: "1 LC or ≤2 LC collaboration" },
  { value: "national", label: "National", desc: "EBTO member, ≥3 LCs, or national team" },
  { value: "regional", label: "Regional", desc: "2 NMOs in same region" },
  { value: "international", label: "International", desc: "Orgs in different regions" },
];

export default function AdminNEF() {
  const [selectedTab, setSelectedTab] = useState("nef");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reviewDialog, setReviewDialog] = useState<{ activityId: number; decision: string } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  // ── Queries ──
  const nefQuery = (trpc as any).admin?.nefNrf?.listNefSubmissions?.useQuery?.({
    status: statusFilter === "all" ? undefined : statusFilter,
    activityLevel: levelFilter === "all" ? undefined : levelFilter,
    limit: 50,
  }) ?? { data: [], isLoading: false };

  const nrfQuery = (trpc as any).admin?.nefNrf?.listNrfReports?.useQuery?.({ limit: 50 }) ?? { data: [], isLoading: false };

  const statsQuery = (trpc as any).admin?.nefNrf?.stats?.useQuery?.() ?? { data: {} };

  // ── Mutations ──
  const reviewNef = (trpc as any).admin?.nefNrf?.reviewNef?.useMutation?.({
    onSuccess: () => {
      toast.success("NEF decision submitted");
      nefQuery.refetch?.();
      setReviewDialog(null);
      setReviewNotes("");
    },
    onError: (err: Error) => toast.error(err.message),
  }) ?? { mutate: () => {}, isPending: false };

  const approveNrf = (trpc as any).admin?.nefNrf?.approveNrf?.useMutation?.({
    onSuccess: () => {
      toast.success("NRF approved — certificate eligible");
      nrfQuery.refetch?.();
    },
    onError: (err: Error) => toast.error(err.message),
  }) ?? { mutate: () => {}, isPending: false };

  const issueCert = (trpc as any).admin?.nefNrf?.issueCertificate?.useMutation?.({
    onSuccess: () => { toast.success("Certificate issued"); nefQuery.refetch?.(); },
    onError: (err: Error) => toast.error(err.message),
  }) ?? { mutate: () => {}, isPending: false };

  const nefSubmissions = (nefQuery.data ?? []) as any[];
  const nrfReports = (nrfQuery.data ?? []) as any[];
  const stats = (statsQuery.data ?? {}) as Record<string, number>;

  const pendingNef = nefSubmissions.filter((s: any) => s.status === "submitted");
  const approvedNef = nefSubmissions.filter((s: any) => s.status === "approved");
  const rejectedNef = nefSubmissions.filter((s: any) => s.status === "rejected");

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "submitted": case "under_review": return "bg-amber-100 text-amber-700 border-amber-200";
      case "rejected": return "bg-red-100 text-red-700 border-red-200";
      case "completed": return "bg-blue-100 text-blue-700 border-blue-200";
      case "draft": return "bg-slate-100 text-slate-600 border-slate-200";
      default: return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "international": return "bg-violet-100 text-violet-700 border-violet-200";
      case "regional": return "bg-blue-100 text-blue-700 border-blue-200";
      case "national": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default: return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">Activities · VPA Module</p>
        <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E]">NEF &amp; NRF Management</h1>
        <p className="mt-2 text-[#66788D]">
          National Enrollment Form (§16.1-16.3) &amp; National Report Form (§16.11-16.12) — managed by the VPA per bylaws
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="msap-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E7F4F0]">
                <FileText className="h-5 w-5 text-[#106E5B]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1B355E]">{stats.totalNef ?? nefSubmissions.length}</p>
                <p className="text-xs text-[#66788D]">NEF Submissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="msap-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{stats.pendingReview ?? pendingNef.length}</p>
                <p className="text-xs text-[#66788D]">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="msap-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.totalNrf ?? nrfReports.length}</p>
                <p className="text-xs text-[#66788D]">NRF Reports</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="msap-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                <Award className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{stats.certificatesIssued ?? 0}</p>
                <p className="text-xs text-[#66788D]">Certificates Issued</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="border border-[#D9E4E1] bg-[#E9F0EE]">
          <TabsTrigger value="nef">NEF Submissions ({nefSubmissions.length})</TabsTrigger>
          <TabsTrigger value="nrf">NRF Reports ({nrfReports.length})</TabsTrigger>
        </TabsList>

        {/* ── NEF Submissions Tab ── */}
        <TabsContent value="nef" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Activity Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {ACTIVITY_LEVELS.map(l => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* List */}
          {nefQuery.isLoading ? (
            <Card className="msap-card py-16 text-center">
              <CardContent><Loader2 className="mx-auto h-8 w-8 animate-spin text-[#138A73]" /></CardContent>
            </Card>
          ) : nefSubmissions.length === 0 ? (
            <Card className="msap-card py-12 text-center">
              <CardContent>
                <FileText className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
                <p className="text-[#5D7086]">No NEF submissions yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {nefSubmissions.map((nef: any) => {
                const isExpanded = expandedId === nef.id;
                return (
                  <Card key={nef.id} className="msap-card">
                    <CardContent className="p-0">
                      {/* Header row */}
                      <div
                        className="flex cursor-pointer items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : nef.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-[#1B355E] truncate">{nef.title}</h3>
                            <Badge className={`border text-[10px] ${getStatusColor(nef.status)}`}>{nef.status?.replace(/_/g, " ")}</Badge>
                            {nef.activityLevel && <Badge className={`border text-[10px] ${getLevelColor(nef.activityLevel)}`}>{nef.activityLevel}</Badge>}
                            {nef.standingCommittee && <Badge variant="outline" className="border-[#D9E4E1] text-[10px] text-[#66788D]">{nef.standingCommittee}</Badge>}
                          </div>
                          <p className="mt-1 text-xs text-[#66788D] line-clamp-1">{nef.description}</p>
                        </div>
                        <div className="flex items-center gap-3 ml-3 text-xs text-[#8A9BAE]">
                          {nef.startDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(nef.startDate).toLocaleDateString()}</span>}
                          {nef.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{nef.city}</span>}
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="border-t border-[#E9F0EE] p-4 space-y-4">
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                            <div><span className="text-[#8A9BAE]">Level:</span><br /><span className="text-[#1B355E] font-medium capitalize">{nef.activityLevel ?? "Local"}</span></div>
                            {nef.standingCommittee && <div><span className="text-[#8A9BAE]">Standing Committee:</span><br /><span className="text-[#1B355E] font-medium">{nef.standingCommittee}</span></div>}
                            {nef.budget && <div><span className="text-[#8A9BAE]">Budget Requested:</span><br /><span className="text-[#1B355E] font-medium">PKR {Number(nef.budget).toLocaleString()}</span></div>}
                            {nef.maxParticipants && <div><span className="text-[#8A9BAE]">Max Participants:</span><br /><span className="text-[#1B355E] font-medium">{nef.maxParticipants}</span></div>}
                            {nef.startDate && <div><span className="text-[#8A9BAE]">Start Date:</span><br /><span className="text-[#1B355E] font-medium">{new Date(nef.startDate).toLocaleDateString()}</span></div>}
                            {nef.endDate && <div><span className="text-[#8A9BAE]">End Date:</span><br /><span className="text-[#1B355E] font-medium">{new Date(nef.endDate).toLocaleDateString()}</span></div>}
                            {nef.mode && <div><span className="text-[#8A9BAE]">Mode:</span><br /><span className="text-[#1B355E] font-medium capitalize">{nef.mode?.replace(/_/g, " ")}</span></div>}
                            {nef.venue && <div><span className="text-[#8A9BAE]">Venue:</span><br /><span className="text-[#1B355E] font-medium">{nef.venue}</span></div>}
                          </div>
                          {nef.nefSubmittedAt && (
                            <p className="text-xs text-[#8A9BAE]">
                              Submitted: {new Date(nef.nefSubmittedAt).toLocaleString()}
                              {nef.nefDecision && <> · Decision: <span className="font-medium text-[#1B355E]">{nef.nefDecision}</span></>}
                              {nef.nefDecisionNotes && <><br />Notes: {nef.nefDecisionNotes}</>}
                            </p>
                          )}
                          {/* VPA Action buttons */}
                          <div className="flex items-center gap-2">
                            {nef.status === "submitted" && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-[#138A73] hover:bg-[#106E5B] text-white"
                                  onClick={() => setReviewDialog({ activityId: nef.id, decision: "accepted" })}
                                >
                                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Accept NEF
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                                  onClick={() => setReviewDialog({ activityId: nef.id, decision: "revision_needed" })}
                                >
                                  <AlertCircle className="mr-1 h-3.5 w-3.5" /> Request Revision
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-300 text-red-700 hover:bg-red-50"
                                  onClick={() => setReviewDialog({ activityId: nef.id, decision: "rejected" })}
                                >
                                  <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                                </Button>
                              </>
                            )}
                            {nef.status === "approved" && nef.certificateIssued && (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                <Award className="mr-1 h-3 w-3" /> Certificate Issued
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── NRF Reports Tab ── */}
        <TabsContent value="nrf" className="space-y-4">
          {nrfQuery.isLoading ? (
            <Card className="msap-card py-16 text-center">
              <CardContent><Loader2 className="mx-auto h-8 w-8 animate-spin text-[#138A73]" /></CardContent>
            </Card>
          ) : nrfReports.length === 0 ? (
            <Card className="msap-card py-12 text-center">
              <CardContent>
                <FileText className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
                <p className="text-[#5D7086]">No NRF reports submitted yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {nrfReports.map((report: any) => {
                const content = (report.content ?? {}) as any;
                return (
                  <Card key={report.id} className="msap-card msap-card-hover">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-[#1B355E]">
                            Activity Report #{report.activityId}
                          </h3>
                          <p className="mt-1 text-sm text-[#5D7086] line-clamp-2">{content.summary}</p>
                        </div>
                        <Badge className={`ml-3 border text-[10px] ${getStatusColor(report.status)}`}>{report.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs text-[#66788D] mb-3">
                        {content.participants != null && <div><span className="text-[#8A9BAE]">Participants:</span> {content.participants}</div>}
                        {content.impact && <div className="col-span-2"><span className="text-[#8A9BAE]">Impact:</span> {content.impact}</div>}
                        {content.budgetActual != null && <div><span className="text-[#8A9BAE]">Actual Cost:</span> PKR {Number(content.budgetActual).toLocaleString()}</div>}
                      </div>
                      {report.status === "submitted" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-[#138A73] hover:bg-[#106E5B] text-white"
                            onClick={() => approveNrf.mutate({ reportId: report.id, activityId: report.activityId })}
                            disabled={approveNrf.isPending}
                          >
                            {approveNrf.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                            Approve NRF
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-emerald-300 text-emerald-700"
                            onClick={() => issueCert.mutate({ activityId: report.activityId })}
                            disabled={issueCert.isPending}
                          >
                            <Award className="mr-1 h-3.5 w-3.5" /> Issue Certificate
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Review Dialog ── */}
      {reviewDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-[#1B355E] mb-2">
              {reviewDialog.decision === "accepted" ? "Accept NEF" : reviewDialog.decision === "rejected" ? "Reject NEF" : "Request Revision"}
            </h2>
            <p className="text-sm text-[#66788D] mb-4">
              Per bylaws §11.5.15, the VPA must decide within 14 days of submission.
            </p>
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setReviewDialog(null); setReviewNotes(""); }}>Cancel</Button>
              <Button
                className={reviewDialog.decision === "accepted" ? "bg-[#138A73] text-white" : reviewDialog.decision === "rejected" ? "bg-red-600 text-white" : "bg-amber-600 text-white"}
                onClick={() => reviewNef.mutate({ activityId: reviewDialog.activityId, decision: reviewDialog.decision, notes: reviewNotes })}
                disabled={reviewNef.isPending}
              >
                {reviewNef.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Confirm {reviewDialog.decision === "accepted" ? "Accept" : reviewDialog.decision === "rejected" ? "Reject" : "Revision"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

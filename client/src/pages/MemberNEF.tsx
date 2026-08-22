import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, FileText, CheckCircle2, Clock, Loader2, Send, Award, Calendar, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const STANDING_COMMITTEES = ["SCOPH", "SCORA", "SCOME", "SCORP", "SCOPE", "SCORE"];
const ACTIVITY_LEVELS = ["local", "national", "regional", "international"];

const initialNef = {
  title: "", description: "", activityLevel: "local", standingCommittee: "",
  startDate: "", endDate: "", venue: "", city: "", mode: "in_person",
  maxParticipants: 0, budget: 0,
};

const initialNrf = {
  activityId: 0, summary: "", participants: 0, impact: "", feedback: "",
  outcomes: "", budgetActual: 0, challenges: "", recommendations: "",
};

export default function MemberNEF() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState("nef");
  const [showNefForm, setShowNefForm] = useState(false);
  const [nrfActivityId, setNrfActivityId] = useState<number | null>(null);
  const [nef, setNef] = useState(initialNef);
  const [nrf, setNrf] = useState(initialNrf);

  const myNefQuery = trpc.nefNrf.myNefSubmissions.useQuery();
  const myNrfQuery = trpc.nefNrf.myNrfReports.useQuery();
  const summaryQuery = trpc.nefNrf.mySummary.useQuery();

  const myNef = (myNefQuery.data ?? []) as any[];
  const myNrf = (myNrfQuery.data ?? []) as any[];
  const summary = summaryQuery.data as any;

  const submitNef = trpc.nefNrf.submitNef.useMutation({
    onSuccess: () => { toast.success("NEF submitted — VPA will review within 14 days"); setShowNefForm(false); setNef(initialNef); myNefQuery.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const submitNrf = trpc.nefNrf.submitNrf.useMutation({
    onSuccess: () => { toast.success("NRF submitted — certificate will be issued after VPA approval"); setNrfActivityId(null); setNrf(initialNrf); myNrfQuery.refetch(); myNefQuery.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const approvedActivities = myNef.filter((a: any) => a.status === "approved");
  const reportingActivities = myNef.filter((a: any) => a.status === "reporting" || a.status === "evaluation");
  const completedActivities = myNef.filter((a: any) => a.status === "completed");

  const sc = (s: string) => {
    switch (s) {
      case "approved": case "completed": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "submitted": case "under_review": case "reporting": case "evaluation": return "bg-amber-100 text-amber-700 border-amber-200";
      case "rejected": return "bg-red-100 text-red-700 border-red-200";
      default: return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="space-y-6">
        <Card className="msap-card p-10 text-center">
          <CardContent>
            <Lock className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
            <h2 className="text-xl font-bold text-[#1B355E]">Sign in to access NEF/NRF</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[#5D7086]">Submit activity enrollments and reports after signing in.</p>
            <Button onClick={() => navigate("/login?next=/nef-nrf")} className="mt-6 px-8 bg-[#138A73] text-white">Member Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">Activities · VPA Module</p>
        <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E]">NEF &amp; NRF</h1>
        <p className="mt-2 text-[#66788D]">National Enrollment Form (§16.1-16.3) &amp; National Report Form (§16.11-16.12)</p>
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="msap-card"><CardContent className="p-5"><p className="text-2xl font-bold text-[#1B355E]">{summary.totalNef ?? 0}</p><p className="text-xs text-[#66788D]">My NEF Submissions</p></CardContent></Card>
          <Card className="msap-card"><CardContent className="p-5"><p className="text-2xl font-bold text-amber-600">{summary.pendingNef ?? 0}</p><p className="text-xs text-[#66788D]">Pending</p></CardContent></Card>
          <Card className="msap-card"><CardContent className="p-5"><p className="text-2xl font-bold text-blue-600">{summary.totalNrf ?? 0}</p><p className="text-xs text-[#66788D]">NRF Reports</p></CardContent></Card>
          <Card className="msap-card"><CardContent className="p-5"><p className="text-2xl font-bold text-emerald-600">{summary.certificatesEarned ?? 0}</p><p className="text-xs text-[#66788D]">Certificates</p></CardContent></Card>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="border border-[#D9E4E1] bg-[#E9F0EE]">
          <TabsTrigger value="nef">My NEF ({myNef.length})</TabsTrigger>
          <TabsTrigger value="nrf">Submit NRF</TabsTrigger>
          <TabsTrigger value="reports">My NRF Reports ({myNrf.length})</TabsTrigger>
        </TabsList>

        {/* ── NEF Tab ── */}
        <TabsContent value="nef" className="space-y-4">
          <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white" onClick={() => setShowNefForm(!showNefForm)}>
            <Send className="h-4 w-4 mr-2" /> New NEF Submission
          </Button>

          {showNefForm && (
            <Card className="msap-card">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-bold text-[#1B355E]">Submit National Enrollment Form (§16.1)</h3>
                <p className="text-xs text-[#66788D]">All activities must be proposed via NEF at least 14 days before the start date.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2"><label className="text-sm font-medium text-[#1B355E]">Activity Title *</label><Input className="mt-1" value={nef.title} onChange={e => setNef({...nef, title: e.target.value})} /></div>
                  <div className="md:col-span-2"><label className="text-sm font-medium text-[#1B355E]">Description *</label><Textarea className="mt-1" rows={3} value={nef.description} onChange={e => setNef({...nef, description: e.target.value})} /></div>
                  <div><label className="text-sm font-medium text-[#1B355E]">Activity Level *</label>
                    <Select value={nef.activityLevel} onValueChange={v => setNef({...nef, activityLevel: v})}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Local (1-2 LCs)</SelectItem>
                        <SelectItem value="national">National (EBTO/3+ LCs)</SelectItem>
                        <SelectItem value="regional">Regional (2 NMOs)</SelectItem>
                        <SelectItem value="international">International</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><label className="text-sm font-medium text-[#1B355E]">Standing Committee</label>
                    <Select value={nef.standingCommittee} onValueChange={v => setNef({...nef, standingCommittee: v})}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {STANDING_COMMITTEES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><label className="text-sm font-medium text-[#1B355E]">Start Date *</label><Input type="datetime-local" className="mt-1" value={nef.startDate} onChange={e => setNef({...nef, startDate: e.target.value})} /></div>
                  <div><label className="text-sm font-medium text-[#1B355E]">End Date *</label><Input type="datetime-local" className="mt-1" value={nef.endDate} onChange={e => setNef({...nef, endDate: e.target.value})} /></div>
                  <div><label className="text-sm font-medium text-[#1B355E]">Mode</label>
                    <Select value={nef.mode} onValueChange={v => setNef({...nef, mode: v})}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in_person">In Person</SelectItem>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><label className="text-sm font-medium text-[#1B355E]">Venue</label><Input className="mt-1" value={nef.venue} onChange={e => setNef({...nef, venue: e.target.value})} /></div>
                  <div><label className="text-sm font-medium text-[#1B355E]">City</label><Input className="mt-1" value={nef.city} onChange={e => setNef({...nef, city: e.target.value})} /></div>
                  <div><label className="text-sm font-medium text-[#1B355E]">Max Participants</label><Input type="number" className="mt-1" value={nef.maxParticipants || ""} onChange={e => setNef({...nef, maxParticipants: Number(e.target.value)})} /></div>
                  <div><label className="text-sm font-medium text-[#1B355E]">Budget (PKR)</label><Input type="number" className="mt-1" value={nef.budget || ""} onChange={e => setNef({...nef, budget: Number(e.target.value)})} /></div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowNefForm(false)}>Cancel</Button>
                  <Button className="bg-[#138A73] text-white" disabled={!nef.title || !nef.description || submitNef.isPending} onClick={() => submitNef.mutate({
                    ...nef,
                    activityLevel: nef.activityLevel as "local" | "national" | "regional" | "international",
                    mode: nef.mode as "in_person" | "online" | "hybrid" | undefined,
                    startDate: nef.startDate ? new Date(nef.startDate) : undefined,
                    endDate: nef.endDate ? new Date(nef.endDate) : undefined,
                  })}>
                    {submitNef.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Submit NEF
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {myNefQuery.isLoading ? (
            <Card className="msap-card py-16 text-center"><CardContent><Loader2 className="mx-auto h-8 w-8 animate-spin text-[#138A73]" /></CardContent></Card>
          ) : myNef.length === 0 ? (
            <Card className="msap-card py-12 text-center"><CardContent><FileText className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" /><p className="text-[#5D7086]">No NEF submissions yet. Submit your first activity enrollment above.</p></CardContent></Card>
          ) : (
            <div className="space-y-3">
              {myNef.map((a: any) => (
                <Card key={a.id} className="msap-card msap-card-hover">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-semibold text-[#1B355E] truncate">{a.title}</h3>
                          <Badge className={`border text-[10px] ${sc(a.status)}`}>{a.status?.replace(/_/g, " ")}</Badge>
                          {a.activityLevel && <Badge variant="outline" className="text-[10px] border-[#D9E4E1]">{a.activityLevel}</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-[#5D7086] line-clamp-1">{a.description}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 text-xs text-[#8A9BAE]">
                        {a.startDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(a.startDate).toLocaleDateString()}</span>}
                        {a.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{a.city}</span>}
                        {a.certificateIssued && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"><Award className="h-3 w-3 mr-1" />Cert</Badge>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Submit NRF Tab ── */}
        <TabsContent value="nrf" className="space-y-4">
          <p className="text-sm text-[#66788D]">Select an approved activity to submit a National Report Form (§16.11).</p>
          {approvedActivities.length === 0 ? (
            <Card className="msap-card py-12 text-center"><CardContent><FileText className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" /><p className="text-[#5D7086]">No approved activities eligible for NRF yet.</p></CardContent></Card>
          ) : (
            <>
              <div className="grid gap-3">
                {approvedActivities.map((a: any) => (
                  <Card key={a.id} className={`msap-card cursor-pointer transition-colors ${nrfActivityId === a.id ? "ring-2 ring-[#138A73]" : ""}`} onClick={() => { setNrfActivityId(a.id); setNrf({...nrf, activityId: a.id}); }}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div><h3 className="font-semibold text-[#1B355E]">{a.title}</h3><p className="text-xs text-[#66788D]">{a.activityLevel} · {a.standingCommittee || "General"}</p></div>
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Approved</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {nrfActivityId && (
                <Card className="msap-card">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-bold text-[#1B355E]">Submit National Report Form (§16.11)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2"><label className="text-sm font-medium text-[#1B355E]">Activity Summary *</label><Textarea className="mt-1" rows={3} value={nrf.summary} onChange={e => setNrf({...nrf, summary: e.target.value})} /></div>
                      <div><label className="text-sm font-medium text-[#1B355E]">Participants</label><Input type="number" className="mt-1" value={nrf.participants || ""} onChange={e => setNrf({...nrf, participants: Number(e.target.value)})} /></div>
                      <div><label className="text-sm font-medium text-[#1B355E]">Actual Cost (PKR)</label><Input type="number" className="mt-1" value={nrf.budgetActual || ""} onChange={e => setNrf({...nrf, budgetActual: Number(e.target.value)})} /></div>
                      <div className="md:col-span-2"><label className="text-sm font-medium text-[#1B355E]">Impact</label><Textarea className="mt-1" rows={2} value={nrf.impact} onChange={e => setNrf({...nrf, impact: e.target.value})} /></div>
                      <div className="md:col-span-2"><label className="text-sm font-medium text-[#1B355E]">Outcomes</label><Textarea className="mt-1" rows={2} value={nrf.outcomes} onChange={e => setNrf({...nrf, outcomes: e.target.value})} /></div>
                      <div className="md:col-span-2"><label className="text-sm font-medium text-[#1B355E]">Challenges</label><Textarea className="mt-1" rows={2} value={nrf.challenges} onChange={e => setNrf({...nrf, challenges: e.target.value})} /></div>
                      <div className="md:col-span-2"><label className="text-sm font-medium text-[#1B355E]">Recommendations</label><Textarea className="mt-1" rows={2} value={nrf.recommendations} onChange={e => setNrf({...nrf, recommendations: e.target.value})} /></div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setNrfActivityId(null)}>Cancel</Button>
                      <Button className="bg-[#138A73] text-white" disabled={!nrf.summary || submitNrf.isPending} onClick={() => submitNrf.mutate({ activityId: nrfActivityId, content: { summary: nrf.summary, participants: nrf.participants || undefined, impact: nrf.impact || undefined, outcomes: nrf.outcomes || undefined, budgetActual: nrf.budgetActual || undefined, challenges: nrf.challenges || undefined, recommendations: nrf.recommendations || undefined } })}>
                        {submitNrf.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Submit NRF
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ── My NRF Reports Tab ── */}
        <TabsContent value="reports" className="space-y-4">
          {myNrfQuery.isLoading ? (
            <Card className="msap-card py-16 text-center"><CardContent><Loader2 className="mx-auto h-8 w-8 animate-spin text-[#138A73]" /></CardContent></Card>
          ) : myNrf.length === 0 ? (
            <Card className="msap-card py-12 text-center"><CardContent><FileText className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" /><p className="text-[#5D7086]">No NRF reports yet.</p></CardContent></Card>
          ) : (
            <div className="space-y-3">
              {myNrf.map((r: any) => {
                const c = (r.content ?? {}) as any;
                return (
                  <Card key={r.id} className="msap-card msap-card-hover">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-[#1B355E]">Activity #{r.activityId} Report</h3>
                          <p className="mt-1 text-xs text-[#5D7086] line-clamp-2">{c.summary}</p>
                          {c.participants && <p className="text-xs text-[#66788D] mt-1">Participants: {c.participants}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`border text-[10px] ${sc(r.status)}`}>{r.status}</Badge>
                          {r.status === "approved" && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"><Award className="h-3 w-3 mr-1" />Cert Eligible</Badge>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

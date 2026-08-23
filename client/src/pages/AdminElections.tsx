import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Vote, CheckCircle, Clock, Loader2, Plus, Search, Users,
  Shield, AlertTriangle, Award, BarChart3, Eye, UserPlus,
  FileText, Lock, Unlock, ChevronRight, Camera, Download,
  Ban, CheckCircle2, XCircle, Minus,
} from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-blue-100 text-blue-700",
  nominations_open: "bg-green-100 text-green-700",
  nominations_closed: "bg-yellow-100 text-yellow-700",
  eligibility_review: "bg-indigo-100 text-indigo-700",
  campaigning: "bg-purple-100 text-purple-700",
  ballot_finalized: "bg-cyan-100 text-cyan-700",
  voting_active: "bg-red-100 text-red-700",
  voting_closed: "bg-orange-100 text-orange-700",
  counting: "bg-amber-100 text-amber-700",
  disputes: "bg-rose-100 text-rose-700",
  certified: "bg-emerald-100 text-emerald-700",
  published_results: "bg-teal-100 text-teal-700",
  archived: "bg-gray-100 text-gray-500",
};

const ELECTION_TYPES = [
  { value: "presidential", label: "Presidential (§9.1.1)" },
  { value: "board", label: "Executive Board (EB)" },
  { value: "national_team", label: "Team of Officials (TO)" },
  { value: "supco", label: "Supervising Council (§9.3)" },
  { value: "nga_officer", label: "NGA Officer" },
  { value: "regional", label: "Regional Coordinator" },
  { value: "chapter", label: "Chapter President" },
  { value: "committee", label: "Committee Chair" },
  { value: "referendum", label: "Referendum" },
];

const VOTE_METHODS = [
  { value: "plurality", label: "Plurality (First Past Post)", desc: "Most votes wins" },
  { value: "majority", label: "Absolute Majority", desc: ">50% required" },
  { value: "ranked_choice", label: "Ranked Choice (IRV)", desc: "Instant Runoff Voting" },
  { value: "approval", label: "Approval Voting", desc: "Vote for all acceptable" },
  { value: "weighted", label: "Weighted Voting", desc: "LC-weighted votes (§8.7)" },
  { value: "multi_seat", label: "Multi-Seat", desc: "Multiple positions filled" },
];

const ELECTION_STATES = [
  "draft", "published", "nominations_open", "nominations_closed",
  "eligibility_review", "campaigning", "ballot_finalized",
  "voting_active", "voting_closed", "counting", "disputes",
  "certified", "published_results", "archived",
];

// ─── Component ──────────────────────────────────────────────────────────
export default function AdminElections() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTab, setSelectedTab] = useState("elections");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedElection, setSelectedElection] = useState<any>(null);
  const [candidateOpen, setCandidateOpen] = useState(false);
  const [observerOpen, setObserverOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [ballotPreviewOpen, setBallotPreviewOpen] = useState(false);

  const [newElection, setNewElection] = useState({
    title: "", description: "", type: "presidential",
    votingStart: "", votingEnd: "",
    votingMethod: "plurality",
    nominationsStart: "", nominationsEnd: "",
    requireEndorsement: false, minEndorsements: 0,
    requireStatement: false, disputePeriodDays: 7,
    requirePhoto: false, maxCampaignDays: 14,
  });

  const [newCandidate, setNewCandidate] = useState({
    name: "", position: "", statement: "", photoUrl: "",
    lc: "", endorsements: "",
  });

  const [disputeForm, setDisputeForm] = useState({
    candidateId: 0, reason: "", evidence: "",
  });

  // ─── Queries ────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.elections?.stats?.useQuery?.() ?? { data: undefined };
  const elections = adminTrpc.elections?.list?.useQuery?.({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 50,
  }) ?? { data: [], isLoading: false };

  const filtered = (elections.data ?? []).filter(
    (e: any) => !searchQuery || e.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─── State tracking ─────────────────────────────────────────────────
  const totalElections = filtered.length;
  const activeElections = filtered.filter((e: any) =>
    ["voting_active", "nominations_open", "campaigning"].includes(e.status)
  ).length;
  const certifiedElections = filtered.filter((e: any) =>
    ["certified", "published_results"].includes(e.status)
  ).length;
  const disputeElections = filtered.filter((e: any) => e.status === "disputes").length;

  // ─── Simulated candidates ──────────────────────────────────────────
  const [candidates, setCandidates] = useState<any[]>([
    { id: 1, name: "Dr. Ahmed Khan", position: "President", statement: "Committed to transparent governance and member empowerment.", lc: "KEMU LC", endorsements: 5, status: "approved", votes: 42 },
    { id: 2, name: "Dr. Fatima Ali", position: "President", statement: "Focus on international exchanges and research opportunities.", lc: "AKU LC", endorsements: 3, status: "approved", votes: 38 },
    { id: 3, name: "Dr. Hassan Raza", position: "Vice President", statement: "Strengthen chapter coordination and活动 funding.", lc: "SIMS LC", endorsements: 4, status: "approved", votes: 31 },
  ]);

  const advanceElection = (electionId: number, newStatus: string) => {
    toast.success(`Election advanced to: ${newStatus.replace(/_/g, " ")}`);
    setDetailOpen(false);
  };

  const openDetail = (election: any) => {
    setSelectedElection(election);
    setDetailOpen(true);
  };

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">Governance</p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E]">Election Runner</h1>
          <p className="mt-2 text-[#66788D]">§9, §13: Full election lifecycle — nominations, ballots, voting, counting, certification, disputes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setObserverOpen(true)}>
            <Eye className="h-4 w-4 mr-2" /> Observers
          </Button>
          <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Election
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Elections", value: totalElections, icon: Vote, color: "text-[#138A73]", bg: "bg-[#E7F4F0]" },
          { label: "Active", value: activeElections, icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Certified", value: certifiedElections, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
          { label: "Disputes", value: disputeElections, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Candidates", value: candidates.length, icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg ${stat.bg} p-2`}><stat.icon className={`h-5 w-5 ${stat.color}`} /></div>
                <div>
                  <p className="text-2xl font-bold text-[#1B355E]">{stat.value}</p>
                  <p className="text-xs text-[#5D7086]">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* §8.7 Voting Matrix */}
      <Card className="border-[#E7F4F0]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-[#1B355E] flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#138A73]" /> Voting Matrix — §8.7 (Bylaws)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E7F4F0]">
                  <th className="text-left py-2 px-3 font-semibold text-[#1B355E]">Organization Type</th>
                  <th className="text-center py-2 px-3 font-semibold text-[#138A73]">Plenary Votes (§8.7.1)</th>
                  <th className="text-center py-2 px-3 font-semibold text-[#1B355E]">Election Votes (§8.7.1)</th>
                  <th className="text-left py-2 px-3 font-semibold text-[#5D7086]">Rule Source</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { type: "Permanent Local Chapter", plenary: 1, election: "10 (max)", rule: "B-8.7.1", note: "If <10 delegates, votes = delegate count" },
                  { type: "Temporary Local Chapter", plenary: 1, election: "10 (max)", rule: "B-8.7.1", note: "If <10 delegates, votes = delegate count" },
                  { type: "Candidate Local Chapter", plenary: 0, election: 1, rule: "B-8.7.2", note: "Observation / candidacy status" },
                  { type: "Coordinator I (CI)", plenary: 0, election: 1, rule: "B-8.7.2", note: "Individual coordinator" },
                ].map((row) => (
                  <tr key={row.type} className="border-b border-[#F4F8F7] hover:bg-[#F4F8F7]">
                    <td className="py-2 px-3 font-medium text-[#1B355E]">{row.type}</td>
                    <td className="py-2 px-3 text-center">
                      <Badge className={row.plenary > 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}>
                        {row.plenary > 0 ? `${row.plenary} vote` : "0 (non-voting)"}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Badge className="bg-[#1B355E]/10 text-[#1B355E]">{row.election} vote{row.election !== 1 ? "s" : ""}</Badge>
                    </td>
                    <td className="py-2 px-3 text-xs text-[#5D7086]">
                      {row.rule} — {row.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[#5D7086] mt-3">§8.7.4: If &lt;10 delegates, election votes = delegate count. If &gt;10, Head of Delegation nominates voters. §8.7.6: Debts &gt; PKR 2,000 may suspend voting.</p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="border border-[#D9E4E1] bg-[#E9F0EE]">
          <TabsTrigger value="elections">Elections</TabsTrigger>
          <TabsTrigger value="candidates">Candidates</TabsTrigger>
          <TabsTrigger value="ballot">Ballot Preview</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="disputes">Disputes</TabsTrigger>
        </TabsList>

        {/* ─── Elections Tab ─────────────────────────────────────── */}
        <TabsContent value="elections" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5D7086]" />
              <Input className="pl-9" placeholder="Search elections..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {ELECTION_STATES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {elections.isLoading ? (
            <Card className="py-16 text-center"><CardContent><Loader2 className="mx-auto h-8 w-8 animate-spin text-[#138A73]" /></CardContent></Card>
          ) : filtered.length === 0 ? (
            <Card className="py-12 text-center"><CardContent><Vote className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" /><p className="text-[#5D7086]">No elections found</p></CardContent></Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((election: any) => (
                <Card key={election.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(election)}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-[#1B355E]">{election.title}</h3>
                          <Badge className={`text-[10px] ${STATUS_COLORS[election.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {election.status?.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-[#5D7086]">
                          <span className="capitalize">{election.type?.replace(/_/g, " ")}</span>
                          {election.votingStart && <span>{new Date(election.votingStart).toLocaleDateString()} — {new Date(election.votingEnd).toLocaleDateString()}</span>}
                          <span className="capitalize">{String(election.votingMethod?.type ?? election.votingMethod ?? "plurality").replace(/_/g, " ")}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-[#5D7086]" />
                    </div>
                    {/* State Machine Progress */}
                    <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
                      {ELECTION_STATES.slice(0, ELECTION_STATES.indexOf(election.status ?? "draft") + 1).map((state, idx) => (
                        <span key={state} className="shrink-0 rounded-full bg-[#138A73] px-2 py-0.5 text-[9px] font-semibold text-white">
                          {state.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Candidates Tab ────────────────────────────────────── */}
        <TabsContent value="candidates" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-[#1B355E]">Candidate Management</h3>
            <Button size="sm" className="bg-[#138A73] text-white" onClick={() => setCandidateOpen(true)}>
              <UserPlus className="h-3 w-3 mr-1" /> Add Candidate
            </Button>
          </div>
          <div className="space-y-3">
            {candidates.map((candidate) => (
              <Card key={candidate.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#1B355E] to-[#138A73] flex items-center justify-center text-white font-bold">
                      {candidate.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-[#1B355E]">{candidate.name}</h4>
                        <Badge className={`text-[10px] ${candidate.status === "approved" ? "bg-green-100 text-green-700" : candidate.status === "disqualified" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {candidate.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#5D7086]">{candidate.position} • {candidate.lc} • {candidate.endorsements} endorsements</p>
                      <p className="text-xs text-[#5D7086] mt-1 line-clamp-1">{candidate.statement}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-[#1B355E]">{candidate.votes}</p>
                      <p className="text-xs text-[#5D7086]">votes</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => toast.success("Candidate approved")}>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toast.error("Candidate disqualified")}>
                        <XCircle className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ─── Ballot Preview Tab ────────────────────────────────── */}
        <TabsContent value="ballot" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2">
                <FileText className="h-5 w-5" /> Ballot Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#5D7086] mb-4">§9.5: Ballot design preview — positions, candidates, and voting method</p>
              <div className="rounded-lg border-2 border-[#1B355E] p-6 max-w-lg">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-[#1B355E]">MSA-Pakistan Official Ballot</h3>
                  <p className="text-sm text-[#5D7086]">National General Assembly 2025-26</p>
                </div>
                {/* Group candidates by position */}
                {["President", "Vice President"].map(position => (
                  <div key={position} className="mb-6">
                    <h4 className="font-bold text-[#1B355E] border-b border-[#E7F4F0] pb-2 mb-3">{position}</h4>
                    <p className="text-xs text-[#5D7086] mb-2">Method: Plurality (First Past Post)</p>
                    {candidates.filter(c => c.position === position).map((candidate, idx) => (
                      <label key={candidate.id} className="flex items-center gap-3 rounded-lg border border-[#E7F4F0] p-3 mb-2 hover:bg-[#F8FBFA] cursor-pointer">
                        <input type="radio" name={position} className="h-4 w-4 text-[#138A73]" />
                        <div className="flex-1">
                          <p className="font-medium text-[#1B355E]">{candidate.name}</p>
                          <p className="text-xs text-[#5D7086]">{candidate.lc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Results Tab ───────────────────────────────────────── */}
        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2">
                <BarChart3 className="h-5 w-5" /> Election Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#5D7086] mb-4">Certified results with turnout, quorum status, and winner declaration</p>
              {certifiedElections === 0 ? (
                <p className="text-center py-8 text-[#5D7086]">No certified results yet</p>
              ) : (
                <div className="space-y-4">
                  {["President", "Vice President"].map(position => {
                    const posCandidates = candidates.filter(c => c.position === position);
                    const totalVotes = posCandidates.reduce((sum, c) => sum + c.votes, 0);
                    const winner = posCandidates.sort((a, b) => b.votes - a.votes)[0];
                    return (
                      <div key={position} className="rounded-lg border border-[#E7F4F0] p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-[#1B355E]">{position}</h4>
                          <Badge className="bg-emerald-100 text-emerald-700">Certified</Badge>
                        </div>
                        <div className="space-y-2">
                          {posCandidates.sort((a, b) => b.votes - a.votes).map((candidate, idx) => {
                            const pct = totalVotes > 0 ? (candidate.votes / totalVotes * 100) : 0;
                            return (
                              <div key={candidate.id} className="flex items-center gap-3">
                                <span className="w-6 text-center text-sm font-bold text-[#1B355E]">{idx + 1}</span>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-[#1B355E]">{candidate.name}</span>
                                    <span className="text-sm text-[#5D7086]">{candidate.votes} votes ({pct.toFixed(1)}%)</span>
                                  </div>
                                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${idx === 0 ? "bg-[#138A73]" : "bg-[#8A9BAE]"}`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                                {idx === 0 && <Award className="h-5 w-5 text-amber-500" />}
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-xs text-[#5D7086] mt-3">Total votes: {totalVotes} • Turnout: 78% • Quorum: Met</p>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => toast.info("PDF export coming soon")}><Download className="h-4 w-4 mr-2" /> Export Results PDF</Button>
                <Button variant="outline" onClick={() => toast.info("Certificate generation coming soon")}><Award className="h-4 w-4 mr-2" /> Generate Certificates</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Disputes Tab ──────────────────────────────────────── */}
        <TabsContent value="disputes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2">
                <Shield className="h-5 w-5" /> Dispute Resolution — §9.7
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#5D7086] mb-4">Formal objection, appeal, evidence, review panel, and resolution workflow</p>
              <div className="flex justify-end mb-4">
                <Button size="sm" className="bg-[#138A73] text-white" onClick={() => setDisputeOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" /> File Dispute
                </Button>
              </div>
              <p className="text-center py-8 text-[#5D7086]">No active disputes</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Create Election Dialog ─────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Election</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-[#1B355E]">Title *</label>
              <Input value={newElection.title} onChange={(e) => setNewElection({ ...newElection, title: e.target.value })} placeholder="e.g. National President 2025-26" className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-[#1B355E]">Description</label>
              <Textarea value={newElection.description} onChange={(e) => setNewElection({ ...newElection, description: e.target.value })} rows={2} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B355E]">Type</label>
              <Select value={newElection.type} onValueChange={(v) => setNewElection({ ...newElection, type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ELECTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B355E]">Voting Method</label>
              <Select value={newElection.votingMethod} onValueChange={(v) => setNewElection({ ...newElection, votingMethod: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOTE_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B355E]">Nominations Open</label>
              <Input type="datetime-local" value={newElection.nominationsStart} onChange={(e) => setNewElection({ ...newElection, nominationsStart: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B355E]">Nominations Close</label>
              <Input type="datetime-local" value={newElection.nominationsEnd} onChange={(e) => setNewElection({ ...newElection, nominationsEnd: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B355E]">Voting Opens *</label>
              <Input type="datetime-local" value={newElection.votingStart} onChange={(e) => setNewElection({ ...newElection, votingStart: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B355E]">Voting Closes *</label>
              <Input type="datetime-local" value={newElection.votingEnd} onChange={(e) => setNewElection({ ...newElection, votingEnd: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B355E]">Dispute Period (days)</label>
              <Input type="number" value={newElection.disputePeriodDays} onChange={(e) => setNewElection({ ...newElection, disputePeriodDays: Number(e.target.value) })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B355E]">Max Campaign Days</label>
              <Input type="number" value={newElection.maxCampaignDays} onChange={(e) => setNewElection({ ...newElection, maxCampaignDays: Number(e.target.value) })} className="mt-1" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newElection.requireEndorsement} onChange={(e) => setNewElection({ ...newElection, requireEndorsement: e.target.checked })} className="rounded border-[#D9E4E1]" />
                <span className="text-sm font-medium text-[#1B355E]">Require endorsement for nominations</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newElection.requireStatement} onChange={(e) => setNewElection({ ...newElection, requireStatement: e.target.checked })} className="rounded border-[#D9E4E1]" />
                <span className="text-sm font-medium text-[#1B355E]">Require candidate statement</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newElection.requirePhoto} onChange={(e) => setNewElection({ ...newElection, requirePhoto: e.target.checked })} className="rounded border-[#D9E4E1]" />
                <span className="text-sm font-medium text-[#1B355E]">Require candidate photo</span>
              </label>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white" onClick={() => { toast.success("Election created"); setCreateOpen(false); }} disabled={!newElection.title || !newElection.votingStart || !newElection.votingEnd}>
                Create Election
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Election Detail Dialog ─────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Election Detail</DialogTitle></DialogHeader>
          {selectedElection && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-[#1B355E]">{selectedElection.title}</h2>
                <Badge className={STATUS_COLORS[selectedElection.status]}>{selectedElection.status?.replace(/_/g, " ")}</Badge>
              </div>
              {selectedElection.description && <p className="text-sm text-[#5D7086]">{selectedElection.description}</p>}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-[#E7F4F0] p-3"><p className="text-[#8A9BAE] text-xs">Type</p><p className="font-semibold text-[#1B355E] capitalize">{selectedElection.type?.replace(/_/g, " ")}</p></div>
                <div className="rounded-lg border border-[#E7F4F0] p-3"><p className="text-[#8A9BAE] text-xs">Method</p><p className="font-semibold text-[#1B355E] capitalize">{String(selectedElection.votingMethod?.type ?? selectedElection.votingMethod ?? "plurality").replace(/_/g, " ")}</p></div>
                <div className="rounded-lg border border-[#E7F4F0] p-3"><p className="text-[#8A9BAE] text-xs">Voting Opens</p><p className="font-semibold text-[#1B355E]">{selectedElection.votingStart ? new Date(selectedElection.votingStart).toLocaleString() : "—"}</p></div>
                <div className="rounded-lg border border-[#E7F4F0] p-3"><p className="text-[#8A9BAE] text-xs">Voting Closes</p><p className="font-semibold text-[#1B355E]">{selectedElection.votingEnd ? new Date(selectedElection.votingEnd).toLocaleString() : "—"}</p></div>
              </div>
              {/* State Machine Actions */}
              <div className="border-t border-[#E7F4F0] pt-4">
                <p className="text-sm font-medium text-[#1B355E] mb-3">Advance Election State</p>
                <div className="flex flex-wrap gap-2">
                  {selectedElection.status === "draft" && <Button size="sm" className="bg-blue-600 text-white" onClick={() => advanceElection(selectedElection.id, "published")}>Publish</Button>}
                  {selectedElection.status === "published" && <Button size="sm" className="bg-green-600 text-white" onClick={() => advanceElection(selectedElection.id, "nominations_open")}>Open Nominations</Button>}
                  {selectedElection.status === "nominations_open" && <Button size="sm" className="bg-yellow-600 text-white" onClick={() => advanceElection(selectedElection.id, "nominations_closed")}>Close Nominations</Button>}
                  {selectedElection.status === "nominations_closed" && <Button size="sm" className="bg-indigo-600 text-white" onClick={() => advanceElection(selectedElection.id, "eligibility_review")}>Review Eligibility</Button>}
                  {selectedElection.status === "eligibility_review" && <Button size="sm" className="bg-purple-600 text-white" onClick={() => advanceElection(selectedElection.id, "campaigning")}>Start Campaigning</Button>}
                  {selectedElection.status === "campaigning" && <Button size="sm" className="bg-cyan-600 text-white" onClick={() => advanceElection(selectedElection.id, "ballot_finalized")}>Finalize Ballot</Button>}
                  {selectedElection.status === "ballot_finalized" && <Button size="sm" className="bg-red-600 text-white" onClick={() => advanceElection(selectedElection.id, "voting_active")}><Lock className="h-3 w-3 mr-1" /> Open Voting</Button>}
                  {selectedElection.status === "voting_active" && <Button size="sm" className="bg-orange-600 text-white" onClick={() => advanceElection(selectedElection.id, "voting_closed")}><Unlock className="h-3 w-3 mr-1" /> Close Voting</Button>}
                  {selectedElection.status === "voting_closed" && <Button size="sm" className="bg-amber-600 text-white" onClick={() => advanceElection(selectedElection.id, "counting")}>Start Counting</Button>}
                  {selectedElection.status === "counting" && <Button size="sm" className="bg-emerald-600 text-white" onClick={() => advanceElection(selectedElection.id, "certified")}>Certify Results</Button>}
                  {selectedElection.status === "certified" && <Button size="sm" className="bg-teal-600 text-white" onClick={() => advanceElection(selectedElection.id, "published_results")}>Publish Results</Button>}
                  {selectedElection.status === "published_results" && <Button size="sm" variant="outline" onClick={() => advanceElection(selectedElection.id, "archived")}>Archive</Button>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Add Candidate Dialog ───────────────────────────────── */}
      <Dialog open={candidateOpen} onOpenChange={setCandidateOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Candidate</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><label className="text-sm font-medium text-[#1B355E]">Name *</label><Input value={newCandidate.name} onChange={(e) => setNewCandidate({ ...newCandidate, name: e.target.value })} placeholder="Candidate name" className="mt-1" /></div>
            <div><label className="text-sm font-medium text-[#1B355E]">Position</label><Input value={newCandidate.position} onChange={(e) => setNewCandidate({ ...newCandidate, position: e.target.value })} placeholder="e.g. President" className="mt-1" /></div>
            <div><label className="text-sm font-medium text-[#1B355E]">Local Council</label><Input value={newCandidate.lc} onChange={(e) => setNewCandidate({ ...newCandidate, lc: e.target.value })} placeholder="e.g. KEMU LC" className="mt-1" /></div>
            <div><label className="text-sm font-medium text-[#1B355E]">Candidate Statement</label><Textarea value={newCandidate.statement} onChange={(e) => setNewCandidate({ ...newCandidate, statement: e.target.value })} rows={3} className="mt-1" /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCandidateOpen(false)}>Cancel</Button>
              <Button className="bg-[#138A73] text-white" onClick={() => { setCandidates(prev => [...prev, { ...newCandidate, id: prev.length + 1, endorsements: 0, status: "pending", votes: 0 }]); toast.success("Candidate added"); setCandidateOpen(false); }} disabled={!newCandidate.name}>
                Add Candidate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Observers Dialog ───────────────────────────────────── */}
      <Dialog open={observerOpen} onOpenChange={setObserverOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Election Observers — §9.6</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-[#5D7086]">Authorized observers can monitor process status without seeing confidential ballots</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-[#E7F4F0] p-3">
                <div><p className="font-medium text-[#1B355E]">Observer Access</p><p className="text-xs text-[#5D7086]">View election status, candidate list, and turnout</p></div>
                <Badge className="bg-green-100 text-green-700">Active</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#E7F4F0] p-3">
                <div><p className="font-medium text-[#1B355E]">Ballot Secrecy</p><p className="text-xs text-[#5D7086]">Observers CANNOT see voter-to-choice mapping</p></div>
                <Badge className="bg-red-100 text-red-700">Enforced</Badge>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── File Dispute Dialog ────────────────────────────────── */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>File Election Dispute — §9.7</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><label className="text-sm font-medium text-[#1B355E]">Reason *</label><Textarea value={disputeForm.reason} onChange={(e) => setDisputeForm({ ...disputeForm, reason: e.target.value })} rows={3} placeholder="Describe the dispute..." className="mt-1" /></div>
            <div><label className="text-sm font-medium text-[#1B355E]">Evidence</label><Textarea value={disputeForm.evidence} onChange={(e) => setDisputeForm({ ...disputeForm, evidence: e.target.value })} rows={2} placeholder="Supporting evidence..." className="mt-1" /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDisputeOpen(false)}>Cancel</Button>
              <Button className="bg-red-600 text-white" onClick={() => { toast.success("Dispute filed"); setDisputeOpen(false); }} disabled={!disputeForm.reason}>
                File Dispute
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

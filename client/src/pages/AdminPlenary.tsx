import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2, Plus, Vote, FileText, Users, Gavel, CheckCircle2,
  Clock, MessageSquare, AlertTriangle, Eye, Play, Pause,
  StopCircle, ChevronRight, Hand, ListOrdered, ScrollText,
  Shield, ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────
type MotionStatus = "draft" | "proposed" | "seconded" | "debate" | "amendment" | "vote" | "adopted" | "rejected" | "withdrawn" | "postponed";
type ProceduralMotion = "adjourn" | "closure" | "postpone" | "referral" | "reconsider" | "suspend" | "point_of_order" | "vote_of_no_confidence";
type VoteMethod = "simple_majority" | "absolute_majority" | "two_thirds" | "consensus" | "roll_call" | "secret_ballot";

const MOTION_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  proposed: "bg-blue-100 text-blue-700",
  seconded: "bg-indigo-100 text-indigo-700",
  debate: "bg-yellow-100 text-yellow-700",
  amendment: "bg-purple-100 text-purple-700",
  vote: "bg-orange-100 text-orange-700",
  adopted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-gray-100 text-gray-500",
  postponed: "bg-amber-100 text-amber-700",
};

const SESSION_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-slate-100 text-slate-600",
  cancelled: "bg-red-100 text-red-700",
};

const PROCEDURAL_MOTIONS: { value: ProceduralMotion; label: string; bylaw: string }[] = [
  { value: "adjourn", label: "Adjourn", bylaw: "§8.4.11(d)" },
  { value: "closure", label: "Closure of Debate", bylaw: "§8.4.11(b)" },
  { value: "postpone", label: "Postpone", bylaw: "§8.4.11(g)" },
  { value: "referral", label: "Refer to Committee", bylaw: "§8.4.11" },
  { value: "reconsider", label: "Reconsider", bylaw: "§8.4.11" },
  { value: "suspend", label: "Suspend Bylaw Paragraph", bylaw: "§8.4.11(l)" },
  { value: "point_of_order", label: "Point of Order", bylaw: "§8.5" },
  { value: "vote_of_no_confidence", label: "Vote of No Confidence", bylaw: "§8.4.11(p)" },
];

const VOTE_METHODS: { value: VoteMethod; label: string }[] = [
  { value: "simple_majority", label: "Simple Majority (>50%)" },
  { value: "absolute_majority", label: "Absolute Majority (>50% of total)" },
  { value: "two_thirds", label: "Two-Thirds Supermajority (§17)" },
  { value: "consensus", label: "Consensus (No Objection)" },
  { value: "roll_call", label: "Roll-Call Vote (§8.4.11)" },
  { value: "secret_ballot", label: "Secret Ballot" },
];

// ─── Component ──────────────────────────────────────────────────────────
export default function AdminPlenary() {
  const [selectedTab, setSelectedTab] = useState("sessions");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createSessionOpen, setCreateSessionOpen] = useState(false);
  const [createMotionOpen, setCreateMotionOpen] = useState(false);
  const [speakerQueueOpen, setSpeakerQueueOpen] = useState(false);
  const [proceduralMotionOpen, setProceduralMotionOpen] = useState(false);
  const [rollCallOpen, setRollCallOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);

  const [newSession, setNewSession] = useState({
    title: "", description: "", type: "ordinary",
    scheduledStart: "", scheduledEnd: "",
    quorumRequired: 33,
  });

  const [newMotion, setNewMotion] = useState({
    title: "", text: "", type: "resolution",
    voteMethod: "simple_majority" as VoteMethod,
    sponsorId: 0, seconderId: 0,
  });

  const [speakerEntry, setSpeakerEntry] = useState({ delegateId: 0, name: "", priority: "normal" });
  const [proceduralVote, setProceduralVote] = useState({ type: "" as ProceduralMotion, reason: "" });
  // §8.7.1: Plenary voting matrix — Permanent/Temporary LC = 1 vote, Candidate LC/CI = 0 votes
  type DelegateType = "permanent_lc" | "temporary_lc" | "candidate_lc" | "ci";
  const DELEGATE_TYPES: { id: string; name: string; type: DelegateType; plenaryVotes: number }[] = [
    { id: "kemu", name: "KEMU LC", type: "permanent_lc", plenaryVotes: 1 },
    { id: "aku", name: "AKU LC", type: "permanent_lc", plenaryVotes: 1 },
    { id: "sims", name: "SIMS LC", type: "permanent_lc", plenaryVotes: 1 },
    { id: "isra", name: "ISRA LC", type: "permanent_lc", plenaryVotes: 1 },
    { id: "zmdc", name: "ZMDC LC", type: "temporary_lc", plenaryVotes: 1 },
    { id: "lums", name: "LUMS LC", type: "temporary_lc", plenaryVotes: 1 },
    { id: "ci_rawalpindi", name: "Rawalpindi CI", type: "ci", plenaryVotes: 0 },
    { id: "ci_islamabad", name: "Islamabad CI", type: "ci", plenaryVotes: 0 },
  ];
  const [rollCallVotes, setRollCallVotes] = useState<Record<string, "yes" | "no" | "abstain">>({});

  // ─── Queries ────────────────────────────────────────────────────────
  const sessionsQuery = trpc.admin.plenary.listSessions.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 50,
  });
  const resolutionsQuery = trpc.admin.plenary.listResolutions.useQuery({ limit: 50 });
  const statsQuery = trpc.admin.plenary.stats.useQuery();

  const createSession = trpc.admin.plenary.createSession.useMutation({
    onSuccess: () => {
      toast.success("Session created");
      setCreateSessionOpen(false);
      sessionsQuery.refetch();
      setNewSession({ title: "", description: "", type: "ordinary", scheduledStart: "", scheduledEnd: "", quorumRequired: 33 });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const sessions = (sessionsQuery.data ?? []) as any[];
  const resolutions = (resolutionsQuery.data ?? []) as any[];
  const totalSessions = sessions.length;
  const activeSessions = sessions.filter((s: any) => s.status === "in_progress").length;
  const totalResolutions = resolutions.length;
  const adoptedResolutions = resolutions.filter((r: any) => r.status === "adopted").length;
  const pendingMotions = resolutions.filter((r: any) => ["proposed", "seconded", "debate"].includes(r.status)).length;

  // ─── Speaker Queue (simulated) ─────────────────────────────────────
  const [speakerQueue, setSpeakerQueue] = useState<Array<{ id: number; name: string; priority: string; timeLimit: number; spokeAt?: string }>>([]);
  let speakerIdCounter = 0;

  const addToSpeakerQueue = () => {
    if (!speakerEntry.name) return;
    setSpeakerQueue(prev => [...prev, {
      id: ++speakerIdCounter,
      name: speakerEntry.name,
      priority: speakerEntry.priority,
      timeLimit: speakerEntry.priority === "point_of_order" ? 1 : 3,
    }]);
    setSpeakerEntry({ delegateId: 0, name: "", priority: "normal" });
    toast.success("Added to speaker queue");
  };

  const removeFromSpeakerQueue = (id: number) => {
    setSpeakerQueue(prev => prev.filter(s => s.id !== id));
  };

  const callNextSpeaker = () => {
    if (speakerQueue.length === 0) return;
    const next = speakerQueue[0];
    setSpeakerQueue(prev => prev.slice(1));
    toast.info(`Floor: ${next.name} (${next.priority})`);
  };

  // ─── Roll-Call Voting (simulated) ──────────────────────────────────
  const castRollCallVote = (delegate: string, vote: "yes" | "no" | "abstain") => {
    setRollCallVotes(prev => ({ ...prev, [delegate]: vote }));
  };

  const tallyRollCall = () => {
    let yes = 0, no = 0, abstain = 0, totalWeight = 0;
    for (const delegate of DELEGATE_TYPES) {
      const vote = rollCallVotes[delegate.id];
      if (vote) {
        totalWeight += delegate.plenaryVotes;
        if (vote === "yes") yes += delegate.plenaryVotes;
        else if (vote === "no") no += delegate.plenaryVotes;
        else abstain += delegate.plenaryVotes;
      }
    }
    return { yes, no, abstain, total: totalWeight, votedCount: Object.keys(rollCallVotes).length };
  };

  const getStatusColor = (status: string) => SESSION_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600";
  const getMotionStatusColor = (status: string) => MOTION_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600";

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">Governance</p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E]">Plenary Console</h1>
          <p className="mt-2 text-[#66788D]">§8.4: Parliamentary proceedings, motions, speaker queue, roll-call voting</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSpeakerQueueOpen(true)}>
            <Hand className="h-4 w-4 mr-2" /> Speaker Queue
          </Button>
          <Button variant="outline" onClick={() => setProceduralMotionOpen(true)}>
            <AlertTriangle className="h-4 w-4 mr-2" /> Procedural Motion
          </Button>
          <Button variant="outline" onClick={() => setRollCallOpen(true)}>
            <ListOrdered className="h-4 w-4 mr-2" /> Roll-Call Vote
          </Button>
          <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white" onClick={() => setCreateSessionOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Session
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Sessions", value: totalSessions, icon: Users, color: "text-[#106E5B]", bg: "bg-[#E7F4F0]" },
          { label: "In Progress", value: activeSessions, icon: Play, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Resolutions", value: totalResolutions, icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Adopted", value: adoptedResolutions, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
          { label: "Pending", value: pendingMotions, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1B355E]">{stat.value}</p>
                  <p className="text-xs text-[#66788D]">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="border border-[#D9E4E1] bg-[#E9F0EE]">
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="motions">Motions & Resolutions</TabsTrigger>
          <TabsTrigger value="speaker_queue">Speaker Queue</TabsTrigger>
          <TabsTrigger value="votes">Voting Record</TabsTrigger>
          <TabsTrigger value="minutes">Minutes</TabsTrigger>
        </TabsList>

        {/* ─── Sessions Tab ──────────────────────────────────────── */}
        <TabsContent value="sessions" className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sessionsQuery.isLoading ? (
            <Card className="py-16 text-center"><CardContent><Loader2 className="mx-auto h-8 w-8 animate-spin text-[#138A73]" /></CardContent></Card>
          ) : sessions.length === 0 ? (
            <Card className="py-12 text-center"><CardContent><Gavel className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" /><p className="text-[#5D7086]">No plenary sessions yet.</p></CardContent></Card>
          ) : (
            <div className="space-y-4">
              {sessions.map((session: any) => (
                <Card key={session.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-[#1B355E]">{session.title}</h3>
                        {session.description && <p className="text-sm text-[#5D7086] mt-1">{session.description}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Badge className={`border ${getStatusColor(session.status)}`}>{session.status?.replace(/_/g, " ")}</Badge>
                        {session.type === "annual" && <Badge className="border bg-blue-100 text-blue-700 border-blue-200">§8.1 NGA</Badge>}
                        {session.type === "presidents_session" && <Badge className="border bg-purple-100 text-purple-700 border-purple-200">§8.9</Badge>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-[#5D7086]">
                      <div><span className="text-[#8A9BAE]">Start:</span> {new Date(session.scheduledStart).toLocaleString()}</div>
                      <div><span className="text-[#8A9BAE]">End:</span> {new Date(session.scheduledEnd).toLocaleString()}</div>
                      <div><span className="text-[#8A9BAE]">Type:</span> {session.type?.replace(/_/g, " ")}</div>
                      <div><span className="text-[#8A9BAE]">Quorum:</span> {session.quorumRequired}%</div>
                    </div>
                    {session.status === "scheduled" && (
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => toast.success("Session started")}>
                          <Play className="h-3 w-3 mr-1" /> Start Session
                        </Button>
                      </div>
                    )}
                    {session.status === "in_progress" && (
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => toast.info("Session paused")}>
                          <Pause className="h-3 w-3 mr-1" /> Pause
                        </Button>
                        <Button size="sm" className="bg-red-600 text-white hover:bg-red-700" onClick={() => toast.success("Session ended")}>
                          <StopCircle className="h-3 w-3 mr-1" /> End Session
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Motions Tab ──────────────────────────────────────── */}
        <TabsContent value="motions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-[#1B355E]">Motions & Resolutions</h3>
            <Button size="sm" className="bg-[#138A73] text-white" onClick={() => setCreateMotionOpen(true)}>
              <Plus className="h-3 w-3 mr-1" /> New Motion
            </Button>
          </div>
          {resolutionsQuery.isLoading ? (
            <Card className="py-16 text-center"><CardContent><Loader2 className="mx-auto h-8 w-8 animate-spin text-[#138A73]" /></CardContent></Card>
          ) : resolutions.length === 0 ? (
            <Card className="py-12 text-center"><CardContent><FileText className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" /><p className="text-[#5D7086]">No motions yet. Propose one to get started.</p></CardContent></Card>
          ) : (
            <div className="space-y-3">
              {resolutions.map((res: any) => (
                <Card key={res.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-[#106E5B] bg-[#E7F4F0] px-2 py-0.5 rounded">{res.number}</span>
                          <h4 className="font-semibold text-[#1B355E]">{res.title}</h4>
                        </div>
                        <p className="text-sm text-[#5D7086] mt-1 line-clamp-2">{res.text}</p>
                        <div className="flex gap-3 mt-2 text-xs text-[#8A9BAE]">
                          {res.sponsor && <span>Sponsor: {res.sponsor}</span>}
                          {res.voteMethod && <span>Vote: {res.voteMethod}</span>}
                        </div>
                      </div>
                      <Badge className={`ml-3 border ${getMotionStatusColor(res.status)}`}>{res.status}</Badge>
                    </div>
                    {/* Quick Actions */}
                    {res.status === "proposed" && (
                      <div className="mt-3 flex gap-2 border-t border-[#E7F4F0] pt-3">
                        <Button size="sm" variant="outline" onClick={() => toast.success("Motion seconded")}>Second</Button>
                        <Button size="sm" variant="outline" onClick={() => toast.info("Motion withdrawn")}>Withdraw</Button>
                      </div>
                    )}
                    {res.status === "seconded" && (
                      <div className="mt-3 flex gap-2 border-t border-[#E7F4F0] pt-3">
                        <Button size="sm" className="bg-blue-600 text-white" onClick={() => toast.success("Debate opened")}>Open Debate</Button>
                        <Button size="sm" variant="outline" onClick={() => toast.info("Amendment proposed")}>Propose Amendment</Button>
                      </div>
                    )}
                    {res.status === "debate" && (
                      <div className="mt-3 flex gap-2 border-t border-[#E7F4F0] pt-3">
                        <Button size="sm" className="bg-orange-600 text-white" onClick={() => toast.success("Vote called")}>Call Vote</Button>
                        <Button size="sm" variant="outline" onClick={() => toast.info("Closure motion")}>Closure</Button>
                        <Button size="sm" variant="outline" onClick={() => toast.info("Postponed")}>Postpone</Button>
                      </div>
                    )}
                    {res.status === "vote" && (
                      <div className="mt-3 flex gap-2 border-t border-[#E7F4F0] pt-3">
                        <Button size="sm" className="bg-emerald-600 text-white" onClick={() => toast.success("Motion adopted")}>Adopt</Button>
                        <Button size="sm" className="bg-red-600 text-white" onClick={() => toast.success("Motion rejected")}>Reject</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Speaker Queue Tab ─────────────────────────────────── */}
        <TabsContent value="speaker_queue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2">
                <ListOrdered className="h-5 w-5" /> Speaker Queue ({speakerQueue.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input placeholder="Delegate name" value={speakerEntry.name} onChange={(e) => setSpeakerEntry({ ...speakerEntry, name: e.target.value })} className="flex-1" />
                <Select value={speakerEntry.priority} onValueChange={(v) => setSpeakerEntry({ ...speakerEntry, priority: v })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="right_of_reply">Right of Reply</SelectItem>
                    <SelectItem value="point_of_order">Point of Order (§8.5)</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addToSpeakerQueue} disabled={!speakerEntry.name}>Add</Button>
                <Button variant="outline" onClick={callNextSpeaker} disabled={speakerQueue.length === 0}>Call Next</Button>
              </div>
              {speakerQueue.length === 0 ? (
                <p className="text-center py-8 text-[#5D7086]">Speaker queue is empty</p>
              ) : (
                <div className="space-y-2">
                  {speakerQueue.map((speaker, idx) => (
                    <div key={speaker.id} className={`flex items-center gap-3 rounded-lg border p-3 ${idx === 0 ? "border-[#138A73] bg-[#F0FAF7]" : "border-[#E7F4F0]"}`}>
                      <span className="text-lg font-bold text-[#1B355E] w-8 text-center">{idx + 1}</span>
                      <div className="flex-1">
                        <p className="font-medium text-[#1B355E]">{speaker.name}</p>
                        <p className="text-xs text-[#5D7086]">{speaker.priority.replace(/_/g, " ")} • {speaker.timeLimit}min limit</p>
                      </div>
                      {idx === 0 && <Badge className="bg-emerald-100 text-emerald-700">Speaking</Badge>}
                      <Button size="sm" variant="ghost" onClick={() => removeFromSpeakerQueue(speaker.id)}>×</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Voting Record Tab ─────────────────────────────────── */}
        <TabsContent value="votes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#1B355E]">Voting Record</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#5D7086] mb-4">All adopted and rejected resolutions with voting tallies</p>
              {resolutions.filter(r => ["adopted", "rejected"].includes(r.status)).length === 0 ? (
                <p className="text-center py-8 text-[#5D7086]">No completed votes yet</p>
              ) : (
                <div className="space-y-3">
                  {resolutions.filter(r => ["adopted", "rejected"].includes(r.status)).map((res: any) => (
                    <div key={res.id} className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4">
                      <div className={`rounded-lg p-2.5 ${res.status === "adopted" ? "bg-emerald-50" : "bg-red-50"}`}>
                        {res.status === "adopted" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-red-600" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-[#106E5B] bg-[#E7F4F0] px-2 py-0.5 rounded">{res.number}</span>
                          <h4 className="font-semibold text-[#1B355E]">{res.title}</h4>
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-[#5D7086]">
                          <span>Method: {res.voteMethod || "simple_majority"}</span>
                          <span>Status: <Badge className={`text-[10px] ${res.status === "adopted" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{res.status}</Badge></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Minutes Tab ──────────────────────────────────────── */}
        <TabsContent value="minutes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2">
                <ScrollText className="h-5 w-5" /> Session Minutes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#5D7086] mb-4">§110: Structured minutes with attendance, motions, speakers, votes, and decisions</p>
              {sessions.length === 0 ? (
                <p className="text-center py-8 text-[#5D7086]">No sessions to generate minutes for</p>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session: any) => (
                    <div key={session.id} className="flex items-center justify-between rounded-lg border border-[#E7F4F0] p-4">
                      <div>
                        <h4 className="font-semibold text-[#1B355E]">{session.title}</h4>
                        <p className="text-xs text-[#5D7086]">{new Date(session.scheduledStart).toLocaleDateString()} • {session.status}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => toast.info("Minutes generation coming soon")}>
                        <ScrollText className="h-3 w-3 mr-1" /> Generate
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Create Session Dialog ─────────────────────────────── */}
      <Dialog open={createSessionOpen} onOpenChange={setCreateSessionOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Plenary Session</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><label className="text-sm font-medium text-[#1B355E]">Title *</label><Input value={newSession.title} onChange={(e) => setNewSession({ ...newSession, title: e.target.value })} placeholder="Session title" className="mt-1" /></div>
            <div><label className="text-sm font-medium text-[#1B355E]">Description</label><Textarea value={newSession.description} onChange={(e) => setNewSession({ ...newSession, description: e.target.value })} rows={2} className="mt-1" /></div>
            <div><label className="text-sm font-medium text-[#1B355E]">Type</label>
              <Select value={newSession.type} onValueChange={(v) => setNewSession({ ...newSession, type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ordinary">Ordinary Plenary</SelectItem>
                  <SelectItem value="extraordinary">Extraordinary Plenary</SelectItem>
                  <SelectItem value="annual">NGA — Annual General Assembly (§8.1)</SelectItem>
                  <SelectItem value="presidents_session">Presidents' Session (§8.9)</SelectItem>
                  <SelectItem value="standing_committee">Standing Committee (§10.2)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium text-[#1B355E]">Quorum Required (%)</label><Input type="number" value={newSession.quorumRequired} onChange={(e) => setNewSession({ ...newSession, quorumRequired: Number(e.target.value) })} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium text-[#1B355E]">Start *</label><Input type="datetime-local" value={newSession.scheduledStart} onChange={(e) => setNewSession({ ...newSession, scheduledStart: e.target.value })} className="mt-1" /></div>
              <div><label className="text-sm font-medium text-[#1B355E]">End *</label><Input type="datetime-local" value={newSession.scheduledEnd} onChange={(e) => setNewSession({ ...newSession, scheduledEnd: e.target.value })} className="mt-1" /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateSessionOpen(false)}>Cancel</Button>
              <Button className="bg-[#138A73] text-white" onClick={() => createSession.mutate({
                ...newSession,
                scheduledStart: new Date(newSession.scheduledStart),
                scheduledEnd: new Date(newSession.scheduledEnd),
                chairId: 1, secretaryId: 1,
              })} disabled={!newSession.title || !newSession.scheduledStart || createSession.isPending}>
                {createSession.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Create Motion Dialog ──────────────────────────────── */}
      <Dialog open={createMotionOpen} onOpenChange={setCreateMotionOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Propose Motion</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><label className="text-sm font-medium text-[#1B355E]">Title *</label><Input value={newMotion.title} onChange={(e) => setNewMotion({ ...newMotion, title: e.target.value })} placeholder="Motion title" className="mt-1" /></div>
            <div><label className="text-sm font-medium text-[#1B355E]">Text *</label><Textarea value={newMotion.text} onChange={(e) => setNewMotion({ ...newMotion, text: e.target.value })} rows={4} placeholder="Full text of the motion..." className="mt-1" /></div>
            <div><label className="text-sm font-medium text-[#1B355E]">Type</label>
              <Select value={newMotion.type} onValueChange={(v) => setNewMotion({ ...newMotion, type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="resolution">Resolution</SelectItem>
                  <SelectItem value="bylaw_change">Bylaw Change Proposal (§17)</SelectItem>
                  <SelectItem value="bylaw_suspension">Bylaw Suspension (§17.1)</SelectItem>
                  <SelectItem value="motion">Simple Motion</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium text-[#1B355E]">Vote Method</label>
              <Select value={newMotion.voteMethod} onValueChange={(v: any) => setNewMotion({ ...newMotion, voteMethod: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOTE_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateMotionOpen(false)}>Cancel</Button>
              <Button className="bg-[#138A73] text-white" onClick={() => { toast.success("Motion proposed"); setCreateMotionOpen(false); }} disabled={!newMotion.title || !newMotion.text}>
                Propose Motion
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Speaker Queue Dialog ──────────────────────────────── */}
      <Dialog open={speakerQueueOpen} onOpenChange={setSpeakerQueueOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Speaker Queue — §8.4</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-[#5D7086]">Chair controls: open/close speakers, speaking time, priority categories, points of order</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => toast.success("Speakers opened")}><Play className="h-3 w-3 mr-1" /> Open Speakers</Button>
              <Button variant="outline" onClick={() => toast.info("Speakers closed")}><StopCircle className="h-3 w-3 mr-1" /> Close Speakers</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Procedural Motion Dialog ──────────────────────────── */}
      <Dialog open={proceduralMotionOpen} onOpenChange={setProceduralMotionOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Procedural Motion — §8.4.11</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-[#5D7086]">Parliamentary procedural motions available to delegates</p>
            <div><label className="text-sm font-medium text-[#1B355E]">Motion Type</label>
              <Select value={proceduralVote.type} onValueChange={(v) => setProceduralVote({ ...proceduralVote, type: v as ProceduralMotion })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select motion" /></SelectTrigger>
                <SelectContent>
                  {PROCEDURAL_MOTIONS.map(m => <SelectItem key={m.value} value={m.value}>{m.label} ({m.bylaw})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium text-[#1B355E]">Reason / Justification</label><Textarea value={proceduralVote.reason} onChange={(e) => setProceduralVote({ ...proceduralVote, reason: e.target.value })} rows={2} className="mt-1" /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setProceduralMotionOpen(false)}>Cancel</Button>
              <Button className="bg-[#138A73] text-white" onClick={() => { toast.success(`Procedural motion: ${proceduralVote.type}`); setProceduralMotionOpen(false); }} disabled={!proceduralVote.type}>
                Submit Motion
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Roll-Call Vote Dialog ─────────────────────────────── */}
      <Dialog open={rollCallOpen} onOpenChange={setRollCallOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Roll-Call Vote — §8.4.11</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-[#5D7086]">Identifiable votes in official roll-call proceedings with complete decision record</p>
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_80px_100px] gap-2 px-3 text-xs font-semibold text-[#5D7086] uppercase tracking-wider">
                <span>Delegate</span><span>Type</span><span>Plenary Votes</span>
              </div>
              {DELEGATE_TYPES.map(delegate => (
                <div key={delegate.id} className={`flex items-center gap-3 rounded-lg border p-3 ${delegate.plenaryVotes === 0 ? "border-gray-200 bg-gray-50 opacity-70" : "border-[#E7F4F0]"}`}>
                  <span className="font-medium text-[#1B355E] w-32">{delegate.name}</span>
                  <Badge variant="outline" className={`text-[10px] w-20 justify-center ${delegate.type === "permanent_lc" ? "border-emerald-300 text-emerald-700" : delegate.type === "temporary_lc" ? "border-blue-300 text-blue-700" : "border-gray-300 text-gray-500"}`}>
                    {delegate.type === "permanent_lc" ? "Perm LC" : delegate.type === "temporary_lc" ? "Temp LC" : delegate.type === "candidate_lc" ? "Cand LC" : "CI"}
                  </Badge>
                  <span className={`text-sm font-bold w-20 text-center ${delegate.plenaryVotes > 0 ? "text-[#138A73]" : "text-gray-400"}`}>
                    {delegate.plenaryVotes > 0 ? `${delegate.plenaryVotes} vote${delegate.plenaryVotes > 1 ? "s" : ""}` : "—"}
                  </span>
                  {delegate.plenaryVotes > 0 ? (
                    <div className="flex gap-2 ml-auto">
                      <Button size="sm" variant={rollCallVotes[delegate.id] === "yes" ? "default" : "outline"} onClick={() => castRollCallVote(delegate.id, "yes")} className={rollCallVotes[delegate.id] === "yes" ? "bg-emerald-600 text-white" : ""}>
                        <ArrowUp className="h-3 w-3 mr-1" /> Yes
                      </Button>
                      <Button size="sm" variant={rollCallVotes[delegate.id] === "no" ? "default" : "outline"} onClick={() => castRollCallVote(delegate.id, "no")} className={rollCallVotes[delegate.id] === "no" ? "bg-red-600 text-white" : ""}>
                        <ArrowDown className="h-3 w-3 mr-1" /> No
                      </Button>
                      <Button size="sm" variant={rollCallVotes[delegate.id] === "abstain" ? "default" : "outline"} onClick={() => castRollCallVote(delegate.id, "abstain")} className={rollCallVotes[delegate.id] === "abstain" ? "bg-gray-600 text-white" : ""}>
                        <Minus className="h-3 w-3 mr-1" /> Abstain
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="outline" className="ml-auto border-gray-300 text-gray-400">Non-Voting (§8.7.2)</Badge>
                  )}
                  {rollCallVotes[delegate.id] && <Badge className="ml-2">{rollCallVotes[delegate.id]}</Badge>}
                </div>
              ))}
            </div>
            {Object.keys(rollCallVotes).length > 0 && (
              <div className="rounded-lg bg-[#F4F8F7] p-4">
                <h4 className="font-semibold text-[#1B355E] mb-2">Weighted Tally — §8.7.1</h4>
                <div className="grid grid-cols-5 gap-4 text-center">
                  <div><p className="text-2xl font-bold text-emerald-600">{tallyRollCall().yes}</p><p className="text-xs text-[#5D7086]">Yes</p></div>
                  <div><p className="text-2xl font-bold text-red-600">{tallyRollCall().no}</p><p className="text-xs text-[#5D7086]">No</p></div>
                  <div><p className="text-2xl font-bold text-gray-600">{tallyRollCall().abstain}</p><p className="text-xs text-[#5D7086]">Abstain</p></div>
                  <div><p className="text-2xl font-bold text-[#1B355E]">{tallyRollCall().total}</p><p className="text-xs text-[#5D7086]">Total Votes</p></div>
                  <div><p className="text-2xl font-bold text-[#5D7086]">{tallyRollCall().votedCount}</p><p className="text-xs text-[#5D7086]">Delegates Voted</p></div>
                </div>
                <p className="text-xs text-[#5D7086] mt-3">Plenary voting: Permanent/Temporary LC = 1 vote each • Candidate LC/CI = 0 votes (§8.7.1, §8.7.2)</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setRollCallVotes({}); setRollCallOpen(false); }}>Reset & Close</Button>
              <Button className="bg-[#138A73] text-white" onClick={() => { toast.success("Roll-call vote recorded"); setRollCallOpen(false); }} disabled={Object.keys(rollCallVotes).length === 0}>
                Record Vote
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

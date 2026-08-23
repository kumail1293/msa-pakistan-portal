import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Flag,
  Plus,
  Users,
  Calendar,
  MapPin,
  Clock,
  ChevronRight,
  Loader2,
  Shield,
  Vote,
  FileText,
  Gavel,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  Archive,
  ScrollText,
  ClipboardList,
  ArrowRight,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

// ─── NGA Status Lifecycle (§8.1) ──────────────────────────────────────
const NGA_STATUSES = [
  { value: "planning", label: "Planning", icon: Settings, color: "bg-gray-100 text-gray-700" },
  { value: "organizing_committee", label: "Organizing Committee", icon: Users, color: "bg-blue-100 text-blue-700" },
  { value: "call_for_participation", label: "Call for Participation", icon: FileText, color: "bg-indigo-100 text-indigo-700" },
  { value: "registration", label: "Registration", icon: ClipboardList, color: "bg-green-100 text-green-700" },
  { value: "credentialing", label: "Credentialing", icon: Shield, color: "bg-yellow-100 text-yellow-700" },
  { value: "preparation", label: "Preparation", icon: Settings, color: "bg-orange-100 text-orange-700" },
  { value: "opening", label: "Opening Ceremony", icon: Flag, color: "bg-purple-100 text-purple-700" },
  { value: "plenary", label: "Plenary Sessions", icon: Gavel, color: "bg-red-100 text-red-700" },
  { value: "committees", label: "Standing Committees", icon: Users, color: "bg-cyan-100 text-cyan-700" },
  { value: "elections", label: "Elections", icon: Vote, color: "bg-rose-100 text-rose-700" },
  { value: "reports", label: "Reports", icon: ScrollText, color: "bg-amber-100 text-amber-700" },
  { value: "bylaw_changes", label: "Bylaw Changes", icon: Gavel, color: "bg-teal-100 text-teal-700" },
  { value: "closing", label: "Closing Ceremony", icon: CheckCircle2, color: "bg-emerald-100 text-emerald-700" },
  { value: "certification", label: "Certification", icon: Shield, color: "bg-lime-100 text-lime-700" },
  { value: "archive", label: "Archived", icon: Archive, color: "bg-gray-100 text-gray-500" },
];

const STATUS_COLORS: Record<string, string> = Object.fromEntries(
  NGA_STATUSES.map((s) => [s.value, s.color])
);

const ORG_TYPES = [
  { value: "permanent_lc", label: "Permanent Local Chapter", plenaryVotes: 1, electionVotes: 10 },
  { value: "temporary_lc", label: "Temporary Local Chapter", plenaryVotes: 1, electionVotes: 10 },
  { value: "candidate_lc", label: "Candidate Local Chapter", plenaryVotes: 0, electionVotes: 1 },
  { value: "ci", label: "Coordinator I", plenaryVotes: 0, electionVotes: 1 },
];

// ─── Simulated Data ────────────────────────────────────────────────────
const MOCK_NGAS = [
  {
    id: 1,
    title: "3rd National General Assembly",
    edition: "3rd NGA",
    status: "planning",
    mode: "in_person",
    venue: "Expo Centre, Karachi",
    city: "Karachi",
    scheduledStart: "2026-07-25T09:00:00Z",
    scheduledEnd: "2026-07-28T17:00:00Z",
    participationFee: 5000,
    quorumRequired: 8,
    quorumMet: false,
    governanceVersion: "v3.2",
  },
  {
    id: 2,
    title: "2nd National General Assembly",
    edition: "2nd NGA",
    status: "archived",
    mode: "in_person",
    venue: "Serena Hotel, Islamabad",
    city: "Islamabad",
    scheduledStart: "2025-07-22T09:00:00Z",
    scheduledEnd: "2025-07-25T17:00:00Z",
    participationFee: 3000,
    quorumRequired: 7,
    quorumMet: true,
    governanceVersion: "v3.0",
  },
];

const MOCK_DELEGATIONS = [
  { id: 1, organizationName: "KEMU LC", organizationType: "permanent_lc", delegateCount: 8, maxDelegates: 10, status: "credentialed", plenaryVotes: 1, electionVotes: 10, feePaid: true, credentialStatus: "approved" },
  { id: 2, organizationName: "AKU LC", organizationType: "permanent_lc", delegateCount: 6, maxDelegates: 10, status: "registered", plenaryVotes: 1, electionVotes: 6, feePaid: true, credentialStatus: "submitted" },
  { id: 3, organizationName: "SIMS LC", organizationType: "permanent_lc", delegateCount: 10, maxDelegates: 10, status: "active", plenaryVotes: 1, electionVotes: 10, feePaid: true, credentialStatus: "approved" },
  { id: 4, organizationName: "ZMDC LC", organizationType: "temporary_lc", delegateCount: 5, maxDelegates: 10, status: "registered", plenaryVotes: 1, electionVotes: 5, feePaid: false, credentialStatus: "pending" },
  { id: 5, organizationName: "ISRA LC", organizationType: "permanent_lc", delegateCount: 4, maxDelegates: 10, status: "registered", plenaryVotes: 1, electionVotes: 4, feePaid: true, credentialStatus: "approved" },
  { id: 6, organizationName: "Rawalpindi CI", organizationType: "ci", delegateCount: 1, maxDelegates: 1, status: "registered", plenaryVotes: 0, electionVotes: 1, feePaid: true, credentialStatus: "approved" },
];

const MOCK_AGENDA = [
  { id: 1, order: 1, title: "Opening Ceremony & National Anthem", type: "opening", status: "approved", timeAllotted: 1800 },
  { id: 2, order: 2, title: "President's Address & Annual Report", type: "reports", status: "approved", timeAllotted: 2400 },
  { id: 3, order: 3, title: "Standing Committee Reports (§10)", type: "reports", status: "approved", timeAllotted: 5400 },
  { id: 4, order: 4, title: "Financial Report & Budget Approval (§11)", type: "reports", status: "approved", timeAllotted: 3600 },
  { id: 5, order: 5, title: "National Elections (§9)", type: "election", status: "proposed", timeAllotted: 7200 },
  { id: 6, order: 6, title: "Bylaw Amendments (§17)", type: "bylaw_changes", status: "proposed", timeAllotted: 3600 },
  { id: 7, order: 7, title: "New Business & Motions", type: "plenary", status: "proposed", timeAllotted: 3600 },
  { id: 8, order: 8, title: "Closing Ceremony & Resolutions", type: "closing", status: "proposed", timeAllotted: 1800 },
];

// ─── Component ─────────────────────────────────────────────────────────
export default function AdminNga() {
  const [selectedTab, setSelectedTab] = useState("overview");
  const [selectedNga, setSelectedNga] = useState<any>(MOCK_NGAS[0]);
  const [createOpen, setCreateOpen] = useState(false);
  const [delegationOpen, setDelegationOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);

  const [newNga, setNewNga] = useState({
    title: "",
    edition: "",
    scheduledStart: "",
    scheduledEnd: "",
    venue: "",
    city: "",
    mode: "in_person",
    participationFee: 0,
  });

  const [newDelegation, setNewDelegation] = useState({
    organizationName: "",
    organizationType: "permanent_lc",
    delegateCount: 1,
    headOfDelegationId: 0,
  });

  const [newAgendaItem, setNewAgendaItem] = useState({
    title: "",
    description: "",
    type: "plenary",
    order: MOCK_AGENDA.length + 1,
    timeAllotted: 1800,
  });

  const advanceStatus = (targetStatus: string) => {
    toast.success(`NGA advanced to: ${targetStatus.replace(/_/g, " ")}`);
    setSelectedNga({ ...selectedNga, status: targetStatus });
  };

  const statusInfo =
    NGA_STATUSES.find((s) => s.value === selectedNga?.status) ?? NGA_STATUSES[0];

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">
            Governance
          </p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E]">
            NGA Management
          </h1>
          <p className="mt-2 text-[#66788D]">
            §8.1: National General Assembly lifecycle — planning, delegations, credentials, plenary, elections
          </p>
        </div>
        <Button
          className="bg-[#138A73] hover:bg-[#106E5B] text-white"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" /> New NGA
        </Button>
      </div>

      {/* Status Pipeline */}
      <Card className="border-[#E7F4F0] overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {NGA_STATUSES.map((status, idx) => {
              const isCurrent = selectedNga?.status === status.value;
              const isPast =
                NGA_STATUSES.findIndex((s) => s.value === selectedNga?.status) > idx;
              return (
                <div key={status.value} className="flex items-center">
                  <button
                    onClick={() => advanceStatus(status.value)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-all ${
                      isCurrent
                        ? "bg-[#1B355E] text-white shadow-md"
                        : isPast
                        ? "bg-[#E7F4F0] text-[#106E5B]"
                        : "bg-gray-50 text-[#8A9BAE] hover:bg-gray-100"
                    }`}
                    title={`Advance to ${status.label}`}
                  >
                    <status.icon className="h-3 w-3" />
                    <span className="hidden lg:inline">{status.label}</span>
                  </button>
                  {idx < NGA_STATUSES.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-[#D9E4E1] mx-0.5 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-[#5D7086] mt-2">
            Click any status to advance the NGA lifecycle. §8.1 defines the complete meeting flow.
          </p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="border border-[#D9E4E1] bg-[#E9F0EE]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="delegations">Delegations</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="voting">Voting Matrix</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ─── Overview Tab ─────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          {/* NGA List */}
          <div className="grid gap-4 sm:grid-cols-2">
            {MOCK_NGAS.map((nga) => (
              <Card
                key={nga.id}
                className={`cursor-pointer border-[#E7F4F0] transition-all ${
                  selectedNga?.id === nga.id
                    ? "border-[#138A73] shadow-md"
                    : "hover:border-[#138A73]/50"
                }`}
                onClick={() => setSelectedNga(nga)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase text-[#106E5B]">{nga.edition}</p>
                      <h3 className="text-lg font-bold text-[#1B355E] mt-1">{nga.title}</h3>
                      <div className="mt-2 space-y-1 text-sm text-[#5D7086]">
                        <p className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" /> {nga.venue}, {nga.city}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />{" "}
                          {new Date(nga.scheduledStart).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <Badge className={STATUS_COLORS[nga.status] ?? "bg-gray-100 text-gray-700"}>
                      {nga.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-[#5D7086]">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {nga.mode === "in_person" ? "In Person" : nga.mode}
                    </span>
                    <span>•</span>
                    <span>Quorum: {nga.quorumRequired} LCs</span>
                    <span>•</span>
                    <span>Fee: PKR {nga.participationFee?.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Current NGA Details */}
          {selectedNga && (
            <Card className="border-[#E7F4F0]">
              <CardHeader>
                <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2">
                  <Flag className="h-5 w-5 text-[#138A73]" /> {selectedNga.title} — Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-[#5D7086]">Status</p>
                    <Badge className={STATUS_COLORS[selectedNga.status] ?? ""}>
                      {selectedNga.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-[#5D7086]">Mode</p>
                    <p className="font-semibold text-[#1B355E] capitalize">{selectedNga.mode?.replace("_", " ")}</p>
                  </div>
                  <div>
                    <p className="text-[#5D7086]">Governance Version</p>
                    <p className="font-semibold text-[#1B355E]">{selectedNga.governanceVersion}</p>
                  </div>
                  <div>
                    <p className="text-[#5D7086]">Quorum</p>
                    <p className="font-semibold text-[#1B355E]">
                      {selectedNga.quorumMet ? (
                        <span className="text-green-600">Met ✓</span>
                      ) : (
                        <span className="text-amber-600">Pending</span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Delegations Tab ──────────────────────────────────── */}
        <TabsContent value="delegations" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#1B355E]">
              Registered Delegations — {MOCK_DELEGATIONS.length}
            </h3>
            <Button size="sm" className="bg-[#138A73] text-white" onClick={() => setDelegationOpen(true)}>
              <Plus className="h-3 w-3 mr-1" /> Register Delegation
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E7F4F0]">
                  <th className="text-left py-3 px-3 font-semibold text-[#1B355E]">Organization</th>
                  <th className="text-left py-3 px-3 font-semibold text-[#1B355E]">Type</th>
                  <th className="text-center py-3 px-3 font-semibold text-[#1B355E]">Delegates</th>
                  <th className="text-center py-3 px-3 font-semibold text-[#138A73]">Plenary</th>
                  <th className="text-center py-3 px-3 font-semibold text-[#1B355E]">Election</th>
                  <th className="text-center py-3 px-3 font-semibold text-[#1B355E]">Fee</th>
                  <th className="text-center py-3 px-3 font-semibold text-[#1B355E]">Credential</th>
                  <th className="text-center py-3 px-3 font-semibold text-[#1B355E]">Status</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_DELEGATIONS.map((del) => {
                  const orgType = ORG_TYPES.find((t) => t.value === del.organizationType);
                  return (
                    <tr key={del.id} className="border-b border-[#F4F8F7] hover:bg-[#F4F8F7]">
                      <td className="py-3 px-3 font-medium text-[#1B355E]">{del.organizationName}</td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className={`text-[10px] ${
                          del.organizationType === "permanent_lc"
                            ? "border-emerald-300 text-emerald-700"
                            : del.organizationType === "temporary_lc"
                            ? "border-blue-300 text-blue-700"
                            : "border-gray-300 text-gray-500"
                        }`}>
                          {orgType?.label ?? del.organizationType}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">{del.delegateCount}/{del.maxDelegates}</td>
                      <td className="py-3 px-3 text-center">
                        <Badge className={del.plenaryVotes > 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}>
                          {del.plenaryVotes > 0 ? `${del.plenaryVotes} vote` : "—"}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-[#1B355E]">{del.electionVotes}</td>
                      <td className="py-3 px-3 text-center">
                        {del.feePaid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto" />
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge className={`text-[10px] ${
                          del.credentialStatus === "approved"
                            ? "bg-green-100 text-green-700"
                            : del.credentialStatus === "submitted"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-500"
                        }`}>
                          {del.credentialStatus}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge className={`text-[10px] ${
                          del.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : del.status === "credentialed"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          {del.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Quorum Summary */}
          <Card className="border-[#E7F4F0]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#5D7086]">
                  Quorum Requirement (§8.1.8): 1/3 of Permanent + Temporary LCs
                </span>
                <span className="font-bold text-[#1B355E]">
                  {MOCK_DELEGATIONS.filter((d) => d.status !== "withdrawn").length} /{" "}
                  {MOCK_DELEGATIONS.length} delegations active
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Agenda Tab ───────────────────────────────────────── */}
        <TabsContent value="agenda" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#1B355E]">NGA Agenda — §8.1</h3>
            <Button size="sm" className="bg-[#138A73] text-white" onClick={() => setAgendaOpen(true)}>
              <Plus className="h-3 w-3 mr-1" /> Add Item
            </Button>
          </div>

          <div className="space-y-2">
            {MOCK_AGENDA.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] bg-white p-4 hover:border-[#138A73]/50 transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E7F4F0] text-sm font-bold text-[#106E5B]">
                  {item.order}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1B355E]">{item.title}</p>
                  <p className="text-xs text-[#5D7086]">
                    Type: {item.type.replace(/_/g, " ")} • Time: {Math.floor(item.timeAllotted / 60)} min
                  </p>
                </div>
                <Badge className={`text-[10px] ${
                  item.status === "approved"
                    ? "bg-green-100 text-green-700"
                    : item.status === "in_progress"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ─── Voting Matrix Tab ────────────────────────────────── */}
        <TabsContent value="voting" className="space-y-4">
          <Card className="border-[#E7F4F0]">
            <CardHeader>
              <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2">
                <Vote className="h-5 w-5 text-[#138A73]" /> Plenary-Election Voting Matrix — §8.7
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
                    {ORG_TYPES.map((row) => (
                      <tr key={row.value} className="border-b border-[#F4F8F7] hover:bg-[#F4F8F7]">
                        <td className="py-3 px-3 font-medium text-[#1B355E]">{row.label}</td>
                        <td className="py-3 px-3 text-center">
                          <Badge className={row.plenaryVotes > 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}>
                            {row.plenaryVotes > 0 ? `${row.plenaryVotes} vote` : "0 (non-voting)"}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge className="bg-[#1B355E]/10 text-[#1B355E]">{row.electionVotes} vote{row.electionVotes !== 1 ? "s" : ""}</Badge>
                        </td>
                        <td className="py-3 px-3 text-xs text-[#5D7086]">
                          {row.value.includes("permanent") || row.value.includes("temporary")
                            ? "B-8.7.1: Full LC representation"
                            : "B-8.7.2: Limited participation"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-[#5D7086] mt-3">
                §8.7.4: If &lt;10 delegates, election votes = delegate count. If &gt;10, Head of Delegation nominates voters.
                §8.7.6: Debts &gt; PKR 2,000 may suspend voting.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── History Tab ──────────────────────────────────────── */}
        <TabsContent value="history" className="space-y-4">
          <Card className="border-[#E7F4F0]">
            <CardHeader>
              <CardTitle className="text-lg text-[#1B355E]">NGA History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {MOCK_NGAS.filter((n) => n.status === "archive").map((nga) => (
                  <div key={nga.id} className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E7F4F0]">
                      <Flag className="h-6 w-6 text-[#106E5B]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-[#1B355E]">{nga.title}</p>
                      <p className="text-sm text-[#5D7086]">
                        {nga.venue}, {nga.city} • {new Date(nga.scheduledStart).getFullYear()}
                      </p>
                    </div>
                    <Badge className="bg-gray-100 text-gray-500">Archived</Badge>
                  </div>
                ))}
                {MOCK_NGAS.filter((n) => n.status === "archive").length === 0 && (
                  <p className="text-center py-8 text-[#5D7086]">No previous NGAs</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Create NGA Dialog ─────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New NGA — §8.1</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-[#1B355E]">Title *</label>
              <Input
                value={newNga.title}
                onChange={(e) => setNewNga({ ...newNga, title: e.target.value })}
                placeholder="e.g. 3rd National General Assembly"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B355E]">Edition</label>
              <Input
                value={newNga.edition}
                onChange={(e) => setNewNga({ ...newNga, edition: e.target.value })}
                placeholder="e.g. 3rd NGA"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B355E]">Mode</label>
              <Select value={newNga.mode} onValueChange={(v) => setNewNga({ ...newNga, mode: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_person">In Person (§8.1.12)</SelectItem>
                  <SelectItem value="online">Online (§8.1.13)</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B355E]">Start Date *</label>
              <Input
                type="datetime-local"
                value={newNga.scheduledStart}
                onChange={(e) => setNewNga({ ...newNga, scheduledStart: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B355E]">End Date *</label>
              <Input
                type="datetime-local"
                value={newNga.scheduledEnd}
                onChange={(e) => setNewNga({ ...newNga, scheduledEnd: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B355E]">Venue</label>
              <Input
                value={newNga.venue}
                onChange={(e) => setNewNga({ ...newNga, venue: e.target.value })}
                placeholder="e.g. Expo Centre"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B355E]">City</label>
              <Input
                value={newNga.city}
                onChange={(e) => setNewNga({ ...newNga, city: e.target.value })}
                placeholder="e.g. Karachi"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B355E]">Participation Fee (PKR)</label>
              <Input
                type="number"
                value={newNga.participationFee || ""}
                onChange={(e) => setNewNga({ ...newNga, participationFee: Number(e.target.value) })}
                placeholder="0"
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button
                className="bg-[#138A73] text-white"
                onClick={() => {
                  toast.success("NGA created successfully");
                  setCreateOpen(false);
                }}
                disabled={!newNga.title || !newNga.scheduledStart}
              >
                Create NGA
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Register Delegation Dialog ────────────────────────── */}
      <Dialog open={delegationOpen} onOpenChange={setDelegationOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Register Delegation — §8.1.17</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-[#1B355E]">Organization Name *</label>
              <Input
                value={newDelegation.organizationName}
                onChange={(e) => setNewDelegation({ ...newDelegation, organizationName: e.target.value })}
                placeholder="e.g. KEMU LC"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B355E]">Type *</label>
              <Select
                value={newDelegation.organizationType}
                onValueChange={(v) => setNewDelegation({ ...newDelegation, organizationType: v })}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORG_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label} ({t.plenaryVotes}P / {t.electionVotes}E)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B355E]">Delegate Count</label>
              <Input
                type="number"
                value={newDelegation.delegateCount}
                onChange={(e) => setNewDelegation({ ...newDelegation, delegateCount: Number(e.target.value) })}
                min={1}
                max={10}
                className="mt-1"
              />
              <p className="text-xs text-[#5D7086] mt-1">Max 10 delegates. §8.7.4: If &lt;10, election votes = delegate count.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDelegationOpen(false)}>Cancel</Button>
              <Button
                className="bg-[#138A73] text-white"
                onClick={() => {
                  toast.success("Delegation registered");
                  setDelegationOpen(false);
                }}
                disabled={!newDelegation.organizationName}
              >
                Register
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Add Agenda Item Dialog ────────────────────────────── */}
      <Dialog open={agendaOpen} onOpenChange={setAgendaOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Agenda Item — §8.1</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-[#1B355E]">Title *</label>
              <Input
                value={newAgendaItem.title}
                onChange={(e) => setNewAgendaItem({ ...newAgendaItem, title: e.target.value })}
                placeholder="e.g. Standing Committee Reports"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B355E]">Description</label>
              <Textarea
                value={newAgendaItem.description}
                onChange={(e) => setNewAgendaItem({ ...newAgendaItem, description: e.target.value })}
                rows={2}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Type</label>
                <Select value={newAgendaItem.type} onValueChange={(v) => setNewAgendaItem({ ...newAgendaItem, type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["opening", "plenary", "standing_committee", "workshop", "election", "bylaw_changes", "reports", "closing", "other"].map((t) => (
                      <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Order</label>
                <Input
                  type="number"
                  value={newAgendaItem.order}
                  onChange={(e) => setNewAgendaItem({ ...newAgendaItem, order: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAgendaOpen(false)}>Cancel</Button>
              <Button
                className="bg-[#138A73] text-white"
                onClick={() => {
                  toast.success("Agenda item added");
                  setAgendaOpen(false);
                }}
                disabled={!newAgendaItem.title}
              >
                Add Item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

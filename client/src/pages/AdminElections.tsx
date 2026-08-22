import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Vote,
  CheckCircle,
  Clock,
  Loader2,
  Plus,
  Search,
  Users,
  Shield,
  AlertTriangle,
  Award,
  BarChart3,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-blue-100 text-blue-700",
  nominations_open: "bg-green-100 text-green-700",
  nominations_closed: "bg-yellow-100 text-yellow-700",
  campaigning: "bg-purple-100 text-purple-700",
  voting_active: "bg-red-100 text-red-700",
  counting: "bg-orange-100 text-orange-700",
  disputes: "bg-amber-100 text-amber-700",
  certified: "bg-emerald-100 text-emerald-700",
  published_results: "bg-teal-100 text-teal-700",
  archived: "bg-gray-100 text-gray-500",
};

const ELECTION_TYPES = [
  { value: "presidential", label: "Presidential" },
  { value: "board", label: "Board" },
  { value: "national_team", label: "National Team" },
  { value: "regional", label: "Regional" },
  { value: "chapter", label: "Chapter" },
  { value: "committee", label: "Committee" },
  { value: "referendum", label: "Referendum" },
];

export default function AdminElections() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newElection, setNewElection] = useState({
    title: "",
    description: "",
    type: "presidential",
    votingStart: "",
    votingEnd: "",
    votingMethod: "plurality",
    nominationsStart: "",
    nominationsEnd: "",
    requireEndorsement: false,
    minEndorsements: 0,
    requireStatement: false,
    disputePeriodDays: 7,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.elections?.stats?.useQuery?.() ?? { data: undefined };
  const elections = adminTrpc.elections?.list?.useQuery?.({
    status: statusFilter || undefined,
    limit: 50,
  }) ?? { data: [], isLoading: false };

  const filtered = (elections.data ?? []).filter(
    (e: any) =>
      !searchQuery ||
      e.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalElections = filtered.length;
  const activeElections = filtered.filter((e: any) =>
    ["voting_active", "nominations_open", "campaigning"].includes(e.status)
  ).length;
  const certifiedElections = filtered.filter((e: any) =>
    ["certified", "published_results"].includes(e.status)
  ).length;
  const disputeElections = filtered.filter((e: any) => e.status === "disputes").length;

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">Elections</h1>
          <p className="text-sm text-[#5D7086]">
            Democratic processes — nominations, ballots, counting, certification, and disputes
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white">
              <Plus className="h-4 w-4 mr-2" /> New Election
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Election</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-[#1B355E]">Title *</label>
                <Input
                  value={newElection.title}
                  onChange={(e) => setNewElection({ ...newElection, title: e.target.value })}
                  placeholder="Election title"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-[#1B355E]">Description</label>
                <Textarea
                  value={newElection.description}
                  onChange={(e) => setNewElection({ ...newElection, description: e.target.value })}
                  placeholder="Describe the election"
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Type</label>
                <Select value={newElection.type} onValueChange={(v) => setNewElection({ ...newElection, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ELECTION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Voting Method</label>
                <Select value={newElection.votingMethod} onValueChange={(v) => setNewElection({ ...newElection, votingMethod: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plurality">Plurality (First Past Post)</SelectItem>
                    <SelectItem value="majority">Majority</SelectItem>
                    <SelectItem value="ranked_choice">Ranked Choice</SelectItem>
                    <SelectItem value="runoff">Runoff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Nominations Open</label>
                <Input
                  type="datetime-local"
                  value={newElection.nominationsStart}
                  onChange={(e) => setNewElection({ ...newElection, nominationsStart: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Nominations Close</label>
                <Input
                  type="datetime-local"
                  value={newElection.nominationsEnd}
                  onChange={(e) => setNewElection({ ...newElection, nominationsEnd: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Voting Opens *</label>
                <Input
                  type="datetime-local"
                  value={newElection.votingStart}
                  onChange={(e) => setNewElection({ ...newElection, votingStart: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Voting Closes *</label>
                <Input
                  type="datetime-local"
                  value={newElection.votingEnd}
                  onChange={(e) => setNewElection({ ...newElection, votingEnd: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Dispute Period (days)</label>
                <Input
                  type="number"
                  value={newElection.disputePeriodDays}
                  onChange={(e) => setNewElection({ ...newElection, disputePeriodDays: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requireEndorsement"
                  checked={newElection.requireEndorsement}
                  onChange={(e) => setNewElection({ ...newElection, requireEndorsement: e.target.checked })}
                  className="rounded border-[#D9E4E1]"
                />
                <label htmlFor="requireEndorsement" className="text-sm font-medium text-[#1B355E]">
                  Require endorsement for nominations
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requireStatement"
                  checked={newElection.requireStatement}
                  onChange={(e) => setNewElection({ ...newElection, requireStatement: e.target.checked })}
                  className="rounded border-[#D9E4E1]"
                />
                <label htmlFor="requireStatement" className="text-sm font-medium text-[#1B355E]">
                  Require candidate statement
                </label>
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button
                  className="bg-[#138A73] hover:bg-[#106E5B] text-white"
                  onClick={() => toast.success("Election creation requires the elections engine to be connected")}
                  disabled={!newElection.title || !newElection.votingStart || !newElection.votingEnd}
                >
                  Create Election
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Elections", value: totalElections, icon: Vote, color: "text-[#138A73]" },
          { label: "Active", value: activeElections, icon: Clock, color: "text-blue-600" },
          { label: "Certified", value: certifiedElections, icon: CheckCircle, color: "text-green-600" },
          { label: "Disputes", value: disputeElections, icon: AlertTriangle, color: "text-orange-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg bg-gray-50 p-2 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1B355E]">{stat.value}</p>
                  <p className="text-xs text-[#5D7086]">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5D7086]" />
          <Input
            className="pl-9"
            placeholder="Search elections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="nominations_open">Nominations Open</SelectItem>
            <SelectItem value="voting_active">Voting Active</SelectItem>
            <SelectItem value="certified">Certified</SelectItem>
            <SelectItem value="published_results">Published Results</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Elections List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">
            Elections ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {elections.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <Vote className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No elections found</p>
              <p className="text-sm mt-1">Create your first election to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((election: any) => (
                <div
                  key={election.id}
                  className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors"
                >
                  <div className="rounded-lg bg-purple-50 p-2.5">
                    <Vote className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1B355E] truncate">{election.title}</h3>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_COLORS[election.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {election.status?.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-[#5D7086]">
                      <span className="flex items-center gap-1 capitalize">
                        <Vote className="h-3 w-3" /> {election.type?.replace(/_/g, " ")}
                      </span>
                      {election.votingStart && election.votingEnd && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(election.votingStart).toLocaleDateString()} — {new Date(election.votingEnd).toLocaleDateString()}
                        </span>
                      )}
                      {election.votingMethod && (
                        <span className="flex items-center gap-1 capitalize">
                          <BarChart3 className="h-3 w-3" /> {String(election.votingMethod?.type ?? election.votingMethod).replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Vote, CheckCircle2, Clock, Lock, AlertCircle, Loader2, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function MemberElections() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedTab, setSelectedTab] = useState("active");
  const [selectedBallots, setSelectedBallots] = useState<Record<string, string>>({});

  const electionsQuery = trpc.elections.list.useQuery({ limit: 50 });
  const myVotesQuery = trpc.elections.myVotes.useQuery();
  const castBallot = trpc.elections.castBallot.useMutation({
    onSuccess: () => {
      toast.success("Your ballot has been cast!");
      setSelectedBallots({});
      myVotesQuery.refetch();
    },
    onError: (err: any) => toast.error(err.message || "Could not cast ballot."),
  });

  const elections = (electionsQuery.data ?? []) as any[];
  const myVotes = (myVotesQuery.data ?? []) as any[];
  const votedElectionIds = new Set(myVotes.map((v: any) => v.electionId));

  const activeElections = elections.filter((e) => {
    const now = new Date();
    const start = new Date(e.votingStart);
    const end = new Date(e.votingEnd);
    return now >= start && now <= end;
  });

  const upcomingElections = elections.filter((e) => new Date(e.votingStart) > new Date());
  const pastElections = elections.filter((e) => new Date(e.votingEnd) < new Date());

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "upcoming": return "bg-blue-100 text-blue-700 border-blue-200";
      case "completed": return "bg-slate-100 text-slate-600 border-slate-200";
      default: return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const handleCastBallot = (electionId: number) => {
    const key = String(electionId);
    const selected = selectedBallots[key];
    if (!selected) {
      toast.error("Please select a candidate first.");
      return;
    }
    castBallot.mutate({ electionId, ballotData: { candidateId: selected } });
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="msap-page min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <Card className="msap-card p-10 text-center">
            <CardContent>
              <Lock className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
              <h2 className="text-xl font-bold text-[#1B355E]">Sign in to vote</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#5D7086]">
                Participate in MSAP elections after signing in.
              </p>
              <Button onClick={() => navigate("/login?next=/elections")} className="msap-primary-action mt-6 px-8 text-white">
                Member Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const ElectionCard = ({ election, showVoting = false }: { election: any; showVoting?: boolean }) => {
    const hasVoted = votedElectionIds.has(election.id);
    const key = String(election.id);
    const candidates = election.candidates ?? [];

    return (
      <Card className="msap-card msap-card-hover">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <h3 className="text-lg font-semibold text-[#1B355E] flex-1">{election.title}</h3>
            <Badge className={`border ${getStatusColor(showVoting ? "active" : election.status ?? "upcoming")}`}>
              {showVoting ? "Open" : election.status ?? "Upcoming"}
            </Badge>
            {election.type && (
              <Badge variant="outline" className="border-[#D9E4E1] text-[#66788D]">
                {election.type.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
          {election.description && (
            <p className="text-sm leading-6 text-[#5D7086] mb-4">{election.description}</p>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div>
              <p className="text-[#8A9BAE]">Voting Opens</p>
              <p className="font-semibold text-[#1B355E]">{new Date(election.votingStart).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-[#8A9BAE]">Voting Closes</p>
              <p className="font-semibold text-[#1B355E]">{new Date(election.votingEnd).toLocaleDateString()}</p>
            </div>
          </div>

          {showVoting && candidates.length > 0 && !hasVoted && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-[#1B355E]">Cast your vote:</p>
              <RadioGroup
                value={selectedBallots[key] || ""}
                onValueChange={(v) => setSelectedBallots((prev) => ({ ...prev, [key]: v }))}
                className="space-y-2"
              >
                {candidates.map((c: any) => (
                  <div key={c.id ?? c.name} className="flex items-center gap-3 rounded-xl border border-[#E7EFEC] p-3">
                    <RadioGroupItem value={String(c.id ?? c.name)} id={`el-${key}-${c.id ?? c.name}`} />
                    <Label htmlFor={`el-${key}-${c.id ?? c.name}`} className="flex-1 cursor-pointer text-[#1B355E]">
                      {c.name ?? c.title ?? `Candidate ${c.id}`}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <Button
                onClick={() => handleCastBallot(election.id)}
                disabled={!selectedBallots[key] || castBallot.isPending}
                className="msap-primary-action w-full text-white disabled:opacity-50"
              >
                {castBallot.isPending ? "Casting ballot..." : "Submit Ballot"}
              </Button>
            </div>
          )}

          {hasVoted && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 mt-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <p className="text-sm text-emerald-700">You have voted in this election.</p>
            </div>
          )}

          {!showVoting && !hasVoted && new Date(election.votingStart) > new Date() && (
            <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 mt-4">
              <Clock className="h-5 w-5 text-blue-500" />
              <p className="text-sm text-blue-700">Voting opens on {new Date(election.votingStart).toLocaleDateString()}.</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="msap-page min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">Democratic participation</p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E] sm:text-4xl">Elections</h1>
          <p className="mt-2 text-[#66788D]">Participate in MSAP elections and democratic processes</p>
        </div>

        <div className="msap-card mb-8 flex items-start gap-4 bg-[linear-gradient(135deg,#EAF7F3_0%,#F7FBFA_70%)] p-6">
          <AlertCircle className="mt-1 h-6 w-6 shrink-0 text-[#106E5B]" />
          <div>
            <h3 className="mb-1 font-semibold text-[#1B355E]">About Elections</h3>
            <p className="text-sm leading-6 text-[#42566E]">
              MSAP elections follow the NGA democratic process. Active elections allow eligible members
              to cast confidential ballots. Results are certified after the dispute period.
            </p>
          </div>
        </div>

        {electionsQuery.isLoading ? (
          <Card className="msap-card py-16 text-center">
            <CardContent>
              <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#138A73]" />
              <p className="text-[#5D7086]">Loading elections...</p>
            </CardContent>
          </Card>
        ) : elections.length === 0 ? (
          <Card className="msap-card py-12 text-center">
            <CardContent>
              <Vote className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
              <h3 className="text-lg font-semibold text-[#1B355E]">No elections yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-[#5D7086]">
                Elections will appear here when opened by the Executive Board.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
            <TabsList className="border border-[#D9E4E1] bg-[#E9F0EE]">
              <TabsTrigger value="active">Active ({activeElections.length})</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming ({upcomingElections.length})</TabsTrigger>
              <TabsTrigger value="past">Past ({pastElections.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {activeElections.length === 0 ? (
                <Card className="msap-card py-12 text-center">
                  <CardContent>
                    <BarChart3 className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
                    <p className="text-[#5D7086]">No active elections at the moment.</p>
                  </CardContent>
                </Card>
              ) : (
                activeElections.map((e) => <ElectionCard key={e.id} election={e} showVoting />)
              )}
            </TabsContent>

            <TabsContent value="upcoming" className="space-y-4">
              {upcomingElections.length === 0 ? (
                <Card className="msap-card py-12 text-center">
                  <CardContent>
                    <Clock className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
                    <p className="text-[#5D7086]">No upcoming elections scheduled.</p>
                  </CardContent>
                </Card>
              ) : (
                upcomingElections.map((e) => <ElectionCard key={e.id} election={e} />)
              )}
            </TabsContent>

            <TabsContent value="past" className="space-y-4">
              {pastElections.length === 0 ? (
                <Card className="msap-card py-12 text-center">
                  <CardContent>
                    <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
                    <p className="text-[#5D7086]">No past elections to display.</p>
                  </CardContent>
                </Card>
              ) : (
                pastElections.map((e) => <ElectionCard key={e.id} election={e} />)
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

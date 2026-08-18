import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Clock, Lock, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type SessionStatus = "Pending" | "Active" | "Closed";
type SessionView = {
  id: number;
  title: string;
  description: string | null;
  status: SessionStatus;
  startDate: Date;
  endDate: Date;
  options: string[];
  totals: Record<string, number>;
  totalVotes: number;
  userVote: string | null;
};

export default function Voting() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedVotes, setSelectedVotes] = useState<Record<string, string>>({});

  const sessionsQuery = trpc.voting.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const submitVote = trpc.voting.submitVote.useMutation({
    onSuccess: async () => {
      toast.success("Your vote has been recorded successfully!");
      setSelectedVotes((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => delete next[k]);
        return next;
      });
      await sessionsQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "Could not record your vote."),
  });

  const sessions = sessionsQuery.data ?? [];

  const handleSubmitVote = (sessionId: number) => {
    const selectedOption = selectedVotes[sessionId];
    if (!selectedOption) {
      toast.error("Please select an option first.");
      return;
    }
    submitVote.mutate({ sessionId, voteOption: selectedOption });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "Closed":
        return "bg-red-100 text-red-700 border-red-200";
      case "Pending":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "Active":
        return "Open";
      case "Pending":
        return "Upcoming";
      case "Closed":
        return "Closed";
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Active":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "Closed":
        return <Lock className="h-5 w-5 text-red-400" />;
      case "Pending":
        return <Clock className="h-5 w-5 text-blue-500" />;
      default:
        return null;
    }
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
                Voting is reserved for verified MSAP members. Sign in with your Membership ID to
                participate.
              </p>
              <Button
                onClick={() => navigate("/login?next=/voting")}
                className="msap-primary-action mt-6 px-8 text-white"
              >
                Member Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="msap-page min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">
            Democratic participation
          </p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E] sm:text-4xl">
            Member Voting
          </h1>
          <p className="mt-2 text-[#66788D]">
            Participate in important decisions shaping our organization
          </p>
        </div>

        {/* Voting Info */}
        <div className="msap-card mb-8 flex items-start gap-4 bg-[linear-gradient(135deg,#EAF7F3_0%,#F7FBFA_70%)] p-6">
          <AlertCircle className="mt-1 h-6 w-6 shrink-0 text-[#106E5B]" />
          <div>
            <h3 className="mb-1 font-semibold text-[#1B355E]">How Voting Works</h3>
            <p className="text-sm leading-6 text-[#42566E]">
              Only members nominated by their Local Council President can participate in voting.
              Your vote is confidential and secure. Each proposal shows real-time voting results.
            </p>
          </div>
        </div>

        {/* Proposals */}
        {sessionsQuery.isLoading ? (
          <Card className="msap-card py-16 text-center">
            <CardContent>
              <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#138A73]" />
              <p className="text-[#5D7086]">Loading voting sessions...</p>
            </CardContent>
          </Card>
        ) : sessions.length === 0 ? (
          <Card className="msap-card py-12 text-center">
            <CardContent>
              <Clock className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
              <h3 className="text-lg font-semibold text-[#1B355E]">No active voting sessions</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-[#5D7086]">
                There are no voting sessions open right now. Sessions appear here when the
                Executive Board opens them.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {sessions.map((session) => {
              const isOpen = session.status === "Active";
              const isUpcoming = session.status === "Pending";
              const isClosed = session.status === "Closed";
              const voted = Boolean(session.userVote);
              const totalVotes = session.totalVotes || 0;

              return (
                <Card key={session.id} className="msap-card msap-card-hover">
                  <CardContent className="space-y-6 p-6 sm:p-7">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="flex-1 text-xl font-bold text-[#1B355E]">{session.title}</h2>
                      <Badge className={`border ${getStatusColor(session.status)}`}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(session.status)}
                          {getStatusLabel(session.status)}
                        </div>
                      </Badge>
                    </div>

                    {session.description && (
                      <p className="text-sm leading-6 text-[#5D7086]">{session.description}</p>
                    )}

                    {/* Timeline */}
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-[#8A9BAE]">Start Date</p>
                        <p className="font-semibold text-[#1B355E]">
                          {new Date(session.startDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#8A9BAE]">End Date</p>
                        <p className="font-semibold text-[#1B355E]">
                          {new Date(session.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#8A9BAE]">Participation</p>
                        <p className="font-semibold text-[#1B355E]">
                          {totalVotes} {totalVotes === 1 ? "vote" : "votes"} cast
                        </p>
                      </div>
                    </div>

                    {/* Voting Options */}
                    {session.options.length === 0 ? (
                      <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                        <Clock className="h-5 w-5 text-blue-500" />
                        <p className="text-sm text-blue-700">
                          Voting options are being prepared by the Executive Board.
                        </p>
                      </div>
                    ) : (
                      <>
                        <RadioGroup
                          value={selectedVotes[session.id] || session.userVote || ""}
                          onValueChange={(value) =>
                            setSelectedVotes((prev) => ({ ...prev, [session.id]: value }))
                          }
                          disabled={!isOpen || voted}
                          className="space-y-3"
                        >
                          {session.options.map((option) => {
                            const count = session.totals[option] ?? 0;
                            const percentage =
                              totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                            return (
                              <div key={option} className="space-y-2">
                                <div className="flex items-center gap-3">
                                  <RadioGroupItem
                                    value={option}
                                    id={`${session.id}-${option}`}
                                    disabled={!isOpen || voted}
                                  />
                                  <Label
                                    htmlFor={`${session.id}-${option}`}
                                    className="flex-1 cursor-pointer text-[#1B355E]"
                                  >
                                    {option}
                                  </Label>
                                  {voted && session.userVote === option && (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                  )}
                                </div>
                                <div className="ml-8 space-y-1">
                                  <div className="flex justify-between text-xs text-[#5D7086]">
                                    <span>{count} votes</span>
                                    <span>{percentage}%</span>
                                  </div>
                                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#E9F0EE]">
                                    <div
                                      className="h-full bg-[linear-gradient(90deg,#1B355E,#138A73)] transition-all duration-500"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </RadioGroup>

                        {isOpen && !voted && (
                          <Button
                            onClick={() => handleSubmitVote(session.id)}
                            disabled={!selectedVotes[session.id] || submitVote.isPending}
                            className="msap-primary-action w-full text-white disabled:opacity-50"
                          >
                            {submitVote.isPending ? "Recording vote..." : "Submit Vote"}
                          </Button>
                        )}

                        {voted && (
                          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            <p className="text-sm text-emerald-700">
                              You have voted in this session.
                            </p>
                          </div>
                        )}

                        {isClosed && (
                          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
                            <Lock className="h-5 w-5 text-red-400" />
                            <p className="text-sm text-red-700">Voting has closed for this session.</p>
                          </div>
                        )}

                        {isUpcoming && (
                          <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                            <Clock className="h-5 w-5 text-blue-500" />
                            <p className="text-sm text-blue-700">
                              Voting opens on {new Date(session.startDate).toLocaleDateString()}.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* No Voting Access */}
        <Card className="msap-card mt-8 bg-[linear-gradient(135deg,#FFF8EC_0%,#FFFDF7_70%)]">
          <CardContent className="flex items-start gap-4 p-6">
            <AlertCircle className="mt-1 h-6 w-6 shrink-0 text-amber-500" />
            <div>
              <h3 className="mb-1 font-semibold text-[#1B355E]">Not a Voter Yet?</h3>
              <p className="mb-3 text-sm leading-6 text-[#42566E]">
                To participate in voting, you need to be nominated by your Local Council President.
                Contact your LC President to learn more about voter eligibility.
              </p>
              <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

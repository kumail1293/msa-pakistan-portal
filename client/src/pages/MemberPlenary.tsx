import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Lock, Gavel, FileText, CheckCircle2, Clock, Loader2, Scale } from "lucide-react";
import { useLocation } from "wouter";

export default function MemberPlenary() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedTab, setSelectedTab] = useState("sessions");

  const sessionsQuery = (trpc as any).plenary?.list?.useQuery?.({ limit: 20 }) ?? { data: [], isLoading: false };
  const resolutionsQuery = (trpc as any).plenary?.resolutions?.useQuery?.({ limit: 20 }) ?? { data: [], isLoading: false };

  const sessions = (sessionsQuery.data ?? []) as any[];
  const resolutions = (resolutionsQuery.data ?? []) as any[];

  const upcomingSessions = sessions.filter((s: any) => ["proposed", "scheduled"].includes(s.status));
  const activeSessions = sessions.filter((s: any) => s.status === "in_progress");
  const pastSessions = sessions.filter((s: any) => ["completed", "adjourned"].includes(s.status));

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_progress": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "scheduled": return "bg-blue-100 text-blue-700 border-blue-200";
      case "completed": return "bg-slate-100 text-slate-600 border-slate-200";
      case "adopted": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "published": return "bg-blue-100 text-blue-700 border-blue-200";
      default: return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="msap-page min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <Card className="msap-card p-10 text-center">
            <CardContent>
              <Lock className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
              <h2 className="text-xl font-bold text-[#1B355E]">Sign in to view plenary sessions</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#5D7086]">
                Access plenary proceedings and resolutions after signing in.
              </p>
              <Button onClick={() => navigate("/login?next=/plenary")} className="msap-primary-action mt-6 px-8 text-white">Member Sign In</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="msap-page min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">Parliamentary proceedings</p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E] sm:text-4xl">Plenary</h1>
          <p className="mt-2 text-[#66788D]">Assembly sessions, motions, and institutional decisions</p>
        </div>

        <div className="msap-card mb-8 flex items-start gap-4 bg-[linear-gradient(135deg,#EAF7F3_0%,#F7FBFA_70%)] p-6">
          <Scale className="mt-1 h-6 w-6 shrink-0 text-[#106E5B]" />
          <div>
            <h3 className="mb-1 font-semibold text-[#1B355E]">About Plenary Sessions</h3>
            <p className="text-sm leading-6 text-[#42566E]">
              Plenary sessions follow parliamentary procedure (WHO/UN/IFMSA-style). Members
              participate through delegations, propose motions, debate, and vote on institutional
              decisions. All adopted resolutions are published in the decision registry.
            </p>
          </div>
        </div>

        {sessionsQuery.isLoading ? (
          <Card className="msap-card py-16 text-center"><CardContent><Loader2 className="mx-auto h-8 w-8 animate-spin text-[#138A73]" /></CardContent></Card>
        ) : (
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
            <TabsList className="border border-[#D9E4E1] bg-[#E9F0EE]">
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="resolutions">Resolutions</TabsTrigger>
            </TabsList>

            <TabsContent value="sessions" className="space-y-6">
              {activeSessions.length > 0 && (
                <div>
                  <h2 className="mb-4 text-xl font-bold text-[#1B355E] flex items-center gap-2">
                    <Gavel className="h-5 w-5 text-emerald-500" /> Live Now
                  </h2>
                  <div className="space-y-4">
                    {activeSessions.map((session: any) => (
                      <Card key={session.id} className="msap-card border-emerald-200 bg-emerald-50/30">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-[#1B355E]">{session.title}</h3>
                              <div className="flex flex-wrap gap-1 mt-1">
                                <Badge className={`border ${getStatusColor(session.status)}`}>In Progress</Badge>
                                {session.type === "annual" && <Badge className="border bg-blue-100 text-blue-700 border-blue-200">NGA (§8.1)</Badge>}
                                {session.type === "presidents_session" && <Badge className="border bg-purple-100 text-purple-700 border-purple-200">Presidents' Session (§8.9)</Badge>}
                                {session.type === "standing_committee" && <Badge className="border bg-amber-100 text-amber-700 border-amber-200">SC Session (§10.2)</Badge>}
                                {session.type === "extraordinary" && <Badge className="border bg-red-100 text-red-700 border-red-200">Extraordinary</Badge>}
                              </div>
                            </div>
                          </div>
                          {session.description && <p className="text-sm text-[#5D7086] mt-2">{session.description}</p>}
                          <div className="mt-3 flex items-center gap-4 text-sm text-[#5D7086]">
                            <span>Started: {session.actualStart ? new Date(session.actualStart).toLocaleString() : "—"}</span>
                            <span>Quorum: {session.membersPresent}/{session.totalEligibleVoters} ({session.quorumMet ? "Met" : "Not Met"})</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {upcomingSessions.length > 0 && (
                <div>
                  <h2 className="mb-4 text-xl font-bold text-[#1B355E]">Upcoming</h2>
                  <div className="space-y-4">
                    {upcomingSessions.map((session: any) => (
                      <Card key={session.id} className="msap-card msap-card-hover">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-[#1B355E]">{session.title}</h3>
                              <div className="flex flex-wrap gap-1 mt-1">
                                <Badge className={`border ${getStatusColor(session.status)}`}>{session.status?.replace(/_/g, " ")}</Badge>
                                {session.type === "annual" && <Badge className="border bg-blue-100 text-blue-700 border-blue-200">NGA (§8.1)</Badge>}
                                {session.type === "presidents_session" && <Badge className="border bg-purple-100 text-purple-700 border-purple-200">Presidents' Session (§8.9)</Badge>}
                                {session.type === "standing_committee" && <Badge className="border bg-amber-100 text-amber-700 border-amber-200">SC Session (§10.2)</Badge>}
                              </div>
                            </div>
                          </div>
                          {session.description && <p className="text-sm text-[#5D7086] mt-2">{session.description}</p>}
                          <div className="mt-3 flex items-center gap-4 text-sm text-[#5D7086]">
                            <Clock className="h-4 w-4 text-[#138A73]" />
                            <span>{new Date(session.scheduledStart).toLocaleString()}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {pastSessions.length > 0 && (
                <div>
                  <h2 className="mb-4 text-xl font-bold text-[#1B355E]">Past Sessions</h2>
                  <div className="space-y-4">
                    {pastSessions.map((session: any) => (
                      <Card key={session.id} className="msap-card opacity-75">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between">
                            <h3 className="font-semibold text-[#1B355E]">{session.title}</h3>
                            <Badge className={`border ${getStatusColor(session.status)}`}>{session.status}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {sessions.length === 0 && (
                <Card className="msap-card py-12 text-center">
                  <CardContent>
                    <Gavel className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
                    <h3 className="text-lg font-semibold text-[#1B355E]">No plenary sessions</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm text-[#5D7086]">Sessions will appear here when scheduled.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="resolutions" className="space-y-4">
              {resolutionsQuery.isLoading ? (
                <Card className="msap-card py-16 text-center"><CardContent><Loader2 className="mx-auto h-8 w-8 animate-spin text-[#138A73]" /></CardContent></Card>
              ) : resolutions.length === 0 ? (
                <Card className="msap-card py-12 text-center">
                  <CardContent>
                    <FileText className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" />
                    <h3 className="text-lg font-semibold text-[#1B355E]">No resolutions yet</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm text-[#5D7086]">Adopted resolutions will appear here.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {resolutions.map((res: any) => (
                    <Card key={res.id} className="msap-card msap-card-hover">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-[#106E5B] bg-[#E7F4F0] px-2 py-0.5 rounded">{res.number}</span>
                              <h3 className="text-lg font-semibold text-[#1B355E]">{res.title}</h3>
                            </div>
                            <p className="text-sm text-[#5D7086] mt-2">{res.text}</p>
                            <div className="mt-3 flex items-center gap-3 text-xs text-[#8A9BAE]">
                              {res.adoptedAt && <span>Adopted: {new Date(res.adoptedAt).toLocaleDateString()}</span>}
                              {res.publishedAt && <span>Published: {new Date(res.publishedAt).toLocaleDateString()}</span>}
                            </div>
                          </div>
                          <Badge className={`ml-3 border ${getStatusColor(res.status)}`}>{res.status}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

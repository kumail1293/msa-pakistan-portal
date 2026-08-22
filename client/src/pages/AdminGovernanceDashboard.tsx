import { useAuth } from "@/_core/hooks/useAuth";
import { canAccessModule } from "@/_core/access";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Scale,
  Calendar,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  ChevronRight,
  RefreshCw,
  Loader2,
  Vote,
  Building,
  Shield,
  TrendingUp,
  ArrowUpRight,
  Settings,
} from "lucide-react";

// ── Status badge color mapping ────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  planning: "bg-blue-50 text-blue-700 border-blue-200",
  organizing_committee: "bg-blue-50 text-blue-700 border-blue-200",
  call_for_participation: "bg-indigo-50 text-indigo-700 border-indigo-200",
  registration: "bg-purple-50 text-purple-700 border-purple-200",
  credentialing: "bg-violet-50 text-violet-700 border-violet-200",
  preparation: "bg-cyan-50 text-cyan-700 border-cyan-200",
  opening: "bg-green-50 text-green-700 border-green-200",
  plenary: "bg-green-50 text-green-700 border-green-200",
  committees: "bg-green-50 text-green-700 border-green-200",
  elections: "bg-emerald-50 text-emerald-700 border-emerald-200",
  reports: "bg-teal-50 text-teal-700 border-teal-200",
  bylaw_changes: "bg-amber-50 text-amber-700 border-amber-200",
  closing: "bg-orange-50 text-orange-700 border-orange-200",
  certification: "bg-green-50 text-green-700 border-green-200",
  archive: "bg-gray-50 text-gray-500 border-gray-200",
  proposed: "bg-blue-50 text-blue-700 border-blue-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? "bg-gray-50 text-gray-500 border-gray-200";
}

// ── Priority badge ────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-50 text-red-700 border-red-200",
    high: "bg-orange-50 text-orange-700 border-orange-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-gray-50 text-gray-500 border-gray-200",
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${colors[priority] ?? colors.low}`}>
      {priority}
    </Badge>
  );
}

// ── Days remaining display ────────────────────────────────────────
function DaysDisplay({ days, isOverdue }: { days: number; isOverdue: boolean }) {
  if (isOverdue) {
    return <span className="text-xs font-semibold text-red-600">{Math.abs(days)} days overdue</span>;
  }
  if (days <= 3) {
    return <span className="text-xs font-semibold text-red-600">{days} days left</span>;
  }
  if (days <= 7) {
    return <span className="text-xs font-semibold text-amber-600">{days} days left</span>;
  }
  if (days <= 30) {
    return <span className="text-xs text-[#66788D]">{days} days left</span>;
  }
  return <span className="text-xs text-[#8A9BAE]">{days} days</span>;
}

// ── Main Page ─────────────────────────────────────────────────────
export default function AdminGovernanceDashboard() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  const dashboardQuery = trpc.enterprise.governanceDashboard.get.useQuery();
  const deadlinesQuery = trpc.enterprise.governanceDashboard.deadlines.useQuery();

  // ── Auth Guard ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="msap-page min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#138A73]" />
      </div>
    );
  }

  if (!user || !canAccessModule(user, "config")) {
    navigate("/official");
    return null;
  }

  const data = dashboardQuery.data;
  const deadlines = deadlinesQuery.data ?? [];

  return (
    <div>
      <div className="">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1B355E] mb-2 flex items-center gap-3">
              <Scale className="h-8 w-8 text-[#106E5B]" />
              Governance Dashboard
            </h1>
            <p className="text-[#66788D]">
              Overview of governance health, meetings, and upcoming deadlines
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              dashboardQuery.refetch();
              deadlinesQuery.refetch();
            }}
            disabled={dashboardQuery.isFetching}
            className="gap-2"
          >
            {dashboardQuery.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>

        {dashboardQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#138A73]" />
          </div>
        ) : !data ? (
          <Card className="card-cinematic">
            <CardContent className="py-12 text-center text-[#8A9BAE]">
              <Scale className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No governance data available</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* ── Summary Cards ──────────────────────────────────── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="card-cinematic">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-[#66788D]">Active NGAs</p>
                      <p className="text-2xl font-bold text-[#1B355E]">{data.summary.activeNGAs}</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-[#138A73]/10 flex items-center justify-center">
                      <Building className="h-5 w-5 text-[#138A73]" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-cinematic">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-[#66788D]">Active SGAs</p>
                      <p className="text-2xl font-bold text-[#1B355E]">{data.summary.activeSGAs}</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-indigo-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-cinematic">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-[#66788D]">Active Rules</p>
                      <p className="text-2xl font-bold text-[#1B355E]">{data.summary.activeRules}</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-amber-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`card-cinematic ${data.summary.overdueDeadlines > 0 ? "border-red-200 bg-red-50/50" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-[#66788D]">Overdue Deadlines</p>
                      <p className={`text-2xl font-bold ${data.summary.overdueDeadlines > 0 ? "text-red-600" : "text-[#1B355E]"}`}>
                        {data.summary.overdueDeadlines}
                      </p>
                    </div>
                    <div className={`h-10 w-10 rounded-lg ${data.summary.overdueDeadlines > 0 ? "bg-red-500/10" : "bg-green-500/10"} flex items-center justify-center`}>
                      <AlertTriangle className={`h-5 w-5 ${data.summary.overdueDeadlines > 0 ? "text-red-500" : "text-green-500"}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* ── NGA Status ───────────────────────────────────── */}
              <Card className="card-cinematic lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2">
                    <Building className="h-5 w-5 text-[#106E5B]" />
                    NGA Status
                  </CardTitle>
                  <CardDescription>National General Assembly lifecycle progress</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.ngaStatus.length === 0 ? (
                    <div className="py-8 text-center text-[#8A9BAE]">
                      <Building className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No NGA meetings found</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {data.ngaStatus.map((nga) => (
                        <div
                          key={nga.id}
                          className="border border-[#E7F4F0] rounded-lg p-4 hover:bg-[#F8FDFB] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-[#1B355E] text-sm">{nga.title}</h3>
                                <Badge variant="outline" className={`text-[10px] ${statusColor(nga.status)}`}>
                                  {nga.status.replace(/_/g, " ")}
                                </Badge>
                                {nga.edition && (
                                  <Badge variant="secondary" className="text-[10px]">{nga.edition}</Badge>
                                )}
                              </div>
                              <p className="text-xs text-[#8A9BAE]">
                                {nga.mode === "in_person" ? "In-Person" : nga.mode === "online" ? "Online" : "Hybrid"}
                                {nga.venue && ` · ${nga.venue}`}
                                {nga.city && `, ${nga.city}`}
                              </p>
                            </div>
                            {nga.phase === "upcoming" && nga.daysUntilStart !== null && (
                              <div className="text-right shrink-0">
                                <p className="text-xs text-[#8A9BAE]">Starts in</p>
                                <p className="text-lg font-bold text-[#1B355E]">{nga.daysUntilStart}</p>
                                <p className="text-[10px] text-[#8A9BAE]">days</p>
                              </div>
                            )}
                            {nga.phase === "in_progress" && (
                              <Badge className="bg-green-500 text-white text-[10px]">IN PROGRESS</Badge>
                            )}
                            {nga.phase === "completed" && (
                              <Badge variant="outline" className="text-[10px]">COMPLETED</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-[#66788D] mb-2">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {nga.delegationCount} delegations
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(nga.scheduledStart).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                            {nga.quorumRequired && (
                              <span className={`flex items-center gap-1 ${nga.quorumMet ? "text-green-600" : "text-amber-600"}`}>
                                <CheckCircle2 className="h-3 w-3" />
                                Quorum {nga.quorumMet ? "met" : "not met"}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={nga.lifecycleProgress} className="h-1.5 flex-1" />
                            <span className="text-[10px] text-[#8A9BAE] font-mono">{nga.lifecycleProgress}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Upcoming Deadlines ───────────────────────────── */}
              <Card className="card-cinematic">
                <CardHeader>
                  <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2">
                    <Clock className="h-5 w-5 text-[#106E5B]" />
                    Upcoming Deadlines
                  </CardTitle>
                  <CardDescription>BCP, credentials, candidacy, term dates</CardDescription>
                </CardHeader>
                <CardContent>
                  {deadlines.length === 0 ? (
                    <div className="py-8 text-center text-[#8A9BAE]">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No upcoming deadlines</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {deadlines.slice(0, 10).map((d) => (
                        <div
                          key={d.id}
                          className={`flex items-start gap-3 p-2 rounded-lg border transition-colors ${
                            d.isOverdue
                              ? "border-red-200 bg-red-50/50"
                              : d.daysRemaining <= 7
                              ? "border-amber-200 bg-amber-50/30"
                              : "border-[#E7F4F0] hover:bg-[#F8FDFB]"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[#1B355E] truncate">{d.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <PriorityBadge priority={d.priority} />
                              <DaysDisplay days={d.daysRemaining} isOverdue={d.isOverdue} />
                            </div>
                          </div>
                          {d.isOverdue && (
                            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* ── SGA Status ───────────────────────────────────── */}
              <Card className="card-cinematic">
                <CardHeader>
                  <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2">
                    <Users className="h-5 w-5 text-[#106E5B]" />
                    SGA Status
                  </CardTitle>
                  <CardDescription>Special General Assembly meetings</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.sgaStatus.length === 0 ? (
                    <div className="py-8 text-center text-[#8A9BAE]">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No SGA meetings found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {data.sgaStatus.map((sga) => (
                        <div
                          key={sga.id}
                          className="border border-[#E7F4F0] rounded-lg p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-[#1B355E] text-sm truncate">{sga.title}</h3>
                                <Badge variant="outline" className={`text-[10px] ${statusColor(sga.status)}`}>
                                  {sga.status.replace(/_/g, " ")}
                                </Badge>
                              </div>
                              <p className="text-xs text-[#8A9BAE]">{sga.reason}</p>
                            </div>
                            {sga.daysUntilStart !== null && (
                              <div className="text-right shrink-0">
                                <p className="text-xs text-[#8A9BAE]">In</p>
                                <p className="text-sm font-bold text-[#1B355E]">{sga.daysUntilStart}d</p>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className={`text-[9px] ${sga.ebtoApproved ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}>
                              {sga.ebtoApproved ? "✓ EBTO" : "○ EBTO"}
                            </Badge>
                            <Badge variant="outline" className={`text-[9px] ${sga.supcoApproved ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}>
                              {sga.supcoApproved ? "✓ SupCo" : "○ SupCo"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Rules & Config Health ────────────────────────── */}
              <div className="space-y-6">
                {/* Rules Summary */}
                <Card className="card-cinematic">
                  <CardHeader>
                    <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2">
                      <Shield className="h-5 w-5 text-[#106E5B]" />
                      Governance Rules
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="text-3xl font-bold text-[#1B355E]">{data.rulesSummary.totalActiveRules}</div>
                      <span className="text-sm text-[#66788D]">active rules</span>
                    </div>
                    {data.rulesSummary.byLevel.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {data.rulesSummary.byLevel.map((level) => (
                          <div key={level.level} className="flex items-center justify-between">
                            <span className="text-xs text-[#66788D] capitalize">{level.level}</span>
                            <Badge variant="secondary" className="text-[10px] font-mono">{level.count}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    {data.rulesSummary.recentlyUpdated.length > 0 && (
                      <div className="border-t border-[#E7F4F0] pt-3">
                        <p className="text-[10px] font-semibold text-[#8A9BAE] uppercase tracking-wider mb-2">
                          Recently Updated
                        </p>
                        {data.rulesSummary.recentlyUpdated.map((rule, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-1">
                            <span className="text-[#1B355E] font-mono truncate">{rule.ruleKey}</span>
                            <Badge variant="outline" className="text-[9px]">{rule.ruleType}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/admin/governance-config")}
                        className="gap-1.5 text-xs w-full"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        Configuration Studio
                        <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Config Health */}
                <Card className="card-cinematic">
                  <CardHeader>
                    <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-[#106E5B]" />
                      Config Health
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-3xl font-bold text-[#1B355E]">
                        {data.configHealth.modificationRate}%
                      </div>
                      <span className="text-sm text-[#66788D]">customized</span>
                    </div>
                    <Progress value={data.configHealth.modificationRate} className="h-2 mb-2" />
                    <div className="flex justify-between text-xs text-[#8A9BAE]">
                      <span>{data.configHealth.modifiedFromDefault} modified</span>
                      <span>{data.configHealth.unchangedCount} default</span>
                    </div>
                    <p className="text-[10px] text-[#B0BEC5] mt-2">
                      {data.configHealth.totalParameters} total governance parameters
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

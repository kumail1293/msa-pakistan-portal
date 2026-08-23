import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Loader2,
  Users,
  Calendar,
  DollarSign,
  FileText,
  TrendingUp,
  Activity,
} from "lucide-react";

export default function AdminAnalytics() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const dashboard = adminTrpc.analytics.dashboard.useQuery();

  const metrics = dashboard.data ?? {};

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">Analytics</h1>
          <p className="text-sm text-[#5D7086]">
            §131-134: KPI dashboards, reports, and data-driven insights
          </p>
        </div>
        <Button variant="outline" onClick={() => dashboard.refetch()} disabled={dashboard.isRefresh}>
          {dashboard.isRefetching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Refresh Data
        </Button>
      </div>

      {dashboard.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Members", value: metrics.totalMembers ?? 0, icon: Users, color: "text-[#138A73]" },
              { label: "Active Activities", value: metrics.activeActivities ?? 0, icon: Activity, color: "text-blue-600" },
              { label: "Upcoming Events", value: metrics.upcomingEvents ?? 0, icon: Calendar, color: "text-purple-600" },
              { label: "Revenue", value: `PKR ${(metrics.revenue ?? 0).toLocaleString()}`, icon: DollarSign, color: "text-green-600" },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg bg-gray-50 p-2 ${stat.color}`}><stat.icon className="h-5 w-5" /></div>
                    <div>
                      <p className="text-2xl font-bold text-[#1B355E]">{stat.value}</p>
                      <p className="text-xs text-[#5D7086]">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Growth Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Member Growth", value: `${metrics.memberGrowth ?? 0}%`, icon: TrendingUp, color: "text-emerald-600" },
              { label: "Chapter Health", value: `${metrics.chapterHealth ?? 0}%`, icon: BarChart3, color: "text-blue-600" },
              { label: "Event Participation", value: `${metrics.eventParticipation ?? 0}%`, icon: Calendar, color: "text-orange-600" },
              { label: "Pending Applications", value: metrics.pendingApplications ?? 0, icon: FileText, color: "text-red-600" },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg bg-gray-50 p-2 ${stat.color}`}><stat.icon className="h-5 w-5" /></div>
                    <div>
                      <p className="text-2xl font-bold text-[#1B355E]">{stat.value}</p>
                      <p className="text-xs text-[#5D7086]">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Module Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#1B355E]">Module Health Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { name: "Membership", count: metrics.totalMembers ?? 0, status: "healthy" },
                  { name: "Activities", count: metrics.activeActivities ?? 0, status: "healthy" },
                  { name: "Events", count: metrics.upcomingEvents ?? 0, status: "healthy" },
                  { name: "Elections", count: metrics.activeElections ?? 0, status: "healthy" },
                  { name: "Plenary", count: metrics.activePlenary ?? 0, status: "healthy" },
                  { name: "Finance", count: metrics.transactionCount ?? 0, status: "healthy" },
                ].map((module) => (
                  <div key={module.name} className="flex items-center justify-between rounded-lg border border-[#E7F4F0] p-4">
                    <div>
                      <h3 className="font-semibold text-[#1B355E]">{module.name}</h3>
                      <p className="text-xs text-[#5D7086]">{module.count} records</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                      ● {module.status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

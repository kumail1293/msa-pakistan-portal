import { useAuth } from "@/_core/hooks/useAuth";
import { canAccessModule } from "@/_core/access";
import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Plus,
  IdCard,
  Upload,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  const stats = { data: { total: 0, pending: 0, interviewScheduled: 0, selected: 0, rejected: 0, noShow: 0, clarify: 0, totalApplications: 0 } }; // TODO: Implement
  const applications = { data: [] }; // TODO: Implement
  const upcomingInterviews = { data: [] }; // TODO: Implement

  // The recruitment dashboard may be opened by any official with the
  // recruitment grant, but the Card Issuance summary below calls card-queue
  // gated endpoints. Only run/render that section when this account can
  // actually open the card queue (admins/super admins always can).
  const hasCardQueue = canAccessModule(user, "card-queue");
  const pendingCards = trpc.admin.card.pending.useQuery(undefined, {
    retry: false,
    enabled: hasCardQueue,
  });

  // National President's real signature, rendered on every member card.
  const presidentSig = trpc.admin.card.getPresidentSignature.useQuery(undefined, {
    retry: false,
    enabled: hasCardQueue,
  });
  const setPresidentSig = trpc.admin.card.setPresidentSignature.useMutation({
    onSuccess: () => {
      toast.success("National President signature updated — new cards now use it.");
      presidentSig.refetch();
      setSigDraft(null);
    },
    onError: (err) => toast.error(err.message),
  });
  const clearPresidentSig = trpc.admin.card.clearPresidentSignature.useMutation({
    onSuccess: () => {
      toast.success("National President signature removed — cards revert to the cursive placeholder.");
      presidentSig.refetch();
      setSigDraft(null);
    },
    onError: (err) => toast.error(err.message),
  });
  const sigFileRef = useRef<HTMLInputElement>(null);
  const [sigDraft, setSigDraft] = useState<string | null>(null);

  const pickSignatureFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      toast.error("Please upload a PNG, JPEG or WebP signature image.");
      return;
    }
    try {
      // Strip the paper/background automatically so the signature sits cleanly
      // on the card. PNG (with transparency) is what the server accepts.
      const { removeImageBackground } = await import("@/lib/signatureBackground");
      const dataUrl = await removeImageBackground(file, { tolerance: 30 });
      setSigDraft(dataUrl);
    } catch {
      toast.error("Could not process that image.");
    }
  };

  // Wait for the session before deciding access — otherwise the first render
  // (user still undefined) redirects admins to "/".
  if (loading) {
    return (
      <div className="msap-page min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#138A73]"></div>
      </div>
    );
  }

  // Module access: admins and super admins inherit the recruitment module;
  // officials only when the super admin opened it for them.
  if (!user || !canAccessModule(user, "recruitment")) {
    navigate("/official");
    return null;
  }

  const dashboardStats = stats.data;

  const chartData = dashboardStats
    ? [
        { name: "Pending", value: dashboardStats.pending, fill: "#f59e0b" },
        { name: "Interview", value: dashboardStats.interviewScheduled, fill: "#3b82f6" },
        { name: "Selected", value: dashboardStats.selected, fill: "#10b981" },
        { name: "Rejected", value: dashboardStats.rejected, fill: "#ef4444" },
        { name: "No-Show", value: dashboardStats.noShow, fill: "#8b5cf6" },
        { name: "Clarify", value: dashboardStats.clarify, fill: "#f97316" },
      ]
    : [];

  return (
    <div className="py-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1B355E] mb-2">Recruitment Dashboard</h1>
            <p className="text-[#66788D]">Real-time recruitment metrics and analytics</p>
          </div>
          <Button className="btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            New Application
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Users className="h-6 w-6" />}
            label="Total Applications"
            value={dashboardStats?.totalApplications || 0}
            trend="+12%"
          />
          <StatCard
            icon={<Clock className="h-6 w-6" />}
            label="Pending Review"
            value={dashboardStats?.pending || 0}
            trend="-5%"
          />
          <StatCard
            icon={<CheckCircle className="h-6 w-6" />}
            label="Selected"
            value={dashboardStats?.selected || 0}
            trend="+8%"
          />
          <StatCard
            icon={<XCircle className="h-6 w-6" />}
            label="Rejected"
            value={dashboardStats?.rejected || 0}
            trend="+3%"
          />
        </div>

        {/* Card Issuance — summary + link to the full queue. Rendered only
            for accounts that can open the card queue. */}
        {hasCardQueue && (
        <Card className="card-cinematic mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1B355E]">
              <IdCard className="h-5 w-5 text-[#106E5B]" />
              Card Issuance
              {pendingCards.data && pendingCards.data.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                  {pendingCards.data.length} pending
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E7EFEC] bg-[#F6F9F8] p-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#1B355E]">
                  <IdCard className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[#1B355E]">
                    {pendingCards.data && pendingCards.data.length > 0
                      ? `${pendingCards.data.length} card request${pendingCards.data.length === 1 ? "" : "s"} awaiting review`
                      : "No card requests awaiting review"}
                  </p>
                  <p className="mt-0.5 text-xs text-[#5D7086]">
                    Holder signatures and data-change re-issues, with search and
                    status filters.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => navigate("/admin/cards")}
                className="bg-[#1B355E] text-white hover:bg-[#294A78]"
              >
                Open queue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* National President signature */}
            <div className="mt-6 rounded-xl border border-[#D9E4E1] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#1B355E]">National President signature</p>
                  <p className="mt-0.5 text-xs leading-5 text-[#5D7086]">
                    {presidentSig.data
                      ? "A real signature image is set — it appears on every member card instead of the cursive placeholder."
                      : "Not set — cards currently render a cursive placeholder. Upload the President's signature (PNG) to use the real one."}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {(presidentSig.data || sigDraft) && (
                    <img
                      src={sigDraft ?? presidentSig.data ?? ""}
                      alt="President signature"
                      className="h-12 max-w-[140px] rounded-lg border border-[#D9E4E1] object-contain p-1"
                      style={{
                        backgroundImage: sigDraft
                          ? "conic-gradient(#E9EFED 0 25%, #ffffff 0 50%, #E9EFED 0 75%, #ffffff 0)"
                          : undefined,
                        backgroundSize: "12px 12px",
                      }}
                    />
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#1B355E] text-[#1B355E] hover:bg-[#F0F5F3]"
                    onClick={() => sigFileRef.current?.click()}
                  >
                    <Upload className="mr-1.5 h-4 w-4" />
                    {presidentSig.data || sigDraft ? "Replace" : "Upload image"}
                  </Button>
                  {sigDraft && (
                    <Button
                      size="sm"
                      disabled={setPresidentSig.isPending || sigDraft.length > 400_000}
                      onClick={() => {
                        if (sigDraft.length > 400_000) {
                          toast.error(
                            "That signature image is too large. Try a smaller or less detailed image."
                          );
                          return;
                        }
                        setPresidentSig.mutate({ dataUrl: sigDraft });
                      }}
                      className="bg-[#1B355E] text-white hover:bg-[#294A78] disabled:opacity-60"
                    >
                      {setPresidentSig.isPending ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-1.5 h-4 w-4" />
                      )}
                      Save
                    </Button>
                  )}
                  {presidentSig.data && !sigDraft && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={clearPresidentSig.isPending}
                      onClick={() => clearPresidentSig.mutate()}
                      className="border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="mr-1.5 h-4 w-4" /> Remove
                    </Button>
                  )}
                </div>
              </div>
              <input
                ref={sigFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => pickSignatureFile(e.target.files?.[0])}
              />
            </div>
          </CardContent>
        </Card>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Pipeline Status Chart */}
          <Card className="card-cinematic lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1B355E]">
              <BarChart3 className="h-5 w-5 text-[#106E5B]" />
              Pipeline Status Distribution
            </CardTitle>
          </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(27,53,94,0.08)" />
                  <XAxis dataKey="name" stroke="#8A9BAE" />
                  <YAxis stroke="#8A9BAE" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #D9E4E1",
                      borderRadius: "12px",
                      boxShadow: "0 12px 30px rgba(27,53,94,0.15)",
                    }}
                  />
                  <Bar dataKey="value" fill="#138A73" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status Pie Chart */}
          <Card className="card-cinematic">
            <CardHeader>
              <CardTitle className="text-base text-[#1B355E]">Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Interviews */}
        <Card className="card-cinematic mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1B355E]">
              <AlertCircle className="h-5 w-5 text-[#106E5B]" />
              Upcoming Interviews ({upcomingInterviews.data?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingInterviews.data && upcomingInterviews.data.length > 0 ? (
              <div className="space-y-4">
                {upcomingInterviews.data.slice(0, 5).map((interview: any) => (
                  <div
                    key={interview.id}
                    className="flex items-center justify-between p-4 bg-[#F6F9F8] border border-[#E7EFEC] rounded-xl hover:border-[#A8D8CD] transition"
                  >
                    <div>
                      <p className="font-semibold text-[#1B355E]">Interview #{interview.id}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(interview.scheduledAt).toLocaleString()}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No upcoming interviews scheduled</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Applications */}
        <Card className="card-cinematic">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1B355E]">
              <TrendingUp className="h-5 w-5 text-[#106E5B]" />
              Recent Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {applications.data && applications.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                          <thead>
                    <tr className="border-b border-[#D9E4E1]">
                      <th className="text-left py-3 px-4 font-semibold text-[#106E5B]">ID</th>
                      <th className="text-left py-3 px-4 font-semibold text-[#106E5B]">Candidate</th>
                      <th className="text-left py-3 px-4 font-semibold text-[#106E5B]">Position</th>
                      <th className="text-left py-3 px-4 font-semibold text-[#106E5B]">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-[#106E5B]">Applied</th>
                      <th className="text-left py-3 px-4 font-semibold text-[#106E5B]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.data.slice(0, 10).map((app: any) => (
                      <tr key={app.id} className="border-b border-[#E7EFEC] hover:bg-[#F6F9F8] transition">
                        <td className="py-3 px-4">#{app.id}</td>
                        <td className="py-3 px-4 text-[#1B355E]">Candidate {app.candidateId}</td>
                        <td className="py-3 px-4">Position {app.positionId}</td>
                        <td className="py-3 px-4">
                          <span className="badge-accent">{app.status}</span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(app.appliedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <Button variant="ghost" size="sm" className="text-accent hover:text-accent/80">
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No applications yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  trend: string;
}) {
  return (
    <Card className="card-cinematic">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-[#66788D] mb-1">{label}</p>
            <p className="text-3xl font-bold text-[#1B355E]">{value}</p>
            <p className="text-xs text-[#106E5B] mt-2">{trend} from last month</p>
          </div>
          <div className="text-accent opacity-50">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

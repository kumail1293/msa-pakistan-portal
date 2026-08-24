import { useAuth } from "@/_core/hooks/useAuth";
import { canAccessModule } from "@/_core/access";
import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import {
  BarChart3,
  Calendar,
  CheckCircle,
  ChevronRight,
  Coins,
  DollarSign,
  FileText,
  Flag,
  Gavel,
  IdCard,
  Loader2,
  Megaphone,
  ShieldCheck,
  Upload,
  Vote,
  XCircle,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  // ── Card Queue ──
  const hasCardQueue = canAccessModule(user, "card-queue");
  const pendingCards = trpc.admin.card.pending.useQuery(undefined, { retry: false, enabled: hasCardQueue });
  const presidentSig = trpc.admin.card.getPresidentSignature.useQuery(undefined, { retry: false, enabled: hasCardQueue });
  const setPresidentSig = trpc.admin.card.setPresidentSignature.useMutation({
    onSuccess: () => { toast.success("National President signature updated."); presidentSig.refetch(); setSigDraft(null); },
    onError: (err) => toast.error(err.message),
  });
  const clearPresidentSig = trpc.admin.card.clearPresidentSignature.useMutation({
    onSuccess: () => { toast.success("Signature removed — cards revert to placeholder."); presidentSig.refetch(); setSigDraft(null); },
    onError: (err) => toast.error(err.message),
  });
  const sigFileRef = useRef<HTMLInputElement>(null);
  const [sigDraft, setSigDraft] = useState<string | null>(null);

  const pickSignatureFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) { toast.error("Please upload a PNG, JPEG or WebP signature image."); return; }
    try {
      const { removeImageBackground } = await import("@/lib/signatureBackground");
      const dataUrl = await removeImageBackground(file, { tolerance: 30 });
      setSigDraft(dataUrl);
    } catch { toast.error("Could not process that image."); }
  };

  // ── Module Stats ──
  const activitiesStats = trpc.admin.activities.stats.useQuery();
  const eventsStats = trpc.admin.events.stats.useQuery();
  const electionsStats = trpc.admin.elections.stats.useQuery();
  const financeStats = trpc.admin.finance.summary.useQuery();
  const documentsStats = trpc.admin.documents.stats.useQuery();
  const communicationsStats = trpc.admin.communications.stats.useQuery();
  const plenaryStats = trpc.admin.plenary.stats.useQuery();
  const nefNrfStats = trpc.admin.nefNrf.stats.useQuery();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#138A73]" />
      </div>
    );
  }

  if (!user) return null;

  const actData = (activitiesStats.data ?? {}) as Record<string, number>;
  const evtData = (eventsStats.data ?? {}) as Record<string, number>;
  const elecData = (electionsStats.data ?? {}) as Record<string, number>;
  const finData = financeStats.data as any;
  const docData = (documentsStats.data ?? {}) as Record<string, number>;
  const commsData = (communicationsStats.data ?? {}) as Record<string, number>;
  const plenData = (plenaryStats.data ?? {}) as Record<string, number>;
  const nefData = (nefNrfStats.data ?? {}) as Record<string, number>;

  const totalActivities = Object.values(actData).reduce((s, n) => s + n, 0);
  const totalEvents = Object.values(evtData).reduce((s, n) => s + n, 0);
  const totalElections = Object.values(elecData).reduce((s, n) => s + n, 0);
  const totalDocs = Object.values(docData).reduce((s, n) => s + n, 0);
  const totalAnnouncements = Object.values(commsData).reduce((s, n) => s + n, 0);
  const totalPlenary = Object.values(plenData).reduce((s, n) => s + n, 0);
  const totalNefCycles = Object.values(nefData).reduce((s, n) => s + n, 0);

  const moduleChartData = [
    { name: "Activities", count: totalActivities, fill: "#138A73" },
    { name: "Events", count: totalEvents, fill: "#1B355E" },
    { name: "Elections", count: totalElections, fill: "#6366f1" },
    { name: "Documents", count: totalDocs, fill: "#f59e0b" },
    { name: "Plenary", count: totalPlenary, fill: "#ec4899" },
    { name: "NEF/NRF", count: totalNefCycles, fill: "#8b5cf6" },
  ];

  const modules = [
    { label: "Activities", icon: <Calendar className="h-4 w-4" />, count: totalActivities, detail: `${actData["draft"] ?? 0} drafts, ${actData["active"] ?? actData["in_progress"] ?? 0} active`, color: "bg-emerald-50 text-emerald-600 border-emerald-100", path: "/admin/activities" },
    { label: "Events", icon: <Calendar className="h-4 w-4" />, count: totalEvents, detail: `${evtData["published"] ?? 0} published, ${evtData["draft"] ?? 0} drafts`, color: "bg-blue-50 text-blue-600 border-blue-100", path: "/admin/events" },
    { label: "Elections", icon: <Vote className="h-4 w-4" />, count: totalElections, detail: `${elecData["voting_active"] ?? elecData["active"] ?? 0} active, ${elecData["certified"] ?? 0} certified`, color: "bg-indigo-50 text-indigo-600 border-indigo-100", path: "/admin/elections" },
    { label: "Plenary", icon: <Gavel className="h-4 w-4" />, count: totalPlenary, detail: `${plenData["in_progress"] ?? 0} live, ${plenData["completed"] ?? 0} completed`, color: "bg-pink-50 text-pink-600 border-pink-100", path: "/admin/plenary" },
    { label: "Finance", icon: <DollarSign className="h-4 w-4" />, count: finData?.transactions ?? 0, detail: `PKR ${(finData?.totalIncome ?? 0).toLocaleString()} income`, color: "bg-amber-50 text-amber-600 border-amber-100", path: "/admin/finance" },
    { label: "NEF/NRF", icon: <Coins className="h-4 w-4" />, count: totalNefCycles, detail: `${nefData["status_open"] ?? 0} open cycles`, color: "bg-violet-50 text-violet-600 border-violet-100", path: "/admin/nef-nrf" },
    { label: "Documents", icon: <FileText className="h-4 w-4" />, count: totalDocs, detail: `${docData["published"] ?? 0} published, ${docData["draft"] ?? 0} drafts`, color: "bg-orange-50 text-orange-600 border-orange-100", path: "/admin/documents" },
    { label: "Communications", icon: <Megaphone className="h-4 w-4" />, count: totalAnnouncements, detail: `${commsData["sent"] ?? 0} sent, ${commsData["queued"] ?? 0} queued`, color: "bg-cyan-50 text-cyan-600 border-cyan-100", path: "/admin/communications" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        label="Overview"
        title="Admin Dashboard"
        description="Platform overview across all modules"
        action={
          <Button onClick={() => navigate("/official")} variant="outline" className="border-[#D9E4E1]">
            <ShieldCheck className="mr-2 h-4 w-4" /> Official Home
          </Button>
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {modules.slice(0, 4).map((mod) => (
          <StatCard
            key={mod.label}
            icon={mod.icon}
            label={mod.label}
            value={mod.count}
            iconColor={mod.color}
            onClick={() => navigate(mod.path)}
          />
        ))}
      </div>

      {/* Module Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-[#1B355E]">
            <BarChart3 className="h-4 w-4 text-[#106E5B]" />
            Modules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((mod) => (
              <button
                key={mod.label}
                onClick={() => navigate(mod.path)}
                className="group rounded-xl border border-[#E7F4F0] bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#A8D8CD] hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${mod.color} border transition-transform group-hover:scale-110`}>
                    {mod.icon}
                  </div>
                  <span className="text-xl font-bold text-[#1B355E]">{mod.count}</span>
                </div>
                <h4 className="mt-3 text-sm font-semibold text-[#1B355E]">{mod.label}</h4>
                <p className="mt-0.5 text-[11px] text-[#66788D] line-clamp-1">{mod.detail}</p>
                <div className="mt-2 flex items-center text-[11px] font-medium text-[#106E5B] opacity-0 transition-opacity group-hover:opacity-100">
                  Open module <ChevronRight className="ml-0.5 h-3 w-3" />
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chart + Card Queue */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#1B355E]">Module Activity Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {moduleChartData.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={moduleChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(27,53,94,0.08)" />
                  <XAxis dataKey="name" stroke="#8A9BAE" fontSize={11} />
                  <YAxis stroke="#8A9BAE" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #D9E4E1", borderRadius: "12px", boxShadow: "0 12px 30px rgba(27,53,94,0.15)" }}
                  />
                  <Bar dataKey="count" fill="#138A73" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-[#8A9BAE]">
                <p className="text-sm">No module data yet.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {hasCardQueue && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-[#1B355E]">
                <IdCard className="h-4 w-4 text-[#106E5B]" />
                Card Queue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-[#E7EFEC] bg-[#F6F9F8] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1B355E]">
                    <IdCard className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#1B355E]">
                      {pendingCards.data?.length ?? 0} pending
                    </p>
                    <p className="text-[11px] text-[#5D7086]">card requests</p>
                  </div>
                </div>
              </div>
              <Button size="sm" onClick={() => navigate("/admin/cards")} className="w-full bg-[#1B355E] text-white hover:bg-[#294A78]">
                Open queue <ChevronRight className="ml-1 h-4 w-4" />
              </Button>

              {/* President signature */}
              <div className="rounded-xl border border-[#D9E4E1] p-3">
                <p className="text-xs font-semibold text-[#1B355E]">President Signature</p>
                <p className="mt-0.5 text-[10px] text-[#5D7086]">
                  {presidentSig.data ? "Set ✓" : "Not set — placeholder used"}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 border-[#1B355E] text-xs text-[#1B355E]" onClick={() => sigFileRef.current?.click()}>
                    <Upload className="mr-1 h-3 w-3" /> Upload
                  </Button>
                  {presidentSig.data && (
                    <Button size="sm" variant="outline" className="h-7 border-red-200 text-xs text-red-600" onClick={() => clearPresidentSig.mutate()}>
                      <XCircle className="mr-1 h-3 w-3" /> Remove
                    </Button>
                  )}
                </div>
                {sigDraft && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={sigDraft} alt="Preview" className="h-8 rounded border" />
                    <Button size="sm" className="h-7 bg-[#106E5B] text-xs text-white" disabled={setPresidentSig.isPending} onClick={() => setPresidentSig.mutate({ dataUrl: sigDraft })}>
                      {setPresidentSig.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                      {" "}Save
                    </Button>
                  </div>
                )}
                <input ref={sigFileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pickSignatureFile(e.target.files?.[0])} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-[#1B355E]">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Module Manager", icon: Flag, path: "/admin/modules" },
              { label: "Feature Flags", icon: Flag, path: "/admin/feature-flags" },
              { label: "Audit Log", icon: ShieldCheck, path: "/admin/audit" },
              { label: "Governance", icon: Gavel, path: "/admin/governance" },
            ].map((action) => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="flex items-center gap-2.5 rounded-xl border border-[#E7F4F0] bg-white px-4 py-3 text-left text-sm font-medium text-[#1B355E] transition-all hover:border-[#A8D8CD] hover:bg-[#F8FBFA]"
              >
                <action.icon className="h-4 w-4 text-[#106E5B]" />
                {action.label}
                <ChevronRight className="ml-auto h-3 w-3 text-[#8A9BAE]" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

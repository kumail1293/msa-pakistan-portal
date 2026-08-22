import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Vote, FileText, Users, Gavel, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminPlenary() {
  const [selectedTab, setSelectedTab] = useState("sessions");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newSession, setNewSession] = useState({ title: "", description: "", type: "ordinary", scheduledStart: "", scheduledEnd: "", chairId: 0, secretaryId: 0, quorumRequired: 0 });

  const sessionsQuery = trpc.admin.plenary.listSessions.useQuery({ status: statusFilter || undefined, limit: 50 });
  const resolutionsQuery = trpc.admin.plenary.listResolutions.useQuery({ limit: 50 });
  const statsQuery = trpc.admin.plenary.stats.useQuery();

  const createSession = trpc.admin.plenary.createSession.useMutation({
    onSuccess: () => { toast.success("Session created"); setCreateOpen(false); sessionsQuery.refetch(); setNewSession({ title: "", description: "", type: "ordinary", scheduledStart: "", scheduledEnd: "", chairId: 0, secretaryId: 0, quorumRequired: 0 }); },
    onError: (err: any) => toast.error(err.message),
  });

  const sessions = (sessionsQuery.data ?? []) as any[];
  const resolutions = (resolutionsQuery.data ?? []) as any[];
  const stats = (statsQuery.data ?? {}) as Record<string, number>;

  const totalSessions = sessions.length;
  const activeSessions = sessions.filter((s: any) => s.status === "in_progress").length;
  const totalResolutions = resolutions.length;
  const adoptedResolutions = resolutions.filter((r: any) => r.status === "adopted").length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_progress": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "scheduled": return "bg-blue-100 text-blue-700 border-blue-200";
      case "completed": return "bg-slate-100 text-slate-600 border-slate-200";
      case "proposed": return "bg-amber-100 text-amber-700 border-amber-200";
      case "adopted": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "rejected": return "bg-red-100 text-red-700 border-red-200";
      default: return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="msap-page min-h-screen p-4 md:p-8">
      <div className="">
        <div className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">Governance</p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#1B355E] sm:text-4xl">Plenary Sessions</h1>
          <p className="mt-2 text-[#66788D]">Manage parliamentary proceedings, motions, and resolutions</p>
        </div>

        <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Session
        </Button>

        {createOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
              <h2 className="text-lg font-bold text-[#1B355E] mb-4">Create Plenary Session</h2>
              <div className="space-y-4">
                <div><label className="text-sm font-medium text-[#1B355E]">Title *</label><Input value={newSession.title} onChange={(e) => setNewSession({ ...newSession, title: e.target.value })} placeholder="Session title" className="mt-1" /></div>
                <div><label className="text-sm font-medium text-[#1B355E]">Description</label><Input value={newSession.description} onChange={(e) => setNewSession({ ...newSession, description: e.target.value })} placeholder="Brief description" className="mt-1" /></div>
                <div><label className="text-sm font-medium text-[#1B355E]">Type</label><Select value={newSession.type} onValueChange={(v) => setNewSession({ ...newSession, type: v })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ordinary">Ordinary Plenary</SelectItem><SelectItem value="extraordinary">Extraordinary Plenary</SelectItem><SelectItem value="annual">NGA — Annual General Assembly (§8.1)</SelectItem><SelectItem value="presidents_session">Presidents' Session (§8.9)</SelectItem><SelectItem value="standing_committee">Standing Committee Session (§10.2)</SelectItem></SelectContent></Select></div>
                <div><label className="text-sm font-medium text-[#1B355E]">Quorum Required (§8.1.8)</label><Input type="number" value={newSession.quorumRequired || ""} onChange={(e) => setNewSession({ ...newSession, quorumRequired: Number(e.target.value) })} placeholder="1/3 of Permanent+Temporary LCs" className="mt-1" /></div>
                <div className="grid grid-cols-2 gap-4"><div><label className="text-sm font-medium text-[#1B355E]">Start</label><Input type="datetime-local" value={newSession.scheduledStart} onChange={(e) => setNewSession({ ...newSession, scheduledStart: e.target.value })} className="mt-1" /></div><div><label className="text-sm font-medium text-[#1B355E]">End</label><Input type="datetime-local" value={newSession.scheduledEnd} onChange={(e) => setNewSession({ ...newSession, scheduledEnd: e.target.value })} className="mt-1" /></div></div>
                <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button className="bg-[#138A73] text-white" onClick={() => createSession.mutate({ ...newSession, scheduledStart: new Date(newSession.scheduledStart), scheduledEnd: new Date(newSession.scheduledEnd), chairId: newSession.chairId || 1, secretaryId: newSession.secretaryId || 1, quorumRequired: newSession.quorumRequired || undefined })} disabled={!newSession.title || !newSession.scheduledStart || createSession.isPending}>Create</Button></div>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="msap-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E7F4F0]"><Users className="h-5 w-5 text-[#106E5B]" /></div>
                <div><p className="text-2xl font-bold text-[#1B355E]">{totalSessions}</p><p className="text-xs text-[#66788D]">Sessions</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="msap-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50"><Gavel className="h-5 w-5 text-emerald-500" /></div>
                <div><p className="text-2xl font-bold text-emerald-600">{activeSessions}</p><p className="text-xs text-[#66788D]">In Progress</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="msap-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50"><FileText className="h-5 w-5 text-blue-500" /></div>
                <div><p className="text-2xl font-bold text-blue-600">{totalResolutions}</p><p className="text-xs text-[#66788D]">Resolutions</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="msap-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50"><CheckCircle2 className="h-5 w-5 text-amber-500" /></div>
                <div><p className="text-2xl font-bold text-amber-600">{adoptedResolutions}</p><p className="text-xs text-[#66788D]">Adopted</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="border border-[#D9E4E1] bg-[#E9F0EE]">
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="resolutions">Resolutions</TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Filter by status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="proposed">Proposed</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {sessionsQuery.isLoading ? (
              <Card className="msap-card py-16 text-center"><CardContent><Loader2 className="mx-auto h-8 w-8 animate-spin text-[#138A73]" /></CardContent></Card>
            ) : sessions.length === 0 ? (
              <Card className="msap-card py-12 text-center"><CardContent><Gavel className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" /><p className="text-[#5D7086]">No plenary sessions yet. Create one to get started.</p></CardContent></Card>
            ) : (
              <div className="space-y-4">
                {sessions.map((session: any) => (
                  <Card key={session.id} className="msap-card msap-card-hover">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-[#1B355E]">{session.title}</h3>
                          {session.description && <p className="text-sm text-[#5D7086] mt-1">{session.description}</p>}
                        </div>
                        <Badge className={`ml-3 border ${getStatusColor(session.status)}`}>{session.status?.replace(/_/g, " ")}</Badge>
                        {session.type === "annual" && <Badge className="ml-1 border bg-blue-100 text-blue-700 border-blue-200">§8.1 NGA</Badge>}
                        {session.type === "presidents_session" && <Badge className="ml-1 border bg-purple-100 text-purple-700 border-purple-200">§8.9</Badge>}
                        {session.type === "standing_committee" && <Badge className="ml-1 border bg-amber-100 text-amber-700 border-amber-200">§10.2 SC</Badge>}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm text-[#5D7086]">
                        <div><span className="text-[#8A9BAE]">Start:</span> {new Date(session.scheduledStart).toLocaleString()}</div>
                        <div><span className="text-[#8A9BAE]">End:</span> {new Date(session.scheduledEnd).toLocaleString()}</div>
                        <div><span className="text-[#8A9BAE]">Type:</span> {session.type}</div>
                        <div><span className="text-[#8A9BAE]">Quorum:</span> {session.quorumRequired}%</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="resolutions" className="space-y-4">
            {resolutionsQuery.isLoading ? (
              <Card className="msap-card py-16 text-center"><CardContent><Loader2 className="mx-auto h-8 w-8 animate-spin text-[#138A73]" /></CardContent></Card>
            ) : resolutions.length === 0 ? (
              <Card className="msap-card py-12 text-center"><CardContent><FileText className="mx-auto mb-4 h-12 w-12 text-[#8A9BAE]" /><p className="text-[#5D7086]">No resolutions yet.</p></CardContent></Card>
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
                          <p className="text-sm text-[#5D7086] mt-1 line-clamp-2">{res.text}</p>
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
      </div>
    </div>
  );
}

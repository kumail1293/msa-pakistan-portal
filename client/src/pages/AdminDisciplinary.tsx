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
import {
  Gavel,
  Loader2,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronRight,
} from "lucide-react";

export default function AdminDisciplinary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newCase, setNewCase] = useState({
    title: "",
    description: "",
    type: "complaint",
    severity: "medium",
    respondentName: "",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.disciplinary.stats.useQuery();
  const cases = adminTrpc.disciplinary.list.useQuery({
    status: statusFilter || undefined,
    limit: 50,
  });

  const createCase = adminTrpc.disciplinary.create.useMutation({
    onSuccess: () => {
      toast.success("Case created");
      setCreateOpen(false);
      cases.refetch();
      stats.refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = (cases.data ?? []).filter(
    (c: any) =>
      !searchQuery ||
      c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.respondentName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">Disciplinary</h1>
          <p className="text-sm text-[#5D7086]">
            §116: Complaints, incident reports, investigations, hearings, and sanctions
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white">
              <Plus className="h-4 w-4 mr-2" /> New Case
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Case</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 py-4">
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Title *</label>
                <Input value={newCase.title} onChange={(e) => setNewCase({ ...newCase, title: e.target.value })} placeholder="Case title" />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Description</label>
                <Textarea value={newCase.description} onChange={(e) => setNewCase({ ...newCase, description: e.target.value })} rows={3} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Type</label>
                <Select value={newCase.type} onValueChange={(v) => setNewCase({ ...newCase, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="complaint">Complaint</SelectItem>
                    <SelectItem value="incident">Incident Report</SelectItem>
                    <SelectItem value="violation">Code Violation</SelectItem>
                    <SelectItem value="misconduct">Misconduct</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Severity</label>
                <Select value={newCase.severity} onValueChange={(v) => setNewCase({ ...newCase, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Respondent Name</label>
                <Input value={newCase.respondentName} onChange={(e) => setNewCase({ ...newCase, respondentName: e.target.value })} placeholder="Respondent name" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white" onClick={() => createCase.mutate(newCase)} disabled={!newCase.title || createCase.isPending}>
                  {createCase.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Case
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Cases", value: stats.data?.total ?? 0, icon: Gavel, color: "text-[#138A73]" },
          { label: "Open", value: stats.data?.open ?? 0, icon: AlertTriangle, color: "text-orange-600" },
          { label: "Investigating", value: stats.data?.investigating ?? 0, icon: Clock, color: "text-blue-600" },
          { label: "Resolved", value: stats.data?.resolved ?? 0, icon: CheckCircle, color: "text-green-600" },
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5D7086]" />
          <Input className="pl-9" placeholder="Search cases..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">Cases ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {cases.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <Gavel className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No cases found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((c: any) => (
                <div key={c.id} className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors">
                  <div className="rounded-lg bg-red-50 p-2.5">
                    <Gavel className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1B355E] truncate">{c.title}</h3>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${c.status === "resolved" ? "bg-green-100 text-green-700" : c.status === "investigating" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                        {c.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#5D7086] mt-1">{c.type} • {c.severity}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#5D7086]" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

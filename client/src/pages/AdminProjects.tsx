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
  FolderKanban,
  Loader2,
  Plus,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

export default function AdminProjects() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    status: "planning",
    startDate: "",
    endDate: "",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.projects.stats.useQuery();
  const projects = adminTrpc.projects.list.useQuery({
    status: statusFilter || undefined,
    limit: 50,
  });

  const createProject = adminTrpc.projects.create?.useMutation?.({
    onSuccess: () => {
      toast.success("Project created");
      setCreateOpen(false);
      projects.refetch();
      stats.refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = (projects.data ?? []).filter(
    (p: any) =>
      !searchQuery ||
      p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">Projects</h1>
          <p className="text-sm text-[#5D7086]">
            Manage projects, milestones, tasks, and deliverables
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white">
              <Plus className="h-4 w-4 mr-2" /> New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 py-4">
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Name *</label>
                <Input value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} placeholder="Project name" />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Description</label>
                <Textarea value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} rows={3} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Status</label>
                <Select value={newProject.status} onValueChange={(v) => setNewProject({ ...newProject, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Start Date</label>
                <Input type="date" value={newProject.startDate} onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">End Date</label>
                <Input type="date" value={newProject.endDate} onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white" onClick={() => createProject?.mutate?.(newProject)} disabled={!newProject.name}>
                  Create Project
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Projects", value: stats.data?.total ?? 0, icon: FolderKanban, color: "text-[#138A73]" },
          { label: "Active", value: stats.data?.active ?? 0, icon: CheckCircle, color: "text-green-600" },
          { label: "Planning", value: stats.data?.planning ?? 0, icon: Clock, color: "text-blue-600" },
          { label: "At Risk", value: stats.data?.at_risk ?? 0, icon: AlertTriangle, color: "text-orange-600" },
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
          <Input className="pl-9" placeholder="Search projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">Projects ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {projects.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No projects found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((project: any) => (
                <div key={project.id} className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors">
                  <div className="rounded-lg bg-purple-50 p-2.5">
                    <FolderKanban className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1B355E] truncate">{project.name}</h3>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase bg-gray-100 text-gray-600">
                        {project.status}
                      </span>
                    </div>
                    {project.description && (
                      <p className="text-xs text-[#5D7086] mt-1 truncate">{project.description}</p>
                    )}
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

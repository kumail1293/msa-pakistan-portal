import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Activity,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  MapPin,
  Plus,
  Search,
  Users,
  TrendingUp,
  Edit,
  Trash2,
  Eye,
  MoreVertical,
  ChevronRight,
  Play,
  Pause,
  XCircle,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  in_progress: "bg-indigo-100 text-indigo-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  registration_open: "bg-cyan-100 text-cyan-700",
  reporting: "bg-purple-100 text-purple-700",
  evaluation: "bg-orange-100 text-orange-700",
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function AdminActivities() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [newActivity, setNewActivity] = useState({
    title: "",
    description: "",
    type: "workshop",
    category: "",
    activityLevel: "local" as "local" | "national" | "regional" | "international",
    standingCommittee: "",
    coordinators: "",
    startDate: "",
    endDate: "",
    venue: "",
    city: "",
    mode: "in_person" as "in_person" | "online" | "hybrid",
    budget: 0,
    maxParticipants: 0,
  });
  const [editActivity, setEditActivity] = useState<any>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.activities.stats.useQuery();
  const activities = adminTrpc.activities.list.useQuery({
    status: statusFilter || undefined,
    type: typeFilter || undefined,
    limit: 50,
  });

  const createActivity = adminTrpc.activities.create.useMutation({
    onSuccess: () => {
      toast.success("Activity created successfully");
      setCreateOpen(false);
      activities.refetch();
      stats.refetch();
      setNewActivity({ title: "", description: "", type: "workshop", category: "", activityLevel: "local", standingCommittee: "", coordinators: "", startDate: "", endDate: "", venue: "", city: "", mode: "in_person", budget: 0, maxParticipants: 0 });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateActivity = adminTrpc.activities.update.useMutation({
    onSuccess: () => {
      toast.success("Activity updated");
      setEditOpen(false);
      activities.refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteActivity = adminTrpc.activities.delete.useMutation({
    onSuccess: () => {
      toast.success("Activity deleted");
      setDetailOpen(false);
      activities.refetch();
      stats.refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateStatus = adminTrpc.activities.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      activities.refetch();
      stats.refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = (activities.data ?? []).filter(
    (a: any) =>
      !searchQuery ||
      a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.venue?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openEdit = (activity: any) => {
    setEditActivity({
      ...activity,
      startDate: activity.startDate ? new Date(activity.startDate).toISOString().slice(0, 16) : "",
      endDate: activity.endDate ? new Date(activity.endDate).toISOString().slice(0, 16) : "",
    });
    setEditOpen(true);
  };

  const openDetail = (activity: any) => {
    setSelectedActivity(activity);
    setDetailOpen(true);
  };

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">Activities</h1>
          <p className="text-sm text-[#5D7086]">
            Manage workshops, seminars, community service, and NEF/NRF activities
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white">
              <Plus className="h-4 w-4 mr-2" /> New Activity
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Activity</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-[#1B355E]">Title *</label>
                <Input value={newActivity.title} onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })} placeholder="Activity title" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-[#1B355E]">Description</label>
                <Textarea value={newActivity.description} onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })} placeholder="Describe the activity" rows={3} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Type</label>
                <Select value={newActivity.type} onValueChange={(v) => setNewActivity({ ...newActivity, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workshop">Workshop</SelectItem>
                    <SelectItem value="seminar">Seminar</SelectItem>
                    <SelectItem value="community_service">Community Service</SelectItem>
                    <SelectItem value="campaign">Campaign</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="conference">Conference</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Activity Level *</label>
                <Select value={newActivity.activityLevel} onValueChange={(v: any) => setNewActivity({ ...newActivity, activityLevel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local (1-2 LCs, §16.6)</SelectItem>
                    <SelectItem value="national">National (EBTO/≥3 LCs, §16.7)</SelectItem>
                    <SelectItem value="regional">Regional (2 NMOs, §16.8)</SelectItem>
                    <SelectItem value="international">International (§16.9)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Standing Committee</label>
                <Select value={newActivity.standingCommittee} onValueChange={(v) => setNewActivity({ ...newActivity, standingCommittee: v })}>
                  <SelectTrigger><SelectValue placeholder="None (General)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (General)</SelectItem>
                    <SelectItem value="SCOPH">SCOPH — Public Health</SelectItem>
                    <SelectItem value="SCORA">SCORA — Sexual & Reproductive Health</SelectItem>
                    <SelectItem value="SCOME">SCOME — Medical Education</SelectItem>
                    <SelectItem value="SCORP">SCORP — Human Rights & Peace</SelectItem>
                    <SelectItem value="SCOPE">SCOPE — Professional Exchange</SelectItem>
                    <SelectItem value="SCORE">SCORE — Research Exchange</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Coordinators (max 3, comma-separated IDs)</label>
                <Input value={newActivity.coordinators} onChange={(e) => setNewActivity({ ...newActivity, coordinators: e.target.value })} placeholder="e.g. 1, 2, 3" />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Category</label>
                <Select value={newActivity.category || "regular"} onValueChange={(v) => setNewActivity({ ...newActivity, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="nef">NEF</SelectItem>
                    <SelectItem value="nrf">NRF</SelectItem>
                    <SelectItem value="special">Special</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Start Date</label>
                <Input type="datetime-local" value={newActivity.startDate} onChange={(e) => setNewActivity({ ...newActivity, startDate: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">End Date</label>
                <Input type="datetime-local" value={newActivity.endDate} onChange={(e) => setNewActivity({ ...newActivity, endDate: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Venue</label>
                <Input value={newActivity.venue} onChange={(e) => setNewActivity({ ...newActivity, venue: e.target.value })} placeholder="Venue name" />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">City</label>
                <Input value={newActivity.city} onChange={(e) => setNewActivity({ ...newActivity, city: e.target.value })} placeholder="City" />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Mode</label>
                <Select value={newActivity.mode} onValueChange={(v: any) => setNewActivity({ ...newActivity, mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_person">In Person</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Budget (PKR)</label>
                <Input type="number" value={newActivity.budget || ""} onChange={(e) => setNewActivity({ ...newActivity, budget: Number(e.target.value) })} placeholder="0" />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Max Participants</label>
                <Input type="number" value={newActivity.maxParticipants || ""} onChange={(e) => setNewActivity({ ...newActivity, maxParticipants: Number(e.target.value) })} placeholder="Unlimited" />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white" onClick={() => createActivity.mutate({ ...newActivity, coordinators: newActivity.coordinators ? newActivity.coordinators.split(",").map(Number).filter(Boolean) : undefined })} disabled={!newActivity.title || createActivity.isPending}>
                  {createActivity.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Activity
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Activities", value: Object.values(stats.data ?? {}).reduce((a: number, b: any) => a + Number(b), 0), icon: Activity, color: "text-[#138A73]" },
          { label: "Workshops", value: stats.data?.workshop ?? 0, icon: Calendar, color: "text-blue-600" },
          { label: "Conferences", value: stats.data?.conference ?? 0, icon: Users, color: "text-purple-600" },
          { label: "Community Service", value: stats.data?.community_service ?? 0, icon: TrendingUp, color: "text-orange-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg bg-gray-50 p-2 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1B355E]">{stat.value}</p>
                  <p className="text-xs text-[#5D7086]">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5D7086]" />
          <Input className="pl-9" placeholder="Search activities..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="workshop">Workshop</SelectItem>
            <SelectItem value="seminar">Seminar</SelectItem>
            <SelectItem value="community_service">Community Service</SelectItem>
            <SelectItem value="campaign">Campaign</SelectItem>
            <SelectItem value="training">Training</SelectItem>
            <SelectItem value="conference">Conference</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Activities List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">
            Activities ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activities.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No activities found</p>
              <p className="text-sm mt-1">Create your first activity to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((activity: any) => (
                <div key={activity.id} className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors cursor-pointer" onClick={() => openDetail(activity)}>
                  <div className="rounded-lg bg-[#E7F4F0] p-2.5">
                    <Activity className="h-5 w-5 text-[#138A73]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1B355E] truncate">{activity.title}</h3>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_COLORS[activity.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {activity.status?.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-[#5D7086]">
                      {activity.type && (
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" /> {activity.type}
                        </span>
                      )}
                      {activity.startDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {new Date(activity.startDate).toLocaleDateString()}
                        </span>
                      )}
                      {activity.venue && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {activity.venue}{activity.city ? `, ${activity.city}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right text-sm mr-2">
                      <p className="font-semibold text-[#1B355E]">{activity.currentParticipants ?? 0}/{activity.maxParticipants ?? "∞"}</p>
                      <p className="text-xs text-[#5D7086]">participants</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(activity); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={(e) => e.stopPropagation()}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Activity</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{activity.title}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => deleteActivity.mutate({ id: activity.id })}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <ChevronRight className="h-4 w-4 text-[#5D7086]" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Activity</DialogTitle>
          </DialogHeader>
          {editActivity && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-[#1B355E]">Title</label>
                <Input value={editActivity.title} onChange={(e) => setEditActivity({ ...editActivity, title: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-[#1B355E]">Description</label>
                <Textarea value={editActivity.description || ""} onChange={(e) => setEditActivity({ ...editActivity, description: e.target.value })} rows={3} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Status</label>
                <Select value={editActivity.status || "draft"} onValueChange={(v) => setEditActivity({ ...editActivity, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Type</label>
                <Select value={editActivity.type} onValueChange={(v) => setEditActivity({ ...editActivity, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workshop">Workshop</SelectItem>
                    <SelectItem value="seminar">Seminar</SelectItem>
                    <SelectItem value="community_service">Community Service</SelectItem>
                    <SelectItem value="campaign">Campaign</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="conference">Conference</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Start Date</label>
                <Input type="datetime-local" value={editActivity.startDate} onChange={(e) => setEditActivity({ ...editActivity, startDate: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">End Date</label>
                <Input type="datetime-local" value={editActivity.endDate} onChange={(e) => setEditActivity({ ...editActivity, endDate: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Venue</label>
                <Input value={editActivity.venue || ""} onChange={(e) => setEditActivity({ ...editActivity, venue: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">City</label>
                <Input value={editActivity.city || ""} onChange={(e) => setEditActivity({ ...editActivity, city: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Max Participants</label>
                <Input type="number" value={editActivity.maxParticipants || ""} onChange={(e) => setEditActivity({ ...editActivity, maxParticipants: Number(e.target.value) })} />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white" onClick={() => {
                  const { id, createdAt, updatedAt, ...updates } = editActivity;
                  if (updates.startDate) updates.startDate = new Date(updates.startDate);
                  if (updates.endDate) updates.endDate = new Date(updates.endDate);
                  updateActivity.mutate({ id, updates });
                }} disabled={!editActivity.title || updateActivity.isPending}>
                  {updateActivity.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Activity Details</DialogTitle>
          </DialogHeader>
          {selectedActivity && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-[#1B355E]">{selectedActivity.title}</h2>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${STATUS_COLORS[selectedActivity.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {selectedActivity.status?.replace(/_/g, " ")}
                </span>
                {selectedActivity.activityLevel && (
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase bg-blue-100 text-blue-700">
                    {selectedActivity.activityLevel}
                  </span>
                )}
                {selectedActivity.standingCommittee && (
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase bg-purple-100 text-purple-700">
                    {selectedActivity.standingCommittee}
                  </span>
                )}
              </div>
              {selectedActivity.description && (
                <p className="text-sm text-[#5D7086] leading-6">{selectedActivity.description}</p>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border border-[#E7F4F0] p-3">
                  <p className="text-[#8A9BAE] text-xs">Type</p>
                  <p className="font-semibold text-[#1B355E] capitalize">{selectedActivity.type?.replace(/_/g, " ")}</p>
                </div>
                <div className="rounded-lg border border-[#E7F4F0] p-3">
                  <p className="text-[#8A9BAE] text-xs">Mode</p>
                  <p className="font-semibold text-[#1B355E] capitalize">{(selectedActivity.mode ?? "in_person").replace(/_/g, " ")}</p>
                </div>
                <div className="rounded-lg border border-[#E7F4F0] p-3">
                  <p className="text-[#8A9BAE] text-xs">Start Date</p>
                  <p className="font-semibold text-[#1B355E]">{selectedActivity.startDate ? new Date(selectedActivity.startDate).toLocaleString() : "—"}</p>
                </div>
                <div className="rounded-lg border border-[#E7F4F0] p-3">
                  <p className="text-[#8A9BAE] text-xs">End Date</p>
                  <p className="font-semibold text-[#1B355E]">{selectedActivity.endDate ? new Date(selectedActivity.endDate).toLocaleString() : "—"}</p>
                </div>
                <div className="rounded-lg border border-[#E7F4F0] p-3">
                  <p className="text-[#8A9BAE] text-xs">Venue</p>
                  <p className="font-semibold text-[#1B355E]">{selectedActivity.venue || "—"}</p>
                </div>
                <div className="rounded-lg border border-[#E7F4F0] p-3">
                  <p className="text-[#8A9BAE] text-xs">City</p>
                  <p className="font-semibold text-[#1B355E]">{selectedActivity.city || "—"}</p>
                </div>
                <div className="rounded-lg border border-[#E7F4F0] p-3">
                  <p className="text-[#8A9BAE] text-xs">Participants</p>
                  <p className="font-semibold text-[#1B355E]">{selectedActivity.currentParticipants ?? 0}/{selectedActivity.maxParticipants ?? "∞"}</p>
                </div>
                <div className="rounded-lg border border-[#E7F4F0] p-3">
                  <p className="text-[#8A9BAE] text-xs">Category</p>
                  <p className="font-semibold text-[#1B355E] capitalize">{selectedActivity.category || "Regular"}</p>
                </div>
                <div className="rounded-lg border border-[#E7F4F0] p-3">
                  <p className="text-[#8A9BAE] text-xs">Activity Level (§16)</p>
                  <p className="font-semibold text-[#1B355E] capitalize">{selectedActivity.activityLevel || "Local"}</p>
                </div>
                <div className="rounded-lg border border-[#E7F4F0] p-3">
                  <p className="text-[#8A9BAE] text-xs">Standing Committee (§10)</p>
                  <p className="font-semibold text-[#1B355E]">{selectedActivity.standingCommittee || "General"}</p>
                </div>
                {selectedActivity.coordinators && (
                  <div className="rounded-lg border border-[#E7F4F0] p-3">
                    <p className="text-[#8A9BAE] text-xs">Coordinators (max 3, §16.5)</p>
                    <p className="font-semibold text-[#1B355E]">{Array.isArray(selectedActivity.coordinators) ? selectedActivity.coordinators.join(", ") : selectedActivity.coordinators}</p>
                  </div>
                )}
                {selectedActivity.budgetApprovedAt && (
                  <div className="rounded-lg border border-[#E7F4F0] p-3">
                    <p className="text-[#8A9BAE] text-xs">Budget Approved (§16.14)</p>
                    <p className="font-semibold text-emerald-600">VPF + President approved</p>
                  </div>
                )}
                {selectedActivity.certificateIssued && (
                  <div className="rounded-lg border border-[#E7F4F0] p-3">
                    <p className="text-[#8A9BAE] text-xs">Certificate (§16.10)</p>
                    <p className="font-semibold text-emerald-600">✓ Issued after NRF</p>
                  </div>
                )}
              </div>

              {/* Quick Status Actions */}
              <div className="border-t border-[#E7F4F0] pt-4">
                <p className="text-sm font-medium text-[#1B355E] mb-3">Quick Actions</p>
                <div className="flex flex-wrap gap-2">
                  {selectedActivity.status === "draft" && (
                    <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => { updateStatus.mutate({ id: selectedActivity.id, status: "approved" }); setSelectedActivity({ ...selectedActivity, status: "approved" }); }}>
                      <CheckCircle className="h-3 w-3 mr-1" /> Approve
                    </Button>
                  )}
                  {selectedActivity.status === "approved" && (
                    <Button size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { updateStatus.mutate({ id: selectedActivity.id, status: "in_progress" }); setSelectedActivity({ ...selectedActivity, status: "in_progress" }); }}>
                      <Play className="h-3 w-3 mr-1" /> Start
                    </Button>
                  )}
                  {selectedActivity.status === "in_progress" && (
                    <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => { updateStatus.mutate({ id: selectedActivity.id, status: "completed" }); setSelectedActivity({ ...selectedActivity, status: "completed" }); }}>
                      <CheckCircle className="h-3 w-3 mr-1" /> Complete
                    </Button>
                  )}
                  {!["completed", "cancelled"].includes(selectedActivity.status) && (
                    <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => { updateStatus.mutate({ id: selectedActivity.id, status: "cancelled" }); setSelectedActivity({ ...selectedActivity, status: "cancelled" }); }}>
                      <XCircle className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => { setDetailOpen(false); openEdit(selectedActivity); }}>
                    <Edit className="h-3 w-3 mr-1" /> Edit
                  </Button>
                </div>
              </div>

              <div className="flex justify-end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4 mr-2" /> Delete Activity
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Activity</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{selectedActivity.title}"? This will remove all registrations and cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => deleteActivity.mutate({ id: selectedActivity.id })}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

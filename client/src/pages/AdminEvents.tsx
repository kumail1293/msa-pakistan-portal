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
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  MapPin,
  Plus,
  Search,
  Users,
  Award,
  Globe,
  Edit,
  Trash2,
  ChevronRight,
  Play,
  XCircle,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-blue-100 text-blue-700",
  registration_open: "bg-green-100 text-green-700",
  registration_closed: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-indigo-100 text-indigo-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AdminEvents() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [newEvent, setNewEvent] = useState({
    title: "", description: "", type: "conference", startDate: "", endDate: "",
    venue: "", city: "", mode: "in_person", maxCapacity: 0, fee: 0,
  });
  const [editEvent, setEditEvent] = useState<any>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.events.stats.useQuery();
  const events = adminTrpc.events.list.useQuery({ status: statusFilter || undefined, limit: 50 });

  const createEvent = adminTrpc.events.create.useMutation({
    onSuccess: () => {
      toast.success("Event created successfully");
      setCreateOpen(false);
      events.refetch();
      stats.refetch();
      setNewEvent({ title: "", description: "", type: "conference", startDate: "", endDate: "", venue: "", city: "", mode: "in_person", maxCapacity: 0, fee: 0 });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateEvent = adminTrpc.events.update.useMutation({
    onSuccess: () => { toast.success("Event updated"); setEditOpen(false); events.refetch(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteEvent = adminTrpc.events.delete.useMutation({
    onSuccess: () => { toast.success("Event deleted"); setDetailOpen(false); events.refetch(); stats.refetch(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateStatus = adminTrpc.events.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); events.refetch(); stats.refetch(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = (events.data ?? []).filter(
    (e: any) => !searchQuery || e.title?.toLowerCase().includes(searchQuery.toLowerCase()) || e.venue?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openEdit = (event: any) => {
    setEditEvent({
      ...event,
      startDate: event.startDate ? new Date(event.startDate).toISOString().slice(0, 16) : "",
      endDate: event.endDate ? new Date(event.endDate).toISOString().slice(0, 16) : "",
    });
    setEditOpen(true);
  };

  const openDetail = (event: any) => { setSelectedEvent(event); setDetailOpen(true); };

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">Events</h1>
          <p className="text-sm text-[#5D7086]">Conferences, assemblies, meetings, workshops, and training events</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white">
              <Plus className="h-4 w-4 mr-2" /> New Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Event</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-[#1B355E]">Title *</label>
                <Input value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} placeholder="Event title" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-[#1B355E]">Description</label>
                <Textarea value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} placeholder="Describe the event" rows={3} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Type</label>
                <Select value={newEvent.type} onValueChange={(v) => setNewEvent({ ...newEvent, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conference">Conference</SelectItem>
                    <SelectItem value="assembly">Assembly</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="workshop">Workshop</SelectItem>
                    <SelectItem value="webinar">Webinar</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="campaign">Campaign</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Mode</label>
                <Select value={newEvent.mode} onValueChange={(v) => setNewEvent({ ...newEvent, mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_person">In Person</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Start Date *</label>
                <Input type="datetime-local" value={newEvent.startDate} onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">End Date *</label>
                <Input type="datetime-local" value={newEvent.endDate} onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Venue</label>
                <Input value={newEvent.venue} onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })} placeholder="Venue name" />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">City</label>
                <Input value={newEvent.city} onChange={(e) => setNewEvent({ ...newEvent, city: e.target.value })} placeholder="City" />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Max Capacity</label>
                <Input type="number" value={newEvent.maxCapacity || ""} onChange={(e) => setNewEvent({ ...newEvent, maxCapacity: Number(e.target.value) })} placeholder="Unlimited" />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Fee (PKR)</label>
                <Input type="number" value={newEvent.fee || ""} onChange={(e) => setNewEvent({ ...newEvent, fee: Number(e.target.value) })} placeholder="0 = Free" />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white" onClick={() => createEvent.mutate({ ...newEvent, startDate: new Date(newEvent.startDate), endDate: new Date(newEvent.endDate) })} disabled={!newEvent.title || !newEvent.startDate || !newEvent.endDate || createEvent.isPending}>
                  {createEvent.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Create Event
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Events", value: Object.values(stats.data ?? {}).reduce((a: number, b: any) => a + Number(b), 0), icon: Calendar, color: "text-[#138A73]" },
          { label: "Conferences", value: stats.data?.conference ?? 0, icon: Globe, color: "text-blue-600" },
          { label: "Workshops", value: stats.data?.workshop ?? 0, icon: Users, color: "text-purple-600" },
          { label: "Trainings", value: stats.data?.training ?? 0, icon: Award, color: "text-orange-600" },
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

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5D7086]" />
          <Input className="pl-9" placeholder="Search events..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="registration_open">Registration Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">Events ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {events.isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#138A73]" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No events found</p>
              <p className="text-sm mt-1">Create your first event to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((event: any) => (
                <div key={event.id} className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors cursor-pointer" onClick={() => openDetail(event)}>
                  <div className="rounded-lg bg-blue-50 p-2.5"><Calendar className="h-5 w-5 text-blue-600" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1B355E] truncate">{event.title}</h3>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_COLORS[event.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {event.status?.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-[#5D7086]">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(event.startDate).toLocaleDateString()}</span>
                      {event.venue && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {event.venue}{event.city ? `, ${event.city}` : ""}</span>}
                      {event.mode && <span className="flex items-center gap-1 capitalize">{event.mode.replace(/_/g, " ")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right text-sm mr-2">
                      <p className="font-semibold text-[#1B355E]">{event.currentRegistrations ?? 0}/{event.maxCapacity ?? "∞"}</p>
                      <p className="text-xs text-[#5D7086]">registered</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(event); }}><Edit className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={(e) => e.stopPropagation()}><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Event</AlertDialogTitle>
                          <AlertDialogDescription>Are you sure you want to delete "{event.title}"? This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => deleteEvent.mutate({ id: event.id })}>Delete</AlertDialogAction>
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
          <DialogHeader><DialogTitle>Edit Event</DialogTitle></DialogHeader>
          {editEvent && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-[#1B355E]">Title</label>
                <Input value={editEvent.title} onChange={(e) => setEditEvent({ ...editEvent, title: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-[#1B355E]">Description</label>
                <Textarea value={editEvent.description || ""} onChange={(e) => setEditEvent({ ...editEvent, description: e.target.value })} rows={3} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Status</label>
                <Select value={editEvent.status || "draft"} onValueChange={(v) => setEditEvent({ ...editEvent, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="registration_open">Registration Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Type</label>
                <Select value={editEvent.type} onValueChange={(v) => setEditEvent({ ...editEvent, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conference">Conference</SelectItem><SelectItem value="assembly">Assembly</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem><SelectItem value="workshop">Workshop</SelectItem>
                    <SelectItem value="webinar">Webinar</SelectItem><SelectItem value="training">Training</SelectItem>
                    <SelectItem value="social">Social</SelectItem><SelectItem value="campaign">Campaign</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Start Date</label>
                <Input type="datetime-local" value={editEvent.startDate} onChange={(e) => setEditEvent({ ...editEvent, startDate: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">End Date</label>
                <Input type="datetime-local" value={editEvent.endDate} onChange={(e) => setEditEvent({ ...editEvent, endDate: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Venue</label>
                <Input value={editEvent.venue || ""} onChange={(e) => setEditEvent({ ...editEvent, venue: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">City</label>
                <Input value={editEvent.city || ""} onChange={(e) => setEditEvent({ ...editEvent, city: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Max Capacity</label>
                <Input type="number" value={editEvent.maxCapacity || ""} onChange={(e) => setEditEvent({ ...editEvent, maxCapacity: Number(e.target.value) })} />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white" onClick={() => {
                  const { id, createdAt, updatedAt, currentRegistrations, ...updates } = editEvent;
                  if (updates.startDate) updates.startDate = new Date(updates.startDate);
                  if (updates.endDate) updates.endDate = new Date(updates.endDate);
                  updateEvent.mutate({ id, updates });
                }} disabled={!editEvent.title || updateEvent.isPending}>
                  {updateEvent.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Event Details</DialogTitle></DialogHeader>
          {selectedEvent && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-[#1B355E]">{selectedEvent.title}</h2>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${STATUS_COLORS[selectedEvent.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {selectedEvent.status?.replace(/_/g, " ")}
                </span>
              </div>
              {selectedEvent.description && <p className="text-sm text-[#5D7086] leading-6">{selectedEvent.description}</p>}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border border-[#E7F4F0] p-3">
                  <p className="text-[#8A9BAE] text-xs">Type</p>
                  <p className="font-semibold text-[#1B355E] capitalize">{selectedEvent.type?.replace(/_/g, " ")}</p>
                </div>
                <div className="rounded-lg border border-[#E7F4F0] p-3">
                  <p className="text-[#8A9BAE] text-xs">Mode</p>
                  <p className="font-semibold text-[#1B355E] capitalize">{(selectedEvent.mode ?? "in_person").replace(/_/g, " ")}</p>
                </div>
                <div className="rounded-lg border border-[#E7F4F0] p-3">
                  <p className="text-[#8A9BAE] text-xs">Start Date</p>
                  <p className="font-semibold text-[#1B355E]">{selectedEvent.startDate ? new Date(selectedEvent.startDate).toLocaleString() : "—"}</p>
                </div>
                <div className="rounded-lg border border-[#E7F4F0] p-3">
                  <p className="text-[#8A9BAE] text-xs">End Date</p>
                  <p className="font-semibold text-[#1B355E]">{selectedEvent.endDate ? new Date(selectedEvent.endDate).toLocaleString() : "—"}</p>
                </div>
                <div className="rounded-lg border border-[#E7F4F0] p-3">
                  <p className="text-[#8A9BAE] text-xs">Venue</p>
                  <p className="font-semibold text-[#1B355E]">{selectedEvent.venue || "—"}</p>
                </div>
                <div className="rounded-lg border border-[#E7F4F0] p-3">
                  <p className="text-[#8A9BAE] text-xs">Registrations</p>
                  <p className="font-semibold text-[#1B355E]">{selectedEvent.currentRegistrations ?? 0}/{selectedEvent.maxCapacity ?? "∞"}</p>
                </div>
              </div>
              {/* Quick Status Actions */}
              <div className="border-t border-[#E7F4F0] pt-4">
                <p className="text-sm font-medium text-[#1B355E] mb-3">Quick Actions</p>
                <div className="flex flex-wrap gap-2">
                  {selectedEvent.status === "draft" && (
                    <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => { updateStatus.mutate({ id: selectedEvent.id, status: "published" }); setSelectedEvent({ ...selectedEvent, status: "published" }); }}>
                      <CheckCircle className="h-3 w-3 mr-1" /> Publish
                    </Button>
                  )}
                  {selectedEvent.status === "published" && (
                    <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={() => { updateStatus.mutate({ id: selectedEvent.id, status: "registration_open" }); setSelectedEvent({ ...selectedEvent, status: "registration_open" }); }}>
                      <Users className="h-3 w-3 mr-1" /> Open Registration
                    </Button>
                  )}
                  {selectedEvent.status === "registration_open" && (
                    <Button size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { updateStatus.mutate({ id: selectedEvent.id, status: "in_progress" }); setSelectedEvent({ ...selectedEvent, status: "in_progress" }); }}>
                      <Play className="h-3 w-3 mr-1" /> Start Event
                    </Button>
                  )}
                  {selectedEvent.status === "in_progress" && (
                    <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => { updateStatus.mutate({ id: selectedEvent.id, status: "completed" }); setSelectedEvent({ ...selectedEvent, status: "completed" }); }}>
                      <CheckCircle className="h-3 w-3 mr-1" /> Complete
                    </Button>
                  )}
                  {!["completed", "cancelled"].includes(selectedEvent.status) && (
                    <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => { updateStatus.mutate({ id: selectedEvent.id, status: "cancelled" }); setSelectedEvent({ ...selectedEvent, status: "cancelled" }); }}>
                      <XCircle className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => { setDetailOpen(false); openEdit(selectedEvent); }}><Edit className="h-3 w-3 mr-1" /> Edit</Button>
                </div>
              </div>
              <div className="flex justify-end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4 mr-2" /> Delete Event</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Event</AlertDialogTitle>
                      <AlertDialogDescription>Are you sure? This will remove all registrations and cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => deleteEvent.mutate({ id: selectedEvent.id })}>Delete</AlertDialogAction>
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

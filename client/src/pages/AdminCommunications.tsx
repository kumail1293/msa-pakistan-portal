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
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Mail,
  MessageSquare,
  Search,
  Loader2,
  Plus,
  Send,
  Clock,
  CheckCircle,
  AlertTriangle,
  Megaphone,
  Users,
  Eye,
} from "lucide-react";

const ANNOUNCEMENT_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  published: "bg-green-100 text-green-700",
  archived: "bg-gray-100 text-gray-500",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-gray-100 text-gray-600",
};

export default function AdminCommunications() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tab, setTab] = useState<"announcements" | "templates" | "publications">("announcements");
  const [createAnnouncementOpen, setCreateAnnouncementOpen] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    content: "",
    type: "general",
    priority: "medium",
    targetAllMembers: true,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const announcements = adminTrpc.communications.announcements.useQuery({
    status: statusFilter || undefined,
    limit: 50,
  });

  const templates = adminTrpc.communications.templates.useQuery();
  const stats = adminTrpc.communications.stats.useQuery();

  const createAnnouncement = adminTrpc.communications.createAnnouncement.useMutation({
    onSuccess: () => {
      toast.success("Announcement created");
      setCreateAnnouncementOpen(false);
      announcements.refetch();
      setNewAnnouncement({ title: "", content: "", type: "general", priority: "medium", targetAllMembers: true });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const publishAnnouncement = adminTrpc.communications.publishAnnouncement.useMutation({
    onSuccess: () => { toast.success("Announcement published"); announcements.refetch(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const filteredAnnouncements = (announcements.data ?? []).filter(
    (a: any) =>
      !searchQuery ||
      a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">Communications</h1>
          <p className="text-sm text-[#5D7086]">
            Announcements, email templates, notifications, and messaging
          </p>
        </div>
        <Dialog open={createAnnouncementOpen} onOpenChange={setCreateAnnouncementOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white">
              <Megaphone className="h-4 w-4 mr-2" /> New Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Announcement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Title *</label>
                <Input
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                  placeholder="Announcement title"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1B355E]">Content *</label>
                <Textarea
                  value={newAnnouncement.content}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                  placeholder="Write your announcement..."
                  rows={5}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#1B355E]">Type</label>
                  <Select value={newAnnouncement.type} onValueChange={(v) => setNewAnnouncement({ ...newAnnouncement, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="info">Information</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="policy">Policy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#1B355E]">Priority</label>
                  <Select value={newAnnouncement.priority} onValueChange={(v) => setNewAnnouncement({ ...newAnnouncement, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="targetAll"
                  checked={newAnnouncement.targetAllMembers}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, targetAllMembers: e.target.checked })}
                  className="rounded border-[#D9E4E1]"
                />
                <label htmlFor="targetAll" className="text-sm font-medium text-[#1B355E]">
                  Target all members
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateAnnouncementOpen(false)}>Cancel</Button>
                <Button
                  className="bg-[#138A73] hover:bg-[#106E5B] text-white"
                  onClick={() => createAnnouncement.mutate(newAnnouncement)}
                  disabled={!newAnnouncement.title || !newAnnouncement.content || createAnnouncement.isPending}
                >
                  {createAnnouncement.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />} Create & Publish
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Announcements", value: (announcements.data ?? []).length, icon: Megaphone, color: "text-[#138A73]" },
          { label: "Published", value: (announcements.data ?? []).filter((a: any) => a.status === "published").length, icon: CheckCircle, color: "text-green-600" },
          { label: "Templates", value: (templates.data ?? []).length, icon: Mail, color: "text-blue-600" },
          { label: "Urgent", value: (announcements.data ?? []).filter((a: any) => a.priority === "critical" || a.priority === "high").length, icon: AlertTriangle, color: "text-orange-600" },
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

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {[
          { key: "announcements" as const, label: "Announcements" },
          { key: "templates" as const, label: "Email Templates" },
          { key: "publications" as const, label: "§14.2 Publications (VPPRC)" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.key
                ? "bg-white text-[#1B355E] shadow-sm"
                : "text-[#5D7086] hover:text-[#1B355E]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5D7086]" />
        <Input
          className="pl-9"
          placeholder={`Search ${tab}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Announcements Tab */}
      {tab === "announcements" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-[#1B355E]">Announcements ({filteredAnnouncements.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {announcements.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
              </div>
            ) : filteredAnnouncements.length === 0 ? (
              <div className="text-center py-12 text-[#5D7086]">
                <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No announcements found</p>
                <p className="text-sm mt-1">Create your first announcement to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAnnouncements.map((ann: any) => (
                  <div key={ann.id} className="flex items-start gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors">
                    <div className={`rounded-lg p-2.5 ${ann.priority === "critical" ? "bg-red-50" : ann.priority === "high" ? "bg-orange-50" : "bg-blue-50"}`}>
                      {ann.priority === "critical" ? (
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      ) : ann.priority === "high" ? (
                        <Bell className="h-5 w-5 text-orange-600" />
                      ) : (
                        <Megaphone className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-[#1B355E]">{ann.title}</h3>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ANNOUNCEMENT_STATUS_COLORS[ann.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {ann.status}
                        </span>
                        {ann.status === "draft" && (
                          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => publishAnnouncement.mutate({ id: ann.id })}>
                            <Send className="h-3 w-3 mr-1" /> Publish
                          </Button>
                        )}
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_COLORS[ann.priority] ?? "bg-gray-100 text-gray-600"}`}>
                          {ann.priority}
                        </span>
                      </div>
                      <p className="text-sm text-[#5D7086] mt-1 line-clamp-2">{ann.content}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-[#5D7086]">
                        <span className="capitalize">{ann.type}</span>
                        {ann.createdAt && <span>{new Date(ann.createdAt).toLocaleDateString()}</span>}
                        {ann.readBy && <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {ann.readBy.length} views</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Templates Tab */}
      {tab === "templates" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-[#1B355E]">Email Templates ({(templates.data ?? []).length})</CardTitle>
          </CardHeader>
          <CardContent>
            {templates.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
              </div>
            ) : (templates.data ?? []).length === 0 ? (
              <div className="text-center py-12 text-[#5D7086]">
                <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No email templates yet</p>
                <p className="text-sm mt-1">Templates are seeded automatically when the notification engine is configured</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(templates.data ?? []).map((tmpl: any) => (
                  <div key={tmpl.id} className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors">
                    <div className="rounded-lg bg-blue-50 p-2.5">
                      <Mail className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[#1B355E]">{tmpl.name}</h3>
                        <Badge variant="outline" className="capitalize text-[10px]">{tmpl.channel}</Badge>
                        {tmpl.status === "active" ? (
                          <Badge className="bg-green-100 text-green-700 text-[10px]">Active</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600 text-[10px]">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-sm text-[#5D7086] mt-1 truncate">{tmpl.subject || tmpl.body?.substring(0, 100)}</p>
                      {tmpl.variables && tmpl.variables.length > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-[#5D7086]">Variables:</span>
                          {tmpl.variables.map((v: string) => (
                            <code key={v} className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{`{{${v}}}`}</code>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Publications Tab — §14.2: All publications must be approved by VPPRC */}
      {tab === "publications" && (
        <Card className="msap-card">
          <CardHeader>
            <CardTitle className="text-[#1B355E]">Publication Approvals (§14.2)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-4">
              <p className="text-sm text-amber-800">
                <strong>§14.2:</strong> All printed &amp; digital publications (leaflets, pamphlets, booklets) must be approved by the VPPRC before distribution. All materials written in the name of MSA-Pakistan must be on official stationery and approved by the Executive Board.
              </p>
            </div>
            <div className="text-center py-12 text-[#5D7086]">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Publication approval queue</p>
              <p className="text-sm mt-1">Submitted publications will appear here for VPPRC review</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Loader2,
  Send,
  Mail,
  MessageSquare,
  ChevronRight,
} from "lucide-react";

export default function AdminNotifications() {
  const [newNotification, setNewNotification] = useState({
    userId: 0,
    title: "",
    body: "",
    channel: "in_app",
    category: "general",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const templates = adminTrpc.notifications.templates.useQuery();
  const notifications = adminTrpc.notifications.list.useQuery({ limit: 50 });

  const sendNotification = adminTrpc.notifications.send.useMutation({
    onSuccess: () => {
      toast.success("Notification sent");
      setNewNotification({ userId: 0, title: "", body: "", channel: "in_app", category: "general" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const seedTemplates = adminTrpc.notifications.seedTemplates.useMutation({
    onSuccess: () => toast.success("Default templates seeded"),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">Notifications</h1>
          <p className="text-sm text-[#5D7086]">
            §84: Notification engine, templates, channels, delivery tracking
          </p>
        </div>
        <Button variant="outline" onClick={() => seedTemplates.mutate()} disabled={seedTemplates.isPending}>
          {seedTemplates.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Seed Default Templates
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "Templates", value: templates.data?.length ?? 0, icon: Mail, color: "text-[#138A73]" },
          { label: "Sent Today", value: notifications.data?.length ?? 0, icon: Send, color: "text-blue-600" },
          { label: "Channels", value: 3, icon: MessageSquare, color: "text-purple-600" },
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

      {/* Send Notification */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">Send Notification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-[#1B355E]">User ID *</label>
              <Input type="number" value={newNotification.userId || ""} onChange={(e) => setNewNotification({ ...newNotification, userId: Number(e.target.value) })} placeholder="User ID" />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B355E]">Channel</label>
              <Select value={newNotification.channel} onValueChange={(v) => setNewNotification({ ...newNotification, channel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_app">In-App</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-[#1B355E]">Title *</label>
              <Input value={newNotification.title} onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })} placeholder="Notification title" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-[#1B355E]">Body *</label>
              <Textarea value={newNotification.body} onChange={(e) => setNewNotification({ ...newNotification, body: e.target.value })} rows={3} placeholder="Notification body" />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button className="bg-[#138A73] hover:bg-[#106E5B] text-white" onClick={() => sendNotification.mutate(newNotification)} disabled={!newNotification.title || !newNotification.body || sendNotification.isPending}>
                {sendNotification.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                <Send className="h-4 w-4 mr-2" /> Send Notification
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">Templates ({templates.data?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {templates.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : (templates.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No templates found</p>
              <p className="text-sm mt-1">Click "Seed Default Templates" to create defaults</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(templates.data ?? []).map((template: any) => (
                <div key={template.id} className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors">
                  <div className="rounded-lg bg-[#E7F4F0] p-2.5">
                    <Bell className="h-5 w-5 text-[#138A73]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#1B355E] truncate">{template.name}</h3>
                    <p className="text-xs text-[#5D7086] mt-1">{template.channel} • {template.category}</p>
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

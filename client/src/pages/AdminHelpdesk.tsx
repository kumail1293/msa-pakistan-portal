import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LifeBuoy,
  Loader2,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle,
  ChevronRight,
} from "lucide-react";

export default function AdminHelpdesk() {
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.helpdesk.stats.useQuery();
  const tickets = adminTrpc.helpdesk.list.useQuery({
    priority: priorityFilter || undefined,
    limit: 50,
  });

  return (
    <div className="py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1B355E]">Helpdesk</h1>
        <p className="text-sm text-[#5D7086]">
          §119: Ticket management, priorities, SLA, assignment, and resolution
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Tickets", value: stats.data?.total ?? 0, icon: LifeBuoy, color: "text-[#138A73]" },
          { label: "Open", value: stats.data?.open ?? 0, icon: AlertTriangle, color: "text-orange-600" },
          { label: "In Progress", value: stats.data?.in_progress ?? 0, icon: Clock, color: "text-blue-600" },
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
          <Input className="pl-9" placeholder="Search tickets..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Priorities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">Tickets ({(tickets.data ?? []).length})</CardTitle>
        </CardHeader>
        <CardContent>
          {tickets.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : (tickets.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <LifeBuoy className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No tickets found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(tickets.data ?? []).map((ticket: any) => (
                <div key={ticket.id} className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors">
                  <div className="rounded-lg bg-cyan-50 p-2.5">
                    <LifeBuoy className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1B355E] truncate">{ticket.subject || ticket.title || `Ticket #${ticket.id}`}</h3>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${ticket.status === "resolved" ? "bg-green-100 text-green-700" : ticket.status === "in_progress" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                        {ticket.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#5D7086] mt-1">{ticket.priority} priority • {ticket.category || "general"}</p>
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

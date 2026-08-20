import { useAuth } from "@/_core/hooks/useAuth";
import { canAccessModule } from "@/_core/access";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import {
  ScrollText,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Shield,
  User,
  Clock,
  Activity,
} from "lucide-react";

const ACTION_CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "security", label: "Security" },
  { value: "admin", label: "Administration" },
  { value: "membership", label: "Membership" },
  { value: "card", label: "Card" },
  { value: "governance", label: "Governance" },
];

const ACTION_ICONS: Record<string, string> = {
  "auth.login": "🔑",
  "auth.logout": "🚪",
  "auth.password_setup": "🔐",
  "member.profile_updated": "👤",
  "card.signature_submitted": "✍️",
  "card.signature_approve": "✅",
  "card.signature_reject": "❌",
  "card.reissue_approve": "🔄",
  "card.reissue_reject": "🚫",
  "membership.application_approved": "🎉",
  "membership.application_rejected": "⛔",
  "voting.vote_cast": "🗳️",
  "config.updated": "⚙️",
  "config.bulk_updated": "📦",
  "config.deleted": "🗑️",
  "branding.updated": "🎨",
  "feature_flag.created": "🚩",
  "feature_flag.updated": "📝",
  "feature_flag.enabled": "🟢",
  "feature_flag.disabled": "🔴",
  "feature_flag.deleted": "🗑️",
  "rbac.role_assigned": "👤",
  "rbac.role_removed": "👤",
  "workflow.started": "🔄",
  "workflow.completed": "✅",
  "workflow.cancelled": "🚫",
  "form.submitted": "📋",
  "system.seeded_defaults": "🌱",
  "system.cache_invalidated": "🧹",
};

function formatAction(action: string): string {
  return action
    .replace(/\./g, " → ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTime(date: Date): string {
  const d = new Date(date);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AdminAudit() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  const [filters, setFilters] = useState({
    category: "all",
    search: "",
    limit: 50,
    offset: 0,
  });

  const auditQuery = trpc.enterprise.audit.list.useQuery({
    category: filters.category === "all" ? undefined : filters.category,
    search: filters.search || undefined,
    limit: filters.limit,
    offset: filters.offset,
  });

  const statsQuery = trpc.enterprise.audit.stats.useQuery();

  if (loading) {
    return (
      <div className="msap-page min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#138A73]" />
      </div>
    );
  }

  if (!user || user.role !== "superadmin") {
    navigate("/official");
    return null;
  }

  const events = auditQuery.data || [];
  const stats = statsQuery.data;
  const hasMore = events.length === filters.limit;

  return (
    <div className="py-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1B355E] mb-2 flex items-center gap-3">
            <ScrollText className="h-8 w-8 text-[#106E5B]" />
            Audit Trail
          </h1>
          <p className="text-[#66788D]">
            Immutable record of all system actions. Append-only, tamper-evident.
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-3 sm:grid-cols-3 mb-6">
            <Card className="card-cinematic">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#138A73]/10 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-[#138A73]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1B355E]">{stats.totalEvents.toLocaleString()}</p>
                  <p className="text-xs text-[#8A9BAE]">Total Events</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-cinematic">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#FFC107]/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-[#FFC107]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1B355E]">
                    {Object.keys(stats.eventsByCategory).length}
                  </p>
                  <p className="text-xs text-[#8A9BAE]">Categories</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-cinematic">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#1B355E]/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-[#1B355E]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1B355E]">
                    {stats.recentEvents.length}
                  </p>
                  <p className="text-xs text-[#8A9BAE]">Actions (24h)</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="card-cinematic mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label className="text-xs font-semibold text-[#66788D]">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8A9BAE]" />
                  <Input
                    value={filters.search}
                    onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value, offset: 0 }))}
                    placeholder="Search actions, emails, reasons..."
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="w-full sm:w-48">
                <Label className="text-xs font-semibold text-[#66788D]">Category</Label>
                <Select
                  value={filters.category}
                  onValueChange={(v) => setFilters((p) => ({ ...p, category: v, offset: 0 }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Events Table */}
        <Card className="card-cinematic">
          <CardContent className="p-0">
            {auditQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#138A73]" />
              </div>
            ) : events.length === 0 ? (
              <div className="py-12 text-center text-[#8A9BAE]">
                <ScrollText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No audit events found.</p>
                <p className="text-sm mt-1">Events will appear here as users interact with the system.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F4F8F7]">
                      <TableHead className="text-[11px] font-bold uppercase text-[#66788D]">Action</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase text-[#66788D]">Actor</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase text-[#66788D]">Entity</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase text-[#66788D]">Category</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase text-[#66788D]">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id} className="hover:bg-[#F0FAF7]">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-base">{ACTION_ICONS[event.action] || "📝"}</span>
                            <div>
                              <p className="text-sm font-medium text-[#1B355E]">{formatAction(event.action)}</p>
                              {event.reason && (
                                <p className="text-[11px] text-[#8A9BAE] max-w-[200px] truncate">{event.reason}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-[#8A9BAE]" />
                            <span className="text-sm text-[#66788D]">
                              {event.actorEmail || "system"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono text-[#66788D]">
                            {event.entityType || "—"}
                            {event.entityId ? `#${event.entityId}` : ""}
                          </span>
                        </TableCell>
                        <TableCell>
                          {event.category && (
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {event.category}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-[#8A9BAE] whitespace-nowrap">
                            {formatTime(event.createdAt)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {events.length > 0 && (
          <div className="flex justify-between items-center mt-4">
            <p className="text-xs text-[#8A9BAE]">
              Showing {filters.offset + 1}–{filters.offset + events.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters((p) => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
                disabled={filters.offset === 0}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters((p) => ({ ...p, offset: p.offset + p.limit }))}
                disabled={!hasMore}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

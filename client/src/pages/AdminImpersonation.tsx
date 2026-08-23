import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  UserCog,
  Loader2,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle,
  ChevronRight,
} from "lucide-react";

export default function AdminImpersonation() {
  const [searchQuery, setSearchQuery] = useState("");
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [impersonateForm, setImpersonateForm] = useState({
    targetUser: "",
    reason: "",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.impersonation?.stats?.useQuery() ?? { data: null };
  const sessions = adminTrpc.impersonation?.sessions?.useQuery({
    limit: 50,
  }) ?? { data: [], isLoading: false };

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">
            Impersonation
          </h1>
          <p className="text-sm text-[#5D7086]">
            §33: Controlled impersonation with mandatory reason capture and
            complete audit logging
          </p>
        </div>
        <Button
          onClick={() => setImpersonateOpen(true)}
          className="bg-[#138A73] hover:bg-[#106E5B] text-white gap-2"
        >
          <UserCog className="h-4 w-4" /> Start Impersonation
        </Button>
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <strong>Important:</strong> All impersonation sessions are
            fully audit-logged with your identity, reason, target user,
            timestamps, and all actions performed. Misuse is subject to
            disciplinary action.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Sessions",
            value: stats.data?.total ?? 0,
            icon: UserCog,
            color: "text-[#138A73]",
          },
          {
            label: "Active Now",
            value: stats.data?.active ?? 0,
            icon: Clock,
            color: "text-orange-600",
          },
          {
            label: "Completed",
            value: stats.data?.completed ?? 0,
            icon: CheckCircle,
            color: "text-green-600",
          },
          {
            label: "Unique Operators",
            value: stats.data?.operators ?? 0,
            icon: UserCog,
            color: "text-blue-600",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg bg-gray-50 p-2 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1B355E]">
                    {stat.value}
                  </p>
                  <p className="text-xs text-[#5D7086]">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5D7086]" />
        <Input
          className="pl-9"
          placeholder="Search impersonation sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">
            Impersonation Audit Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : (sessions.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <UserCog className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No impersonation sessions recorded</p>
              <p className="text-sm mt-1">
                All sessions will appear here for audit review.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(sessions.data ?? []).map((session: any) => (
                <div
                  key={session.id}
                  className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors"
                >
                  <div className="rounded-lg bg-purple-50 p-2.5">
                    <UserCog className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1B355E] truncate">
                        {session.operator} → {session.target}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          session.active
                            ? "bg-orange-100 text-orange-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {session.active ? "Active" : "Completed"}
                      </span>
                    </div>
                    <p className="text-xs text-[#5D7086] mt-1">
                      Reason: {session.reason}
                    </p>
                    <p className="text-xs text-[#5D7086]">
                      {session.startedAt} — {session.endedAt || "ongoing"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#5D7086]" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={impersonateOpen} onOpenChange={setImpersonateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1B355E]">
              Start Impersonation Session
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <strong>Warning:</strong> This action will be audit-logged
              with your identity, the target user, timestamps, and all
              actions performed.
            </div>
            <div>
              <Label className="text-xs font-semibold text-[#66788D]">
                Target User (email or ID)
              </Label>
              <Input
                value={impersonateForm.targetUser}
                onChange={(e) =>
                  setImpersonateForm((p) => ({
                    ...p,
                    targetUser: e.target.value,
                  }))
                }
                placeholder="user@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-[#66788D]">
                Mandatory Reason
              </Label>
              <Textarea
                value={impersonateForm.reason}
                onChange={(e) =>
                  setImpersonateForm((p) => ({ ...p, reason: e.target.value }))
                }
                placeholder="Why are you impersonating this user? (required)"
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImpersonateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => setImpersonateOpen(false)}
              disabled={
                !impersonateForm.targetUser || !impersonateForm.reason
              }
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Start Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

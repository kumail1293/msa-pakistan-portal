import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Shield,
  Loader2,
  Search,
  Plus,
  Eye,
  EyeOff,
  Lock,
  ChevronRight,
} from "lucide-react";

export default function AdminPrivacy() {
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    field: "",
    defaultVisibility: "org_only",
    description: "",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.privacy?.stats?.useQuery() ?? { data: null };
  const policies = adminTrpc.privacy?.list?.useQuery({
    scope: scopeFilter || undefined,
    limit: 50,
  }) ?? { data: [], isLoading: false };

  const visibilityColors: Record<string, string> = {
    public: "bg-green-100 text-green-700",
    org_only: "bg-blue-100 text-blue-700",
    chapter_only: "bg-purple-100 text-purple-700",
    leadership_only: "bg-orange-100 text-orange-700",
    private: "bg-red-100 text-red-700",
  };

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">Privacy</h1>
          <p className="text-sm text-[#5D7086]">
            §19: Member privacy controls — who sees which profile fields
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#138A73] hover:bg-[#106E5B] text-white gap-2"
        >
          <Plus className="h-4 w-4" /> Add Policy
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Policies",
            value: stats.data?.total ?? 0,
            icon: Shield,
            color: "text-[#138A73]",
          },
          {
            label: "Public Fields",
            value: stats.data?.public ?? 0,
            icon: Eye,
            color: "text-green-600",
          },
          {
            label: "Restricted",
            value: stats.data?.restricted ?? 0,
            icon: Lock,
            color: "text-orange-600",
          },
          {
            label: "Private Fields",
            value: stats.data?.private ?? 0,
            icon: EyeOff,
            color: "text-red-600",
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5D7086]" />
          <Input
            className="pl-9"
            placeholder="Search privacy policies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={scopeFilter} onValueChange={setScopeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Scopes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Scopes</SelectItem>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="org_only">Org Only</SelectItem>
            <SelectItem value="chapter_only">Chapter Only</SelectItem>
            <SelectItem value="leadership_only">Leadership Only</SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">
            Privacy Policies ({(policies.data ?? []).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {policies.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : (policies.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No privacy policies configured</p>
              <p className="text-sm mt-1">
                Define visibility rules for member profile fields.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(policies.data ?? []).map((policy: any) => (
                <div
                  key={policy.id}
                  className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors"
                >
                  <div className="rounded-lg bg-indigo-50 p-2.5">
                    <Shield className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1B355E] truncate">
                        {policy.field}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          visibilityColors[policy.visibility] ||
                          "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {policy.visibility?.replace("_", " ")}
                      </span>
                    </div>
                    {policy.description && (
                      <p className="text-xs text-[#5D7086] mt-1">
                        {policy.description}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#5D7086]" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1B355E]">
              Add Privacy Policy
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-[#66788D]">
                Profile Field
              </Label>
              <Input
                value={newPolicy.field}
                onChange={(e) =>
                  setNewPolicy((p) => ({ ...p, field: e.target.value }))
                }
                placeholder="email, phone, chapter..."
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-[#66788D]">
                Default Visibility
              </Label>
              <Select
                value={newPolicy.defaultVisibility}
                onValueChange={(v) =>
                  setNewPolicy((p) => ({ ...p, defaultVisibility: v }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="org_only">Organization Only</SelectItem>
                  <SelectItem value="chapter_only">Chapter Only</SelectItem>
                  <SelectItem value="leadership_only">
                    Leadership Only
                  </SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-[#66788D]">
                Description
              </Label>
              <Input
                value={newPolicy.description}
                onChange={(e) =>
                  setNewPolicy((p) => ({
                    ...p,
                    description: e.target.value,
                  }))
                }
                placeholder="What this policy controls..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => setCreateOpen(false)}
              disabled={!newPolicy.field}
              className="bg-[#138A73] hover:bg-[#106E5B] text-white"
            >
              Add Policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

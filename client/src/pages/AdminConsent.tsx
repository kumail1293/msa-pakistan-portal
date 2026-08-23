import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Handshake,
  Loader2,
  Search,
  Plus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

export default function AdminConsent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newConsent, setNewConsent] = useState({
    purpose: "",
    description: "",
    required: false,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTrpc = trpc.admin as any;
  const stats = adminTrpc.consent?.stats?.useQuery() ?? { data: null };
  const purposes = adminTrpc.consent?.list?.useQuery({
    search: searchQuery || undefined,
    limit: 50,
  }) ?? { data: [], isLoading: false };

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B355E]">
            Consent Management
          </h1>
          <p className="text-sm text-[#5D7086]">
            §20: Track member consent for communications, data use,
            photography, publications, and events
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#138A73] hover:bg-[#106E5B] text-white gap-2"
        >
          <Plus className="h-4 w-4" /> Add Consent Purpose
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Purposes",
            value: stats.data?.total ?? 0,
            icon: Handshake,
            color: "text-[#138A73]",
          },
          {
            label: "Granted",
            value: stats.data?.granted ?? 0,
            icon: CheckCircle,
            color: "text-green-600",
          },
          {
            label: "Declined",
            value: stats.data?.declined ?? 0,
            icon: XCircle,
            color: "text-red-600",
          },
          {
            label: "Pending",
            value: stats.data?.pending ?? 0,
            icon: AlertTriangle,
            color: "text-orange-600",
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
          placeholder="Search consent purposes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B355E]">
            Consent Purposes ({(purposes.data ?? []).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {purposes.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#138A73]" />
            </div>
          ) : (purposes.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-[#5D7086]">
              <Handshake className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No consent purposes defined</p>
              <p className="text-sm mt-1">
                Define what members can consent to (photography, data use,
                etc.)
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(purposes.data ?? []).map((purpose: any) => (
                <div
                  key={purpose.id}
                  className="flex items-center gap-4 rounded-lg border border-[#E7F4F0] p-4 hover:bg-[#F8FBFA] transition-colors"
                >
                  <div className="rounded-lg bg-teal-50 p-2.5">
                    <Handshake className="h-5 w-5 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1B355E] truncate">
                        {purpose.purpose}
                      </h3>
                      {purpose.required && (
                        <Badge className="bg-red-100 text-red-700 text-[10px]">
                          Required
                        </Badge>
                      )}
                    </div>
                    {purpose.description && (
                      <p className="text-xs text-[#5D7086] mt-1">
                        {purpose.description}
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
              Add Consent Purpose
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-[#66788D]">
                Purpose
              </Label>
              <Input
                value={newConsent.purpose}
                onChange={(e) =>
                  setNewConsent((p) => ({ ...p, purpose: e.target.value }))
                }
                placeholder="Photography, Data Use, Event Participation..."
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-[#66788D]">
                Description
              </Label>
              <Textarea
                value={newConsent.description}
                onChange={(e) =>
                  setNewConsent((p) => ({
                    ...p,
                    description: e.target.value,
                  }))
                }
                placeholder="What does this consent cover?"
                className="mt-1"
                rows={2}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={newConsent.required}
                onCheckedChange={(v) =>
                  setNewConsent((p) => ({ ...p, required: v }))
                }
              />
              <Label className="text-sm">Required for membership</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => setCreateOpen(false)}
              disabled={!newConsent.purpose}
              className="bg-[#138A73] hover:bg-[#106E5B] text-white"
            >
              Add Purpose
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

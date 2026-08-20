import { useAuth } from "@/_core/hooks/useAuth";
import { canAccessModule } from "@/_core/access";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import {
  Flag,
  Plus,
  Trash2,
  Shield,
  Loader2,
} from "lucide-react";

export default function AdminFeatureFlags() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [newFlag, setNewFlag] = useState({
    key: "",
    name: "",
    description: "",
    enabled: false,
  });

  const flagsQuery = trpc.enterprise.featureFlags.list.useQuery();
  const toggleMutation = trpc.enterprise.featureFlags.toggle.useMutation({
    onSuccess: () => {
      flagsQuery.refetch();
      toast.success("Feature flag toggled");
    },
    onError: () => toast.error("Failed to toggle flag"),
  });

  const createMutation = trpc.enterprise.featureFlags.create.useMutation({
    onSuccess: () => {
      flagsQuery.refetch();
      setCreateOpen(false);
      setNewFlag({ key: "", name: "", description: "", enabled: false });
      toast.success("Feature flag created");
    },
    onError: (err) => toast.error(err.message || "Failed to create flag"),
  });

  const deleteMutation = trpc.enterprise.featureFlags.delete.useMutation({
    onSuccess: () => {
      flagsQuery.refetch();
      toast.success("Feature flag deleted");
    },
    onError: () => toast.error("Failed to delete flag"),
  });

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

  const flags = flagsQuery.data || [];
  const enabledCount = flags.filter((f) => f.enabled).length;

  return (
    <div className="py-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1B355E] mb-2 flex items-center gap-3">
              <Flag className="h-8 w-8 text-[#106E5B]" />
              Feature Flags
            </h1>
            <p className="text-[#66788D]">
              Control which modules and features are available. {enabledCount} of {flags.length} enabled.
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-[#138A73] hover:bg-[#106E5B] text-white gap-2"
          >
            <Plus className="h-4 w-4" /> New Flag
          </Button>
        </div>

        {/* Flags Grid */}
        {flagsQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#138A73]" />
          </div>
        ) : flags.length === 0 ? (
          <Card className="card-cinematic">
            <CardContent className="py-12 text-center text-[#8A9BAE]">
              <Flag className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No feature flags configured.</p>
              <p className="text-sm mt-1">Create your first flag to start controlling feature rollout.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {flags.map((flag) => (
              <Card
                key={flag.key}
                className={`card-cinematic transition-all ${
                  flag.enabled ? "border-[#138A73]/30 bg-[#F0FAF7]" : "opacity-70"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#1B355E] text-sm truncate">{flag.name}</h3>
                        <Badge
                          variant={flag.enabled ? "default" : "secondary"}
                          className={`text-[10px] ${
                            flag.enabled
                              ? "bg-[#138A73] text-white"
                              : "bg-[#E7F4F0] text-[#66788D]"
                          }`}
                        >
                          {flag.enabled ? "ON" : "OFF"}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#8A9BAE] font-mono mb-1">{flag.key}</p>
                      {flag.description && (
                        <p className="text-xs text-[#66788D] line-clamp-2">{flag.description}</p>
                      )}
                      <div className="flex gap-2 mt-2">
                        {flag.environment && (
                          <Badge variant="outline" className="text-[10px]">{flag.environment}</Badge>
                        )}
                        {flag.percentage !== undefined && flag.percentage < 100 && (
                          <Badge variant="outline" className="text-[10px]">{flag.percentage}% rollout</Badge>
                        )}
                        {flag.allowedRoles && flag.allowedRoles.length > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            <Shield className="h-3 w-3 mr-1" />
                            {flag.allowedRoles.length} role(s)
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={flag.enabled}
                        onCheckedChange={(enabled) =>
                          toggleMutation.mutateAsync({ key: flag.key, enabled })
                        }
                        disabled={toggleMutation.isPending}
                      />
                      {!flag.key.startsWith("workflow.") &&
                        !flag.key.startsWith("forms.") &&
                        !flag.key.startsWith("activities.") &&
                        !flag.key.startsWith("events.") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => {
                              if (confirm(`Delete flag "${flag.name}"?`)) {
                                deleteMutation.mutateAsync({ key: flag.key });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#1B355E]">Create Feature Flag</DialogTitle>
              <DialogDescription>
                Add a new feature flag to control feature rollout.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs font-semibold text-[#66788D]">Key (unique identifier)</Label>
                <Input
                  value={newFlag.key}
                  onChange={(e) => setNewFlag((p) => ({ ...p, key: e.target.value }))}
                  placeholder="my.new.feature"
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#66788D]">Display Name</Label>
                <Input
                  value={newFlag.name}
                  onChange={(e) => setNewFlag((p) => ({ ...p, name: e.target.value }))}
                  placeholder="My New Feature"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#66788D]">Description</Label>
                <Textarea
                  value={newFlag.description}
                  onChange={(e) => setNewFlag((p) => ({ ...p, description: e.target.value }))}
                  placeholder="What does this flag control?"
                  className="mt-1"
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={newFlag.enabled}
                  onCheckedChange={(enabled) => setNewFlag((p) => ({ ...p, enabled }))}
                />
                <Label className="text-sm">Enabled by default</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutateAsync(newFlag)}
                disabled={!newFlag.key || !newFlag.name || createMutation.isPending}
                className="bg-[#138A73] hover:bg-[#106E5B] text-white"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create Flag"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

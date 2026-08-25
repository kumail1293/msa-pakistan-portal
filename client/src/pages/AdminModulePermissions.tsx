import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import {
  Shield,
  Eye,
  MessageSquare,
  Pencil,
  Users,
  Settings,
  ChevronDown,
  Check,
  RefreshCw,
} from "lucide-react";

// ============================================================================
// Access level config
// ============================================================================

const ACCESS_CONFIG = {
  view: {
    label: "View Only",
    description: "Can view content but cannot edit or comment",
    icon: Eye,
    color: "bg-blue-100 text-blue-800 border-blue-200",
    activeColor: "bg-blue-500 text-white",
  },
  comment: {
    label: "View + Comments",
    description: "Can view and add comments, but cannot edit",
    icon: MessageSquare,
    color: "bg-amber-100 text-amber-800 border-amber-200",
    activeColor: "bg-amber-500 text-white",
  },
  edit: {
    label: "Full Edit",
    description: "Can view, comment, and create/edit/delete",
    icon: Pencil,
    color: "bg-green-100 text-green-800 border-green-200",
    activeColor: "bg-green-600 text-white",
  },
} as const;

// ============================================================================
// Main Component
// ============================================================================

export default function AdminModulePermissions() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Redirect if not superadmin ──
  if (!authLoading && user && user.role !== "superadmin") {
    navigate("/dashboard");
    return null;
  }

  // ── Queries ──
  const modulesQuery = trpc.modulePermissions.modules.useQuery();
  const summaryQuery = trpc.modulePermissions.getSummary.useQuery();
  const userPermsQuery = trpc.modulePermissions.getUserPermissions.useQuery(
    { userId: selectedUserId! },
    { enabled: selectedUserId !== null }
  );

  // ── Mutations ──
  const setAccess = trpc.modulePermissions.setAccess.useMutation({
    onSuccess: () => {
      toast.success("Permission updated");
      userPermsQuery.refetch();
      summaryQuery.refetch();
      setSaving(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setSaving(false);
    },
  });

  const removeAccess = trpc.modulePermissions.removeAccess.useMutation({
    onSuccess: () => {
      toast.success("Permission removed (reverted to default)");
      userPermsQuery.refetch();
      summaryQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const setDefaultAccess = trpc.modulePermissions.setDefaultAccess.useMutation({
    onSuccess: () => {
      toast.success("Default access level updated");
      summaryQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Loading state ──
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user.role !== "superadmin") return null;

  const modules = modulesQuery.data?.modules ?? [];
  const summary = summaryQuery.data?.summary;
  const defaultAccess = summaryQuery.data?.defaultAccess ?? "view";
  const userPerms = userPermsQuery.data?.permissions ?? [];

  // Build a map of user's current permissions
  const userPermMap: Record<string, string> = {};
  for (const p of userPerms) {
    userPermMap[p.module] = p.accessLevel;
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Module Permissions</h1>
          </div>
          <p className="text-muted-foreground">
            Control what each user can do in every module. Three access levels:
            <strong> View Only</strong>, <strong>View + Comments</strong>, and <strong>Full Edit</strong>.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Modules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{modules.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Default Access</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AccessBadge level={defaultAccess as any} />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => {
                    const next = defaultAccess === "view" ? "comment" : defaultAccess === "comment" ? "edit" : "view";
                    setDefaultAccess.mutate({ level: next as any });
                  }}
                >
                  Cycle
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Custom Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.totalPermissions ?? 0}</div>
              <p className="text-xs text-muted-foreground">overrides set</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">By Access Level</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                {summary?.byLevel && Object.entries(summary.byLevel).map(([level, count]) => (
                  <span key={level} className="text-xs">
                    <AccessBadge level={level as any} /> ×{count}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Module Permission Matrix */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Module Access Levels
            </CardTitle>
            <CardDescription>
              Each module has three access levels. The default applies to all users unless overridden per-user below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {modules.map((mod) => (
                <div
                  key={mod.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{mod.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{mod.description}</div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {(Object.entries(ACCESS_CONFIG) as [string, typeof ACCESS_CONFIG.view][]).map(([level, config]) => {
                      const Icon = config.icon;
                      const isDefault = defaultAccess === level;
                      return (
                        <button
                          key={level}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${
                            isDefault ? config.activeColor + " border-transparent shadow-sm" : config.color + " hover:opacity-80"
                          }`}
                          onClick={() => setDefaultAccess.mutate({ level: level as any })}
                          title={config.description}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {config.label}
                          {isDefault && <Check className="h-3 w-3 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Per-User Permission Editor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Per-User Permissions
            </CardTitle>
            <CardDescription>
              Override the default access level for specific users. Enter a user ID to manage their module permissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-6">
              <label className="text-sm font-medium">User ID:</label>
              <input
                type="number"
                className="border rounded-md px-3 py-1.5 text-sm w-32"
                placeholder="e.g. 1"
                value={selectedUserId ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : null;
                  setSelectedUserId(val);
                }}
              />
              {selectedUserId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => userPermsQuery.refetch()}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
              )}
            </div>

            {selectedUserId && (
              <div className="space-y-2">
                {modules.map((mod) => {
                  const currentLevel = userPermMap[mod.id] ?? defaultAccess;
                  return (
                    <div
                      key={mod.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{mod.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {mod.description}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 ml-4">
                        {(Object.entries(ACCESS_CONFIG) as [string, typeof ACCESS_CONFIG.view][]).map(([level, config]) => {
                          const Icon = config.icon;
                          const isActive = currentLevel === level;
                          return (
                            <button
                              key={level}
                              disabled={saving}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium transition-all ${
                                isActive ? config.activeColor + " border-transparent shadow-sm" : config.color + " hover:opacity-80"
                              } ${saving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                              onClick={() => {
                                setSaving(true);
                                setAccess.mutate({
                                  userId: selectedUserId,
                                  moduleId: mod.id,
                                  accessLevel: level as any,
                                });
                              }}
                              title={config.description}
                            >
                              <Icon className="h-3 w-3" />
                              {config.label}
                              {isActive && <Check className="h-3 w-3" />}
                            </button>
                          );
                        })}
                        {userPermMap[mod.id] && (
                          <button
                            className="ml-1 text-xs text-red-500 hover:text-red-700 underline"
                            onClick={() =>
                              removeAccess.mutate({ userId: selectedUserId, moduleId: mod.id })
                            }
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!selectedUserId && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Enter a user ID above to manage their module permissions</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Access Badge Component
// ============================================================================

function AccessBadge({ level }: { level: "view" | "comment" | "edit" }) {
  const config = ACCESS_CONFIG[level];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

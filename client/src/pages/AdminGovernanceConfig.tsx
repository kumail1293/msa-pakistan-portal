import { useAuth } from "@/_core/hooks/useAuth";
import { canAccessModule } from "@/_core/access";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Scale,
  Save,
  RotateCcw,
  Tag,
  Vote,
  Mic,
  Users,
  Building,
  Bell,
  FileText,
  Shield,
  Settings,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  Info,
} from "lucide-react";

// ── Domain icon mapping ───────────────────────────────────────────
const DOMAIN_ICONS: Record<string, React.ElementType> = {
  Terminology: Tag,
  Governance: Scale,
  Elections: Vote,
  Plenary: Mic,
  Membership: Users,
  "Local Councils": Building,
  Notifications: Bell,
  Document: FileText,
  Security: Shield,
};

// ── Config entry type (mirrors server) ────────────────────────────
interface ConfigEntry {
  key: string;
  value: string;
  domain: string;
  label: string;
  description: string;
  type: "string" | "number" | "boolean" | "json" | "select";
  options?: string[];
  defaultValue: string;
  updatedAt?: string;
}

// ── Single Config Row ─────────────────────────────────────────────
function ConfigRow({
  entry,
  onSave,
  onReset,
  saving,
}: {
  entry: ConfigEntry;
  onSave: (key: string, value: string) => void;
  onReset: (key: string) => void;
  saving: boolean;
}) {
  const [localValue, setLocalValue] = useState(entry.value);
  const [expanded, setExpanded] = useState(false);
  const isChanged = localValue !== entry.value;

  useEffect(() => {
    setLocalValue(entry.value);
  }, [entry.value]);

  const renderInput = () => {
    switch (entry.type) {
      case "boolean":
        return (
          <div className="flex items-center gap-3">
            <Switch
              checked={localValue === "true"}
              onCheckedChange={(checked) =>
                setLocalValue(checked ? "true" : "false")
              }
            />
            <span className="text-sm text-[#66788D]">
              {localValue === "true" ? "Enabled" : "Disabled"}
            </span>
          </div>
        );
      case "select":
        return (
          <Select value={localValue} onValueChange={setLocalValue}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {(entry.options ?? []).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "number":
        return (
          <Input
            type="number"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            className="font-mono text-sm"
          />
        );
      case "json":
        return (
          <div>
            <Textarea
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              className="font-mono text-xs"
              rows={expanded ? 4 : 1}
            />
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 h-6 text-xs"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" /> Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" /> Expand
                </>
              )}
            </Button>
          </div>
        );
      default:
        return (
          <Input
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            className="text-sm"
          />
        );
    }
  };

  return (
    <div className="grid gap-2 sm:grid-cols-[240px_1fr_100px] sm:items-center py-3 border-b border-[#E7F4F0] last:border-0">
      <div>
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium text-[#1B355E]">
            {entry.label}
          </Label>
          {entry.value !== entry.defaultValue && (
            <Badge
              variant="outline"
              className="text-[9px] bg-amber-50 text-amber-700 border-amber-200"
            >
              Modified
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-[#8A9BAE] mt-0.5">{entry.description}</p>
        <p className="text-[10px] text-[#B0BEC5] font-mono mt-0.5">{entry.key}</p>
      </div>
      <div>{renderInput()}</div>
      <div className="flex gap-1 justify-end">
        {isChanged && (
          <Button
            size="sm"
            onClick={() => onSave(entry.key, localValue)}
            disabled={saving}
            className="h-7 bg-[#138A73] hover:bg-[#106E5B] text-white text-xs gap-1"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            Save
          </Button>
        )}
        {entry.value !== entry.defaultValue && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setLocalValue(entry.defaultValue);
              onReset(entry.key);
            }}
            className="h-7 text-xs gap-1 text-[#8A9BAE] hover:text-[#1B355E]"
          >
            <RotateCcw className="h-3 w-3" />
            Default
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Simulation Dialog ─────────────────────────────────────────────
function SimulationDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState("");
  const simulateQuery = trpc.enterprise.governanceConfig.simulate.useQuery(
    { question },
    { enabled: false }
  );

  const handleSimulate = () => {
    if (!question.trim()) return;
    simulateQuery.refetch();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#1B355E] flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#138A73]" />
            Rule Simulator
          </DialogTitle>
          <DialogDescription>
            Ask a question about the current governance rules to see how they
            apply.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder='e.g. "Who can vote in NGA?" or "What is quorum?"'
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSimulate();
              }}
            />
            <Button
              onClick={handleSimulate}
              disabled={!question.trim() || simulateQuery.isFetching}
              className="bg-[#138A73] hover:bg-[#106E5B] text-white"
            >
              {simulateQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          </div>
          {simulateQuery.data && (
            <Card className="bg-[#F0FAF7] border-[#138A73]/20">
              <CardContent className="p-4">
                <p className="text-sm text-[#1B355E] font-medium mb-2">
                  {simulateQuery.data.answer}
                </p>
                {simulateQuery.data.applicableRules.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#66788D] uppercase tracking-wider">
                      Applicable Rules
                    </p>
                    {simulateQuery.data.applicableRules.map((rule, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs text-[#8A9BAE]"
                      >
                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono"
                        >
                          {rule.key}
                        </Badge>
                        <span>= {rule.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                <Badge
                  className={`mt-2 text-[10px] ${
                    simulateQuery.data.confidence === "high"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : simulateQuery.data.confidence === "medium"
                      ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  Confidence: {simulateQuery.data.confidence}
                </Badge>
              </CardContent>
            </Card>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function AdminGovernanceConfig() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [simOpen, setSimOpen] = useState(false);

  // ── Queries ─────────────────────────────────────────────────────
  const configQuery =
    trpc.enterprise.governanceConfig.listGrouped.useQuery();
  const domainsQuery =
    trpc.enterprise.governanceConfig.domains.useQuery();

  // ── Mutations ───────────────────────────────────────────────────
  const updateMutation =
    trpc.enterprise.governanceConfig.update.useMutation({
      onSuccess: () => {
        configQuery.refetch();
        toast.success("Configuration saved");
      },
      onError: (err) => toast.error(err.message || "Failed to save"),
    });

  const resetMutation =
    trpc.enterprise.governanceConfig.reset.useMutation({
      onSuccess: () => {
        configQuery.refetch();
        toast.success("Value reset to default");
      },
      onError: (err) => toast.error(err.message || "Failed to reset"),
    });

  const resetDomainMutation =
    trpc.enterprise.governanceConfig.resetDomain.useMutation({
      onSuccess: () => {
        configQuery.refetch();
        toast.success("Domain reset to defaults");
      },
      onError: (err) => toast.error(err.message || "Failed to reset domain"),
    });

  // ── Auth Guard ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="msap-page min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#138A73]" />
      </div>
    );
  }

  if (!user || !canAccessModule(user, "config")) {
    navigate("/official");
    return null;
  }

  // ── Handlers ────────────────────────────────────────────────────
  const handleSave = async (key: string, value: string) => {
    setSavingKey(key);
    try {
      await updateMutation.mutateAsync({ key, value });
    } finally {
      setSavingKey(null);
    }
  };

  const handleReset = async (key: string) => {
    await resetMutation.mutateAsync({ key });
  };

  // ── Data ────────────────────────────────────────────────────────
  const grouped = (configQuery.data ?? {}) as Record<string, ConfigEntry[]>;
  const domains = (domainsQuery.data ?? []) as Array<{
    key: string;
    label: string;
    icon: string;
    count: number;
  }>;

  // Filter by search
  const filterEntries = (entries: ConfigEntry[]): ConfigEntry[] => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.key.toLowerCase().includes(q) ||
        e.label.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
    );
  };

  const totalEntries = Object.values(grouped).flat().length;
  const modifiedEntries = Object.values(grouped)
    .flat()
    .filter((e) => e.value !== e.defaultValue).length;

  return (
    <div className="py-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1B355E] mb-2 flex items-center gap-3">
              <Scale className="h-8 w-8 text-[#106E5B]" />
              Governance Configuration
            </h1>
            <p className="text-[#66788D]">
              Configure all governance parameters without changing code.{" "}
              {totalEntries} parameters across {domains.length} domains.
              {modifiedEntries > 0 && (
                <span className="text-amber-600 font-medium">
                  {" "}
                  {modifiedEntries} modified from defaults.
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8A9BAE]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search parameters..."
                className="pl-9 w-56 text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSimOpen(true)}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Simulator
            </Button>
          </div>
        </div>

        {/* Domain Tabs */}
        {configQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#138A73]" />
          </div>
        ) : (
          <Tabs defaultValue={domains[0]?.key ?? "Terminology"} className="space-y-6">
            <TabsList className="bg-white border border-[#D9E4E1] p-1 flex flex-wrap">
              {domains.map((domain) => {
                const Icon = DOMAIN_ICONS[domain.key] ?? Settings;
                const domainEntries = grouped[domain.key] ?? [];
                const modified = domainEntries.filter(
                  (e) => e.value !== e.defaultValue
                ).length;
                return (
                  <TabsTrigger
                    key={domain.key}
                    value={domain.key}
                    className="gap-1.5 text-xs"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {domain.label}
                    <Badge
                      variant="secondary"
                      className="ml-1 text-[9px] px-1.5 py-0"
                    >
                      {domain.count}
                    </Badge>
                    {modified > 0 && (
                      <Badge className="ml-0.5 text-[9px] px-1.5 py-0 bg-amber-100 text-amber-700">
                        {modified}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {domains.map((domain) => {
              const entries = filterEntries(grouped[domain.key] ?? []);
              const domainEntries = grouped[domain.key] ?? [];
              const modified = domainEntries.filter(
                (e) => e.value !== e.defaultValue
              ).length;

              return (
                <TabsContent key={domain.key} value={domain.key}>
                  <Card className="card-cinematic">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg text-[#1B355E] flex items-center gap-2">
                            {(() => {
                              const Icon = DOMAIN_ICONS[domain.key] ?? Settings;
                              return <Icon className="h-5 w-5 text-[#106E5B]" />;
                            })()}
                            {domain.label} Configuration
                          </CardTitle>
                          <CardDescription>
                            {entries.length} parameters
                            {modified > 0 && (
                              <span className="text-amber-600">
                                {" "}
                                · {modified} modified
                              </span>
                            )}
                          </CardDescription>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (
                              confirm(
                                `Reset all ${domain.label} settings to defaults?`
                              )
                            ) {
                              resetDomainMutation.mutateAsync({
                                domain: domain.key,
                              });
                            }
                          }}
                          disabled={resetDomainMutation.isPending}
                          className="gap-1.5 text-xs"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reset Domain
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {entries.length === 0 ? (
                        <div className="py-8 text-center text-[#8A9BAE]">
                          <Info className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <p className="text-sm">
                            {searchQuery
                              ? "No parameters match your search."
                              : "No parameters in this domain."}
                          </p>
                        </div>
                      ) : (
                        <div>
                          {entries.map((entry) => (
                            <ConfigRow
                              key={entry.key}
                              entry={entry}
                              onSave={handleSave}
                              onReset={handleReset}
                              saving={savingKey === entry.key}
                            />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        )}

        {/* Simulation Dialog */}
        <SimulationDialog open={simOpen} onClose={() => setSimOpen(false)} />
      </div>
    </div>
  );
}

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { isSuperAdmin } from "@/_core/access";
import {
  OFFICIAL_MODULES,
  OFFICIAL_MODULE_LABELS,
  OFFICIAL_POSITIONS,
  OFFICIAL_POSITION_LABELS,
} from "@/_core/access";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  KeyRound,
  Loader2,
  Plus,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";

type Official = {
  id: number;
  name: string | null;
  email: string;
  role: string;
  officialPosition: string | null;
  domain: string | null;
  localCouncil: string | null;
  moduleAccess: string[];
  active: boolean;
  passwordSetupRequired: boolean;
  lastSignedIn: Date | null;
  createdAt: Date;
  termEnd: Date | null;
  termExpired: boolean;
};

/** Position badge colors — grouped by body */
const POSITION_META: Record<string, string> = {
  // Executive Board
  president: "bg-[#1B355E] text-white",
  vpi: "bg-[#3B5B8C] text-white",
  vpe: "bg-[#4A6FA5] text-white",
  vpa: "bg-[#138A73] text-white",
  vpcb: "bg-[#5B8C5A] text-white",
  vpm: "bg-[#7B5EA7] text-white",
  vpf: "bg-[#B8860B] text-white",
  vpprc: "bg-[#C0504D] text-white",
  // Supervising Council
  supco: "bg-[#106E5B] text-white",
  // Team of Officials
  npo: "bg-[#2E8B57] text-white",
  norp: "bg-[#4682B4] text-white",
  nora: "bg-[#DB7093] text-white",
  nome: "bg-[#9370DB] text-white",
  nore: "bg-[#20B2AA] text-white",
  neo: "bg-[#F4A460] text-black",
  // LC/CI
  "lc-president": "bg-[#7A5C1E] text-white",
  "lc-vpa": "bg-[#8B7355] text-white",
  "lc-vpf": "bg-[#A0522D] text-white",
  "lc-secretary": "bg-[#696969] text-white",
  "ci-coordinator": "bg-[#556B2F] text-white",
};

function initialsOf(name: string | null | undefined): string {
  if (!name) return "O";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Officials Management — Super Admin only. There is NO public sign-up for
 * officials: every official account is provisioned here, with an optional
 * position/domain/Local Council and the module grants that decide what the
 * official sees on the separate Official Portal.
 */
export default function OfficialsManagement() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  const officials = trpc.admin.officials.list.useQuery(undefined, {
    retry: false,
  });

  // ---- Create form ----
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState<string>(OFFICIAL_POSITIONS[0]);
  const [domain, setDomain] = useState("");
  const [localCouncil, setLocalCouncil] = useState("");
  const [role, setRole] = useState<"official" | "admin">("official");
  const [modules, setModules] = useState<string[]>([]);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const createOfficial = trpc.admin.officials.create.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.created
          ? `Official ${data.official.email} provisioned.`
          : `Official ${data.official.email} re-provisioned.`
      );
      const link = data.setupToken
        ? `${window.location.origin}/set-password?token=${data.setupToken}`
        : null;
      setCreatedLink(link);
      if (link) {
        toast.info("A password setup link was generated — copy it now (shown once).");
      }
      setName("");
      setEmail("");
      setDomain("");
      setLocalCouncil("");
      setModules([]);
      officials.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleModule = (module: string, current: string[], setter: (m: string[]) => void) => {
    setter(current.includes(module)
      ? current.filter((m) => m !== module)
      : [...current, module]);
  };

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    createOfficial.mutate({
      name: name.trim(),
      email: email.trim(),
      position: position as (typeof OFFICIAL_POSITIONS)[number],
      domain: domain.trim() || undefined,
      localCouncil: localCouncil.trim() || undefined,
      role,
      moduleAccess: modules,
    });
  };

  // ---- Row editing ----
  const updateOfficial = trpc.admin.officials.update.useMutation({
    onSuccess: () => {
      toast.success("Official updated.");
      officials.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const saveModuleGrants = trpc.admin.officials.setModules.useMutation({
    onSuccess: () => {
      toast.success("Module grants updated.");
      officials.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const resetPassword = trpc.admin.officials.resetPassword.useMutation({
    onSuccess: (data, vars) => {
      const link = `${window.location.origin}/set-password?token=${data.setupToken}`;
      setResetLinkFor((prev) => ({ ...prev, [vars.userId]: link }));
      toast.info("Fresh password setup link generated for the official.");
    },
    onError: (err) => toast.error(err.message),
  });
  const [resetLinkFor, setResetLinkFor] = useState<Record<number, string | null>>({});
  const [openRow, setOpenRow] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="msap-page min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#138A73]" />
      </div>
    );
  }

  if (!user || !isSuperAdmin(user.role)) {
    navigate("/official");
    return null;
  }

  const items = officials.data ?? [];

  return (
    <div>
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0E2547_0%,#1B355E_55%,#294A78_100%)] px-6 py-8 text-white shadow-[0_24px_60px_-32px_rgba(27,53,94,.65)] sm:px-8">
        <div className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full border-[24px] border-white/10" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">
            <ShieldCheck className="h-4 w-4" /> Super Admin
          </div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Officials Management
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
            Provision official accounts (SUPCO, National President, Vice
            Presidents, Local Council Presidents) and open the modules each one
            can use. There is no self sign-up — access is granted here, and it
            is always revocable.
          </p>
        </div>
      </div>

      {/* Create */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-[#D9E4E1] bg-white shadow-[0_14px_36px_-24px_rgba(27,53,94,.4)]">
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[#F6F9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#138A73]"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1B355E]">
              <Plus className="h-4 w-4 text-white" />
            </span>
            <span>
              <span className="block font-bold text-[#1B355E]">
                Provision a new official
              </span>
              <span className="block text-xs text-[#5D7086]">
                Creates a portal account with a one-time password setup link
              </span>
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 text-[#5D7086] transition-transform ${showCreate ? "rotate-180" : ""}`}
          />
        </button>

        {showCreate && (
          <form onSubmit={handleCreate} className="space-y-5 border-t border-[#E7EFEC] px-5 py-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="off-name" className="text-xs font-bold text-[#1B355E]">Full name</Label>
                <Input id="off-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Ayesha Khan" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="off-email" className="text-xs font-bold text-[#1B355E]">Official email</Label>
                <Input id="off-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="official@msapakistan.org" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#1B355E]">Position</Label>
                <Select value={position} onValueChange={setPosition}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFICIAL_POSITIONS.map((p) => (
                      <SelectItem key={p} value={p}>{OFFICIAL_POSITION_LABELS[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#1B355E]">Account type</Label>
                <Select value={role} onValueChange={(v) => setRole(v as "official" | "admin")}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="official">Official (granted modules)</SelectItem>
                    <SelectItem value="admin">Admin (all modules)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {["vpi", "vpe", "vpa", "vpcb", "vpm", "vpf", "vpprc"].includes(position) && (
                <div className="space-y-1.5">
                  <Label htmlFor="off-domain" className="text-xs font-bold text-[#1B355E]">Domain</Label>
                  <Input id="off-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="e.g. Internal Affairs, Activities" className="h-10" />
                </div>
              )}
              {["npo", "norp", "nora", "nome", "nore", "neo"].includes(position) && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-[#1B355E]">Standing Committee (§12.1)</Label>
                  <Select value={domain} onValueChange={setDomain}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select SC" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SCOPH">SCOPH — Public Health</SelectItem>
                      <SelectItem value="SCORA">SCORA — Sexual & Reproductive Health</SelectItem>
                      <SelectItem value="SCOME">SCOME — Medical Education</SelectItem>
                      <SelectItem value="SCORP">SCORP — Human Rights & Peace</SelectItem>
                      <SelectItem value="SCOPE">SCOPE — Professional Exchange</SelectItem>
                      <SelectItem value="SCORE">SCORE — Research Exchange</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {position === "lc-president" && (
                <div className="space-y-1.5">
                  <Label htmlFor="off-council" className="text-xs font-bold text-[#1B355E]">Local Council</Label>
                  <Input id="off-council" value={localCouncil} onChange={(e) => setLocalCouncil(e.target.value)} placeholder="MSA-Pakistan KEMU LC" className="h-10" />
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#5D7086]">
                Modules to open for this official
              </p>
              <div className="flex flex-wrap gap-2">
                {OFFICIAL_MODULES.map((m) => (
                  <label
                    key={m}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                      modules.includes(m)
                        ? "border-[#106E5B] bg-[#E7F4F0] text-[#106E5B]"
                        : "border-[#D9E4E1] bg-white text-[#5D7086] hover:border-[#B9CBC6]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-[#106E5B]"
                      checked={modules.includes(m)}
                      onChange={() => toggleModule(m, modules, setModules)}
                    />
                    {OFFICIAL_MODULE_LABELS[m]}
                  </label>
                ))}
              </div>
            </div>

            {createdLink && (
              <div className="rounded-xl border border-[#BBD8CF] bg-[#E7F4F0] p-4">
                <p className="text-xs font-bold text-[#0B4E40]">
                  Setup link (shown once — copy it now or use “Reset password” later):
                </p>
                <div className="mt-2 flex gap-2">
                  <a
                    href={createdLink}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#106E5B] text-xs font-bold text-white transition-colors hover:bg-[#0B4E40]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open setup link
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(createdLink);
                      toast.success("Setup link copied.");
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-[#106E5B] px-3 text-xs font-bold text-[#106E5B] transition-colors hover:bg-white"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={createOfficial.isPending}
                className="h-10 bg-[#1B355E] px-5 text-white transition-colors hover:bg-[#294A78] disabled:opacity-60"
              >
                {createOfficial.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Provision official
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 border-[#D9E4E1] text-[#5D7086]"
                onClick={() => {
                  setShowCreate(false);
                  setCreatedLink(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Officials list */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-[#1B355E]">
            <Users className="h-5 w-5 text-[#106E5B]" />
            Officials ({items.length})
          </h2>
        </div>

        {officials.isLoading ? (
          <p className="py-8 text-center text-sm text-[#8A9BAE]">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#B9CBC6] bg-white/70 p-10 text-center">
            <UserCog className="mx-auto h-10 w-10 text-[#B9C6D0]" />
            <p className="mt-3 text-sm font-bold text-[#1B355E]">No officials yet</p>
            <p className="mt-1 text-xs text-[#5D7086]">
              Provision the first official above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((official) => (
              <OfficialRow
                key={official.id}
                official={official}
                open={openRow === official.id}
                onToggle={() => setOpenRow(openRow === official.id ? null : official.id)}
                onUpdate={(fields) => updateOfficial.mutate({ userId: official.id, ...fields })}
                onToggleActive={() => updateOfficial.mutate({ userId: official.id, active: !official.active })}
                onSetModules={(mods) =>
                  saveModuleGrants.mutate({ userId: official.id, modules: mods as any })
                }
                onResetPassword={() => resetPassword.mutate({ userId: official.id })}
                resetLink={resetLinkFor[official.id] ?? null}
                busy={updateOfficial.isPending || saveModuleGrants.isPending || resetPassword.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OfficialRow({
  official,
  open,
  onToggle,
  onUpdate,
  onToggleActive,
  onSetModules,
  onResetPassword,
  resetLink,
  busy,
}: {
  official: Official;
  open: boolean;
  onToggle: () => void;
  onUpdate: (fields: Record<string, unknown>) => void;
  onToggleActive: () => void;
  onSetModules: (modules: string[]) => void;
  onResetPassword: () => void;
  resetLink: string | null;
  busy: boolean;
}) {
  const [nameDraft, setNameDraft] = useState(official.name ?? "");
  const [positionDraft, setPositionDraft] = useState(official.officialPosition ?? OFFICIAL_POSITIONS[0]);
  const [domainDraft, setDomainDraft] = useState(official.domain ?? "");
  const [councilDraft, setCouncilDraft] = useState(official.localCouncil ?? "");
  const [moduleDraft, setModuleDraft] = useState<string[]>(
    (official.moduleAccess ?? []) as string[]
  );
  const positionBadge = official.officialPosition
    ? POSITION_META[official.officialPosition] ?? "bg-[#5D7086] text-white"
    : "bg-[#5D7086] text-white";

  return (
    <div className="overflow-hidden rounded-2xl border border-[#D9E4E1] bg-white shadow-[0_10px_28px_-22px_rgba(27,53,94,.4)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0 border border-[#D9E4E1] bg-[linear-gradient(135deg,#1B355E,#138A73)]">
            <AvatarFallback className="bg-transparent text-xs font-bold text-white">
              {initialsOf(official.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-bold text-[#1B355E]">
                {official.name || "Unnamed official"}
              </p>
              <Badge className={`${positionBadge} border-0 text-[10px]`}>
                {official.officialPosition
                  ? OFFICIAL_POSITION_LABELS[official.officialPosition]
                  : "Official"}
              </Badge>
              {official.role === "superadmin" && (
                <Badge className="border-0 bg-[#0E2547] text-[10px] text-white">Super Admin</Badge>
              )}
              {official.role === "admin" && (
                <Badge className="border-0 bg-[#7A5C1E] text-[10px] text-white">Admin</Badge>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  official.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                }`}
              >
                {official.active ? "Active" : "Disabled"}
              </span>
              {official.termExpired && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                  Term Expired (§9.2.1)
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-[#66788D]">
              {official.email}
              {official.domain ? ` · ${official.domain}` : ""}
              {official.localCouncil ? ` · ${official.localCouncil}` : ""}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {official.moduleAccess.length === 0 ? (
                <span className="text-[10px] font-semibold text-[#B9C6D0]">
                  No modules opened
                </span>
              ) : (
                official.moduleAccess.map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-[#E7F4F0] px-2 py-0.5 text-[10px] font-bold text-[#106E5B]"
                  >
                    {OFFICIAL_MODULE_LABELS[m] ?? m}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-[#D9E4E1] text-[#5D7086] hover:bg-[#F6F9F8]"
            onClick={onToggle}
          >
            <ChevronDown className={`mr-1 h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            {open ? "Close" : "Manage"}
          </Button>
        </div>
      </div>

      {open && (
        <div className="space-y-5 border-t border-[#E7EFEC] bg-[#FBFDFC] px-4 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#1B355E]">Name</Label>
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#1B355E]">Position</Label>
              <Select
                value={positionDraft}
                onValueChange={(v) => setPositionDraft(v)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OFFICIAL_POSITIONS.map((p) => (
                    <SelectItem key={p} value={p}>{OFFICIAL_POSITION_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#1B355E]">Domain</Label>
              <Input
                value={domainDraft}
                onChange={(e) => setDomainDraft(e.target.value)}
                placeholder="Optional"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#1B355E]">Local Council</Label>
              <Input
                value={councilDraft}
                onChange={(e) => setCouncilDraft(e.target.value)}
                placeholder="Optional"
                className="h-10"
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#5D7086]">
              Opened modules (super-admin delegation)
            </p>
            <div className="flex flex-wrap gap-2">
              {OFFICIAL_MODULES.map((m) => {
                const checked = moduleDraft.includes(m);
                return (
                  <label
                    key={m}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                      checked
                        ? "border-[#106E5B] bg-[#E7F4F0] text-[#106E5B]"
                        : "border-[#D9E4E1] bg-white text-[#5D7086] hover:border-[#B9CBC6]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-[#106E5B]"
                      checked={checked}
                      onChange={() =>
                        setModuleDraft((cur) =>
                          cur.includes(m)
                            ? cur.filter((x) => x !== m)
                            : [...cur, m]
                        )
                      }
                    />
                    {OFFICIAL_MODULE_LABELS[m]}
                  </label>
                );
              })}
            </div>
          </div>

          {resetLink && (
            <div className="rounded-xl border border-[#BBD8CF] bg-[#E7F4F0] p-3">
              <p className="text-xs font-bold text-[#0B4E40]">
                Fresh password setup link (shown once):
              </p>
              <div className="mt-2 flex gap-2">
                <a
                  href={resetLink}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#106E5B] text-xs font-bold text-white transition-colors hover:bg-[#0B4E40]"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open setup link
                </a>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(resetLink);
                    toast.success("Setup link copied.");
                  }}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-[#106E5B] px-3 text-xs font-bold text-[#106E5B] transition-colors hover:bg-white"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                onUpdate({
                  name: nameDraft.trim() || undefined,
                  position: positionDraft as (typeof OFFICIAL_POSITIONS)[number],
                  domain: domainDraft.trim() || null,
                  localCouncil: councilDraft.trim() || null,
                })
              }
              className="bg-[#1B355E] text-white hover:bg-[#294A78] disabled:opacity-60"
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Save profile
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onSetModules(moduleDraft)}
              className="border-[#106E5B] text-[#106E5B] hover:bg-[#E7F4F0] disabled:opacity-60"
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Save modules
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={onResetPassword}
              className="border-[#3B5B8C] text-[#3B5B8C] hover:bg-[#EAF1F6] disabled:opacity-60"
            >
              <KeyRound className="mr-1.5 h-4 w-4" /> Reset password
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={onToggleActive}
              className={`${
                official.active
                  ? "border-red-200 text-red-600 hover:bg-red-50"
                  : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              } disabled:opacity-60`}
            >
              {official.active ? "Disable account" : "Re-enable account"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

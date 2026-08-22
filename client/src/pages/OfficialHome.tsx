import { useAuth } from "@/_core/hooks/useAuth";
import {
  canAccessModule,
  isOfficialRole,
  positionLabelOf,
  OFFICIAL_MODULE_DESCRIPTIONS,
  type OfficialModule,
} from "@/_core/access";
import {
  BarChart3,
  Calendar,
  Coins,
  DollarSign,
  FileText,
  Flag,
  Gavel,
  IdCard,
  LayoutDashboard,
  Megaphone,
  Scale,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  Vote,
} from "lucide-react";
import { useLocation } from "wouter";

const MODULE_CARDS: {
  module: OfficialModule;
  title: string;
  path: string;
  icon: typeof LayoutDashboard;
  accent: string;
  bylawRef?: string;
}[] = [
  {
    module: "dashboard",
    title: "Dashboard",
    path: "/admin/dashboard",
    icon: BarChart3,
    accent: "from-[#1B355E] to-[#294A78]",
  },
  {
    module: "activities",
    title: "Activities",
    path: "/admin/activities",
    icon: Calendar,
    accent: "from-emerald-500 to-emerald-600",
    bylawRef: "§61-70",
  },
  {
    module: "events",
    title: "Events",
    path: "/admin/events",
    icon: Calendar,
    accent: "from-blue-500 to-blue-600",
    bylawRef: "§78-82",
  },
  {
    module: "elections",
    title: "Elections",
    path: "/admin/elections",
    icon: Vote,
    accent: "from-indigo-500 to-indigo-600",
    bylawRef: "§13",
  },
  {
    module: "finance",
    title: "Finance",
    path: "/admin/finance",
    icon: DollarSign,
    accent: "from-amber-500 to-amber-600",
    bylawRef: "§15",
  },
  {
    module: "documents",
    title: "Documents",
    path: "/admin/documents",
    icon: FileText,
    accent: "from-orange-500 to-orange-600",
    bylawRef: "§14, §17",
  },
  {
    module: "communications",
    title: "Communications",
    path: "/admin/communications",
    icon: Megaphone,
    accent: "from-cyan-500 to-cyan-600",
    bylawRef: "§14",
  },
  {
    module: "plenary",
    title: "Plenary",
    path: "/admin/plenary",
    icon: Gavel,
    accent: "from-pink-500 to-pink-600",
    bylawRef: "§6, §8",
  },
  {
    module: "nef-nrf",
    title: "NEF/NRF",
    path: "/admin/nef-nrf",
    icon: Coins,
    accent: "from-violet-500 to-violet-600",
    bylawRef: "§16",
  },
  {
    module: "cards",
    title: "Card Issuance Queue",
    path: "/admin/cards",
    icon: IdCard,
    accent: "from-[#106E5B] to-[#138A73]",
  },
  {
    module: "lifecycle",
    title: "Membership Lifecycle",
    path: "/admin/lifecycle",
    icon: Scale,
    accent: "from-[#8C3A2E] to-[#A9523F]",
  },
  {
    module: "config",
    title: "System Configuration",
    path: "/admin/config",
    icon: Settings,
    accent: "from-[#7A5C1E] to-[#A67C2E]",
  },
  {
    module: "config",
    title: "Governance",
    path: "/admin/governance",
    icon: Gavel,
    accent: "from-teal-500 to-teal-600",
  },
  {
    module: "config",
    title: "Feature Flags",
    path: "/admin/feature-flags",
    icon: Flag,
    accent: "from-rose-500 to-rose-600",
  },
];

/** Official Portal home. The module grid shows ONLY what this account can open. */
export default function OfficialHome() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="msap-page min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#138A73]" />
      </div>
    );
  }

  if (!user || !isOfficialRole(user.role)) {
    navigate("/official/login");
    return null;
  }

  const accessibleModules = MODULE_CARDS.filter((card) =>
    canAccessModule(user, card.module)
  );
  const isSuper = user.role === "superadmin";
  const position = positionLabelOf(user?.officialPosition);

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0E2547_0%,#1B355E_52%,#106E5B_100%)] px-6 py-8 text-white shadow-[0_24px_60px_-32px_rgba(27,53,94,.65)] sm:px-10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border-[28px] border-white/10" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-[#138A73]/30 blur-3xl" />
        <div className="relative z-10 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            Official Portal
            <span className="text-white/40">·</span>
            {isSuper ? "Super Admin" : position}
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Assalam-o-Alaikum, {user?.name?.split(" ")[0] || "Official"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/80">
            {isSuper
              ? "You can provision officials and open any module for any of them. Access is always revocable and never self-served."
              : "You have access to the modules below. Need more? Ask the Super Admin to open them for you."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {user?.officialPosition === "lc-president" && user?.localCouncil && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
                <Users className="h-3.5 w-3.5" /> {user.localCouncil}
              </span>
            )}
            {user?.domain && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
                Domain: {user.domain}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Module grid */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-tight text-[#1B355E]">
            Your modules
          </h2>
          <span className="rounded-full bg-[#E7F4F0] px-3 py-1 text-xs font-bold text-[#106E5B]">
            {accessibleModules.length} available
          </span>
        </div>

        {accessibleModules.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {accessibleModules.map((card) => (
              <button
                key={card.title}
                onClick={() => navigate(card.path)}
                className="group relative overflow-hidden rounded-xl border border-[#D9E4E1] bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#A8D8CD] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#138A73]"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${card.accent} text-white shadow-sm transition-transform group-hover:scale-105`}
                  >
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-[#1B355E] truncate">{card.title}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-[#5D7086] line-clamp-2">
                      {OFFICIAL_MODULE_DESCRIPTIONS[card.module]}
                    </p>
                    {card.bylawRef && (
                      <span className="mt-1 inline-block rounded bg-[#E7F4F0] px-1.5 py-0.5 text-[9px] font-bold text-[#106E5B]">{card.bylawRef}</span>
                    )}
                  </div>
                </div>
                <span className="mt-3 inline-flex items-center text-[11px] font-bold text-[#106E5B] opacity-0 transition-opacity group-hover:opacity-100">
                  Open module →
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#B9CBC6] bg-white/70 p-10 text-center">
            <UserCog className="mx-auto h-10 w-10 text-[#B9C6D0]" />
            <p className="mt-3 text-sm font-bold text-[#1B355E]">
              No modules opened for you yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[#5D7086]">
              The Super Admin grants official modules per role. If you expected
              access, ask the Super Admin to open it from the Officials
              Management page.
            </p>
          </div>
        )}
      </div>

      {/* Super Admin quick action */}
      {isSuper && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#1B355E]/20 bg-[#EAF1F6] p-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1B355E]">
              <UserCog className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-[#1B355E]">Super Admin actions</p>
              <p className="mt-0.5 text-xs leading-5 text-[#5D7086]">
                Provision officials, assign positions and open/close modules for
                any of them.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/admin/officials")}
            className="rounded-xl bg-[#1B355E] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#294A78]"
          >
            Manage officials
          </button>
        </div>
      )}
    </div>
  );
}

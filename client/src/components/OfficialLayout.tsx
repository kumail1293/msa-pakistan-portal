import { useAuth } from "@/_core/hooks/useAuth";
import {
  canAccessModule,
  isOfficialRole,
  positionLabelOf,
} from "@/_core/access";
import { MSAPLogo } from "@/components/MSAPLogo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  Calendar,
  Flag,
  IdCard,
  LayoutDashboard,
  LogOut,
  Scale,
  ScrollText,
  ShieldCheck,
  Settings,
  UserCog,
} from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

const NAV_ITEMS = [
  { module: null, label: "Home", path: "/official", icon: LayoutDashboard },
  {
    module: "recruitment",
    label: "Recruitment",
    path: "/admin/dashboard",
    icon: BarChart3,
  },
  {
    module: "card-queue",
    label: "Card Queue",
    path: "/admin/cards",
    icon: IdCard,
  },
  { module: "config", label: "Config", path: "/admin/config", icon: Settings },
  {
    module: "config",
    label: "Governance",
    path: "/admin/governance",
    icon: Scale,
  },
  {
    module: "config",
    label: "Config Studio",
    path: "/admin/governance-config",
    icon: Settings,
  },
  {
    module: "config",
    label: "Feature Flags",
    path: "/admin/feature-flags",
    icon: Flag,
  },
  {
    module: "config",
    label: "Audit Log",
    path: "/admin/audit",
    icon: ScrollText,
  },
  {
    module: "interviews",
    label: "Interviews",
    path: "/admin/interviews/schedule",
    icon: Calendar,
  },
  {
    module: "lifecycle",
    label: "Lifecycle",
    path: "/admin/lifecycle",
    icon: Scale,
  },
  {
    module: "officials",
    label: "Officials",
    path: "/admin/officials",
    icon: UserCog,
  },
];

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
 * Official Portal shell. Members never see it: an unauthenticated visitor is
 * sent to the official login page, and a member-role session is pushed back to
 * the member dashboard. Navigation shows exactly the modules this account can
 * open (super admin everything, admins all modules, officials only grants).
 */
export default function OfficialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();

  // Official shell guard: unauthenticated visitors are sent to the official
  // login page (returned to the page they tried to open), and member sessions
  // are pushed back to the member dashboard. Side effects live in an effect,
  // never during render.
  useEffect(() => {
    if (loading) return;
    if (typeof window === "undefined") return;
    if (!user) {
      const next = window.location.pathname + window.location.search;
      window.location.href = `/official/login?next=${encodeURIComponent(next)}`;
      return;
    }
    if (!isOfficialRole(user.role)) {
      window.location.href = "/dashboard";
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div className="msap-page min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#138A73]" />
      </div>
    );
  }

  if (!user || !isOfficialRole(user.role)) {
    return null; // the effect above handles navigation
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.module || canAccessModule(user, item.module)
  );
  const activePath = location.split("?")[0];

  const handleLogout = async () => {
    await logout();
    setLocation("/official/login");
  };

  const NavLinks = ({ compact = false }: { compact?: boolean }) => (
    <>
      {visibleItems.map((item) => {
        const isActive = activePath === item.path;
        return (
          <button
            key={item.path}
            onClick={() => setLocation(item.path)}
            className={
              compact
                ? `inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-[#1B355E] text-white"
                      : "text-[#5D7086] hover:bg-[#E7F4F0] hover:text-[#1B355E]"
                  }`
                : `inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-[#E7F4F0] text-[#106E5B]"
                      : "text-[#5D7086] hover:bg-[#F0F5F3] hover:text-[#1B355E]"
                  }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        );
      })}
    </>
  );

  return (
    <div className="msap-page min-h-screen bg-[#F4F8F7]">
      {/* Official portal header */}
      <header className="sticky top-0 z-40 border-b border-[#D9E4E1] bg-white/90 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <button
            onClick={() => setLocation("/official")}
            className="flex min-w-0 items-center gap-3 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#138A73]"
            aria-label="Back to official home"
          >
            <MSAPLogo variant="horizontal-compact" tone="brand" className="w-32 sm:w-36" />
            <span className="hidden items-center gap-1 rounded-full bg-[#1B355E] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white sm:inline-flex">
              <ShieldCheck className="h-3 w-3" /> Official Portal
            </span>
          </button>

          {!isMobile && (
            <nav className="hidden items-center gap-1 lg:flex">
              <NavLinks />
            </nav>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-[#F0F5F3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#138A73]">
                <Avatar className="h-9 w-9 border border-[#D9E4E1] bg-[linear-gradient(135deg,#1B355E,#138A73)]">
                  <AvatarFallback className="bg-transparent text-xs font-bold text-white">
                    {initialsOf(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-left sm:block">
                  <span className="block max-w-[180px] truncate text-sm font-semibold leading-tight text-[#1B355E]">
                    {user?.name || "Official"}
                  </span>
                  <span className="block text-[11px] font-medium text-[#106E5B]">
                    {positionLabelOf(user?.officialPosition)}
                    {user?.role === "superadmin" ? " · Super Admin" : ""}
                  </span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() => setLocation("/official")}
                className="cursor-pointer"
              >
                <LayoutDashboard className="mr-2 h-4 w-4" /> Official Home
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile nav row */}
        {isMobile && (
          <div className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <NavLinks compact />
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6">{children}</main>
    </div>
  );
}

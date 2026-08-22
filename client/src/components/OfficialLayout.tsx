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
  ChevronDown,
  ChevronRight,
  Coins,
  DollarSign,
  FileText,
  Flag,
  Gavel,
  IdCard,
  LayoutDashboard,
  LogOut,
  Megaphone,
  ScrollText,
  Scale,
  Settings,
  ShieldCheck,
  UserCog,
  Vote,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

type NavItem = {
  module: string | null;
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { module: null, label: "Home", path: "/official", icon: LayoutDashboard },
      { module: "recruitment", label: "Recruitment", path: "/admin/dashboard", icon: BarChart3 },
      { module: "card-queue", label: "Card Queue", path: "/admin/cards", icon: IdCard },
    ],
  },
  {
    label: "Modules",
    items: [
      { module: "config", label: "Activities", path: "/admin/activities", icon: Calendar },
      { module: "config", label: "Events", path: "/admin/events", icon: Calendar },
      { module: "config", label: "Elections", path: "/admin/elections", icon: Vote },
      { module: "config", label: "Finance", path: "/admin/finance", icon: DollarSign },
      { module: "config", label: "Documents", path: "/admin/documents", icon: FileText },
      { module: "config", label: "Communications", path: "/admin/communications", icon: Megaphone },
      { module: "config", label: "Plenary", path: "/admin/plenary", icon: Gavel },
      { module: "config", label: "NEF/NRF", path: "/admin/nef-nrf", icon: Coins },
    ],
  },
  {
    label: "Administration",
    items: [
      { module: "interviews", label: "Interviews", path: "/admin/interviews/schedule", icon: Calendar },
      { module: "lifecycle", label: "Lifecycle", path: "/admin/lifecycle", icon: Scale },
      { module: "officials", label: "Officials", path: "/admin/officials", icon: UserCog },
      { module: "config", label: "Config", path: "/admin/config", icon: Settings },
      { module: "config", label: "Governance", path: "/admin/governance", icon: Scale },
      { module: "config", label: "Modules", path: "/admin/modules", icon: Settings },
      { module: "config", label: "Feature Flags", path: "/admin/feature-flags", icon: Flag },
      { module: "config", label: "Audit Log", path: "/admin/audit", icon: ScrollText },
    ],
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

export default function OfficialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [expandedGroup, setExpandedGroup] = useState<string | null>("Overview");

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
    return null;
  }

  const activePath = location.split("?")[0];

  const handleLogout = async () => {
    await logout();
    setLocation("/official/login");
  };

  // Filter groups to only show accessible items
  const visibleGroups = NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.module || canAccessModule(user, item.module)
      ),
    }))
    .filter((group) => group.items.length > 0);

  // Find which group the current page belongs to
  const findGroupForPath = (path: string): string | null => {
    for (const group of visibleGroups) {
      if (group.items.some((item) => item.path === path)) {
        return group.label;
      }
    }
    return null;
  };

  // Auto-expand the group containing the active page
  const activeGroup = findGroupForPath(activePath);
  if (activeGroup && expandedGroup !== activeGroup) {
    // Use setTimeout to avoid state update during render
    setTimeout(() => setExpandedGroup(activeGroup), 0);
  }

  const SidebarNav = () => (
    <nav className="space-y-1">
      {visibleGroups.map((group) => {
        const isExpanded = expandedGroup === group.label;
        const hasActive = group.items.some((item) => item.path === activePath);

        return (
          <div key={group.label}>
            <button
              onClick={() => setExpandedGroup(isExpanded ? null : group.label)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                hasActive
                  ? "text-[#106E5B]"
                  : "text-[#8A9BAE] hover:text-[#1B355E]"
              }`}
            >
              {group.label}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>
            {isExpanded && (
              <div className="ml-1 space-y-0.5 border-l-2 border-[#E7F4F0] pl-3">
                {group.items.map((item) => {
                  const isActive = activePath === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => setLocation(item.path)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-[#E7F4F0] text-[#106E5B] font-semibold"
                          : "text-[#5D7086] hover:bg-[#F0F5F3] hover:text-[#1B355E]"
                      }`}
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-[#106E5B]" : ""}`} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  // Flat list for mobile horizontal scroll
  const MobileNav = () => (
    <div className="flex gap-1 overflow-x-auto px-4 pb-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {visibleGroups.flatMap((group) =>
        group.items.map((item) => {
          const isActive = activePath === item.path;
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? "bg-[#1B355E] text-white"
                  : "text-[#5D7086] hover:bg-[#E7F4F0] hover:text-[#1B355E]"
              }`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <div className="msap-page min-h-screen bg-[#F4F8F7]">
      {/* Header */}
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
                <ChevronDown className="hidden h-4 w-4 text-[#5D7086] sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setLocation("/official")} className="cursor-pointer">
                <LayoutDashboard className="mr-2 h-4 w-4" /> Official Home
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile nav */}
        {isMobile && <MobileNav />}
      </header>

      <div className="mx-auto max-w-7xl flex">
        {/* Desktop sidebar */}
        {!isMobile && (
          <aside className="sticky top-16 h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-[#E7F4F0] bg-white p-4">
            <SidebarNav />
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}

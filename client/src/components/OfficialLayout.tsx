import { useAuth } from "@/_core/hooks/useAuth";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { ModuleAccessBadge } from "@/components/ModuleAccessBadge";
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
  Bell,
  Building,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Coins,
  DollarSign,
  FileText,
  FileTextIcon,
  Flag,
  Gavel,
  GitBranch,
  GraduationCap,
  Headphones,
  HelpCircle,
  IdCard,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  MessageSquare,
  Package,
  Plane,
  ScrollText,
  Scale,
  Settings,
  Shield,
  ShieldCheck,
  ToggleRight,
  UserCog,
  Users,
  Vote,
  Menu,
  Globe,
  Lock,
  Handshake,
  Smartphone,
  Languages,
  Server,
  Accessibility,
  Rocket,
  Building2,
  Layout,
  Cloud,
  Table2,
  FileSpreadsheet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
      { module: "dashboard", label: "Dashboard", path: "/admin/dashboard", icon: BarChart3 },
      { module: "cards", label: "Card Queue", path: "/admin/cards", icon: IdCard },
    ],
  },
  {
    label: "Modules",
    items: [
      { module: "activities", label: "Activities", path: "/admin/activities", icon: Calendar },
      { module: "events", label: "Events", path: "/admin/events", icon: Calendar },
      { module: "elections", label: "Elections", path: "/admin/elections", icon: Vote },
      { module: "finance", label: "Finance", path: "/admin/finance", icon: DollarSign },
      { module: "documents", label: "Documents", path: "/admin/documents", icon: FileText },
      { module: "communications", label: "Communications", path: "/admin/communications", icon: Megaphone },
      { module: "plenary", label: "Plenary", path: "/admin/plenary", icon: Gavel },
      { module: "nef-nrf", label: "NEF/NRF", path: "/admin/nef-nrf", icon: Coins },
      { module: "chapters", label: "Chapters", path: "/admin/chapters", icon: Building },
      { module: "projects", label: "Projects", path: "/admin/projects", icon: ClipboardList },
      { module: "training", label: "Training", path: "/admin/training", icon: GraduationCap },
    ],
  },
  {
    label: "NGA",
    items: [
      { module: "nga", label: "NGA Dashboard", path: "/admin/nga", icon: Flag },
      { module: "nga", label: "Delegations", path: "/admin/nga/delegations", icon: Users },
      { module: "nga", label: "Agenda", path: "/admin/nga/agenda", icon: ScrollText },
      { module: "nga", label: "Roll Call", path: "/admin/nga/roll-call", icon: ClipboardList },
      { module: "nga", label: "CCC Review", path: "/admin/nga/ccc", icon: ShieldCheck },
      { module: "nga", label: "Decisions", path: "/admin/nga/decisions", icon: Gavel },
      { module: "nga", label: "Minutes", path: "/admin/nga/minutes", icon: FileText },
    ],
  },
  {
    label: "Automation",
    items: [
      { module: "config", label: "Workflows", path: "/admin/workflows", icon: GitBranch },
      { module: "config", label: "Forms Builder", path: "/admin/forms", icon: FileTextIcon },
      { module: "config", label: "Notifications", path: "/admin/notifications", icon: Bell },
      { module: "config", label: "Import / Export", path: "/admin/import-export", icon: ClipboardList },
      { module: "config", label: "Analytics", path: "/admin/analytics", icon: BarChart3 },
      { module: "config", label: "Feature Flags", path: "/admin/feature-flags", icon: ToggleRight },
      { module: "config", label: "I18n / Localization", path: "/admin/i18n", icon: Languages },
      { module: null, label: "Page Builder", path: "/admin/page-builder", icon: Layout },
      { module: null, label: "Google Drive", path: "/admin/google-drive", icon: Cloud },
      { module: null, label: "Bulk Data Manager", path: "/admin/bulk-data", icon: Table2 },
    ],
  },
  {
    label: "Operations",
    items: [
      { module: "config", label: "Disciplinary", path: "/admin/disciplinary", icon: Gavel },
      { module: "config", label: "Safeguarding", path: "/admin/safeguarding", icon: ShieldCheck },
      { module: "config", label: "Feedback", path: "/admin/feedback", icon: MessageSquare },
      { module: "config", label: "Helpdesk", path: "/admin/helpdesk", icon: LifeBuoy },
      { module: "config", label: "Inventory", path: "/admin/inventory", icon: Package },
      { module: "config", label: "Travel", path: "/admin/travel", icon: Plane },
      { module: "config", label: "Ops & DevOps", path: "/admin/ops", icon: Server },
    ],
  },
  {
    label: "Administration",
    items: [
      { module: "lifecycle", label: "Lifecycle", path: "/admin/lifecycle", icon: Scale },
      { module: "officials", label: "Officials", path: "/admin/officials", icon: UserCog },
      { module: "config", label: "Institutions", path: "/admin/institutions", icon: Building2 },
      { module: "config", label: "Privacy", path: "/admin/privacy", icon: Lock },
      { module: "config", label: "Consent", path: "/admin/consent", icon: Handshake },
      { module: "config", label: "MFA", path: "/admin/mfa", icon: Smartphone },
      { module: "config", label: "Impersonation", path: "/admin/impersonation", icon: UserCog },
      { module: "config", label: "Accessibility", path: "/admin/accessibility", icon: Accessibility },
      { module: "config", label: "Module Permissions", path: "/admin/module-permissions", icon: Shield },
      { module: "config", label: "Config", path: "/admin/config", icon: Settings },
      { module: "governance", label: "Governance", path: "/admin/governance", icon: Scale },
      { module: "modules", label: "Modules", path: "/admin/modules", icon: Settings },
      { module: "governance-config", label: "Governance Config", path: "/admin/governance-config", icon: Settings },
      { module: "config", label: "SaaS & Federation", path: "/admin/saas", icon: Rocket },
      { module: "audit", label: "Audit Log", path: "/admin/audit", icon: ScrollText },
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
  const moduleAccess = useModuleAccess();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["Overview"])
  );

  // Filter groups to only show accessible items — must be before the useEffect
  // that references it, so it cannot live after the early returns.
  const visibleGroups = user
    ? NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => !item.module || canAccessModule(user, item.module)
        ),
      })).filter((group) => group.items.length > 0)
    : [];

  // Redirect if not authenticated or wrong role
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

  // Auto-expand the group containing the active page
  const activePath = location.split("?")[0];
  useEffect(() => {
    for (const group of visibleGroups) {
      if (group.items.some((item) => item.path === activePath)) {
        setExpandedGroups((prev) => {
          if (prev.has(group.label)) return prev;
          const next = new Set(prev);
          next.add(group.label);
          return next;
        });
        break;
      }
    }
  }, [activePath]);

  const toggleGroup = useCallback((label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }, []);

  const handleNavigate = useCallback(
    (path: string) => {
      setLocation(path);
      setMobileOpen(false);
    },
    [setLocation]
  );

  const handleLogout = async () => {
    await logout();
    setLocation("/official/login");
  };

  if (loading) {
    return (
      <div className="msap-page min-h-screen flex items-center justify-center bg-[#F4F8F7]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-[#E7F4F0] border-t-[#138A73]" />
          <p className="text-sm text-[#5D7086] font-medium">Loading portal…</p>
        </div>
      </div>
    );
  }

  if (!user || !isOfficialRole(user.role)) {
    return null;
  }

  return (
    <div className="msap-page min-h-screen bg-[#F4F8F7]">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-[#D9E4E1] bg-white/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
        <div className="mx-auto flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
          {/* Left: Logo + mobile toggle */}
          <div className="flex items-center gap-2">
            {isMobile && (
              <button
                onClick={() => setMobileOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#1B355E] hover:bg-[#E7F4F0] transition-colors"
                aria-label="Toggle navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            {!isMobile && (
              <button
                onClick={() => setCollapsed((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5D7086] hover:bg-[#E7F4F0] hover:text-[#1B355E] transition-colors"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            )}
            <button
              onClick={() => handleNavigate("/official")}
              className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80"
            >
              <MSAPLogo
                variant="horizontal-compact"
                tone="brand"
                className={collapsed && !isMobile ? "w-8" : "w-32 sm:w-36"}
              />
              {(!collapsed || isMobile) && (
                <span className="hidden items-center gap-1 rounded-full bg-[#1B355E] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white sm:inline-flex">
                  <ShieldCheck className="h-3 w-3" /> Official
                </span>
              )}
            </button>
          </div>

          {/* Right: User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-[#F0F5F3] transition-colors">
                <Avatar className="h-8 w-8 border border-[#D9E4E1] bg-[linear-gradient(135deg,#1B355E,#138A73)]">
                  <AvatarFallback className="bg-transparent text-xs font-bold text-white">
                    {initialsOf(user?.name)}
                  </AvatarFallback>
                </Avatar>
                {(!collapsed || isMobile) && (
                  <span className="hidden text-left sm:block">
                    <span className="block max-w-[160px] truncate text-sm font-semibold text-[#1B355E]">
                      {user?.name || "Official"}
                    </span>
                    <span className="block text-[11px] text-[#106E5B]">
                      {positionLabelOf(user?.officialPosition)}
                      {user?.role === "superadmin" ? " · Super Admin" : ""}
                    </span>
                  </span>
                )}
                <ChevronDown className="hidden h-3.5 w-3.5 text-[#5D7086] sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() => handleNavigate("/official")}
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

        {/* Mobile horizontal nav */}
        {isMobile && mobileOpen && (
          <div className="border-t border-[#E7F4F0] bg-white px-3 py-2 max-h-[60vh] overflow-y-auto">
            <SidebarNav
              groups={visibleGroups}
              activePath={activePath}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
              onNavigate={handleNavigate}
              collapsed={false}
              moduleAccess={moduleAccess}
            />
          </div>
        )}
      </header>

      <div className="mx-auto max-w-[1600px] flex">
        {/* ─── Desktop Sidebar ────────────────────────────────────── */}
        {!isMobile && (
          <aside
            className={`sticky top-14 h-[calc(100vh-3.5rem)] shrink-0 overflow-y-auto border-r border-[#E7F4F0] bg-white transition-all duration-200 ${
              collapsed ? "w-16" : "w-64"
            }`}
          >
            <nav className="p-3 space-y-0.5">
              {visibleGroups.map((group) => {
                const isExpanded = expandedGroups.has(group.label);
                const hasActive = group.items.some(
                  (item) => item.path === activePath
                );

                // Collapsed mode: show only icons for active group items
                if (collapsed) {
                  if (hasActive || isExpanded) {
                    return group.items.map((item) => {
                      const isActive = activePath === item.path;
                      const badgeLevel = item.module ? moduleAccess.getAccess(item.module) : null;
                      return (
                        <button
                          key={item.path}
                          onClick={() => handleNavigate(item.path)}
                          title={`${item.label}${badgeLevel && user?.role !== "superadmin" ? ` (${badgeLevel})` : ""}`}
                          className={`relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                            isActive
                              ? "bg-[#E7F4F0] text-[#106E5B]"
                              : "text-[#5D7086] hover:bg-[#F0F5F3] hover:text-[#1B355E]"
                          }`}
                        >
                          <item.icon className="h-4.5 w-4.5" />
                          {badgeLevel && user?.role !== "superadmin" && (
                            <ModuleAccessBadge level={badgeLevel} compact className="absolute -bottom-0.5 -right-0.5" />
                          )}
                        </button>
                      );
                    });
                  }
                  return null;
                }

                return (
                  <div key={group.label}>
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                        hasActive
                          ? "text-[#106E5B]"
                          : "text-[#8A9BAE] hover:text-[#1B355E] hover:bg-[#F8FAF9]"
                      }`}
                    >
                      <span>{group.label}</span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-150 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-200 ${
                        isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="ml-1 space-y-0.5 border-l-2 border-[#E7F4F0] pl-3 py-1">
                        {group.items.map((item) => {
                          const isActive = activePath === item.path;
                          const badgeLevel = item.module ? moduleAccess.getAccess(item.module) : null;
                          return (
                            <button
                              key={item.path}
                              onClick={() => handleNavigate(item.path)}
                              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                                isActive
                                  ? "bg-[#E7F4F0] text-[#106E5B] font-semibold shadow-[inset_2px_0_0_#106E5B]"
                                  : "text-[#5D7086] hover:bg-[#F0F5F3] hover:text-[#1B355E]"
                              }`}
                            >
                              <item.icon
                                className={`h-4 w-4 shrink-0 ${
                                  isActive ? "text-[#106E5B]" : ""
                                }`}
                              />
                              <span className="truncate flex-1 text-left">{item.label}</span>
                              {badgeLevel && user?.role !== "superadmin" && (
                                <ModuleAccessBadge level={badgeLevel} compact className="ml-auto shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </nav>
          </aside>
        )}

        {/* ─── Main Content ───────────────────────────────────────── */}
        <main className="flex-1 min-w-0 px-4 py-6 sm:px-6">
          {user &&
            user.role === "official" &&
            user.termEnd &&
            new Date(user.termEnd).getTime() < Date.now() && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <strong>⚠ Term Expired (§9.2.1).</strong> Your official term has
                ended. Contact the Super Admin to renew.
              </div>
            )}
          {children}
        </main>
      </div>
    </div>
  );
}

// ─── Sidebar Nav (shared between mobile and collapsed desktop) ──────────
function SidebarNav({
  groups,
  activePath,
  expandedGroups,
  toggleGroup,
  onNavigate,
  collapsed,
  moduleAccess,
}: {
  groups: NavGroup[];
  activePath: string;
  expandedGroups: Set<string>;
  toggleGroup: (label: string) => void;
  onNavigate: (path: string) => void;
  collapsed: boolean;
  moduleAccess: ReturnType<typeof useModuleAccess>;
}) {
  const { user } = useAuth();
  return (
    <nav className="space-y-0.5">
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.label);
        const hasActive = group.items.some((item) => item.path === activePath);

        return (
          <div key={group.label}>
            <button
              onClick={() => toggleGroup(group.label)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                hasActive
                  ? "text-[#106E5B]"
                  : "text-[#8A9BAE] hover:text-[#1B355E] hover:bg-[#F8FAF9]"
              }`}
            >
              <span>{group.label}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-150 ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              className={`overflow-hidden transition-all duration-200 ${
                isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="ml-1 space-y-0.5 border-l-2 border-[#E7F4F0] pl-3 py-1">
                {group.items.map((item) => {
                  const isActive = activePath === item.path;
                  const badgeLevel = item.module ? moduleAccess.getAccess(item.module) : null;
                  return (
                    <button
                      key={item.path}
                      onClick={() => onNavigate(item.path)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-[#E7F4F0] text-[#106E5B] font-semibold shadow-[inset_2px_0_0_#106E5B]"
                          : "text-[#5D7086] hover:bg-[#F0F5F3] hover:text-[#1B355E]"
                      }`}
                    >
                      <item.icon
                        className={`h-4 w-4 shrink-0 ${
                          isActive ? "text-[#106E5B]" : ""
                        }`}
                      />
                      <span className="truncate flex-1 text-left">{item.label}</span>
                      {badgeLevel && user?.role !== "superadmin" && (
                        <ModuleAccessBadge level={badgeLevel} compact className="ml-auto shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

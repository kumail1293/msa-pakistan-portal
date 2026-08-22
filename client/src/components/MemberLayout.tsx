import { useAuth } from "@/_core/hooks/useAuth";
import { isOfficialRole } from "@/_core/access";
import { MSAPLogo } from "@/components/MSAPLogo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BookOpen,
  Briefcase,
  Calendar,
  Coins,
  DollarSign,
  FileText,
  FolderOpen,
  IdCard,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PanelLeft,
  Scale,
  Settings,
  Users,
  Vote,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: FolderOpen, label: "Activities", path: "/activities" },
  { icon: Calendar, label: "Events", path: "/events" },
  { icon: Vote, label: "Elections", path: "/elections" },
  { icon: Scale, label: "Plenary", path: "/plenary" },
  { icon: Coins, label: "NEF/NRF", path: "/nef-nrf" },
  { icon: DollarSign, label: "Finance", path: "/finance" },
  { icon: FileText, label: "Documents", path: "/documents" },
  { icon: Megaphone, label: "Updates", path: "/communications" },
  { icon: Briefcase, label: "Opportunities", path: "/opportunities" },
  { icon: BookOpen, label: "CV Maker", path: "/cv-maker" },
  { icon: Users, label: "Directory", path: "/directory" },
  { icon: IdCard, label: "Membership Card", path: "/membership-card" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const SIDEBAR_WIDTH_KEY = "msap-sidebar-width";
const DEFAULT_WIDTH = 272;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

function initialsOf(name: string | null | undefined): string {
  if (!name) return "M";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  // Authenticated shell: unauthenticated visitors are sent to /login and
  // returned to the page they tried to open after signing in. Officials never
  // see the member portal - their session is pushed to the Official Portal.
  useEffect(() => {
    if (loading) return;
    if (typeof window === "undefined") return;
    if (!user) {
      const next = window.location.pathname + window.location.search;
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
      return;
    }
    if (isOfficialRole(user.role)) {
      window.location.href = "/official";
    }
  }, [loading, user]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    // The redirect effect above handles navigation; render nothing meanwhile.
    return null;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <MemberLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </MemberLayoutContent>
    </SidebarProvider>
  );
}

type MemberLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function MemberLayoutContent({ children, setSidebarWidth }: MemberLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const isMobile = useIsMobile();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const activeItem = navItems.find((item) => location.split("?")[0] === item.path);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const handleNavigate = (path: string) => {
    setOpenMobile(false);
    setLocation(path);
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          {/* Brand header */}
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-2 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[#E7F4F0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#138A73]"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-[#5D7086]" />
              </button>
              {!isCollapsed && (
                <MSAPLogo variant="horizontal-compact" tone="brand" className="w-36" />
              )}
            </div>
          </SidebarHeader>

          {/* Navigation */}
          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {navItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => handleNavigate(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all ${
                        isActive ? "font-semibold shadow-[inset_2.5px_0_0_#106E5B]" : "font-normal"
                      }`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-[#106E5B]" : "text-[#5D7086]"}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          {/* User footer */}
          <SidebarFooter className="border-t border-[#E7EFEC] p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-xl px-1.5 py-1.5 text-left transition-colors hover:bg-[#E7F4F0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#138A73] group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-9 w-9 shrink-0 border border-[#D9E4E1] bg-[linear-gradient(135deg,#1B355E,#138A73)]">
                    <AvatarFallback className="bg-transparent text-xs font-bold text-white">
                      {initialsOf(user?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <p className="truncate text-sm font-semibold leading-none text-[#1B355E]">
                      {user?.name || "MSAP Member"}
                    </p>
                    <p className="mt-1.5 truncate text-xs text-[#66788D]">
                      {user?.email || ""}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => handleNavigate("/settings")}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Drag-to-resize handle */}
        <div
          className={`absolute top-0 right-0 h-full w-1 cursor-col-resize transition-colors hover:bg-[#138A73]/30 ${
            isCollapsed ? "hidden" : ""
          }`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {/* Mobile top bar */}
        {isMobile && (
          <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#D9E4E1] bg-white/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg text-[#1B355E]" />
              <span className="text-sm font-semibold tracking-tight text-[#1B355E]">
                {activeItem?.label ?? "Menu"}
              </span>
            </div>
            <MSAPLogo variant="horizontal-compact" tone="brand" className="w-28" />
          </div>
        )}
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </>
  );
}

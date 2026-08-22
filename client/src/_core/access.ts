/**
 * Client-side mirror of the server's official-role & module-access rules.
 *
 * These helpers only drive navigation and what the UI offers. The server
 * re-validates every gate (officialModuleProcedure / superAdminProcedure), so
 * a member can never open an official module even by forging a URL.
 *
 * Role model (minimal, extensible):
 *   user       - member portal only (/login, member dashboard)
 *   official   - official portal (/official/login); sees ONLY the modules the
 *                super admin granted via moduleAccess
 *   admin      - official portal; inherits every official module
 *   superadmin - official portal; everything, plus officials management and
 *                the power to provision/delegate any official
 */

/** Positions — per bylaws §9.1 */
export const OFFICIAL_POSITIONS = [
  // Executive Board (§9.1.1)
  "president",
  "vpi",
  "vpe",
  "vpa",
  "vpcb",
  "vpm",
  "vpf",
  "vpprc",
  // Supervising Council (§9.3)
  "supco",
  // Team of Officials (§9.1.4)
  "npo",
  "norp",
  "nora",
  "nome",
  "nore",
  "neo",
  // LC/CI positions
  "lc-president",
  "lc-vpa",
  "lc-vpf",
  "lc-secretary",
  "ci-coordinator",
] as const;
export type OfficialPosition = (typeof OFFICIAL_POSITIONS)[number];

/** Module keys grantable to officials. "officials" is super-admin reserved. */
export const OFFICIAL_MODULES = [
  "dashboard",
  "activities",
  "events",
  "elections",
  "finance",
  "documents",
  "communications",
  "plenary",
  "nef-nrf",
  "config",
  "modules",
  "governance",
  "governance-config",
  "lifecycle",
  "cards",
  "audit",
] as const;
export type OfficialModule = (typeof OFFICIAL_MODULES)[number];

/** Human-readable position labels — per bylaws §9.1, §11.5-11.9, §12.1 */
export const OFFICIAL_POSITION_LABELS: Record<string, string> = {
  president: "National President",
  vpi: "Vice-President for Internal Affairs",
  vpe: "Vice-President for External Affairs",
  vpa: "Vice-President for Activities",
  vpcb: "Vice-President for Capacity Building",
  vpm: "Vice-President for Members (Secretary General)",
  vpf: "Vice-President for Finances",
  vpprc: "Vice-President for Public Relations & Communication",
  supco: "Supervising Council Member",
  npo: "National Public Health Officer (SCOPH)",
  norp: "National Officer on Human Rights & Peace (SCORP)",
  nora: "National Officer on Sexual & Reproductive Health (SCORA)",
  nome: "National Officer on Medical Education (SCOME)",
  nore: "National Officer on Research Exchange (SCORE)",
  neo: "National Exchange Officer (SCOPE)",
  "lc-president": "Local Council President",
  "lc-vpa": "Local VPA",
  "lc-vpf": "Local VPF",
  "lc-secretary": "Local Secretary",
  "ci-coordinator": "Coordinator Institute Coordinator",
};

export const OFFICIAL_MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  activities: "Activities",
  events: "Events",
  elections: "Elections",
  finance: "Finance",
  documents: "Documents",
  communications: "Communications",
  plenary: "Plenary",
  "nef-nrf": "NEF/NRF",
  config: "System Configuration",
  modules: "Module Management",
  governance: "Governance",
  "governance-config": "Governance Config",
  lifecycle: "Membership Lifecycle",
  cards: "Card Queue",
  audit: "Audit Log",
  officials: "Officials Management",
};

export const OFFICIAL_MODULE_DESCRIPTIONS: Record<string, string> = {
  dashboard: "Overall statistics and quick actions",
  activities: "Activity planning, NEF/NRF lifecycle, certificates",
  events: "NGA, SGA, OGA and other events",
  elections: "EB, TO and SupCo election management",
  finance: "Budgets, transactions and financial reports",
  documents: "Document management and BCP workflow",
  communications: "Announcements, publications and VPPRC approvals",
  plenary: "Plenary sessions and quorum tracking",
  "nef-nrf": "National Enrollment & Report Forms",
  config: "Portal-wide system settings",
  modules: "Module statistics and management",
  governance: "Governance overview and config",
  "governance-config": "Governance system settings",
  lifecycle: "Audited suspend / terminate / reinstate cases",
  cards: "Approve holder signatures and card re-issues",
  audit: "Audit trail of all admin actions",
  officials: "Provision officials and open modules for them",
};

/** Minimal structural shape of the session user (from auth.me). */
export type PortalUserLike = {
  role?: string | null;
  moduleAccess?: string[] | null;
  officialPosition?: string | null;
  termEnd?: string | Date | null;
};

export function isOfficialRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "superadmin" || role === "official";
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === "superadmin";
}

/**
 * Whether the official's term has expired (per bylaws §9.2.1).
 * Returns true if termEnd is set and is in the past.
 */
function hasTermExpired(user: PortalUserLike): boolean {
  if (!user.termEnd) return false;
  const end = new Date(user.termEnd);
  return !isNaN(end.getTime()) && end.getTime() < Date.now();
}

/**
 * Position → module mapping per bylaws §11.5, §11.8, §11.9, §12.1.
 * Mirrors POSITION_MODULE_MAP in memberAccountService.ts.
 */
const POSITION_MODULE_MAP: Record<string, string[]> = {
  president: ["dashboard", "activities", "events", "elections", "finance", "documents", "communications", "plenary", "nef-nrf", "config", "modules", "governance", "governance-config", "lifecycle", "cards", "audit"],
  vpa: ["activities", "nef-nrf", "events"],
  vpf: ["finance"],
  vpprc: ["communications", "documents"],
  vpi: ["lifecycle", "officials", "governance"],
  vpe: ["communications"],
  vpcb: ["activities"],
  vpm: ["documents", "governance"],
  supco: ["dashboard", "activities", "events", "elections", "finance", "documents", "communications", "plenary", "nef-nrf", "config", "modules", "governance", "governance-config", "lifecycle", "cards", "audit"],
  npo: ["activities"], // SCOPH
  norp: ["activities"], // SCORP
  nora: ["activities"], // SCORA
  nome: ["activities"], // SCOME
  nore: ["activities"], // SCORE
  neo: ["activities"], // SCOPE
};

/**
 * Whether a user may open an official module. Mirrors the server rule:
 * super admin everything · admin inherits all official modules · official
 * only the granted ones (position-based first, then explicit grants) · member never.
 */
export function canAccessModule(
  user: PortalUserLike | null | undefined,
  module: string
): boolean {
  if (!user) return false;
  if (user.role === "superadmin") return true;
  if (module === "officials") return false;
  if (user.role === "admin") {
    return (OFFICIAL_MODULES as readonly string[]).includes(
      module as OfficialModule
    );
  }
  if (user.role === "official") {
    // Term-expired officials lose all module access (§9.2.1)
    if (hasTermExpired(user)) return false;
    // Check position-based access first (bylaws §11.5-11.9)
    const pos = user.officialPosition;
    if (pos && POSITION_MODULE_MAP[pos]) {
      if (POSITION_MODULE_MAP[pos].includes(module)) return true;
    }
    // Fall back to explicit moduleAccess grants
    return (user.moduleAccess ?? []).includes(module);
  }
  return false;
}

export function positionLabelOf(
  position: string | null | undefined
): string {
  if (!position) return "Official";
  return OFFICIAL_POSITION_LABELS[position] ?? position;
}

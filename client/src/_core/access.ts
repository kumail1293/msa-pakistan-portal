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
  recruitment: "Recruitment Dashboard",
  "card-queue": "Card Issuance Queue",
  config: "System Configuration",
  interviews: "Interview Scheduling",
  lifecycle: "Membership Lifecycle",
  officials: "Officials Management",
};

export const OFFICIAL_MODULE_DESCRIPTIONS: Record<string, string> = {
  recruitment: "Recruitment pipeline, applications and analytics",
  "card-queue": "Approve holder signatures and card re-issues",
  config: "Portal-wide system settings",
  interviews: "Schedule and manage candidate interviews",
  lifecycle: "Audited suspend / terminate / reinstate cases",
  officials: "Provision officials and open modules for them",
};

/** Minimal structural shape of the session user (from auth.me). */
export type PortalUserLike = {
  role?: string | null;
  moduleAccess?: string[] | null;
};

export function isOfficialRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "superadmin" || role === "official";
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === "superadmin";
}

/**
 * Whether a user may open an official module. Mirrors the server rule:
 * super admin everything · admin inherits all official modules · official
 * only the granted ones · member never.
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

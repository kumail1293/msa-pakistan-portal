/**
 * Member Account Service
 *
 * Owns the portal-side member account lifecycle:
 *   approved member (Google Apps Script) -> account -> setup token -> login.
 *
 * STORAGE
 * The live workspace has no DATABASE_URL configured, and the legacy drizzle
 * migrations do not match drizzle/schema.ts, so this service currently uses an
 * in-process memory store. The store is deliberately small and typed so a
 * Drizzle-backed implementation can replace the memory maps without touching
 * the routers. When a database is provisioned (see docs/PORTAL_BUILD.md),
 * swap the *_memory helpers below for DB queries and run `pnpm db:push`.
 *
 * SECURITY
 * - Identity is always derived from the authenticated session server-side;
 *   a membership ID supplied by the browser is never trusted as authorization.
 * - Setup tokens are stored only as SHA-256 digests (see memberAuthService).
 * - Only safe profile fields are ever returned to the client.
 */

import type {
  CvEntry,
  Document,
  LifecycleCase,
  LifecycleEvidenceItem,
  LifecycleTimelineEvent,
  User,
} from "../../drizzle/schema";
import { createHmac, timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ENV } from "../_core/env";
import {
  generateSecureToken,
  hashToken,
  toPublicUser,
  type PublicUser,
} from "./memberAuthService";
import {
  lookupMembership,
  type MembershipLookup,
} from "./googleSheetsService";
import {
  queueMembershipStatusEmail,
  queuePasswordSetupEmail,
} from "./emailService";

// ============================================================================
// Types
// ============================================================================

type StoredUser = User;
type StoredDocument = Document;

export type SyncResult =
  | {
      status: "lookup-unavailable" | "not-found" | "not-approved";
      message: string;
    }
  | {
      status: "created" | "updated";
      message: string;
      membershipId: string;
      setupEmailQueued: boolean;
      newSetupTokenIssued: boolean;
    };

export type PortalDocument = {
  type: string;
  fileName: string;
  viewUrl: string;
  downloadUrl: string;
};

export type PortalProfile = PublicUser & {
  membership: {
    membershipId: string | null;
    status: string | null;
    validity: string | null;
    membershipStartDate: Date | null;
    membershipEndDate: Date | null;
  };
  documents: PortalDocument[];
  setupComplete: boolean;
};

// ============================================================================
// In-memory store (see header comment)
// ============================================================================

const usersById = new Map<number, StoredUser>();
const openIdIndex = new Map<string, number>();
const membershipIdIndex = new Map<string, number>();
const emailIndex = new Map<string, number>();
const setupTokenIndex = new Map<string, number>();
const docsByMember = new Map<number, StoredDocument[]>();
const cvEntriesByMember = new Map<number, CvEntry[]>();
let nextUserId = 1;
let nextDocId = 1;
let nextCvEntryId = 1;

function keyOf(value: string): string {
  return value.trim().toLowerCase();
}

function indexUser(user: StoredUser) {
  usersById.set(user.id, user);
  openIdIndex.set(keyOf(user.openId), user.id);
  if (user.membershipId) membershipIdIndex.set(keyOf(user.membershipId), user.id);
  if (user.email) emailIndex.set(keyOf(user.email), user.id);
  if (user.setupTokenHash) setupTokenIndex.set(keyOf(user.setupTokenHash), user.id);
}

function unindexUser(user: StoredUser) {
  usersById.delete(user.id);
  openIdIndex.delete(keyOf(user.openId));
  if (user.membershipId) membershipIdIndex.delete(keyOf(user.membershipId));
  if (user.email) emailIndex.delete(keyOf(user.email));
  if (user.setupTokenHash) setupTokenIndex.delete(keyOf(user.setupTokenHash));
}

function getById(id: number): StoredUser | undefined {
  return usersById.get(id);
}

function getByOpenId(openId: string): StoredUser | undefined {
  const id = openIdIndex.get(keyOf(openId));
  return id === undefined ? undefined : usersById.get(id);
}

function getByMembershipId(membershipId: string): StoredUser | undefined {
  const id = membershipIdIndex.get(keyOf(membershipId));
  return id === undefined ? undefined : usersById.get(id);
}

function getBySetupTokenHash(hash: string): StoredUser | undefined {
  const id = setupTokenIndex.get(keyOf(hash));
  return id === undefined ? undefined : usersById.get(id);
}

/** Find a member by either their Membership ID or email (case-insensitive). */
export function findUserByIdentity(
  identifier: string
): StoredUser | undefined {
  const key = keyOf(identifier);
  const byMembership = membershipIdIndex.get(key);
  if (byMembership !== undefined) return usersById.get(byMembership);
  const byEmail = emailIndex.get(key);
  if (byEmail !== undefined) return usersById.get(byEmail);
  return undefined;
}

export function findUserByOpenId(openId: string): StoredUser | undefined {
  return getByOpenId(openId);
}

export function findUserById(id: number): StoredUser | undefined {
  return getById(id);
}

export function findUserBySetupTokenHash(hash: string): StoredUser | undefined {
  return getBySetupTokenHash(hash);
}

/**
 * Generic upsert keyed on openId. Used by the session layer so OAuth users and
 * member accounts share one identity path.
 */
export function upsertUser(input: {
  openId: string;
  email?: string | null;
  name?: string | null;
  loginMethod?: string | null;
  lastSignedIn?: Date | null;
  membershipId?: string | null;
  membershipStatus?: User["membershipStatus"] | null;
  phone?: string | null;
  institution?: string | null;
  degree?: string | null;
  graduationYear?: number | null;
  profilePhotoUrl?: string | null;
  discipline?: string | null;
  yearOfStudy?: string | null;
  localCouncil?: string | null;
  role?: User["role"] | null;
  officialPosition?: User["officialPosition"] | null;
  domain?: string | null;
  moduleAccess?: string[] | null;
}): StoredUser {
  const existing = getByOpenId(input.openId);
  if (existing) {
    const updated: StoredUser = {
      ...existing,
      email: input.email ?? existing.email,
      name: input.name ?? existing.name,
      loginMethod: input.loginMethod ?? existing.loginMethod,
      lastSignedIn: input.lastSignedIn ?? existing.lastSignedIn,
      membershipId: input.membershipId ?? existing.membershipId,
      membershipStatus: input.membershipStatus ?? existing.membershipStatus,
      phone: input.phone ?? existing.phone,
      institution: input.institution ?? existing.institution,
      degree: input.degree ?? existing.degree,
      graduationYear: input.graduationYear ?? existing.graduationYear,
      profilePhotoUrl: input.profilePhotoUrl ?? existing.profilePhotoUrl,
      discipline: input.discipline ?? existing.discipline,
      yearOfStudy: input.yearOfStudy ?? existing.yearOfStudy,
      localCouncil: input.localCouncil ?? existing.localCouncil,
      role: input.role ?? existing.role,
      officialPosition: input.officialPosition ?? existing.officialPosition,
      domain: input.domain ?? existing.domain,
      moduleAccess: input.moduleAccess ?? existing.moduleAccess,
      updatedAt: new Date(),
    };
    unindexUser(existing);
    indexUser(updated);
    persistStore();
    return updated;
  }

  const now = new Date();
  const created: StoredUser = {
    id: nextUserId++,
    openId: input.openId,
    email: input.email ?? `${input.openId}@msap.local`,
    name: input.name ?? null,
    cnic: null,
    phone: input.phone ?? null,
    institution: input.institution ?? null,
    degree: input.degree ?? null,
    graduationYear: input.graduationYear ?? null,
    localCouncilId: null,
    membershipStatus: input.membershipStatus ?? "Pending",
    membershipId: input.membershipId ?? null,
    membershipStartDate: null,
    membershipEndDate: null,
    profilePhotoUrl: input.profilePhotoUrl ?? null,
    bio: null,
    loginMethod: input.loginMethod ?? "member-password",
    role: input.role ?? "user",
    officialPosition: input.officialPosition ?? null,
    domain: input.domain ?? null,
    moduleAccess: input.moduleAccess ?? null,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: input.lastSignedIn ?? null,
    // Member account fields
    passwordHash: null,
    passwordSetupRequired: true,
    setupTokenHash: null,
    setupTokenExpiresAt: null,
    setupTokenUsedAt: null,
    active: true,
    // Extended profile columns (added to schema for future migrations)
    discipline: input.discipline ?? null,
    yearOfStudy: input.yearOfStudy ?? null,
    localCouncil: input.localCouncil ?? null,
    // Fresh accounts start at epoch 0; every new session carries this value.
    sessionEpoch: 0,
  };
  indexUser(created);
  persistStore();
  return created;
}

function hasValidPendingSetupToken(user: StoredUser): boolean {
  return Boolean(user.setupTokenHash && isSetupTokenValid(user));
}

/**
 * True when a setup token is usable: the account is active, the token has not
 * expired and has not already been consumed. Single source of truth for the
 * password-setup procedures and the sync's re-issue decision.
 */
export function isSetupTokenValid(
  user: Pick<
    StoredUser,
    "active" | "setupTokenExpiresAt" | "setupTokenUsedAt"
  > | null | undefined,
  now: number = Date.now()
): boolean {
  return Boolean(
    user &&
      user.active !== false &&
      user.setupTokenExpiresAt &&
      user.setupTokenExpiresAt.getTime() > now &&
      !user.setupTokenUsedAt
  );
}

/**
 * Issue a fresh one-time password setup token for a member.
 * Re-issuing overwrites (and therefore invalidates) any previous token.
 * Returns the raw token - this is the only time it exists outside the DB.
 */
export function issueSetupToken(
  userId: number
): { rawToken: string; expiresAt: Date } | null {
  const user = getById(userId);
  if (!user) return null;

  const rawToken = generateSecureToken(32);
  const expiresAt = new Date(Date.now() + ENV.passwordSetupTokenExpiryMs);
  const updated: StoredUser = {
    ...user,
    setupTokenHash: hashToken(rawToken),
    setupTokenExpiresAt: expiresAt,
    setupTokenUsedAt: null,
    // A re-issue must not resurrect a completed password setup.
    passwordSetupRequired: user.passwordHash ? false : true,
  };
  unindexUser(user);
  indexUser(updated);
  persistStore();

  // Never log the raw token.
  console.log(
    `[MemberAccount] Issued password setup token for user ${userId} (expires ${expiresAt.toISOString()}).`
  );
  return { rawToken, expiresAt };
}

/** Clear the setup token fields and store the password hash. */
export function completePasswordSetup(userId: number, passwordHash: string) {
  const user = getById(userId);
  if (!user) return null;

  const updated: StoredUser = {
    ...user,
    passwordHash,
    passwordSetupRequired: false,
    setupTokenHash: null,
    setupTokenExpiresAt: null,
    setupTokenUsedAt: new Date(),
    active: true,
    // A changed password must invalidate every previously issued session.
    sessionEpoch: (user.sessionEpoch ?? 0) + 1,
    updatedAt: new Date(),
  };
  unindexUser(user);
  indexUser(updated);
  persistStore();
  return updated;
}

/**
 * Bump the session revocation epoch for a user, invalidating every session
 * token issued before this moment. Used by logout (so a copied cookie dies
 * too) and by password resets/account disabling (which callers trigger via
 * the service functions below). Returns true when the user exists.
 */
export function revokeAllSessions(userId: number): boolean {
  const user = getById(userId);
  if (!user) return false;
  const updated: StoredUser = {
    ...user,
    sessionEpoch: (user.sessionEpoch ?? 0) + 1,
    updatedAt: new Date(),
  };
  unindexUser(user);
  indexUser(updated);
  persistStore();
  return true;
}

export function recordLastSignIn(userId: number) {
  const user = getById(userId);
  if (!user) return;
  unindexUser(user);
  indexUser({ ...user, lastSignedIn: new Date(), updatedAt: new Date() });
  persistStore();
}

// ============================================================================
// Officials & module access (super-admin provisioned)
// ============================================================================
//
// Officials (SUPCO, National President, Vice Presidents, Local Council
// Presidents) and admins sign in on the SEPARATE /official/login pathway and
// land on the Official Portal - never the member dashboard. Accounts are
// provisioned ONLY by the super admin (there is no self sign-up anywhere);
// the super admin can also open any module for any official so work can be
// delegated when someone is absent.

/** Positions an official account can hold (minimal set; more later). */
export const OFFICIAL_POSITIONS = [
  "supco",
  "national-president",
  "vice-president",
  "lc-president",
] as const;
export type OfficialPosition = (typeof OFFICIAL_POSITIONS)[number];

/**
 * Module keys the super admin can grant to any official. The key "officials"
 * (the management page itself) is reserved for the super admin and can never
 * be granted.
 */
export const OFFICIAL_MODULES = [
  "recruitment",
  "card-queue",
  "config",
  "interviews",
  "lifecycle",
] as const;
export type OfficialModule = (typeof OFFICIAL_MODULES)[number];

export const OFFICIAL_POSITION_LABELS: Record<OfficialPosition, string> = {
  supco: "SUPCO Member",
  "national-president": "National President",
  "vice-president": "Vice President",
  "lc-president": "Local Council President",
};

export const OFFICIAL_MODULE_LABELS: Record<string, string> = {
  recruitment: "Recruitment Dashboard",
  "card-queue": "Card Issuance Queue",
  config: "System Configuration",
  interviews: "Interview Scheduling",
  lifecycle: "Membership Lifecycle",
  officials: "Officials Management",
};

export const OFFICIAL_ROLES = ["admin", "superadmin", "official"] as const;
export type OfficialRole = (typeof OFFICIAL_ROLES)[number];

/** Roles that authenticate through the official login pathway. */
export function isOfficialRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "superadmin" || role === "official";
}

/**
 * Whether a user may open a given official module. The super admin can open
 * anything (including the officials-management page); admins inherit every
 * official module; officials only see exactly what the super admin granted
 * them via moduleAccess.
 */
export function canAccessModule(
  user: Pick<StoredUser, "role" | "moduleAccess"> | null | undefined,
  module: string
): boolean {
  if (!user) return false;
  if (user.role === "superadmin") return true;
  if (module === "officials") return false; // super admin only
  if (user.role === "admin") {
    return (OFFICIAL_MODULES as readonly string[]).includes(module);
  }
  if (user.role === "official") {
    return (user.moduleAccess ?? []).includes(module);
  }
  return false;
}

/** Safe list entry for the officials-management page. */
export type OfficialListEntry = {
  id: number;
  name: string | null;
  email: string;
  role: string;
  officialPosition: OfficialPosition | null;
  domain: string | null;
  localCouncil: string | null;
  moduleAccess: string[];
  active: boolean;
  passwordSetupRequired: boolean;
  lastSignedIn: Date | null;
  createdAt: Date;
};

function toOfficialListEntry(user: StoredUser): OfficialListEntry {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || "official",
    officialPosition: user.officialPosition ?? null,
    domain: user.domain ?? null,
    localCouncil: user.localCouncil ?? null,
    moduleAccess: user.moduleAccess ?? [],
    active: user.active !== false,
    passwordSetupRequired: Boolean(user.passwordSetupRequired),
    lastSignedIn: user.lastSignedIn,
    createdAt: user.createdAt,
  };
}

/** Every non-member account (officials, admins, super admins), name-sorted. */
export function listOfficials(): OfficialListEntry[] {
  return Array.from(usersById.values())
    .filter((u) => isOfficialRole(u.role))
    .sort((a, b) =>
      (a.name ?? a.email).localeCompare(b.name ?? b.email)
    )
    .map(toOfficialListEntry);
}

export type CreateOfficialInput = {
  name: string;
  email: string;
  position: OfficialPosition;
  domain?: string | null;
  localCouncil?: string | null;
  moduleAccess?: string[];
  /** Defaults to "official"; the super admin may also provision a full admin. */
  role?: "official" | "admin";
};

export type CreateOfficialResult =
  | {
      ok: true;
      user: OfficialListEntry;
      /** Raw one-time setup token (powers the password-setup link). */
      setupToken: string | null;
      /** True when the account was created fresh (false = re-provisioned). */
      created: boolean;
    }
  | { ok: false; error: string };

/**
 * Provision an official account. Only the super admin may call this (enforced
 * in the router). An existing account with the same email is re-provisioned
 * with the new position/grants instead of duplicated; a member account can
 * never be silently converted - that needs a deliberate re-provision.
 */
export function createOfficial(
  input: CreateOfficialInput
): CreateOfficialResult {
  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: false, error: "Email is required." };
  const existing = findUserByIdentity(email);
  if (existing && existing.role === "user") {
    return {
      ok: false,
      error:
        "That email belongs to an existing member account. Use a different email, or manage the account from the member side.",
    };
  }

  const base = {
    email,
    name: input.name.trim(),
    role: input.role ?? "official",
    officialPosition: input.position,
    domain: input.domain?.trim() || null,
    localCouncil: input.localCouncil?.trim() || null,
    moduleAccess: input.moduleAccess ?? [],
    loginMethod: "member-password" as const,
    membershipStatus: "Active" as const,
  };
  const user = existing
    ? upsertUser({ ...base, openId: existing.openId })
    : upsertUser({ ...base, openId: `official:${email}` });

  const needsSetup = !user.passwordHash || Boolean(user.passwordSetupRequired);
  const setupToken = needsSetup ? issueSetupToken(user.id)?.rawToken ?? null : null;
  return {
    ok: true,
    user: toOfficialListEntry(user),
    setupToken,
    created: !existing,
  };
}

/**
 * Update an official's profile fields. Returns null when no official account
 * matches the id.
 */
export function updateOfficial(
  userId: number,
  fields: {
    name?: string;
    position?: OfficialPosition;
    domain?: string | null;
    localCouncil?: string | null;
    active?: boolean;
  }
): OfficialListEntry | null {
  const user = getById(userId);
  if (!user || !isOfficialRole(user.role)) return null;
  const nowDisabling = fields.active === false && user.active !== false;
  const updated: StoredUser = {
    ...user,
    name: fields.name?.trim() || user.name,
    officialPosition: fields.position ?? user.officialPosition,
    domain:
      fields.domain === undefined ? user.domain : fields.domain?.trim() || null,
    localCouncil:
      fields.localCouncil === undefined
        ? user.localCouncil
        : fields.localCouncil?.trim() || null,
    active: fields.active ?? user.active,
    // Bump the epoch when disabling: the active flag locks the account out
    // immediately, and this extra bump ensures a re-enabled account does NOT
    // resurrect sessions that were live before the disable.
    sessionEpoch: nowDisabling ? (user.sessionEpoch ?? 0) + 1 : user.sessionEpoch,
    updatedAt: new Date(),
  };
  unindexUser(user);
  indexUser(updated);
  persistStore();
  return toOfficialListEntry(updated);
}

/**
 * Replace the module grants for an official. Only meaningful for role
 * "official" (admins inherit all modules; super admins need nothing).
 * Unknown module keys are dropped so grants stay within the allowlist.
 */
export function setOfficialModuleAccess(
  userId: number,
  modules: string[]
): OfficialListEntry | null {
  const user = getById(userId);
  if (!user || user.role !== "official") return null;
  const allowed = OFFICIAL_MODULES as readonly string[];
  const sanitized = Array.from(
    new Set(modules.filter((m) => allowed.includes(m)))
  );
  const updated: StoredUser = {
    ...user,
    moduleAccess: sanitized,
    updatedAt: new Date(),
  };
  unindexUser(user);
  indexUser(updated);
  persistStore();
  return toOfficialListEntry(updated);
}

/**
 * Issue a fresh one-time setup link for an official (password reset).
 * Returns the raw token or null when no official account matches — or the
 * account is disabled (a disabled official must not receive working links).
 */
export function resetOfficialPassword(userId: number): string | null {
  const user = getById(userId);
  if (!user || !isOfficialRole(user.role) || user.active === false) return null;
  // A password reset must revoke every existing session: the token holder
  // gets a fresh session when they set the new password, old cookies die.
  revokeAllSessions(userId);
  return issueSetupToken(userId)?.rawToken ?? null;
}

/**
 * Boot-time super-admin bootstrap: when SUPER_ADMIN_EMAIL is set and an
 * account exists with that email, promote it to super admin. This is the
 * safe production path for designating the first super admin (accounts are
 * created from the approved-member registry; the env var only flips the
 * role).
 */
export function ensureBootstrapSuperAdmin(): void {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return;
  const user = findUserByIdentity(email);
  if (!user || user.role === "superadmin") return;
  upsertUser({ openId: user.openId, role: "superadmin" });
  console.log(
    `[Officials] Promoted ${email} to super admin (SUPER_ADMIN_EMAIL bootstrap).`
  );
}

// ============================================================================
// Membership lifecycle (workflow-based suspend / terminate / reinstate)
// ============================================================================
//
// Suspension and termination are NEVER a direct status flip or delete. Each
// one is a case that records the reason, evidence and requester, goes through
// review by an official with the "lifecycle" module, and only an approved
// decision applies the change. Every event is appended to the case timeline
// (the audit trail), the member's sessions are revoked where the account is
// locked, and the member is notified by email. Reinstatement reverses a
// suspension/termination through the same workflow.

export const LIFECYCLE_ACTIONS = ["suspend", "terminate", "reinstate"] as const;
export type LifecycleAction = (typeof LIFECYCLE_ACTIONS)[number];

export type LifecycleCaseStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export const LIFECYCLE_ACTION_LABELS: Record<LifecycleAction, string> = {
  suspend: "Suspend membership",
  terminate: "Terminate membership",
  reinstate: "Reinstate membership",
};

export const LIFECYCLE_STATUS_LABELS: Record<LifecycleCaseStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const MAX_CASE_EVIDENCE_ITEMS = 4;
const MAX_EVIDENCE_BYTES = 500_000;

/**
 * Evidence attachment guard: a PNG/JPEG data URL within the size cap. Reused
 * by openLifecycleCase so memory stays predictable (the store file holds the
 * attachments as data URLs until object storage is provisioned).
 */
export function isValidLifecycleEvidence(dataUrl: string): boolean {
  return (
    /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(dataUrl) &&
    dataUrl.length <= MAX_EVIDENCE_BYTES
  );
}

const lifecycleCasesById = new Map<number, LifecycleCase>();
let nextCaseId = 1;

function getAllLifecycleCases(): LifecycleCase[] {
  return Array.from(lifecycleCasesById.values());
}

export type OpenLifecycleCaseInput = {
  /** Membership ID or email — resolved server-side, never trusted from the client. */
  identifier: string;
  action: LifecycleAction;
  reason: string;
  description?: string;
  evidence?: LifecycleEvidenceItem[];
  requestedBy: { name: string; email: string };
};

export type OpenLifecycleCaseResult =
  | { ok: true; case: LifecycleCase }
  | { ok: false; error: string };

/**
 * Open a lifecycle case. Enforces the state machine up front:
 *   suspend/terminate -> member must currently be Active
 *   reinstate        -> member must currently be Suspended or Terminated
 * The case starts "pending" and changes nothing until an official approves it.
 */
export function openLifecycleCase(
  input: OpenLifecycleCaseInput
): OpenLifecycleCaseResult {
  const user = findUserByIdentity(input.identifier);
  if (!user) {
    return {
      ok: false,
      error: "No portal account matches that Membership ID or email.",
    };
  }
  if (user.role !== "user") {
    return { ok: false, error: "Lifecycle actions apply to member accounts only." };
  }

  const current = user.membershipStatus ?? "Pending";
  if (input.action === "reinstate") {
    if (current !== "Suspended" && current !== "Terminated") {
      return {
        ok: false,
        error:
          "Only suspended or terminated members can be reinstated (current status: " +
          current +
          ").",
      };
    }
  } else if (current !== "Active") {
    return {
      ok: false,
      error:
        "A " +
        LIFECYCLE_ACTION_LABELS[input.action].toLowerCase() +
        " case requires the member to currently hold an Active membership (current status: " +
        current +
        ").",
    };
  }

  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "A reason is required." };
  if (reason.length > 120) {
    return { ok: false, error: "Reason must be 120 characters or fewer." };
  }
  if (input.description && input.description.length > 2000) {
    return { ok: false, error: "Description must be 2000 characters or fewer." };
  }

  const evidence = (input.evidence ?? []).slice(0, MAX_CASE_EVIDENCE_ITEMS);
  for (const item of evidence) {
    if (!item.label?.trim() || item.label.trim().length > 120) {
      return { ok: false, error: "Every evidence item needs a short label." };
    }
    if (!isValidLifecycleEvidence(item.dataUrl)) {
      return {
        ok: false,
        error: "Evidence must be a PNG/JPEG image (data URL, max 500KB each).",
      };
    }
  }

  const now = new Date();
  const memberName = user.name || "Member";
  const created: LifecycleCase = {
    id: nextCaseId++,
    userId: user.id,
    membershipId: user.membershipId || "",
    memberName,
    action: input.action,
    reason,
    description: input.description?.trim() || null,
    status: "pending",
    evidence,
    requestedByName: input.requestedBy.name,
    requestedByEmail: input.requestedBy.email,
    requestedAt: now,
    decidedByName: null,
    decidedByEmail: null,
    decidedAt: null,
    decisionNotes: null,
    effectiveDate: null,
    notificationQueued: false,
    timeline: [
      {
        at: now,
        byName: input.requestedBy.name,
        byEmail: input.requestedBy.email,
        action: "case.opened",
        detail:
          LIFECYCLE_ACTION_LABELS[input.action] +
          " case opened for " +
          memberName +
          " (" +
          (user.membershipId || "no ID") +
          ").",
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
  lifecycleCasesById.set(created.id, created);
  persistStore();
  return { ok: true, case: created };
}

export type LifecycleListFilters = {
  status?: LifecycleCaseStatus;
  action?: LifecycleAction;
  query?: string;
  limit?: number;
};

/** All lifecycle cases, newest first, with status/action/free-text filters. */
export function listLifecycleCases(
  filters: LifecycleListFilters = {}
): LifecycleCase[] {
  const q = filters.query?.trim().toLowerCase() ?? "";
  return getAllLifecycleCases()
    .filter((c) => !filters.status || c.status === filters.status)
    .filter((c) => !filters.action || c.action === filters.action)
    .filter(
      (c) =>
        !q ||
        [c.memberName, c.membershipId, c.reason, c.requestedByEmail].some((v) =>
          (v ?? "").toLowerCase().includes(q)
        )
    )
    .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime())
    .slice(0, filters.limit ?? 200);
}

/** Full detail for one case (timeline included) for the review panel. */
export function getLifecycleCase(caseId: number): LifecycleCase | null {
  return lifecycleCasesById.get(caseId) ?? null;
}

/** Pending/approved/rejected/cancelled counts for the page header chips. */
export function getLifecycleCounts(): {
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
} {
  const all = getAllLifecycleCases();
  return {
    pending: all.filter((c) => c.status === "pending").length,
    approved: all.filter((c) => c.status === "approved").length,
    rejected: all.filter((c) => c.status === "rejected").length,
    cancelled: all.filter((c) => c.status === "cancelled").length,
  };
}

export type ReviewLifecycleCaseResult =
  | { ok: true; case: LifecycleCase }
  | { ok: false; error: string };

/**
 * Review a pending lifecycle case. Approval APPLIES the action (status +
 * lockout + session revocation + member notification); rejection records the
 * decision without touching the member. Both paths append to the timeline.
 */
export function reviewLifecycleCase(
  caseId: number,
  decision: "approve" | "reject",
  decidedBy: { name: string; email: string },
  notes?: string
): ReviewLifecycleCaseResult {
  const lifecycleCase = lifecycleCasesById.get(caseId);
  if (!lifecycleCase) {
    return { ok: false, error: "No lifecycle case matches that id." };
  }
  if (lifecycleCase.status !== "pending") {
    return { ok: false, error: "That case has already been decided." };
  }
  const user = getById(lifecycleCase.userId);
  if (!user) return { ok: false, error: "The member account no longer exists." };

  const now = new Date();
  const decisionNotes = notes?.trim() || null;

  // Separation of duties: the official who opened a case must NOT be the one
  // who decides it. Pass the case to another official with the module.
  if (
    lifecycleCase.requestedByEmail &&
    lifecycleCase.requestedByEmail.toLowerCase() ===
      decidedBy.email.toLowerCase()
  ) {
    return {
      ok: false,
      error:
        "An official cannot decide a case they opened themselves — hand it to another official with the Lifecycle module.",
    };
  }

  if (decision === "approve") {
    // The member account must exist to APPLY a decision. (Rejecting does not
    // touch the member, so a rejection stays possible even if the account is
    // gone.)
    const before = user.membershipStatus ?? "Pending";
    const updated = applyLifecycleDecision_(user, lifecycleCase.action);
    if (!updated) {
      return {
        ok: false,
        error:
          "The member's current status no longer allows this action — the case cannot be applied.",
      };
    }
    lifecycleCase.status = "approved";
    lifecycleCase.decidedByName = decidedBy.name;
    lifecycleCase.decidedByEmail = decidedBy.email;
    lifecycleCase.decidedAt = now;
    lifecycleCase.decisionNotes = decisionNotes;
    lifecycleCase.effectiveDate = now;
    lifecycleCase.timeline = [
      ...(lifecycleCase.timeline ?? []),
      {
        at: now,
        byName: decidedBy.name,
        byEmail: decidedBy.email,
        action: "case.approved",
        detail:
          LIFECYCLE_ACTION_LABELS[lifecycleCase.action] +
          " applied (" +
          before +
          " → " +
          (updated.membershipStatus ?? "Unknown") +
          ").",
      },
    ];
    // Notify the member (best effort; queued until SMTP is configured).
    void queueMembershipStatusEmail({
      memberName: user.name || "MSAP Member",
      membershipId: user.membershipId || lifecycleCase.membershipId || "",
      recipientEmail: user.email || "",
      action: lifecycleCase.action,
      reason: lifecycleCase.reason,
      effectiveDate: now,
    });
    lifecycleCase.notificationQueued = true;
  } else {
    lifecycleCase.status = "rejected";
    lifecycleCase.decidedByName = decidedBy.name;
    lifecycleCase.decidedByEmail = decidedBy.email;
    lifecycleCase.decidedAt = now;
    lifecycleCase.decisionNotes = decisionNotes;
    lifecycleCase.timeline = [
      ...(lifecycleCase.timeline ?? []),
      {
        at: now,
        byName: decidedBy.name,
        byEmail: decidedBy.email,
        action: "case.rejected",
        detail: decisionNotes
          ? `Rejected. Notes: ${decisionNotes}`
          : "Rejected without notes.",
      },
    ];
  }
  lifecycleCase.updatedAt = now;
  persistStore();
  return { ok: true, case: lifecycleCase };
}

/**
 * Withdraw/cancel a pending case (e.g. it became unactionable because the
 * member's status changed elsewhere, or the request was withdrawn). Only
 * pending cases can be cancelled; the decision is recorded on the timeline.
 */
export function cancelLifecycleCase(
  caseId: number,
  cancelledBy: { name: string; email: string },
  notes?: string
): ReviewLifecycleCaseResult {
  const lifecycleCase = lifecycleCasesById.get(caseId);
  if (!lifecycleCase) {
    return { ok: false, error: "No lifecycle case matches that id." };
  }
  if (lifecycleCase.status !== "pending") {
    return { ok: false, error: "Only pending cases can be cancelled." };
  }
  const now = new Date();
  const notesTrimmed = notes?.trim() || null;
  lifecycleCase.status = "cancelled";
  lifecycleCase.decidedByName = cancelledBy.name;
  lifecycleCase.decidedByEmail = cancelledBy.email;
  lifecycleCase.decidedAt = now;
  lifecycleCase.decisionNotes = notesTrimmed;
  lifecycleCase.timeline = [
    ...(lifecycleCase.timeline ?? []),
    {
      at: now,
      byName: cancelledBy.name,
      byEmail: cancelledBy.email,
      action: "case.cancelled",
      detail: notesTrimmed ? `Cancelled. Notes: ${notesTrimmed}` : "Cancelled.",
    },
  ];
  lifecycleCase.updatedAt = now;
  persistStore();
  return { ok: true, case: lifecycleCase };
}

/**
 * Apply the approved decision to the member account. Re-checks the state
 * machine at apply time (a case can sit pending while the member's status
 * changes elsewhere), revokes the member's sessions when the account is
 * locked, and returns the updated user (or null when not applicable).
 */
function applyLifecycleDecision_(
  user: StoredUser,
  action: LifecycleAction
): StoredUser | null {
  const current = user.membershipStatus ?? "Pending";
  let next: StoredUser | null = null;
  if (action === "suspend") {
    if (current !== "Active") return null;
    next = { ...user, membershipStatus: "Suspended" as const, active: false };
  } else if (action === "terminate") {
    if (current !== "Active") return null;
    next = { ...user, membershipStatus: "Terminated" as const, active: false };
  } else {
    if (current !== "Suspended" && current !== "Terminated") return null;
    next = { ...user, membershipStatus: "Active" as const, active: true };
  }
  const updated: StoredUser = {
    ...next,
    // Locking the account (or reversing a lock) must invalidate any session
    // that predates this decision.
    sessionEpoch: (user.sessionEpoch ?? 0) + 1,
    updatedAt: new Date(),
  };
  unindexUser(user);
  indexUser(updated);
  persistStore();
  return updated;
}

// ============================================================================
// Documents
// ============================================================================

/** Convert a Google Drive "view" URL into a direct download URL. */
export function toDriveDownloadUrl(viewUrl: string): string {
  const match = viewUrl.match(/\/file\/d\/([^/]+)\//);
  if (match && match[1]) {
    return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  }
  return viewUrl;
}

function getDocumentsFor(userId: number): StoredDocument[] {
  return docsByMember.get(userId) ?? [];
}

export function upsertDocument(
  userId: number,
  type: Document["type"],
  documentUrl: string,
  membershipId: string
) {
  const list = docsByMember.get(userId) ?? [];
  const existing = list.find((d) => d.type === type);
  const fileName =
    type === "Membership Letter"
      ? `${membershipId}_Membership_Letter.pdf`
      : `${membershipId}_Membership_Card.pdf`;

  if (existing) {
    const updated = { ...existing, documentUrl, fileName };
    docsByMember.set(
      userId,
      list.map((d) => (d.id === existing.id ? updated : d))
    );
    return updated;
  }

  const doc: StoredDocument = {
    id: nextDocId++,
    memberId: userId,
    type,
    documentUrl,
    documentKey: `${membershipId}-${type.replace(/\s+/g, "-")}`,
    fileName,
    generatedAt: new Date(),
    createdAt: new Date(),
  };
  docsByMember.set(userId, [...list, doc]);
  persistStore();
  return doc;
}

export function getMemberDocuments(userId: number): PortalDocument[] {
  return getDocumentsFor(userId).map((d) => ({
    type: d.type,
    fileName: d.fileName ?? d.documentKey,
    viewUrl: d.documentUrl,
    downloadUrl: toDriveDownloadUrl(d.documentUrl),
  }));
}

// ============================================================================
// Profile updates
// ============================================================================

/**
 * Persist editable profile fields for a member. Identity comes from the
 * session server-side; a browser-supplied id is never trusted.
 */
export function updateMemberProfile(
  userId: number,
  fields: {
    name?: string | null;
    phone?: string | null;
    bio?: string | null;
    institution?: string | null;
    degree?: string | null;
    localCouncil?: string | null;
  }
): StoredUser | null {
  const user = getById(userId);
  if (!user) return null;

  const updated: StoredUser = {
    ...user,
    name: fields.name ?? user.name,
    phone: fields.phone ?? user.phone,
    bio: fields.bio ?? user.bio,
    institution: fields.institution ?? user.institution,
    degree: fields.degree ?? user.degree,
    localCouncil: fields.localCouncil ?? user.localCouncil,
    updatedAt: new Date(),
  };
  unindexUser(user);
  indexUser(updated);
  persistStore();
  return updated;
}

// ============================================================================
// CV entries (in-memory, mirrors the cv_entries table)
// ============================================================================

export type CvEntryInput = {
  type: CvEntry["type"];
  title: string;
  description?: string | null;
  organization?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  isCurrent?: boolean;
};

export function getCVEntries(userId: number): CvEntry[] {
  return cvEntriesByMember.get(userId) ?? [];
}

export function addCVEntry(userId: number, input: CvEntryInput): CvEntry {
  const list = cvEntriesByMember.get(userId) ?? [];
  const entry: CvEntry = {
    id: nextCvEntryId++,
    memberId: userId,
    type: input.type,
    title: input.title,
    description: input.description ?? null,
    organization: input.organization ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    isCurrent: input.isCurrent ?? false,
    order: list.length,
    createdAt: new Date(),
  };
  cvEntriesByMember.set(userId, [...list, entry]);
  persistStore();
  return entry;
}

export function updateCVEntry(
  userId: number,
  entryId: number,
  input: Partial<CvEntryInput>
): CvEntry | null {
  const list = cvEntriesByMember.get(userId) ?? [];
  const existing = list.find((e) => e.id === entryId);
  if (!existing) return null;
  const updated: CvEntry = {
    ...existing,
    type: input.type ?? existing.type,
    title: input.title ?? existing.title,
    description: input.description ?? existing.description,
    organization: input.organization ?? existing.organization,
    startDate: input.startDate ?? existing.startDate,
    endDate: input.endDate ?? existing.endDate,
    isCurrent: input.isCurrent ?? existing.isCurrent,
  };
  cvEntriesByMember.set(
    userId,
    list.map((e) => (e.id === entryId ? updated : e))
  );
  persistStore();
  return updated;
}

export function deleteCVEntry(userId: number, entryId: number): boolean {
  const list = cvEntriesByMember.get(userId) ?? [];
  const next = list.filter((e) => e.id !== entryId);
  if (next.length === list.length) return false;
  cvEntriesByMember.set(userId, next);
  persistStore();
  return true;
}

// ============================================================================
// Approved-member sync (idempotent reconciliation)
// ============================================================================

function buildAccountFromLookup(member: MembershipLookup) {
  const personalEmail =
    member.personalEmail && member.personalEmail.trim()
      ? member.personalEmail.trim()
      : member.email;
  return {
    openId: `member:${member.membershipId}`,
    email: (member.email || personalEmail || "").toLowerCase(),
    name: member.name || null,
    phone: member.phone || null,
    institution: member.institute || null,
    degree: member.discipline || null,
    graduationYear: member.graduationYear
      ? Number(member.graduationYear) || null
      : null,
    membershipId: member.membershipId || null,
    membershipStatus: "Active" as const,
    membershipStartDate: null,
    membershipEndDate: null,
    profilePhotoUrl: member.profilePhotoUrl || null,
    discipline: member.discipline || null,
    yearOfStudy: member.yearOfStudy || null,
    localCouncil: member.localCouncil || null,
  };
}

/**
 * Reconcile the portal account for one approved member.
 *
 * Idempotent guarantees:
 * - never creates a second account for an approved member
 * - never resends the setup email when a valid token is already pending
 * - passing `resendSetupEmail: true` always issues a fresh token (and
 *   invalidates the previous one)
 */
export async function syncApprovedMember(
  identifier: string,
  options: { resendSetupEmail?: boolean } = {},
  lookupFn: (id: string) => Promise<MembershipLookup | null> = lookupMembership
): Promise<SyncResult> {
  const member = await lookupFn(identifier);

  if (!member) {
    return {
      status: "lookup-unavailable",
      message:
        "Could not reach the membership registry (Google Apps Script). " +
        "Check MSAP_APPS_SCRIPT_URL and that the deployed script includes the lookupMember action.",
    };
  }
  if (!member.found) {
    return { status: "not-found", message: "No member record matches that identifier." };
  }
  if (!member.approved) {
    return { status: "not-approved", message: "That member record is not yet approved." };
  }
  if (!member.membershipId) {
    return {
      status: "not-found",
      message: "The approved member record has no membership ID assigned yet.",
    };
  }
  const membershipId: string = member.membershipId;

  const existing = getByMembershipId(membershipId);
  const profile = buildAccountFromLookup(member);
  const queued = (user: StoredUser, rawToken: string, expiresAt: Date) =>
    queuePasswordSetupEmail({
      memberName: user.name || "MSAP Member",
      membershipId: user.membershipId || membershipId,
      recipientEmail: user.email || "",
      setupUrl: `${getPortalBaseUrl()}/set-password?token=${rawToken}`,
      expiresAt,
    });

  if (existing) {
    const updated: StoredUser = {
      ...existing,
      ...profile,
      id: existing.id,
      openId: existing.openId,
      membershipId: existing.membershipId ?? member.membershipId,
      email: profile.email || existing.email,
      updatedAt: new Date(),
    };
    unindexUser(existing);
    indexUser(updated);

    // Keep documents in sync with the registry (letter/card URLs).
    if (member.letterUrl) upsertDocument(updated.id, "Membership Letter", member.letterUrl, membershipId);
    if (member.cardUrl) upsertDocument(updated.id, "Membership Card", member.cardUrl, membershipId);

    const shouldIssue =
      options.resendSetupEmail ||
      (updated.passwordSetupRequired && !hasValidPendingSetupToken(updated));

    if (shouldIssue) {
      const issued = issueSetupToken(updated.id);
      if (issued) {
        queued(updated, issued.rawToken, issued.expiresAt);
        return {
          status: "updated",
          message: "Member account updated; fresh setup link issued.",
          membershipId: updated.membershipId ?? membershipId,
          setupEmailQueued: true,
          newSetupTokenIssued: true,
        };
      }
    }

    return {
      status: "updated",
      message: "Member account already up to date; no setup email resent.",
      membershipId: updated.membershipId ?? membershipId,
      setupEmailQueued: false,
      newSetupTokenIssued: false,
    };
  }

  // Create account (never duplicates - membershipId is the unique key).
  const created = upsertUser({
    ...profile,
    openId: `member:${membershipId}`,
    loginMethod: "member-password",
  });
  const issued = issueSetupToken(created.id);
  if (issued) {
    queued(created, issued.rawToken, issued.expiresAt);
  }

  if (member.letterUrl) upsertDocument(created.id, "Membership Letter", member.letterUrl, membershipId);
  if (member.cardUrl) upsertDocument(created.id, "Membership Card", member.cardUrl, membershipId);

  return {
    status: "created",
    message: "Portal account created for approved member.",
    membershipId,
    setupEmailQueued: Boolean(issued),
    newSetupTokenIssued: Boolean(issued),
  };
}

export function getPortalBaseUrl(): string {
  const base = ENV.portalBaseUrl?.trim();
  return base || "http://localhost:3000";
}

/** Build the safe profile payload for the member dashboard. */
export function buildPortalProfile(user: User): PortalProfile {
  const publicUser = toPublicUser(user);
  const validity =
    user.membershipStatus === "Active"
      ? user.graduationYear
        ? `Active membership (valid through graduation year ${user.graduationYear})`
        : "Active membership"
      : user.membershipStatus || "Pending";

  return {
    ...publicUser,
    membership: {
      membershipId: user.membershipId,
      status: user.membershipStatus,
      validity,
      membershipStartDate: user.membershipStartDate,
      membershipEndDate: user.membershipEndDate,
    },
    documents: getMemberDocuments(user.id),
    setupComplete: !user.passwordSetupRequired,
  };
}

// ============================================================================
// Membership card (issuance + holder-signature approval workflow)
// ============================================================================
//
// The card renders ONLY approved data:
//   - identity fields (name, ID, council, institute, discipline, year) come
//     from the registry-synced account (never from a member's editable profile)
//   - the holder's signature goes through submit -> pending -> National Office
//     approve/reject; approval (re)issues the card with a new version and a
//     fresh HMAC verification token embedded in the QR code

/** National President, term 2025-26 (mirrors CONFIG in the Apps Script). */
const PRESIDENT_NAME = "Kumail Danial";
const PRESIDENT_TITLE = "National President";

/** Max size of an accepted signature image (PNG data URL). */
const MAX_SIGNATURE_BYTES = 400_000;

/**
 * Single validation point for signature images: a base64 PNG data URL within
 * the size cap. Used for holder signatures and the National President's.
 * The data URL prefix is checked strictly (no other MIME types), and the
 * payload length is bounded so memory stays predictable.
 */
export function isValidSignatureDataUrl(dataUrl: string): boolean {
  return (
    /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl) &&
    dataUrl.length <= MAX_SIGNATURE_BYTES
  );
}

/**
 * The National President's real signature, set by the National Office.
 * Stored as a PNG data URL (same validation as holder signatures). When unset
 * the cards fall back to a cursive-name placeholder. Env override lets ops
 * pre-seed it with a hosted image URL (or data URL) without an upload; it is
 * read lazily so dotenv has loaded by the time the card is built.
 */
let presidentSignatureUrl: string | null | undefined;

function currentPresidentSignatureUrl(): string | null {
  if (presidentSignatureUrl === undefined) {
    presidentSignatureUrl =
      process.env.PRESIDENT_SIGNATURE_URL?.trim() || null;
  }
  return presidentSignatureUrl;
}

/** Set (or replace) the National President's signature image. */
export function setPresidentSignatureUrl(dataUrl: string): boolean {
  if (!isValidSignatureDataUrl(dataUrl)) return false;
  presidentSignatureUrl = dataUrl;
  persistStore();
  return true;
}

/** Clear the National President's signature (revert to cursive placeholder). */
export function clearPresidentSignatureUrl(): void {
  presidentSignatureUrl = null;
  persistStore();
}

/** Current National President signature image (data URL or hosted URL). */
export function getPresidentSignatureUrl(): string | null {
  return currentPresidentSignatureUrl();
}

export type CardSignatureStatus = "none" | "pending" | "approved" | "rejected";

/**
 * The identity fields frozen onto the card at issuance. The card renders ONLY
 * this snapshot - a member's later profile edits can never appear on the card
 * until the National Office approves a re-issue.
 */
type CardIdentitySnapshot = {
  memberName: string;
  institution: string;
  discipline: string;
  yearOfStudy: string;
  localCouncil: string;
  graduationYear: number | null;
  photoUrl: string;
};

export type MemberCardRecord = {
  userId: number;
  version: number;
  holderSignature: {
    dataUrl: string | null;
    status: CardSignatureStatus;
    submittedAt: Date | null;
    reviewedAt: Date | null;
  };
  identitySnapshot: CardIdentitySnapshot | null;
  reissueRequested: boolean;
  reissueRequestedAt: Date | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
  verificationToken: string | null;
};

const cardsByMember = new Map<number, MemberCardRecord>();

function getCardRecord(userId: number): MemberCardRecord {
  const existing = cardsByMember.get(userId);
  if (existing) return existing;
  const created: MemberCardRecord = {
    userId,
    version: 0,
    holderSignature: {
      dataUrl: null,
      status: "none",
      submittedAt: null,
      reviewedAt: null,
    },
    identitySnapshot: null,
    reissueRequested: false,
    reissueRequestedAt: null,
    issuedAt: null,
    expiresAt: null,
    verificationToken: null,
  };
  cardsByMember.set(userId, created);
  return created;
}

function cardSecret(): string {
  if (ENV.cookieSecret) return ENV.cookieSecret;
  console.warn(
    "[MemberCard] JWT_SECRET not set - using an insecure dev fallback for card verification tokens."
  );
  return "msap-dev-card-secret";
}

/** Deterministic HMAC-SHA256 over the card identity (membershipId|version|issuedAt). */
export function issueCardToken(
  membershipId: string,
  version: number,
  issuedAt: Date
): string {
  return createHmac("sha256", cardSecret())
    .update(`${membershipId}|${version}|${issuedAt.toISOString()}`)
    .digest("hex");
}

/** Constant-time comparison of a presented token against the expected one. */
export function isCardTokenValid(
  membershipId: string,
  version: number,
  issuedAt: Date,
  token: string | null | undefined
): boolean {
  if (!token) return false;
  const expected = Buffer.from(
    issueCardToken(membershipId, version, issuedAt),
    "hex"
  );
  const presented = Buffer.from(token, "hex");
  return (
    expected.length === presented.length && timingSafeEqual(expected, presented)
  );
}

export type MemberCardData = {
  memberName: string;
  membershipId: string;
  institution: string;
  discipline: string;
  yearOfStudy: string;
  localCouncil: string;
  graduationYear: number | null;
  photoUrl: string;
  status: string;
  role: string;
  // Issuance state (approved snapshot)
  issued: boolean;
  version: number;
  issuedAt: Date | null;
  expiresAt: Date | null;
  verificationToken: string | null;
  // True when the member's live profile drifted from the approved snapshot
  // (a re-issue must be approved before the new data appears on the card).
  dataChangedSinceIssuance: boolean;
  reissueRequested: boolean;
  holderSignature: {
    dataUrl: string | null;
    status: CardSignatureStatus;
    submittedAt: Date | null;
    reviewedAt: Date | null;
  };
  president: { name: string; title: string; signatureUrl: string | null };
};

function captureIdentity(user: StoredUser): CardIdentitySnapshot {
  return {
    memberName: user.name || "MSAP Member",
    institution: user.institution || "",
    discipline: user.discipline || user.degree || "",
    yearOfStudy: user.yearOfStudy || "",
    localCouncil: user.localCouncil || "",
    graduationYear: user.graduationYear || null,
    photoUrl: user.profilePhotoUrl || "",
  };
}

/**
 * The member's card payload. Once issued, identity fields come from the
 * frozen approved snapshot - never from live, editable profile data. Before
 * first issuance they mirror the registry-synced account so the draft preview
 * is meaningful. Issuance fields only change on National Office approval.
 */
export function buildMemberCard(userId: number): MemberCardData | null {
  const user = getById(userId);
  if (!user) return null;
  const rec = getCardRecord(userId);

  const snapshot = rec.identitySnapshot;
  const live = captureIdentity(user);
  const identity = snapshot ?? live;
  const dataChangedSinceIssuance = Boolean(
    snapshot &&
      (snapshot.memberName !== live.memberName ||
        snapshot.institution !== live.institution ||
        snapshot.discipline !== live.discipline ||
        snapshot.yearOfStudy !== live.yearOfStudy ||
        snapshot.localCouncil !== live.localCouncil ||
        snapshot.graduationYear !== live.graduationYear ||
        snapshot.photoUrl !== live.photoUrl)
  );

  return {
    memberName: identity.memberName,
    membershipId: user.membershipId || "",
    institution: identity.institution,
    discipline: identity.discipline,
    yearOfStudy: identity.yearOfStudy,
    localCouncil: identity.localCouncil,
    graduationYear: identity.graduationYear,
    photoUrl: identity.photoUrl,
    status: user.membershipStatus || "Pending",
    role: user.role || "user",
    issued: Boolean(rec.issuedAt && rec.verificationToken),
    version: rec.version,
    issuedAt: rec.issuedAt,
    expiresAt: rec.expiresAt,
    verificationToken: rec.verificationToken,
    dataChangedSinceIssuance,
    reissueRequested: rec.reissueRequested,
    holderSignature: { ...rec.holderSignature },
    president: {
      name: PRESIDENT_NAME,
      title: PRESIDENT_TITLE,
      signatureUrl: currentPresidentSignatureUrl(),
    },
  };
}

/**
 * Submit (or replace) the holder's hand-drawn signature for approval.
 * Only PNG data URLs up to 400KB are accepted; the card is not re-issued
 * until the National Office approves.
 */
export function submitHolderSignature(
  userId: number,
  dataUrl: string
): MemberCardData | null {
  const user = getById(userId);
  if (!user) return null;
  if (!isValidSignatureDataUrl(dataUrl)) {
    return null;
  }
  const rec = getCardRecord(userId);
  rec.holderSignature = {
    dataUrl,
    status: "pending",
    submittedAt: new Date(),
    reviewedAt: null,
  };
  persistStore();
  return buildMemberCard(userId);
}

/**
 * Shared issuance: bump the version, stamp issue/expiry and mint a fresh HMAC
 * token. Captures the current registry profile as the approved snapshot.
 */
function reissueCard_(user: StoredUser, rec: MemberCardRecord) {
  rec.version += 1;
  rec.issuedAt = new Date();
  const expiryYear = user.graduationYear ?? new Date().getFullYear() + 1;
  rec.expiresAt = new Date(`${expiryYear}-12-31T23:59:59`);
  rec.identitySnapshot = captureIdentity(user);
  rec.verificationToken = issueCardToken(
    user.membershipId || `member-${user.id}`,
    rec.version,
    rec.issuedAt
  );
}

/**
 * National Office review of a pending holder signature or a re-issue request.
 * Approval (re)issues the card: it bumps the version, freezes the current
 * approved identity snapshot and mints a fresh HMAC token.
 *
 * kind "signature": reviews the holder's hand-drawn signature.
 * kind "reissue":   approves/rejects a data-change re-issuance request.
 */
export function reviewCardSignature(
  userId: number,
  decision: "approve" | "reject",
  kind: "signature" | "reissue" = "signature"
): MemberCardData | null {
  const user = getById(userId);
  if (!user) return null;
  const rec = getCardRecord(userId);

  if (kind === "reissue") {
    if (!rec.reissueRequested || !rec.identitySnapshot) return null;
    if (decision === "approve") reissueCard_(user, rec);
    rec.reissueRequested = false;
    persistStore();
    return buildMemberCard(userId);
  }

  if (rec.holderSignature.status !== "pending" || !rec.holderSignature.dataUrl) {
    return null;
  }
  rec.holderSignature.status = decision === "approve" ? "approved" : "rejected";
  rec.holderSignature.reviewedAt = new Date();
  if (decision === "approve") reissueCard_(user, rec);
  persistStore();
  return buildMemberCard(userId);
}

/**
 * Member requests National Office approval to re-issue the card after their
 * registry data changed. Does nothing if no snapshot exists yet or a request
 * is already pending.
 */
export function requestCardReissue(userId: number): MemberCardData | null {
  const user = getById(userId);
  if (!user) return null;
  const rec = getCardRecord(userId);
  if (!rec.identitySnapshot || rec.reissueRequested) {
    return buildMemberCard(userId);
  }
  rec.reissueRequested = true;
  rec.reissueRequestedAt = new Date();
  persistStore();
  return buildMemberCard(userId);
}

export type PendingCardReview =
  | {
      request: "signature";
      userId: number;
      name: string;
      membershipId: string;
      submittedAt: Date | null;
      signaturePreview: string | null;
    }
  | {
      request: "reissue";
      userId: number;
      name: string;
      membershipId: string;
      submittedAt: Date | null;
      signaturePreview: null;
    };

/** Admin queue: holder signatures and data-change re-issues awaiting review. */
export function listPendingCardApprovals(): PendingCardReview[] {
  const entries: PendingCardReview[] = [];
  for (const rec of Array.from(cardsByMember.values())) {
    const user = getById(rec.userId);
    if (rec.holderSignature.status === "pending" && rec.holderSignature.dataUrl) {
      entries.push({
        request: "signature",
        userId: rec.userId,
        name: user?.name || "",
        membershipId: user?.membershipId || "",
        submittedAt: rec.holderSignature.submittedAt,
        signaturePreview: rec.holderSignature.dataUrl,
      });
    }
    if (rec.reissueRequested) {
      entries.push({
        request: "reissue",
        userId: rec.userId,
        name: user?.name || "",
        membershipId: user?.membershipId || "",
        submittedAt: rec.reissueRequestedAt,
        signaturePreview: null,
      });
    }
  }
  return entries.sort(
    (a, b) => (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0)
  );
}

/**
 * One full entry of the card issuance queue, including resolved history so
 * the admin page can show issued/rejected cards, not just pending ones.
 */
export type CardQueueItem =
  | {
      request: "signature";
      userId: number;
      name: string;
      membershipId: string;
      email: string;
      localCouncil: string;
      institution: string;
      submittedAt: Date | null;
      reviewedAt: Date | null;
      status: "pending" | "approved" | "rejected";
      signaturePreview: string | null;
    }
  | {
      request: "reissue";
      userId: number;
      name: string;
      membershipId: string;
      email: string;
      localCouncil: string;
      institution: string;
      submittedAt: Date | null;
      reviewedAt: Date | null;
      status: "pending" | "approved" | "rejected";
      signaturePreview: null;
    };

export type CardQueueFilters = {
  /** "signature" | "reissue" | undefined = all kinds */
  kind?: "signature" | "reissue";
  /** "pending" | "approved" | "rejected" | undefined = all statuses */
  status?: "pending" | "approved" | "rejected";
  /** Free-text search over name, membership ID, institution and council. */
  query?: string;
  /** Case-insensitive substring match on the member's Local Council. */
  localCouncil?: string;
  limit?: number;
};

function cardQueueStatusFor(
  request: "signature" | "reissue",
  rec: MemberCardRecord
): CardQueueItem["status"] {
  if (request === "reissue") {
    // A pending re-issue is a live request; a card that has been issued (an
    // identity snapshot exists) counts as the resolved "approved" history.
    // Rejections are not recorded on the record, so they simply drop out.
    if (rec.reissueRequested) return "pending";
    return rec.identitySnapshot ? "approved" : "pending";
  }
  if (rec.holderSignature.status === "pending") return "pending";
  if (rec.holderSignature.status === "approved") return "approved";
  if (rec.holderSignature.status === "rejected") return "rejected";
  return "pending";
}

/**
 * The full card issuance queue with filters, including resolved history.
 *
 * Unlike `listPendingCardApprovals` (pending-only, used by the dashboard
 * badge), this powers the dedicated admin queue page: it can be narrowed by
 * request kind, review status, free-text search and Local Council, and each
 * item carries the member's profile fields for a denser table.
 */
export function listCardQueue(filters: CardQueueFilters = {}): CardQueueItem[] {
  const kind = filters.kind;
  const status = filters.status;
  const q = filters.query?.trim().toLowerCase() ?? "";
  const lc = filters.localCouncil?.trim().toLowerCase() ?? "";
  const limit = filters.limit ?? 200;

  const entries: CardQueueItem[] = [];
  for (const rec of Array.from(cardsByMember.values())) {
    const user = getById(rec.userId);
    if (!user) continue;

    const hasPendingSignature =
      rec.holderSignature.status === "pending" && rec.holderSignature.dataUrl;
    const hasReissue = rec.reissueRequested;

    // Show a signature row once a signature exists (pending/approved/rejected),
    // and a reissue row while one is pending or after any issuance happened
    // (resolved history). Skip members who never interacted with the card.
    const showSignatureRow = Boolean(rec.holderSignature.dataUrl);
    const showReissueRow = hasReissue || Boolean(rec.identitySnapshot);
    if (!showSignatureRow && !showReissueRow) continue;

    if (showSignatureRow) {
      const item: CardQueueItem = {
        request: "signature",
        userId: user.id,
        name: user.name || "",
        membershipId: user.membershipId || "",
        email: user.email || "",
        localCouncil: user.localCouncil || "",
        institution: user.institution || "",
        submittedAt: rec.holderSignature.submittedAt,
        reviewedAt: rec.holderSignature.reviewedAt,
        status: cardQueueStatusFor("signature", rec),
        signaturePreview: rec.holderSignature.dataUrl,
      };
      if (!status || item.status === status) entries.push(item);
    }

    if (showReissueRow) {
      const item: CardQueueItem = {
        request: "reissue",
        userId: user.id,
        name: user.name || "",
        membershipId: user.membershipId || "",
        email: user.email || "",
        localCouncil: user.localCouncil || "",
        institution: user.institution || "",
        submittedAt: rec.reissueRequestedAt ?? rec.issuedAt,
        reviewedAt: null,
        status: cardQueueStatusFor("reissue", rec),
        signaturePreview: null,
      };
      if (!status || item.status === status) entries.push(item);
    }
  }

  return entries
    .filter((item) => {
      if (kind && item.request !== kind) return false;
      if (q) {
        const haystack = [
          item.name,
          item.membershipId,
          item.email,
          item.institution,
          item.localCouncil,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (lc && !item.localCouncil.toLowerCase().includes(lc)) return false;
      return true;
    })
    .sort(
      (a, b) => (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0)
    )
    .slice(0, limit);
}

/**
 * Public verification for the QR on the card. Recomputes the HMAC and
 * reveals the holder's name only when the token is authentic.
 */
export function verifyCardToken(membershipId: string, token: string) {
  const user = findUserByIdentity(membershipId);
  if (!user) return { valid: false as const };
  const rec = getCardRecord(user.id);
  if (!rec.issuedAt || !rec.verificationToken) return { valid: false as const };
  if (!isCardTokenValid(membershipId, rec.version, rec.issuedAt, token)) {
    return { valid: false as const };
  }
  return {
    valid: true as const,
    name: user.name || "",
    memberId: membershipId,
    version: rec.version,
    issuedAt: rec.issuedAt,
    expiresAt: rec.expiresAt,
  };
}

// ============================================================================
// Member directory (safe public profiles)
// ============================================================================

export type DirectoryMember = {
  id: number;
  name: string | null;
  email: string | null;
  membershipId: string | null;
  degree: string | null;
  discipline: string | null;
  yearOfStudy: string | null;
  institution: string | null;
  localCouncil: string | null;
  membershipStatus: User["membershipStatus"] | null;
  profilePhotoUrl: string | null;
};

function toDirectoryMember(user: StoredUser): DirectoryMember {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    membershipId: user.membershipId,
    degree: user.degree,
    discipline: user.discipline,
    yearOfStudy: user.yearOfStudy,
    institution: user.institution,
    localCouncil: user.localCouncil,
    membershipStatus: user.membershipStatus,
    profilePhotoUrl: user.profilePhotoUrl,
  };
}

/**
 * List portal member accounts for the member directory.
 *
 * Only safe public fields are exposed (never CNIC, hashes, tokens or internal
 * notes). Active members only, sorted by name.
 */
export function listDirectoryMembers(input: {
  query?: string;
  localCouncil?: string;
  limit?: number;
}): DirectoryMember[] {
  const q = input.query?.trim().toLowerCase() ?? "";
  const lc = input.localCouncil?.trim().toLowerCase() ?? "";

  return Array.from(usersById.values())
    .filter((u) => u.membershipStatus === "Active")
    .filter(
      (u) =>
        !q ||
        [
          u.name,
          u.email,
          u.institution,
          u.localCouncil,
          u.membershipId,
          u.discipline,
        ].some((v) => (v ?? "").toLowerCase().includes(q))
    )
    .filter((u) => !lc || (u.localCouncil ?? "").toLowerCase().includes(lc))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
    .slice(0, input.limit ?? 100)
    .map(toDirectoryMember);
}

/** Safe directory profile for a single member. */
export function getDirectoryMember(id: number): DirectoryMember | null {
  // Mirror listDirectoryMembers: only Active members are directory-visible.
  const user = getById(id);
  if (!user || user.membershipStatus !== "Active") return null;
  return toDirectoryMember(user);
}

// ============================================================================
// Disk persistence (issued cards survive server restarts)
// ============================================================================
//
// The in-memory store is snapshotted to a JSON file on every mutation so an
// issued card - and the member account it is keyed on - survive `tsx watch`
// restarts and process crashes. The file is gitignored and its path can be
// overridden with MEMBER_STORE_FILE. Unit tests (NODE_ENV=test) never touch
// the disk, so test suites stay hermetic and order-independent.

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const STORE_FILE =
  process.env.MEMBER_STORE_FILE ||
  path.resolve(MODULE_DIR, "..", "..", ".data", "membership-store.json");

function persistenceEnabled(): boolean {
  return process.env.NODE_ENV !== "test";
}

/** JSON-safe snapshot of everything needed to rebuild the member store. */
export type MemberStoreSnapshot = {
  version: 1;
  savedAt: string;
  nextUserId: number;
  nextDocId: number;
  nextCvEntryId: number;
  presidentSignatureUrl: string | null;
  users: StoredUser[];
  docs: StoredDocument[];
  cvEntries: CvEntry[];
  cards: MemberCardRecord[];
  lifecycleCases: LifecycleCase[];
};

function reviveDocument(raw: StoredDocument): StoredDocument {
  return {
    ...raw,
    generatedAt: reviveDate(raw.generatedAt) ?? new Date(),
    createdAt: reviveDate(raw.createdAt) ?? new Date(),
  };
}

function reviveCvEntry(raw: CvEntry): CvEntry {
  return {
    ...raw,
    startDate: reviveDate(raw.startDate),
    endDate: reviveDate(raw.endDate),
    createdAt: reviveDate(raw.createdAt) ?? new Date(),
  };
}

function reviveLifecycleCase(raw: LifecycleCase): LifecycleCase {
  return {
    ...raw,
    requestedAt: reviveDate(raw.requestedAt) ?? new Date(),
    decidedAt: reviveDate(raw.decidedAt),
    effectiveDate: reviveDate(raw.effectiveDate),
    createdAt: reviveDate(raw.createdAt) ?? new Date(),
    updatedAt: reviveDate(raw.updatedAt) ?? new Date(),
    timeline: (raw.timeline ?? []).map((e) => ({
      ...e,
      at: reviveDate(e.at) ?? new Date(),
    })),
  };
}

/** Capture the current store state (dates stay as Date; stringified later). */
export function snapshotStoreState(): MemberStoreSnapshot {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    nextUserId,
    nextDocId,
    nextCvEntryId,
    presidentSignatureUrl: currentPresidentSignatureUrl(),
    users: Array.from(usersById.values()),
    docs: Array.from(docsByMember.values()).flat(),
    cvEntries: Array.from(cvEntriesByMember.values()).flat(),
    cards: Array.from(cardsByMember.values()),
    lifecycleCases: getAllLifecycleCases(),
  };
}

function reviveDate(value: unknown): Date | null {
  // Disk round-trips give ISO strings; in-memory round trips give Date.
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function reviveUser(raw: StoredUser): StoredUser {
  return {
    ...raw,
    createdAt: reviveDate(raw.createdAt) ?? new Date(),
    updatedAt: reviveDate(raw.updatedAt) ?? new Date(),
    lastSignedIn: reviveDate(raw.lastSignedIn),
    membershipStartDate: reviveDate(raw.membershipStartDate),
    membershipEndDate: reviveDate(raw.membershipEndDate),
    setupTokenExpiresAt: reviveDate(raw.setupTokenExpiresAt),
    setupTokenUsedAt: reviveDate(raw.setupTokenUsedAt),
  };
}

function reviveCard(raw: MemberCardRecord): MemberCardRecord {
  return {
    ...raw,
    holderSignature: {
      ...raw.holderSignature,
      submittedAt: reviveDate(raw.holderSignature?.submittedAt),
      reviewedAt: reviveDate(raw.holderSignature?.reviewedAt),
    },
    issuedAt: reviveDate(raw.issuedAt),
    expiresAt: reviveDate(raw.expiresAt),
    reissueRequestedAt: reviveDate(raw.reissueRequestedAt),
  };
}

/**
 * TEST-ONLY: wipe the in-memory store and counters so unit tests are hermetic
 * and order-independent. Never called outside test suites.
 */
export function resetMemberStoreForTests(): void {
  applyStoreState({
    version: 1,
    savedAt: new Date().toISOString(),
    nextUserId: 1,
    nextDocId: 1,
    nextCvEntryId: 1,
    presidentSignatureUrl: null,
    users: [],
    docs: [],
    cvEntries: [],
    cards: [],
    lifecycleCases: [],
  });
}

/** Wipe the store and rebuild it from a snapshot (used at boot and in tests). */
export function applyStoreState(snapshot: MemberStoreSnapshot): void {
  usersById.clear();
  openIdIndex.clear();
  membershipIdIndex.clear();
  emailIndex.clear();
  setupTokenIndex.clear();
  docsByMember.clear();
  cvEntriesByMember.clear();
  cardsByMember.clear();
  lifecycleCasesById.clear();

  nextUserId = snapshot.nextUserId || 1;
  nextDocId = snapshot.nextDocId || 1;
  nextCvEntryId = snapshot.nextCvEntryId || 1;
  nextCaseId = 1;

  for (const user of snapshot.users ?? []) {
    indexUser(reviveUser(user));
    nextUserId = Math.max(nextUserId, user.id + 1);
  }
  for (const doc of snapshot.docs ?? []) {
    const list = docsByMember.get(doc.memberId) ?? [];
    list.push(reviveDocument(doc));
    docsByMember.set(doc.memberId, list);
  }
  for (const entry of snapshot.cvEntries ?? []) {
    const list = cvEntriesByMember.get(entry.memberId) ?? [];
    list.push(reviveCvEntry(entry));
    cvEntriesByMember.set(entry.memberId, list);
  }

  for (const card of snapshot.cards ?? []) {
    cardsByMember.set(card.userId, reviveCard(card));
  }
  for (const lifecycleCase of snapshot.lifecycleCases ?? []) {
    lifecycleCasesById.set(lifecycleCase.id, reviveLifecycleCase(lifecycleCase));
    nextCaseId = Math.max(nextCaseId, lifecycleCase.id + 1);
  }
  // Env fallback for the president signature stays alive: a persisted value
  // only overrides when it is explicitly set (non-null), so ops can still
  // seed PRESIDENT_SIGNATURE_URL even after a store file exists.
  if (
    Object.prototype.hasOwnProperty.call(snapshot, "presidentSignatureUrl") &&
    snapshot.presidentSignatureUrl
  ) {
    presidentSignatureUrl = snapshot.presidentSignatureUrl;
  }
}

// Coalesce disk writes: a burst of mutations (e.g. login reconciliation =
// upsertUser + issueSetupToken + recordLastSignIn) settles into ONE write per
// event-loop tick, instead of three blocking sync writes per request.
let persistQueued = false;
let persistDirty = false;
let persistWarned = false;

function flushStore(): void {
  persistQueued = false;
  if (!persistDirty) return;
  persistDirty = false;
  try {
    const dir = path.dirname(STORE_FILE);
    fs.mkdirSync(dir, { recursive: true });
    const snapshot = snapshotStoreState();
    const tmp = `${STORE_FILE}.tmp`;
    // 0o600: the file holds credential material (password/token digests).
    fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, STORE_FILE);
    persistWarned = false;
  } catch (error) {
    console.error("[MemberStore] Failed to persist store:", error);
    if (!persistWarned) {
      persistWarned = true;
      console.warn(
        "[MemberStore] The membership store is NOT being persisted - issued cards will be lost on the next restart. Check MEMBER_STORE_FILE and disk permissions."
      );
    }
  }
}

/**
 * Queue a disk write for the current store state (best effort; never throws).
 * Coalesced to one write per tick; the store is also flushed on any later
 * mutation, so a crash between writes only loses the very last mutation.
 */
export function persistStore(): void {
  if (!persistenceEnabled()) return;
  persistDirty = true;
  if (persistQueued) return;
  persistQueued = true;
  setImmediate(flushStore);
}

/** Restore the store from disk at boot (no-op when absent or corrupt). */
export function restoreStoreFromDisk(): void {
  if (!persistenceEnabled()) return;
  let raw: string;
  try {
    raw = fs.readFileSync(STORE_FILE, "utf8");
  } catch {
    return; // no snapshot yet
  }
  try {
    const parsed = JSON.parse(raw) as MemberStoreSnapshot;
    if (parsed.version !== 1) return;
    applyStoreState(parsed);
    console.log(
      `[MemberStore] Restored ${parsed.users?.length ?? 0} member(s) and ${parsed.cards?.length ?? 0} card record(s) from ${STORE_FILE}`
    );
  } catch (error) {
    console.error("[MemberStore] Failed to restore snapshot; starting empty:", error);
  }
}

// Restore at module load (skipped under NODE_ENV=test), then apply the
// SUPER_ADMIN_EMAIL bootstrap so ops can designate the first super admin.
restoreStoreFromDisk();
ensureBootstrapSuperAdmin();

// Flush any pending write before the process exits, so the last mutation is
// not lost on a graceful shutdown/restart (e.g. `tsx watch` restart).
process.on("beforeExit", () => {
  if (persistQueued || persistDirty) flushStore();
});

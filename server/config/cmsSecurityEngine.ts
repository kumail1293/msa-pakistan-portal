/**
 * CMS Security Engine
 *
 * Enterprise-grade security: authentication, RBAC, CSRF protection,
 * XSS prevention, rate limiting, IP blocking, audit logging, CSP headers.
 *
 * Architecture:
 * - Role-Based Access Control (RBAC) with granular permissions
 * - Rate limiting per IP and per user
 * - IP blacklist/whitelist
 * - Full audit trail for all CMS operations
 * - Content Security Policy headers
 * - Input sanitization
 */

import crypto from "crypto";

// ============================================================================
// TYPES
// ============================================================================

export type CMSRole =
  | "super_admin"      // Full access to everything
  | "portal_admin"     // Portal super admin (member portal)
  | "cms_admin"        // CMS content admin
  | "business_admin"   // Business/SaaS admin
  | "editor"           // Content editor (create/edit/publish)
  | "author"           // Can create and edit own posts
  | "contributor"      // Can create but not publish
  | "subscriber"       // Can read and comment
  | "viewer"           // Read-only access
  | "custom";          // Custom role with specific permissions

export type CMSPermission =
  | "cms.read"
  | "cms.pages.create"
  | "cms.pages.edit"
  | "cms.pages.delete"
  | "cms.pages.publish"
  | "cms.pages.manage"      // Edit any page
  | "cms.posts.create"
  | "cms.posts.edit"
  | "cms.posts.delete"
  | "cms.posts.publish"
  | "cms.media.upload"
  | "cms.media.delete"
  | "cms.media.manage"
  | "cms.menus.edit"
  | "cms.widgets.edit"
  | "cms.themes.install"
  | "cms.themes.activate"
  | "cms.themes.customize"
  | "cms.plugins.install"
  | "cms.plugins.activate"
  | "cms.plugins.manage"
  | "cms.forms.create"
  | "cms.forms.edit"
  | "cms.forms.view_submissions"
  | "cms.seo.edit"
  | "cms.redirects.manage"
  | "cms.post_types.manage"
  | "cms.taxonomies.manage"
  | "cms.users.view"
  | "cms.users.edit"
  | "cms.users.delete"
  | "cms.users.assign_roles"
  | "cms.settings.read"
  | "cms.settings.write"
  | "cms.audit.view"
  | "cms.security.manage"
  | "portal.admin"
  | "portal.members"
  | "portal.elections"
  | "portal.governance"
  | "portal.finance"
  | "business.admin"
  | "business.billing"
  | "business.analytics"
  | "business.integrations";

export interface CMSUser {
  id: string;
  email: string;
  name: string;
  roles: CMSRole[];
  customPermissions: CMSPermission[];
  isSuperAdmin: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface AuditEntry {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface RateLimitEntry {
  count: number;
  resetAt: Date;
}

export interface SecurityConfig {
  maxLoginAttempts: number;
  lockoutDuration: number; // ms
  rateLimitWindow: number; // ms
  rateLimitMax: number;
  csrfTokenExpiry: number; // ms
  sessionTimeout: number; // ms
  minPasswordLength: number;
  requireMFA: boolean;
  ipWhitelist: string[];
  ipBlacklist: string[];
  csp: string;
}

// ============================================================================
// ROLE → PERMISSIONS MAPPING
// ============================================================================

const ROLE_PERMISSIONS: Record<CMSRole, CMSPermission[]> = {
  super_admin: ["*"] as unknown as CMSPermission[], // All permissions
  portal_admin: [
    "portal.admin", "portal.members", "portal.elections",
    "portal.governance", "portal.finance", "cms.read",
    "cms.users.view", "cms.users.edit", "cms.audit.view",
  ],
  cms_admin: [
    "cms.read", "cms.pages.create", "cms.pages.edit", "cms.pages.delete",
    "cms.pages.publish", "cms.pages.manage", "cms.posts.create", "cms.posts.edit",
    "cms.posts.delete", "cms.posts.publish", "cms.media.upload", "cms.media.delete",
    "cms.media.manage", "cms.menus.edit", "cms.widgets.edit", "cms.themes.install",
    "cms.themes.activate", "cms.themes.customize", "cms.plugins.install",
    "cms.plugins.activate", "cms.plugins.manage", "cms.forms.create", "cms.forms.edit",
    "cms.forms.view_submissions", "cms.seo.edit", "cms.redirects.manage",
    "cms.post_types.manage", "cms.taxonomies.manage", "cms.users.view",
    "cms.settings.read", "cms.settings.write", "cms.audit.view",
  ],
  business_admin: [
    "business.admin", "business.billing", "business.analytics",
    "business.integrations", "cms.read", "cms.audit.view",
  ],
  editor: [
    "cms.read", "cms.pages.create", "cms.pages.edit", "cms.pages.publish",
    "cms.posts.create", "cms.posts.edit", "cms.posts.publish",
    "cms.media.upload", "cms.forms.create",
  ],
  author: [
    "cms.read", "cms.posts.create", "cms.posts.edit",
    "cms.media.upload",
  ],
  contributor: [
    "cms.read", "cms.posts.create",
  ],
  subscriber: [
    "cms.read",
  ],
  viewer: [
    "cms.read",
  ],
  custom: [],
};

// ============================================================================
// SECURITY ENGINE
// ============================================================================

class CMSSecurityEngine {
  private config: SecurityConfig = {
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    rateLimitWindow: 60 * 1000, // 1 minute
    rateLimitMax: 60,
    csrfTokenExpiry: 30 * 60 * 1000, // 30 minutes
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    minPasswordLength: 8,
    requireMFA: false,
    ipWhitelist: [],
    ipBlacklist: [],
    csp: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self';",
  };

  private users: Map<string, CMSUser> = new Map();
  private sessions: Map<string, { userId: string; createdAt: Date; expiresAt: Date; ip: string }> = new Map();
  private csrfTokens: Map<string, { token: string; userId: string; expiresAt: Date }> = new Map();
  private rateLimits: Map<string, RateLimitEntry> = new Map();
  private loginAttempts: Map<string, { count: number; lockedUntil: Date | null }> = new Map();
  private auditLog: AuditEntry[] = [];

  constructor() {
    this.seedDefaults();
  }

  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================

  createUser(email: string, name: string, roles: CMSRole[], isSuperAdmin = false): CMSUser {
    const id = crypto.randomUUID();
    const user: CMSUser = {
      id,
      email,
      name,
      roles,
      customPermissions: [],
      isSuperAdmin,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  getUser(id: string): CMSUser | null {
    return this.users.get(id) || null;
  }

  getUserByEmail(email: string): CMSUser | null {
    for (const user of Array.from(this.users.values())) {
      if (user.email === email) return user;
    }
    return null;
  }

  listUsers(): CMSUser[] {
    return Array.from(this.users.values());
  }

  updateUser(id: string, data: Partial<CMSUser>): CMSUser | null {
    const user = this.users.get(id);
    if (!user) return null;
    const updated = { ...user, ...data };
    this.users.set(id, updated);
    return updated;
  }

  deleteUser(id: string): boolean {
    return this.users.delete(id);
  }

  /** Create a session for a user */
  createSession(userId: string, ip: string): string {
    const token = crypto.randomBytes(32).toString("hex");
    const now = new Date();
    this.sessions.set(token, {
      userId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.sessionTimeout),
      ip,
    });
    return token;
  }

  /** Validate a session */
  validateSession(token: string): CMSUser | null {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      this.sessions.delete(token);
      return null;
    }
    return this.users.get(session.userId) || null;
  }

  /** Destroy a session */
  destroySession(token: string): void {
    this.sessions.delete(token);
  }

  // ==========================================================================
  // AUTHORIZATION
  // ==========================================================================

  /** Check if user has a specific permission */
  hasPermission(userId: string, permission: CMSPermission): boolean {
    const user = this.users.get(userId);
    if (!user || !user.isActive) return false;

    // Super admin has all permissions
    if (user.isSuperAdmin) return true;

    // Check role permissions
    for (const role of user.roles) {
      const perms = ROLE_PERMISSIONS[role] || [];
      if (perms.includes("*" as CMSPermission)) return true;
      if (perms.includes(permission)) return true;
    }

    // Check custom permissions
    if (user.customPermissions.includes(permission)) return true;

    return false;
  }

  /** Check if user has any of the given permissions */
  hasAnyPermission(userId: string, permissions: CMSPermission[]): boolean {
    return permissions.some((p) => this.hasPermission(userId, p));
  }

  /** Require a permission — throws if not authorized */
  requirePermission(userId: string, permission: CMSPermission): void {
    if (!this.hasPermission(userId, permission)) {
      throw new Error(`Unauthorized: requires "${permission}"`);
    }
  }

  /** Assign a role to a user */
  assignRole(userId: string, role: CMSRole): CMSUser | null {
    const user = this.users.get(userId);
    if (!user) return null;
    if (!user.roles.includes(role)) {
      user.roles.push(role);
    }
    return user;
  }

  /** Remove a role from a user */
  removeRole(userId: string, role: CMSRole): CMSUser | null {
    const user = this.users.get(userId);
    if (!user) return null;
    user.roles = user.roles.filter((r) => r !== role);
    return user;
  }

  /** Add a custom permission */
  grantPermission(userId: string, permission: CMSPermission): CMSUser | null {
    const user = this.users.get(userId);
    if (!user) return null;
    if (!user.customPermissions.includes(permission)) {
      user.customPermissions.push(permission);
    }
    return user;
  }

  /** Get all permissions for a user */
  getEffectivePermissions(userId: string): CMSPermission[] {
    const user = this.users.get(userId);
    if (!user) return [];

    if (user.isSuperAdmin) return ["*"] as unknown as CMSPermission[];

    const perms = new Set<CMSPermission>();
    for (const role of user.roles) {
      const rolePerms = ROLE_PERMISSIONS[role] || [];
      for (const p of rolePerms) perms.add(p);
    }
    for (const p of user.customPermissions) perms.add(p);
    return Array.from(perms);
  }

  // ==========================================================================
  // CSRF PROTECTION
  // ==========================================================================

  generateCsrfToken(userId: string): string {
    const token = crypto.randomBytes(32).toString("hex");
    this.csrfTokens.set(token, {
      token,
      userId,
      expiresAt: new Date(Date.now() + this.config.csrfTokenExpiry),
    });
    return token;
  }

  validateCsrfToken(token: string, userId: string): boolean {
    const entry = this.csrfTokens.get(token);
    if (!entry) return false;
    if (entry.expiresAt < new Date()) {
      this.csrfTokens.delete(token);
      return false;
    }
    return entry.userId === userId;
  }

  // ==========================================================================
  // RATE LIMITING
  // ==========================================================================

  checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetAt: Date } {
    const now = new Date();
    const entry = this.rateLimits.get(identifier);

    if (!entry || now > entry.resetAt) {
      this.rateLimits.set(identifier, {
        count: 1,
        resetAt: new Date(now.getTime() + this.config.rateLimitWindow),
      });
      return { allowed: true, remaining: this.config.rateLimitMax - 1, resetAt: new Date(now.getTime() + this.config.rateLimitWindow) };
    }

    entry.count++;
    if (entry.count > this.config.rateLimitMax) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    return { allowed: true, remaining: this.config.rateLimitMax - entry.count, resetAt: entry.resetAt };
  }

  // ==========================================================================
  // LOGIN ATTEMPTS
  // ==========================================================================

  recordLoginAttempt(email: string, success: boolean): { locked: boolean; attemptsRemaining: number } {
    const entry = this.loginAttempts.get(email) || { count: 0, lockedUntil: null };

    if (success) {
      this.loginAttempts.delete(email);
      return { locked: false, attemptsRemaining: this.config.maxLoginAttempts };
    }

    entry.count++;

    if (entry.count >= this.config.maxLoginAttempts) {
      entry.lockedUntil = new Date(Date.now() + this.config.lockoutDuration);
      this.loginAttempts.set(email, entry);
      return { locked: true, attemptsRemaining: 0 };
    }

    this.loginAttempts.set(email, entry);
    return { locked: false, attemptsRemaining: this.config.maxLoginAttempts - entry.count };
  }

  isLocked(email: string): boolean {
    const entry = this.loginAttempts.get(email);
    if (!entry || !entry.lockedUntil) return false;
    if (new Date() > entry.lockedUntil) {
      this.loginAttempts.delete(email);
      return false;
    }
    return true;
  }

  // ==========================================================================
  // IP BLOCKING
  // ==========================================================================

  isIpBlocked(ip: string): boolean {
    if (this.config.ipBlacklist.length > 0) {
      return this.config.ipBlacklist.includes(ip);
    }
    if (this.config.ipWhitelist.length > 0) {
      return !this.config.ipWhitelist.includes(ip);
    }
    return false;
  }

  blockIp(ip: string): void {
    if (!this.config.ipBlacklist.includes(ip)) {
      this.config.ipBlacklist.push(ip);
    }
  }

  unblockIp(ip: string): void {
    this.config.ipBlacklist = this.config.ipBlacklist.filter((i) => i !== ip);
  }

  // ==========================================================================
  // INPUT SANITIZATION
  // ==========================================================================

  /** Strip HTML tags */
  stripTags(input: string): string {
    return input.replace(/<[^>]*>/g, "");
  }

  /** Sanitize text — remove dangerous chars */
  sanitizeText(input: string): string {
    return input
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/\//g, "&#x2F;");
  }

  /** Sanitize a slug */
  sanitizeSlug(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  /** Validate email */
  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /** Validate URL */
  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /** Generate a secure random token */
  generateToken(length = 32): string {
    return crypto.randomBytes(length).toString("hex");
  }

  /** Hash a password (simplified — use bcrypt in production) */
  hashPassword(password: string): string {
    return crypto.createHash("sha256").update(password + "msap_salt_2026").digest("hex");
  }

  /** Verify password */
  verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }

  // ==========================================================================
  // AUDIT LOGGING
  // ==========================================================================

  logAudit(entry: Omit<AuditEntry, "id" | "timestamp">): void {
    this.auditLog.push({
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    });
    // Keep last 10,000 entries
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-10000);
    }
  }

  getAuditLog(filters?: { userId?: string; entityType?: string; entityId?: string; since?: Date; limit?: number }): AuditEntry[] {
    let result = [...this.auditLog];

    if (filters?.userId) result = result.filter((e) => e.userId === filters.userId);
    if (filters?.entityType) result = result.filter((e) => e.entityType === filters.entityType);
    if (filters?.entityId) result = result.filter((e) => e.entityId === filters.entityId);
    if (filters?.since) result = result.filter((e) => e.timestamp >= filters.since!);

    result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters?.limit) result = result.slice(0, filters.limit);

    return result;
  }

  // ==========================================================================
  // SECURITY HEADERS
  // ==========================================================================

  getSecurityHeaders(): Record<string, string> {
    return {
      "Content-Security-Policy": this.config.csp,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    };
  }

  // ==========================================================================
  // CONFIG
  // ==========================================================================

  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  // ==========================================================================
  // STATS
  // ==========================================================================

  getStats(): {
    users: number;
    activeSessions: number;
    auditEntries: number;
    blockedIps: number;
    lockedAccounts: number;
    rateLimited: number;
  } {
    const now = new Date();
    return {
      users: this.users.size,
      activeSessions: Array.from(this.sessions.values()).filter((s) => s.expiresAt > now).length,
      auditEntries: this.auditLog.length,
      blockedIps: this.config.ipBlacklist.length,
      lockedAccounts: Array.from(this.loginAttempts.values()).filter((e) => e.lockedUntil && e.lockedUntil > now).length,
      rateLimited: Array.from(this.rateLimits.entries()).filter(([, e]) => e.count > this.config.rateLimitMax).length,
    };
  }

  // ==========================================================================
  // SEED
  // ==========================================================================

  private seedDefaults(): void {
    // Default super admin
    this.createUser("admin@msapakistan.org", "MSAP Super Admin", ["super_admin", "cms_admin", "portal_admin", "business_admin"], true);
    this.createUser("editor@msapakistan.org", "CMS Editor", ["editor"]);
    this.createUser("portal@msapakistan.org", "Portal Admin", ["portal_admin"]);
    this.createUser("business@msapakistan.org", "Business Admin", ["business_admin"]);
  }
}

export const cmsSecurity = new CMSSecurityEngine();

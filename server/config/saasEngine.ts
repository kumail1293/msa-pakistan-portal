/**
 * SaaS Engine — Multi-tenant organization management
 *
 * WordPress-like onboarding: sign up → configure → go live.
 * Organization subscription, billing, plan management, and usage tracking.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  organizations,
  subscriptionPlans,
  invoices,
  onboardingSteps,
  organizationAdmins,
  usageMetrics,
} from "../../drizzle/schema.saas";

// ============================================================================
// Default subscription plans
// ============================================================================

const DEFAULT_PLANS = [
  {
    name: "Starter",
    slug: "starter",
    description: "For small local councils with up to 100 members",
    priceMonthly: "0",
    priceYearly: "0",
    maxMembers: 100,
    maxStorage: 512,
    maxApiCalls: 5000,
    features: ["Members", "Basic Governance", "Events", "Documents", "Email Support"],
    modules: ["members", "governance", "events", "documents"],
    isPopular: false,
    sortOrder: 0,
  },
  {
    name: "Professional",
    slug: "professional",
    description: "For national organizations with full governance features",
    priceMonthly: "15000",
    priceYearly: "150000",
    maxMembers: 5000,
    maxStorage: 5120,
    maxApiCalls: 100000,
    features: [
      "Unlimited Members", "Full Governance Engine", "Elections", "Plenary",
      "Finance", "Analytics", "API Access", "Priority Support", "Custom Branding",
    ],
    modules: [
      "members", "governance", "events", "documents", "elections", "plenary",
      "finance", "analytics", "communications", "activities", "projects",
    ],
    isPopular: true,
    sortOrder: 1,
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    description: "For large federations with unlimited everything",
    priceMonthly: "45000",
    priceYearly: "450000",
    maxMembers: 100000,
    maxStorage: 51200,
    maxApiCalls: 1000000,
    features: [
      "Everything in Professional", "Multi-tenant", "White-label",
      "Custom Integrations", "Dedicated Support", "SLA 99.9%",
      "Advanced Security", "Custom Modules", "Training & Onboarding",
    ],
    modules: [
      "members", "governance", "events", "documents", "elections", "plenary",
      "finance", "analytics", "communications", "activities", "projects",
      "training", "recognition", "volunteers", "applications", "meetings",
      "import_export", "api_platform", "integrations",
    ],
    isPopular: false,
    sortOrder: 2,
  },
];

// ============================================================================
// Organization Management
// ============================================================================

export const saasEngine = {
  /** Seed default plans */
  seedPlans: async (): Promise<void> => {
    const db = getDb();
    if (!db) return;
    try {
      for (const plan of DEFAULT_PLANS) {
        const [existing] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.slug, plan.slug)).limit(1);
        if (!existing) {
          await db.insert(subscriptionPlans).values(plan as any);
        }
      }
    } catch { /* already seeded */ }
  },

  /** Create a new organization */
  createOrganization: async (input: {
    name: string;
    slug: string;
    contactEmail: string;
    contactPhone?: string;
    website?: string;
    country?: string;
    tagline?: string;
    planSlug?: string;
    ownerId?: number;
  }): Promise<{ id: number; slug: string } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      // Get plan
      const planSlug = input.planSlug ?? "starter";
      const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.slug, planSlug)).limit(1);

      const trialEnds = new Date();
      trialEnds.setDate(trialEnds.getDate() + 14); // 14-day trial

      const [result] = await db.insert(organizations).values({
        name: input.name,
        slug: input.slug,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        website: input.website,
        country: input.country ?? "Pakistan",
        tagline: input.tagline,
        planId: plan?.id,
        status: "trialing" as any,
        trialEndsAt: trialEnds,
      });

      const orgId = Number((result as any)[0].insertId);

      // Create onboarding steps
      const steps = ["organization_info", "branding", "modules", "invite_admins", "configure_governance", "launch"];
      for (const step of steps) {
        await db.insert(onboardingSteps).values({ organizationId: orgId, step } as any);
      }

      // Add owner as admin
      if (input.ownerId) {
        await db.insert(organizationAdmins).values({
          organizationId: orgId,
          userId: input.ownerId,
          role: "owner" as any,
          status: "active" as any,
          acceptedAt: new Date(),
        });
      }

      return { id: orgId, slug: input.slug };
    } catch { return null; }
  },

  /** Get organization by slug */
  getBySlug: async (slug: string): Promise<any | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
      return org ?? null;
    } catch { return null; }
  },

  /** Get organization by ID */
  getById: async (id: number): Promise<any | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
      return org ?? null;
    } catch { return null; }
  },

  /** List all organizations */
  list: async (options: { status?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.status) conditions.push(eq(organizations.status, options.status as any));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(organizations).where(where).orderBy(desc(organizations.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  /** Update organization settings */
  updateOrganization: async (id: number, updates: Record<string, any>): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(organizations).set({ ...updates, updatedAt: new Date() }).where(eq(organizations.id, id));
      return true;
    } catch { return false; }
  },

  // ============================================================================
  // Subscription Plans
  // ============================================================================

  /** Get all plans */
  getPlans: async (): Promise<any[]> => {
    const db = getDb();
    if (!db) return DEFAULT_PLANS;
    try {
      return db.select().from(subscriptionPlans).where(eq(subscriptionPlans.status, "active" as any)).orderBy(subscriptionPlans.sortOrder);
    } catch { return DEFAULT_PLANS; }
  },

  /** Get plan by slug */
  getPlan: async (slug: string): Promise<any | null> => {
    const db = getDb();
    if (!db) return DEFAULT_PLANS.find(p => p.slug === slug) ?? null;
    try {
      const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.slug, slug)).limit(1);
      return plan ?? null;
    } catch { return null; }
  },

  /** Change organization plan */
  changePlan: async (organizationId: number, planSlug: string): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.slug, planSlug)).limit(1);
      if (!plan) return false;
      await db.update(organizations).set({ planId: plan.id, updatedAt: new Date() }).where(eq(organizations.id, organizationId));
      return true;
    } catch { return false; }
  },

  // ============================================================================
  // Onboarding Wizard
  // ============================================================================

  /** Get onboarding progress for an org */
  getOnboardingProgress: async (organizationId: number): Promise<{ total: number; completed: number; steps: any[] }> => {
    const db = getDb();
    if (!db) return { total: 6, completed: 0, steps: [] };
    try {
      const steps = await db.select().from(onboardingSteps)
        .where(eq(onboardingSteps.organizationId, organizationId))
        .orderBy(onboardingSteps.createdAt);
      const completedCount = steps.filter(s => s.status === "completed").length;
      return { total: steps.length, completed: completedCount, steps };
    } catch { return { total: 6, completed: 0, steps: [] }; }
  },

  /** Complete an onboarding step */
  completeStep: async (organizationId: number, step: string, data?: Record<string, any>): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      const [existing] = await db.select().from(onboardingSteps)
        .where(and(eq(onboardingSteps.organizationId, organizationId), eq(onboardingSteps.step, step)))
        .limit(1);
      if (existing) {
        await db.update(onboardingSteps).set({
          status: "completed" as any, data, completedAt: new Date(),
        }).where(eq(onboardingSteps.id, existing.id));
      }
      return true;
    } catch { return false; }
  },

  /** Check if onboarding is complete */
  isOnboardingComplete: async (organizationId: number): Promise<boolean> => {
    const progress = await saasEngine.getOnboardingProgress(organizationId);
    return progress.total > 0 && progress.completed >= progress.total;
  },

  // ============================================================================
  // Billing
  // ============================================================================

  /** Create an invoice */
  createInvoice: async (input: {
    organizationId: number;
    amount: number;
    currency?: string;
    description?: string;
    periodStart?: Date;
    periodEnd?: Date;
    dueDate?: Date;
  }): Promise<{ id: number; invoiceNumber: string } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
      const [result] = await db.insert(invoices).values({
        organizationId: input.organizationId,
        invoiceNumber,
        amount: String(input.amount),
        currency: input.currency ?? "PKR",
        description: input.description,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        dueDate: input.dueDate,
      });
      return { id: Number((result as any)[0].insertId), invoiceNumber };
    } catch { return null; }
  },

  /** List invoices for an org */
  listInvoices: async (organizationId: number): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      return db.select().from(invoices)
        .where(eq(invoices.organizationId, organizationId))
        .orderBy(desc(invoices.createdAt));
    } catch { return []; }
  },

  // ============================================================================
  // Usage Metrics
  // ============================================================================

  /** Record usage metrics */
  recordUsage: async (organizationId: number, period: string, metrics: {
    activeMembers?: number;
    totalMembers?: number;
    storageUsed?: number;
    apiCalls?: number;
    documentsCreated?: number;
    eventsCreated?: number;
    activitiesCreated?: number;
  }): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      const [existing] = await db.select().from(usageMetrics)
        .where(and(eq(usageMetrics.organizationId, organizationId), eq(usageMetrics.period, period)))
        .limit(1);
      if (existing) {
        await db.update(usageMetrics).set(metrics).where(eq(usageMetrics.id, existing.id));
      } else {
        await db.insert(usageMetrics).values({ organizationId, period, ...metrics } as any);
      }
      return true;
    } catch { return false; }
  },

  /** Get usage for an org */
  getUsage: async (organizationId: number): Promise<any | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
      const [usage] = await db.select().from(usageMetrics)
        .where(and(eq(usageMetrics.organizationId, organizationId), eq(usageMetrics.period, currentPeriod)))
        .limit(1);
      return usage ?? null;
    } catch { return null; }
  },

  // ============================================================================
  // Dashboard Stats
  // ============================================================================

  /** Get platform-level stats */
  getPlatformStats: async (): Promise<{
    totalOrgs: number;
    activeOrgs: number;
    trialOrgs: number;
    totalMembers: number;
    planBreakdown: Record<string, number>;
  }> => {
    const db = getDb();
    if (!db) return { totalOrgs: 0, activeOrgs: 0, trialOrgs: 0, totalMembers: 0, planBreakdown: {} };
    try {
      const allOrgs = await db.select().from(organizations);
      const totalMembers = allOrgs.reduce((sum, o) => sum + (o.memberCount ?? 0), 0);
      return {
        totalOrgs: allOrgs.length,
        activeOrgs: allOrgs.filter(o => o.status === "active").length,
        trialOrgs: allOrgs.filter(o => o.status === "trialing").length,
        totalMembers,
        planBreakdown: {}, // Would join with plans table
      };
    } catch {
      return { totalOrgs: 0, activeOrgs: 0, trialOrgs: 0, totalMembers: 0, planBreakdown: {} };
    }
  },
};

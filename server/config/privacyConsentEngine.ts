/**
 * Privacy Controls (§19) + Consent Management (§20)
 *
 * Member privacy settings, consent tracking, data retention,
 * and consent audit trail.
 */

import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { privacySettings, consentRecords } from "../../drizzle/schema.membership";

export const privacyEngine = {
  /** Get privacy settings for a user */
  getSettings: async (userId: number): Promise<any> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [settings] = await db.select().from(privacySettings).where(eq(privacySettings.userId, userId)).limit(1);
      return settings ?? {
        profileVisibility: "members_only",
        showEmail: false, showPhone: false, showInstitution: true,
        showChapter: true, showActivityHistory: true, showSkills: true,
        allowDirectorySearch: true, allowContactFromMembers: true,
        allowContactFromLeadership: true, showInPublicVerification: true,
        dataRetentionConsent: true, marketingConsent: false, analyticsConsent: false,
      };
    } catch { return null; }
  },

  /** Update privacy settings */
  updateSettings: async (userId: number, updates: Record<string, any>): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      const [existing] = await db.select().from(privacySettings).where(eq(privacySettings.userId, userId)).limit(1);
      if (existing) {
        await db.update(privacySettings).set({ ...updates, updatedAt: new Date() }).where(eq(privacySettings.userId, userId));
      } else {
        await db.insert(privacySettings).values({ userId, ...updates });
      }
      return true;
    } catch { return false; }
  },

  /** Check if a field is visible based on privacy settings */
  isFieldVisible: (settings: any, field: string, viewerType: string = "member"): boolean => {
    if (settings.profileVisibility === "private") return false;
    if (settings.profileVisibility === "leadership_only" && viewerType !== "leadership") return false;
    switch (field) {
      case "email": return settings.showEmail;
      case "phone": return settings.showPhone;
      case "institution": return settings.showInstitution;
      case "chapter": return settings.showChapter;
      case "activityHistory": return settings.showActivityHistory;
      case "skills": return settings.showSkills;
      default: return true;
    }
  },
};

/** Consent Management Engine (§20) */
export const consentEngine = {
  /** Record a consent decision */
  recordConsent: async (input: {
    userId: number; consentType: string; granted: boolean;
    version?: string; policyUrl?: string; ipAddress?: string; userAgent?: string;
  }): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      // Check for existing consent of same type
      const [existing] = await db.select().from(consentRecords)
        .where(and(eq(consentRecords.userId, input.userId), eq(consentRecords.consentType, input.consentType)))
        .orderBy(consentRecords.createdAt).limit(1);

      // If granting and there's an existing granted consent, revoke it first
      if (existing && existing.granted && !input.granted) {
        await db.update(consentRecords).set({ revokedAt: new Date() }).where(eq(consentRecords.id, existing.id));
      }

      await db.insert(consentRecords).values({
        userId: input.userId,
        consentType: input.consentType,
        granted: input.granted,
        version: input.version,
        policyUrl: input.policyUrl,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
      return true;
    } catch { return false; }
  },

  /** Get current consent status for a user */
  getConsentStatus: async (userId: number): Promise<Record<string, boolean>> => {
    const db = getDb();
    if (!db) return {};
    try {
      const records = await db.select().from(consentRecords).where(eq(consentRecords.userId, userId));
      const status: Record<string, boolean> = {};
      // Latest consent for each type (not revoked)
      for (const r of records) {
        if (!r.revokedAt) {
          status[r.consentType] = r.granted;
        }
      }
      return status;
    } catch { return {}; }
  },

  /** Get consent history for audit */
  getConsentHistory: async (userId: number): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const { desc: descOrder } = await import("drizzle-orm");
      return db.select().from(consentRecords).where(eq(consentRecords.userId, userId)).orderBy(descOrder(consentRecords.createdAt));
    } catch { return []; }
  },

  /** Check if user has granted a specific consent */
  hasConsent: async (userId: number, consentType: string): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      const [latest] = await db.select().from(consentRecords)
        .where(and(eq(consentRecords.userId, userId), eq(consentRecords.consentType, consentType)))
        .limit(1);
      return latest?.granted ?? false;
    } catch { return false; }
  },
};

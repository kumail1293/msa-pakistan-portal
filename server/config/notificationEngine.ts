/**
 * Notification Engine
 *
 * Handles email, push, in-app, and SMS notifications with templates,
 * queue management, and user preferences.
 *
 * Usage:
 *   import { sendNotification, getNotifications, markAsRead } from "./notificationEngine";
 *
 *   await sendNotification({
 *     templateKey: "election.voting_reminder",
 *     recipientId: userId,
 *     data: { electionTitle: "Presidential Election", deadline: "March 8" },
 *   });
 *
 *   const notifications = await getNotifications(userId);
 */

import { eq, and, desc, sql } from "drizzle-orm";
import {
  notificationTemplates,
  notificationQueue,
  notificationPreferences,
  inAppNotifications,
} from "../../drizzle/schema.notifications";
import { getDb } from "../db";
import { logAuditEvent } from "./auditService";

// ============================================================================
// Types
// ============================================================================

export interface SendNotificationInput {
  templateKey: string;
  recipientId?: number;
  recipientEmail?: string;
  recipientPhone?: string;
  data?: Record<string, unknown>;
  type?: "email" | "push" | "in_app" | "sms";
  priority?: "low" | "normal" | "high" | "urgent";
  scheduledFor?: Date;
  metadata?: Record<string, unknown>;
}

export interface NotificationFilters {
  userId?: number;
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Template Management
// ============================================================================

/**
 * Create or update a notification template.
 */
export async function upsertTemplate(
  key: string,
  name: string,
  type: "email" | "push" | "in_app" | "sms",
  options: {
    description?: string;
    subject?: string;
    bodyHtml?: string;
    bodyText?: string;
    placeholders?: Array<{
      name: string;
      description: string;
      required: boolean;
      defaultValue?: string;
    }>;
    enabled?: boolean;
  } = {}
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Check if template exists
    const [existing] = await db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.key, key))
      .limit(1);

    if (existing) {
      // Update
      await db
        .update(notificationTemplates)
        .set({
          name,
          type,
          description: options.description,
          subject: options.subject,
          bodyHtml: options.bodyHtml,
          bodyText: options.bodyText,
          placeholders: options.placeholders,
          enabled: options.enabled ?? true,
          updatedAt: new Date(),
        })
        .where(eq(notificationTemplates.id, existing.id));

      return { id: existing.id };
    } else {
      // Insert
      const [result] = await db.insert(notificationTemplates).values({
        key,
        name,
        type,
        description: options.description,
        subject: options.subject,
        bodyHtml: options.bodyHtml,
        bodyText: options.bodyText,
        placeholders: options.placeholders,
        enabled: options.enabled ?? true,
      });

      return { id: Number((result as any)[0].insertId) };
    }
  } catch (error) {
    console.error("[Notifications] Failed to upsert template:", error);
    return null;
  }
}

/**
 * Get a template by key.
 */
export async function getTemplate(
  key: string
): Promise<any | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [template] = await db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.key, key))
      .limit(1);

    return template ?? null;
  } catch (error) {
    console.error("[Notifications] Failed to get template:", error);
    return null;
  }
}

/**
 * List all templates.
 */
export async function listTemplates(
  type?: string
): Promise<any[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const where = type ? eq(notificationTemplates.type, type as any) : undefined;
    return await db
      .select()
      .from(notificationTemplates)
      .where(where)
      .orderBy(notificationTemplates.key);
  } catch (error) {
    console.error("[Notifications] Failed to list templates:", error);
    return [];
  }
}

// ============================================================================
// Notification Sending
// ============================================================================

/**
 * Send a notification using a template.
 */
export async function sendNotification(
  input: SendNotificationInput
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Get template
    const template = await getTemplate(input.templateKey);
    if (!template) {
      console.warn(`[Notifications] Template "${input.templateKey}" not found.`);
      return null;
    }

    if (!template.enabled) {
      console.warn(`[Notifications] Template "${input.templateKey}" is disabled.`);
      return null;
    }

    // Check user preferences
    if (input.recipientId) {
      const preferences = await getUserPreferences(input.recipientId);
      const type = input.type ?? template.type;
      
      if (preferences) {
        const category = getCategoryFromTemplateKey(input.templateKey);
        const categoryPrefs = (preferences.preferences as any)?.[category];
        if (categoryPrefs && !categoryPrefs[type]) {
          console.info(`[Notifications] User ${input.recipientId} has disabled ${type} notifications for ${category}.`);
          return null;
        }
      }
    }

    // Render template
    const rendered = renderTemplate(template, input.data ?? {});

    // Create notification
    const [result] = await db.insert(notificationQueue).values({
      templateKey: input.templateKey,
      recipientId: input.recipientId,
      recipientEmail: input.recipientEmail,
      recipientPhone: input.recipientPhone,
      subject: rendered.subject,
      bodyHtml: rendered.bodyHtml,
      bodyText: rendered.bodyText,
      data: input.data,
      type: (input.type ?? template.type) as any,
      status: "pending",
      priority: input.priority ?? "normal",
      scheduledFor: input.scheduledFor,
      metadata: input.metadata,
    });

    const notificationId = Number((result as any)[0].insertId);

    // Also create in-app notification if applicable
    if (input.recipientId && (input.type ?? template.type) === "in_app") {
      await db.insert(inAppNotifications).values({
        userId: input.recipientId,
        title: rendered.subject ?? template.name,
        message: rendered.bodyText ?? "",
        type: "info",
        metadata: input.data,
      });
    }

    await logAuditEvent({
      action: "notification.queued",
      entityType: "notification",
      entityId: notificationId,
      after: { templateKey: input.templateKey, recipientId: input.recipientId },
    });

    return { id: notificationId };
  } catch (error) {
    console.error("[Notifications] Failed to send notification:", error);
    return null;
  }
}

/**
 * Send a simple in-app notification (no template required).
 */
export async function sendInAppNotification(
  userId: number,
  title: string,
  message: string,
  options: {
    type?: "info" | "success" | "warning" | "error";
    linkUrl?: string;
    linkText?: string;
    entityType?: string;
    entityId?: number;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [result] = await db.insert(inAppNotifications).values({
      userId,
      title,
      message,
      type: options.type ?? "info",
      linkUrl: options.linkUrl,
      linkText: options.linkText,
      entityType: options.entityType,
      entityId: options.entityId,
      metadata: options.metadata,
    });

    return { id: Number((result as any)[0].insertId) };
  } catch (error) {
    console.error("[Notifications] Failed to send in-app notification:", error);
    return null;
  }
}

// ============================================================================
// Notification Retrieval
// ============================================================================

/**
 * Get in-app notifications for a user.
 */
export async function getNotifications(
  userId: number,
  options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
): Promise<{
  notifications: any[];
  unreadCount: number;
}> {
  const db = getDb();
  if (!db) return { notifications: [], unreadCount: 0 };

  try {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const conditions = [eq(inAppNotifications.userId, userId)];
    if (options.unreadOnly) {
      conditions.push(eq(inAppNotifications.read, false));
    }

    const notifications = await db
      .select()
      .from(inAppNotifications)
      .where(and(...conditions))
      .orderBy(desc(inAppNotifications.createdAt))
      .limit(limit)
      .offset(offset);

    const [unreadResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(inAppNotifications)
      .where(
        and(
          eq(inAppNotifications.userId, userId),
          eq(inAppNotifications.read, false)
        )
      );

    return {
      notifications,
      unreadCount: unreadResult?.count ?? 0,
    };
  } catch (error) {
    console.error("[Notifications] Failed to get notifications:", error);
    return { notifications: [], unreadCount: 0 };
  }
}

/**
 * Mark notifications as read.
 */
export async function markAsRead(
  userId: number,
  notificationIds?: number[]
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const conditions = [eq(inAppNotifications.userId, userId)];
    if (notificationIds && notificationIds.length > 0) {
      conditions.push(sql`${inAppNotifications.id} IN ${notificationIds}`);
    }

    await db
      .update(inAppNotifications)
      .set({
        read: true,
        readAt: new Date(),
      })
      .where(and(...conditions));

    return true;
  } catch (error) {
    console.error("[Notifications] Failed to mark as read:", error);
    return false;
  }
}

/**
 * Get unread count for a user.
 */
export async function getUnreadCount(
  userId: number
): Promise<number> {
  const db = getDb();
  if (!db) return 0;

  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(inAppNotifications)
      .where(
        and(
          eq(inAppNotifications.userId, userId),
          eq(inAppNotifications.read, false)
        )
      );

    return result?.count ?? 0;
  } catch (error) {
    console.error("[Notifications] Failed to get unread count:", error);
    return 0;
  }
}

// ============================================================================
// User Preferences
// ============================================================================

/**
 * Get user notification preferences.
 */
export async function getUserPreferences(
  userId: number
): Promise<any | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [preferences] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    return preferences ?? null;
  } catch (error) {
    console.error("[Notifications] Failed to get preferences:", error);
    return null;
  }
}

/**
 * Update user notification preferences.
 */
export async function updatePreferences(
  userId: number,
  preferences: {
    emailEnabled?: boolean;
    pushEnabled?: boolean;
    inAppEnabled?: boolean;
    smsEnabled?: boolean;
    categories?: Record<string, { email: boolean; push: boolean; inApp: boolean }>;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    quietHoursTimezone?: string;
  }
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [existing] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (existing) {
      await db
        .update(notificationPreferences)
        .set({
          emailEnabled: preferences.emailEnabled ?? existing.emailEnabled,
          pushEnabled: preferences.pushEnabled ?? existing.pushEnabled,
          inAppEnabled: preferences.inAppEnabled ?? existing.inAppEnabled,
          smsEnabled: preferences.smsEnabled ?? existing.smsEnabled,
          preferences: (preferences.categories ?? existing.preferences) as any,
          quietHoursStart: preferences.quietHoursStart ?? existing.quietHoursStart,
          quietHoursEnd: preferences.quietHoursEnd ?? existing.quietHoursEnd,
          quietHoursTimezone: preferences.quietHoursTimezone ?? existing.quietHoursTimezone,
          updatedAt: new Date(),
        })
        .where(eq(notificationPreferences.userId, userId));
    } else {
      await db.insert(notificationPreferences).values({
        userId,
        emailEnabled: preferences.emailEnabled ?? true,
        pushEnabled: preferences.pushEnabled ?? true,
        inAppEnabled: preferences.inAppEnabled ?? true,
        smsEnabled: preferences.smsEnabled ?? false,          preferences: (preferences.categories ?? {
            membership: { email: true, push: true, inApp: true },
            elections: { email: true, push: true, inApp: true },
            plenary: { email: true, push: true, inApp: true },
            activities: { email: true, push: true, inApp: true },
            finance: { email: true, push: true, inApp: true },
            documents: { email: true, push: true, inApp: true },
            system: { email: true, push: true, inApp: true },
          }) as any,
        quietHoursStart: preferences.quietHoursStart,
        quietHoursEnd: preferences.quietHoursEnd,
        quietHoursTimezone: preferences.quietHoursTimezone,
      });
    }

    return true;
  } catch (error) {
    console.error("[Notifications] Failed to update preferences:", error);
    return false;
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Render a template with data.
 */
function renderTemplate(
  template: any,
  data: Record<string, unknown>
): {
  subject?: string;
  bodyHtml?: string;
  bodyText?: string;
} {
  const render = (text: string | null): string | undefined => {
    if (!text) return undefined;
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return String(data[key] ?? `{{${key}}}`);
    });
  };

  return {
    subject: render(template.subject),
    bodyHtml: render(template.bodyHtml),
    bodyText: render(template.bodyText),
  };
}

/**
 * Get category from template key.
 */
function getCategoryFromTemplateKey(key: string): string {
  const parts = key.split(".");
  return parts[0] ?? "system";
}

// ============================================================================
// Default Templates
// ============================================================================

export const DEFAULT_TEMPLATES = [
  {
    key: "membership.application_received",
    name: "Application Received",
    type: "email" as const,
    subject: "Your membership application has been received",
    bodyHtml: `
      <h2>Application Received</h2>
      <p>Dear {{fullName}},</p>
      <p>We have received your membership application for {{orgName}}.</p>
      <p>Your application is now under review. We will notify you once a decision has been made.</p>
      <p>Application Reference: #{{applicationId}}</p>
      <p>Best regards,<br/>{{orgName}} Team</p>
    `,
    bodyText: "Dear {{fullName}}, We have received your membership application for {{orgName}}. Your application is now under review. Application Reference: #{{applicationId}}",
    placeholders: [
      { name: "fullName", description: "Applicant's full name", required: true },
      { name: "orgName", description: "Organization name", required: true },
      { name: "applicationId", description: "Application ID", required: true },
    ],
  },
  {
    key: "membership.application_approved",
    name: "Application Approved",
    type: "email" as const,
    subject: "Your membership application has been approved!",
    bodyHtml: `
      <h2>Application Approved!</h2>
      <p>Dear {{fullName}},</p>
      <p>We are pleased to inform you that your membership application has been approved!</p>
      <p>Your membership ID: <strong>{{membershipId}}</strong></p>
      <p>Please log in to your portal to complete your profile and access member benefits.</p>
      <p>Welcome to {{orgName}}!</p>
      <p>Best regards,<br/>{{orgName}} Team</p>
    `,
    bodyText: "Dear {{fullName}}, Your membership application has been approved! Your membership ID: {{membershipId}}. Welcome to {{orgName}}!",
    placeholders: [
      { name: "fullName", description: "Member's full name", required: true },
      { name: "orgName", description: "Organization name", required: true },
      { name: "membershipId", description: "Membership ID", required: true },
    ],
  },
  {
    key: "election.voting_reminder",
    name: "Election Voting Reminder",
    type: "email" as const,
    subject: "Reminder: Vote in {{electionTitle}}",
    bodyHtml: `
      <h2>Voting Reminder</h2>
      <p>Dear Member,</p>
      <p>This is a reminder that voting is now open for <strong>{{electionTitle}}</strong>.</p>
      <p>Voting ends on: <strong>{{votingEnd}}</strong></p>
      <p>Please log in to cast your ballot.</p>
      <p>Your vote matters!</p>
      <p>Best regards,<br/>{{orgName}} Elections Committee</p>
    `,
    bodyText: "Voting is now open for {{electionTitle}}. Voting ends on {{votingEnd}}. Please log in to cast your ballot.",
    placeholders: [
      { name: "electionTitle", description: "Election title", required: true },
      { name: "votingEnd", description: "Voting end date", required: true },
      { name: "orgName", description: "Organization name", required: true },
    ],
  },
  {
    key: "plenary.session_reminder",
    name: "Plenary Session Reminder",
    type: "email" as const,
    subject: "Reminder: {{sessionTitle}}",
    bodyHtml: `
      <h2>Session Reminder</h2>
      <p>Dear Member,</p>
      <p>This is a reminder that <strong>{{sessionTitle}}</strong> is scheduled for <strong>{{sessionDate}}</strong>.</p>
      <p>Please review the agenda and prepare accordingly.</p>
      <p>Best regards,<br/>{{orgName}} Secretariat</p>
    `,
    bodyText: "Reminder: {{sessionTitle}} is scheduled for {{sessionDate}}. Please review the agenda.",
    placeholders: [
      { name: "sessionTitle", description: "Session title", required: true },
      { name: "sessionDate", description: "Session date", required: true },
      { name: "orgName", description: "Organization name", required: true },
    ],
  },
];

/**
 * Seed default notification templates.
 */
export async function seedDefaultTemplates(): Promise<void> {
  for (const template of DEFAULT_TEMPLATES) {
    await upsertTemplate(template.key, template.name, template.type, {
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText,
      placeholders: template.placeholders,
    });
  }
  console.log("[Notifications] Seeded default templates.");
}

/**
 * Notification Schema Extension
 * Adds notification engine tables for templates, queue, and user preferences.
 */

import {
  int,
  varchar,
  text,
  timestamp,
  boolean,
  mysqlEnum,
  mysqlTable,
  json,
  index,
} from "drizzle-orm/mysql-core";

// ============================================================================
// NOTIFICATION TEMPLATES
// ============================================================================

export const notificationTemplates = mysqlTable("notification_templates", {
  id: int("id").autoincrement().primaryKey(),
  
  // Identification
  key: varchar("key", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Type
  type: mysqlEnum("type", ["email", "push", "in_app", "sms"]).notNull(),
  
  // Subject (for email)
  subject: varchar("subject", { length: 500 }),
  
  // Content
  bodyHtml: text("bodyHtml"), // HTML template
  bodyText: text("bodyText"), // Plain text fallback
  
  // Placeholders
  placeholders: json("placeholders").$type<Array<{
    name: string;
    description: string;
    required: boolean;
    defaultValue?: string;
  }>>(),
  
  // Settings
  enabled: boolean("enabled").default(true),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  keyIdx: index("nt_key_idx").on(table.key),
  typeIdx: index("nt_type_idx").on(table.type),
}));

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type InsertNotificationTemplate = typeof notificationTemplates.$inferInsert;

// ============================================================================
// NOTIFICATION QUEUE
// ============================================================================

export const notificationQueue = mysqlTable("notification_queue", {
  id: int("id").autoincrement().primaryKey(),
  
  // Template
  templateKey: varchar("templateKey", { length: 100 }).notNull(),
  
  // Recipient
  recipientId: int("recipientId"),
  recipientEmail: varchar("recipientEmail", { length: 320 }),
  recipientPhone: varchar("recipientPhone", { length: 20 }),
  
  // Content
  subject: varchar("subject", { length: 500 }),
  bodyHtml: text("bodyHtml"),
  bodyText: text("bodyText"),
  
  // Data for template rendering
  data: json("data").$type<Record<string, unknown>>(),
  
  // Type
  type: mysqlEnum("type", ["email", "push", "in_app", "sms"]).notNull(),
  
  // Status
  status: mysqlEnum("status", [
    "pending", "processing", "sent", "delivered", "read", 
    "failed", "cancelled"
  ]).default("pending").notNull(),
  
  // Retry
  retryCount: int("retryCount").default(0),
  maxRetries: int("maxRetries").default(3),
  lastAttemptAt: timestamp("lastAttemptAt"),
  
  // Scheduling
  scheduledFor: timestamp("scheduledFor"), // null = send immediately
  sentAt: timestamp("sentAt"),
  deliveredAt: timestamp("deliveredAt"),
  readAt: timestamp("readAt"),
  
  // Priority
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal"),
  
  // Metadata
  metadata: json("metadata").$type<Record<string, unknown>>(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusIdx: index("nq_status_idx").on(table.status),
  recipientIdx: index("nq_recipient_idx").on(table.recipientId),
  scheduledIdx: index("nq_scheduled_idx").on(table.scheduledFor),
  priorityIdx: index("nq_priority_idx").on(table.priority),
}));

export type NotificationQueueItem = typeof notificationQueue.$inferSelect;
export type InsertNotificationQueueItem = typeof notificationQueue.$inferInsert;

// ============================================================================
// NOTIFICATION PREFERENCES
// ============================================================================

export const notificationPreferences = mysqlTable("notification_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  
  // Global settings
  emailEnabled: boolean("emailEnabled").default(true),
  pushEnabled: boolean("pushEnabled").default(true),
  inAppEnabled: boolean("inAppEnabled").default(true),
  smsEnabled: boolean("smsEnabled").default(false),
  
  // Category preferences
  preferences: json("preferences").$type<{
    membership: { email: boolean; push: boolean; inApp: boolean };
    elections: { email: boolean; push: boolean; inApp: boolean };
    plenary: { email: boolean; push: boolean; inApp: boolean };
    activities: { email: boolean; push: boolean; inApp: boolean };
    finance: { email: boolean; push: boolean; inApp: boolean };
    documents: { email: boolean; push: boolean; inApp: boolean };
    system: { email: boolean; push: boolean; inApp: boolean };
  }>(),
  
  // Quiet hours
  quietHoursStart: varchar("quietHoursStart", { length: 5 }), // "22:00"
  quietHoursEnd: varchar("quietHoursEnd", { length: 5 }), // "08:00"
  quietHoursTimezone: varchar("quietHoursTimezone", { length: 50 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("np_user_idx").on(table.userId),
}));

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;

// ============================================================================
// IN-APP NOTIFICATIONS (read/unread tracking)
// ============================================================================

export const inAppNotifications = mysqlTable("in_app_notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  // Content
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: mysqlEnum("type", ["info", "success", "warning", "error"]).default("info"),
  
  // Link
  linkUrl: varchar("linkUrl", { length: 500 }),
  linkText: varchar("linkText", { length: 100 }),
  
  // Reference
  entityType: varchar("entityType", { length: 50 }),
  entityId: int("entityId"),
  
  // Status
  read: boolean("read").default(false),
  readAt: timestamp("readAt"),
  
  // Metadata
  metadata: json("metadata").$type<Record<string, unknown>>(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("ian_user_idx").on(table.userId),
  readIdx: index("ian_read_idx").on(table.userId, table.read),
  createdIdx: index("ian_created_idx").on(table.createdAt),
}));

export type InAppNotification = typeof inAppNotifications.$inferSelect;
export type InsertInAppNotification = typeof inAppNotifications.$inferInsert;

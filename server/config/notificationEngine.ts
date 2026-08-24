/**
 * Notification Engine
 *
 * Config-driven notification delivery for all MSAP operations:
 * - Email notifications (via SMTP)
 * - SMS notifications (via provider)
 * - Push notifications (via PWA service worker)
 * - In-app notifications (database + UI)
 *
 * All templates, recipients, and delivery channels are config-driven.
 * Uses the workflow engine's notification stage for orchestration.
 *
 * Usage:
 *   import { sendNotification, createInAppNotification } from "./notificationEngine";
 *
 *   await sendNotification({
 *     type: "membership.approved",
 *     recipientId: userId,
 *     data: { memberName: "Ahmed", lcName: "KEMU LC" },
 *   });
 */

import { getConfig, getConfigNumber } from "./configService";
import { getCurrentGovernanceVersion, getTermDisplayString } from "./termService";
import { logAuditEvent } from "./auditService";

// ============================================================================
// Types
// ============================================================================

export type NotificationChannel = "email" | "sms" | "push" | "in_app";
export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type NotificationType =
  | "membership.applied"
  | "membership.approved"
  | "membership.rejected"
  | "membership.activated"
  | "membership.terminated"
  | "membership.suspended"
  | "appointment.proposed"
  | "appointment.approved"
  | "appointment.rejected"
  | "activity.submitted"
  | "activity.approved"
  | "activity.rejected"
  | "nef.submitted"
  | "nef.approved"
  | "nef.rejected"
  | "nef.completed"
  | "nrf.submitted"
  | "nrf.approved"
  | "election.scheduled"
  | "election.candidate_registered"
  | "election.voting_open"
  | "election.result_published"
  | "credential.submitted"
  | "credential.approved"
  | "credential.rejected"
  | "nga.invitation"
  | "nga.credentials_reminder"
  | "plenary.motion_published"
  | "plenary.vote_reminder"
  | "workflow.task_assigned"
  | "workflow.task_overdue"
  | "workflow.escalation"
  | "governance.rule_changed"
  | "config.changed"
  | "security.login_new_device"
  | "security.password_changed"
  | "generic";

export interface SendNotificationInput {
  type: NotificationType;
  recipientId?: number;
  recipientEmail?: string;
  recipientPhone?: string;
  data: Record<string, unknown>;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  scheduledAt?: Date;
  correlationId?: string;
}

export interface NotificationResult {
  sent: boolean;
  channels: NotificationChannel[];
  errors: string[];
}

// ============================================================================
// Template Definitions
// ============================================================================

const NOTIFICATION_TEMPLATES: Record<
  string,
  {
    subject: string;
    body: string;
    smsBody?: string;
    pushTitle: string;
    pushBody: string;
    priority: NotificationPriority;
    channels: NotificationChannel[];
  }
> = {
  "membership.applied": {
    subject: "Membership Application Received",
    body: "Dear {memberName},\n\nYour membership application for {localCouncil} has been received and is under review.\n\nApplication ID: {applicationId}\n\nYou will be notified once your application is reviewed.",
    pushTitle: "Application Received",
    pushBody: "Your membership application for {localCouncil} is under review.",
    priority: "normal",
    channels: ["email", "push", "in_app"],
  },
  "membership.approved": {
    subject: "Membership Approved — Welcome to MSA Pakistan!",
    body: "Dear {memberName},\n\nCongratulations! Your membership application has been approved.\n\nMembership ID: {membershipId}\nLocal Council: {localCouncil}\nTerm: {termDisplay}\n\nPlease collect your membership card from your LC president.",
    pushTitle: "Membership Approved! 🎉",
    pushBody: "Welcome to MSA Pakistan! Your membership has been approved.",
    priority: "high",
    channels: ["email", "push", "in_app"],
  },
  "membership.rejected": {
    subject: "Membership Application — Action Required",
    body: "Dear {memberName},\n\nYour membership application requires attention.\n\nStatus: {rejectionReason}\n\nPlease contact your Local Council for assistance.",
    pushTitle: "Application Update",
    pushBody: "Your membership application requires attention.",
    priority: "high",
    channels: ["email", "push", "in_app"],
  },
  "appointment.approved": {
    subject: "Appointment Confirmed — {position}",
    body: "Dear {officerName},\n\nYou have been appointed as {position}.\n\nScope: {scope}\nTerm: {termDisplay}\nEffective: {appointmentDate}\n\nPlease report to {reportingTo}.",
    pushTitle: "Appointment Confirmed! 📋",
    pushBody: "You have been appointed as {position}.",
    priority: "high",
    channels: ["email", "push", "in_app"],
  },
  "nef.submitted": {
    subject: "NEF Activity Submitted — {activityName}",
    body: "Dear {coordinatorName},\n\nYour NEF activity \"{activityName}\" has been submitted for review.\n\nBudget: {budget}\nLocal Council: {localCouncil}\n\nStatus: Pending VPA Review",
    pushTitle: "NEF Submitted",
    pushBody: "Activity \"{activityName}\" submitted for review.",
    priority: "normal",
    channels: ["email", "push", "in_app"],
  },
  "nef.approved": {
    subject: "NEF Activity Approved — {activityName}",
    body: "Dear {coordinatorName},\n\nYour NEF activity \"{activityName}\" has been approved.\n\nApproved Budget: {budget}\n\nYou may proceed with execution.",
    pushTitle: "NEF Approved ✅",
    pushBody: "Activity \"{activityName}\" has been approved. Budget: {budget}",
    priority: "high",
    channels: ["email", "push", "in_app"],
  },
  "nga.invitation": {
    subject: "Invitation — {meetingTitle}",
    body: "Dear Delegate,\n\nYou are invited to {meetingTitle}.\n\nDates: {scheduledStart} — {scheduledEnd}\nVenue: {venue}, {city}\nMode: {mode}\n\nPlease submit credentials before the deadline.",
    pushTitle: "NGA Invitation 🏛️",
    pushBody: "You're invited to {meetingTitle}",
    priority: "high",
    channels: ["email", "push", "in_app"],
  },
  "workflow.task_assigned": {
    subject: "Task Assigned — {taskName}",
    body: "You have been assigned a task:\n\n{taskName}\nAssigned by: {assignerName}\nDue: {dueDate}\n\nPlease review and take action.",
    pushTitle: "New Task Assigned",
    pushBody: "{taskName} — Due: {dueDate}",
    priority: "normal",
    channels: ["push", "in_app"],
  },
  "workflow.task_overdue": {
    subject: "⚠️ Overdue Task — {taskName}",
    body: "The following task is overdue:\n\n{taskName}\nDue: {dueDate}\nOverdue by: {overdueDays} days\n\nPlease take immediate action.",
    pushTitle: "⚠️ Overdue Task",
    pushBody: "{taskName} is {overdueDays} days overdue",
    priority: "urgent",
    channels: ["email", "push", "in_app"],
  },
  "governance.rule_changed": {
    subject: "Governance Rule Updated — {ruleName}",
    body: "A governance rule has been updated:\n\nRule: {ruleName}\nPrevious: {oldValue}\nNew: {newValue}\nEffective: {effectiveDate}\nGovernance Version: {governanceVersion}\n\nThis change affects how organizational rules are applied.",
    pushTitle: "Governance Updated",
    pushBody: "{ruleName} has been updated",
    priority: "high",
    channels: ["email", "push", "in_app"],
  },
};

// ============================================================================
// Notification Sending
// ============================================================================

/**
 * Send a notification through the configured channels.
 */
export async function sendNotification(
  input: SendNotificationInput
): Promise<NotificationResult> {
  const result: NotificationResult = {
    sent: false,
    channels: [],
    errors: [],
  };

  try {
    const template = NOTIFICATION_TEMPLATES[input.type];
    if (!template) {
      result.errors.push(`Unknown notification type: ${input.type}`);
      return result;
    }

    // Resolve channels from config or use template defaults
    const channels = input.channels ?? template.channels;

    // Check which channels are enabled in config
    const enabledChannels: NotificationChannel[] = [];
    for (const channel of channels) {
      const enabled = await getConfig(
        `notifications.channels.${channel}.enabled`,
        "true"
      );
      if (enabled === "true") {
        enabledChannels.push(channel);
      }
    }

    if (enabledChannels.length === 0) {
      result.errors.push("No notification channels enabled");
      return result;
    }

    // Populate template with data
    const resolvedData = {
      ...input.data,
      termDisplay: input.data.termDisplay ?? (await getTermDisplayString()),
      governanceVersion:
        input.data.governanceVersion ??
        (await getCurrentGovernanceVersion()),
    };

    const subject = interpolate(template.subject, resolvedData);
    const body = interpolate(template.body, resolvedData);
    const pushTitle = interpolate(template.pushTitle, resolvedData);
    const pushBody = interpolate(template.pushBody, resolvedData);

    // Send through each enabled channel
    for (const channel of enabledChannels) {
      try {
        switch (channel) {
          case "email":
            await sendEmail(
              input.recipientEmail ?? "",
              subject,
              body
            );
            result.channels.push("email");
            break;
          case "sms":
            if (template.smsBody && input.recipientPhone) {
              await sendSMS(
                input.recipientPhone,
                interpolate(template.smsBody, resolvedData)
              );
              result.channels.push("sms");
            }
            break;
          case "push":
            await sendPush(
              input.recipientId ?? 0,
              pushTitle,
              pushBody
            );
            result.channels.push("push");
            break;
          case "in_app":
            await createInAppNotification({
              userId: input.recipientId ?? 0,
              type: input.type,
              title: pushTitle,
              body: pushBody,
              priority: input.priority ?? template.priority,
              correlationId: input.correlationId,
            });
            result.channels.push("in_app");
            break;
        }
      } catch (error) {
        result.errors.push(
          `Failed to send via ${channel}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    result.sent = result.channels.length > 0;

    // Audit log
    if (result.sent) {
      await logAuditEvent({
        userId: input.recipientId,
        action: "notification.sent",
        entityType: "notification",
        entityId: 0,
        after: {
          type: input.type,
          channels: result.channels,
          priority: input.priority ?? template.priority,
        },
        correlationId: input.correlationId,
      });
    }

    return result;
  } catch (error) {
    result.errors.push(
      `Notification error: ${error instanceof Error ? error.message : "Unknown"}`
    );
    return result;
  }
}

// ============================================================================
// Channel Implementations (stubs — wire to real providers)
// ============================================================================

async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<void> {
  if (!to) throw new Error("No recipient email");

  const smtpEnabled = await getConfig("notifications.channels.email.enabled", "true");
  if (smtpEnabled !== "true") throw new Error("Email channel disabled");

  // In production: use nodemailer/SMTP
  console.log(
    `[Notification:Email] To: ${to} | Subject: ${subject}`
  );
}

async function sendSMS(
  to: string,
  body: string
): Promise<void> {
  if (!to) throw new Error("No recipient phone");

  const smsEnabled = await getConfig("notifications.channels.sms.enabled", "false");
  if (smsEnabled !== "true") throw new Error("SMS channel disabled");

  // In production: use SMS provider API
  console.log(`[Notification:SMS] To: ${to} | Body: ${body.slice(0, 100)}`);
}

async function sendPush(
  userId: number,
  title: string,
  body: string
): Promise<void> {
  if (!userId) throw new Error("No recipient user ID");

  const pushEnabled = await getConfig("notifications.channels.push.enabled", "true");
  if (pushEnabled !== "true") throw new Error("Push channel disabled");

  // In production: use web push API
  console.log(
    `[Notification:Push] userId: ${userId} | Title: ${title}`
  );
}

async function createInAppNotification(input: {
  userId: number;
  type: string;
  title: string;
  body: string;
  priority: string;
  correlationId?: string;
}): Promise<void> {
  // In production: insert into notifications table
  console.log(
    `[Notification:InApp] userId: ${input.userId} | ${input.title}`
  );
}

// ============================================================================
// Template Helpers
// ============================================================================

/**
 * Interpolate {key} placeholders in a string.
 */
function interpolate(
  template: string,
  data: Record<string, unknown>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = data[key];
    return value !== undefined && value !== null ? String(value) : match;
  });
}

/**
 * Get all notification types and their templates.
 */
export function getNotificationTemplates(): Array<{
  type: string;
  subject: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
}> {
  return Object.entries(NOTIFICATION_TEMPLATES).map(([type, t]) => ({
    type,
    subject: t.subject,
    channels: t.channels,
    priority: t.priority,
  }));
}

/**
 * Get a specific notification template.
 */
export function getNotificationTemplate(
  type: string
): (typeof NOTIFICATION_TEMPLATES)[string] | null {
  return NOTIFICATION_TEMPLATES[type] ?? null;
}

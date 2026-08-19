import { getDb } from "../db";
import { emailQueue } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import nodemailer, { type Transporter } from "nodemailer";
import { getBranding, getEmailBranding } from "../config/branding";

/**
 * Email Service for MSAP Member Portal
 *
 * Queues emails (DB-backed, with a process-local outbox fallback when no
 * database is configured) and delivers them over SMTP via nodemailer.
 *
 * SMTP is configured with the same variables the admin config UI already
 * exposes, so any relay works (Gmail/Zoho/Brevo/Mailgun, or Elastic Email's
 * SMTP servers for a zero-budget non-profit):
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, FROM_EMAIL
 *
 * When SMTP is not configured the service degrades gracefully (logs instead
 * of sending) so local development and tests never block on credentials.
 *
 * Org-specific values (name, email, colors) are now read from the branding
 * config service instead of being hardcoded.
 */

export interface EmailOptions {
  recipientEmail: string;
  subject: string;
  emailType: string;
  htmlBody: string;
}

const MAX_RETRIES = 3;

// Logged once per boot so an unconfigured relay doesn't spam every tick.
let warnedSmtpUnconfigured = false;

// ============================================================================
// SMTP transport (env-configured)
// ============================================================================

let cachedTransport: Transporter | null | undefined;

/**
 * Strip credentials out of a nodemailer error message before it reaches logs
 * or an API response (auth failures often echo the SMTP username).
 */
function sanitizeEmailError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const config = getSmtpConfig();
  return message
    .replace(config.user, "[user]")
    .replace(config.pass, "[password]")
    .replace(config.host, "[host]")
    .slice(0, 300);
}

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST?.trim() ?? "",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true", // true for port 465 (implicit TLS)
    user: process.env.SMTP_USER?.trim() ?? "",
    pass: process.env.SMTP_PASSWORD ?? "",
    from: process.env.FROM_EMAIL?.trim() ?? "no-reply@msapakistan.org",
    fromName: process.env.SMTP_FROM_NAME?.trim() || "MSA Pakistan",
  };
}

/** True when a usable SMTP relay host is configured. */
export function isSmtpConfigured(): boolean {
  return Boolean(getSmtpConfig().host);
}

/** Lazy singleton transport. Returns null when SMTP is not configured. */
async function getTransport(): Promise<Transporter | null> {
  if (cachedTransport !== undefined) return cachedTransport;

  const config = getSmtpConfig();
  if (!config.host) {
    if (!warnedSmtpUnconfigured) {
      warnedSmtpUnconfigured = true;
      console.warn(
        "[Email] SMTP_HOST is not configured. Emails will be logged but not sent."
      );
    }
    cachedTransport = null;
    return null;
  }

  try {
    cachedTransport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user
        ? { user: config.user, pass: config.pass }
        : undefined,
    });
    console.log(`[Email] SMTP transport created (${config.host}:${config.port})`);
    return cachedTransport;
  } catch (error) {
    console.error("[Email] Failed to create SMTP transport:", sanitizeEmailError(error));
    cachedTransport = null;
    return null;
  }
}

// ============================================================================
// Queue + send
// ============================================================================

/**
 * Queue an email for delivery. Falls back to process-local outbox when
 * the database is unavailable.
 */
export async function queueEmail(
  options: EmailOptions
): Promise<number | null> {
  const db = getDb();
  if (!db) {
    console.log(`[Email] (no DB) To: ${options.recipientEmail} | Subject: ${options.subject}`);
    memoryEmailLog.push(options);
    return null;
  }

  try {
    const result = await db.insert(emailQueue).values({
      recipientEmail: options.recipientEmail,
      subject: options.subject,
      emailType: options.emailType,
      htmlBody: options.htmlBody,
      status: "Pending",
    });
    const id = Number(result[0].insertId);
    console.log(`[Email] Queued #${id}: ${options.subject} → ${options.recipientEmail}`);
    return id;
  } catch (error) {
    console.error("[Email] Failed to queue email:", sanitizeEmailError(error));
    return null;
  }
}

/**
 * Process the email queue: dequeue pending messages and attempt delivery.
 * Safe to call on a timer or at boot.
 */
/** Alias for backward compatibility. */
export const processPendingEmails = processEmailQueue;

export async function processEmailQueue(): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    const rows = await db
      .select()
      .from(emailQueue)
      .where(eq(emailQueue.status, "Pending"))
      .limit(10);

    for (const email of rows) {
      await deliverEmail(email);
    }
  } catch (error) {
    console.error("[Email] Failed to process queue:", sanitizeEmailError(error));
  }
}

async function deliverEmail(
  email: {
    id: number;
    recipientEmail: string;
    subject: string;
    htmlBody: string | null;
    retryCount: number | null;
    maxRetries: number | null;
  }
): Promise<void> {
  const transport = await getTransport();
  const retryCount = email.retryCount ?? 0;
  const maxRetries = email.maxRetries ?? MAX_RETRIES;
  const db = getDb();

  if (!transport) {
    console.log(
      `[Email] (no SMTP) To: ${email.recipientEmail} | Subject: ${email.subject}`
    );
    if (db) {
      await db
        .update(emailQueue)
        .set({ status: "Sent", sentAt: new Date(), lastAttemptAt: new Date() })
        .where(eq(emailQueue.id, email.id));
    }
    return;
  }

  if (retryCount >= maxRetries) {
    if (db) {
      await db
        .update(emailQueue)
        .set({ status: "Permanent Failure", lastAttemptAt: new Date() })
        .where(eq(emailQueue.id, email.id));
    }
    console.error(
      `[Email] Permanent failure after ${maxRetries} attempts: ${email.recipientEmail} | ${email.subject}`
    );
    return;
  }

  try {
    const config = getSmtpConfig();
    await transport.sendMail({
      from: `"${config.fromName}" <${config.from}>`,
      to: email.recipientEmail,
      subject: email.subject,
      html: email.htmlBody ?? "",
    });
    console.log(
      `[Email] Sent to ${email.recipientEmail}: ${email.subject}`
    );
    if (db) {
      await db
        .update(emailQueue)
        .set({ status: "Sent", sentAt: new Date(), lastAttemptAt: new Date() })
        .where(eq(emailQueue.id, email.id));
    }
  } catch (error) {
    console.error(
      `[Email] Delivery failed (attempt ${retryCount + 1}/${maxRetries}) to ${email.recipientEmail}: ${email.subject}`,
      sanitizeEmailError(error)
    );
    if (db) {
      await db
        .update(emailQueue)
        .set({ retryCount: retryCount + 1, lastAttemptAt: new Date() })
        .where(eq(emailQueue.id, email.id));
    }
  }
}

// ============================================================================
// Test email
// ============================================================================

/**
 * Send a test email to verify SMTP configuration.
 * Returns true on success, false on failure.
 */
export async function sendTestEmail(
  recipientEmail: string,
  branding?: { orgName?: string; supportEmail?: string }
): Promise<boolean> {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP is not configured. Set SMTP_HOST and related environment variables.");
  }
  const orgName = branding?.orgName ?? "MSA Pakistan";
  const supportEmail = branding?.supportEmail ?? "vpm@msapakistan.org";

  return queueEmail({
    recipientEmail,
    subject: `[${orgName}] Test Email`,
    emailType: "TEST",
    htmlBody: `
      <h2>Test Email</h2>
      <p>This is a test email from the ${escapeHtml(orgName)} member portal.</p>
      <p style="color:#475569;">This email confirms the MSAP member portal can send mail through its configured SMTP relay.</p>
      <p>If you received this, your email configuration is working correctly.</p>
      <p style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;">
        If you have questions, contact <a href="mailto:${escapeHtml(supportEmail)}" style="color:#16a34a;">${escapeHtml(supportEmail)}</a>
      </p>
    `,
  }).then((id) => id !== null);
}

// ============================================================================
// Email templates (branding-aware)
// ============================================================================

/**
 * Email templates for the member portal.
 *
 * Every dynamic value is HTML-escaped before interpolation (no template may
 * trust a name/title/link supplied by an application), and link targets are
 * restricted to http(s) so a hostile value can never inject an attribute or
 * a javascript: href.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Allow only http(s) links; anything else becomes a safe no-op href. */
function safeLink(url: string): string {
  if (/^https?:\/\//i.test(url)) return escapeHtml(url);
  return "#";
}

/**
 * Build the branded email header (dark background with org name).
 * All colors come from the branding config.
 */
async function buildEmailHeader(portalLabel: string): Promise<string> {
  const branding = await getBranding();
  const bgColor = branding.primaryColor || "#122840";
  const textColor = "#ffffff";
  const labelColor = "#4ade80";
  return `
    <td style="background:${bgColor};padding:28px 32px;text-align:center;">
      <div style="color:${textColor};font-size:20px;font-weight:700;letter-spacing:0.5px;">${escapeHtml(branding.orgName)}</div>
      <div style="color:${labelColor};font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">${escapeHtml(portalLabel)}</div>
    </td>
  `;
}

/**
 * Build the branded email footer.
 */
async function buildEmailFooter(): Promise<string> {
  const branding = await getBranding();
  return `<p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">${escapeHtml(branding.orgFullName)}</p>`;
}

/**
 * Build the email wrapper (common layout for all branded emails).
 */
async function wrapEmail(
  portalLabel: string,
  content: string
): Promise<string> {
  const header = await buildEmailHeader(portalLabel);
  const footer = await buildEmailFooter();
  return `
    <div style="margin:0;padding:0;background:#f3f7f6;font-family:'Montserrat',Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f7f6;padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
              <tr>
                ${header}
              </tr>
              <tr>
                <td style="padding:32px;">
                  ${content}
                </td>
              </tr>
            </table>
            ${footer}
          </td>
        </tr>
      </table>
    </div>
  `;
}

// ── Simple templates (non-wrapped, for backward compatibility) ────────

export async function getMembershipConfirmationEmail(memberName: string, membershipId: string): Promise<string> {
  const b = await getBranding();
  return `
    <h2>Welcome to ${escapeHtml(b.orgName)}!</h2>
    <p>Dear ${escapeHtml(memberName)},</p>
    <p>Thank you for applying for membership with ${escapeHtml(b.orgFullName)}.</p>
    <p><strong>Your Membership ID:</strong> ${escapeHtml(membershipId)}</p>
    <p>Your application is under review. You will receive an email once it has been approved.</p>
    <p>Best regards,<br/>${escapeHtml(b.orgName)} Team</p>
  `;
}

export async function getMembershipApprovedEmail(memberName: string, membershipId: string): Promise<string> {
  const b = await getBranding();
  return `
    <h2>Membership Approved!</h2>
    <p>Dear ${escapeHtml(memberName)},</p>
    <p>Congratulations! Your membership application has been approved.</p>
    <p><strong>Membership ID:</strong> ${escapeHtml(membershipId)}</p>
    <p>You can now access your membership portal and download your membership letter and card.</p>
    <p>Best regards,<br/>${escapeHtml(b.orgName)} Team</p>
  `;
}

export async function getOpportunityApplicationEmail(
  memberName: string,
  opportunityTitle: string
): Promise<string> {
  const b = await getBranding();
  return `
    <h2>Application Received</h2>
    <p>Dear ${escapeHtml(memberName)},</p>
    <p>Thank you for applying to: <strong>${escapeHtml(opportunityTitle)}</strong></p>
    <p>We will review your application and get back to you soon.</p>
    <p>Best regards,<br/>${escapeHtml(b.orgName)} Team</p>
  `;
}

export async function getVotingNotificationEmail(
  memberName: string,
  votingTitle: string,
  votingLink: string
): Promise<string> {
  const b = await getBranding();
  return `
    <h2>You're Invited to Vote</h2>
    <p>Dear ${escapeHtml(memberName)},</p>
    <p>You have been nominated as a voter for: <strong>${escapeHtml(votingTitle)}</strong></p>
    <p><a href="${safeLink(votingLink)}">Click here to vote</a></p>
    <p>Best regards,<br/>${escapeHtml(b.orgName)} Team</p>
  `;
}

export async function getPositionApplicationEmail(
  memberName: string,
  positionTitle: string
): Promise<string> {
  const b = await getBranding();
  return `
    <h2>Position Application Received</h2>
    <p>Dear ${escapeHtml(memberName)},</p>
    <p>Thank you for applying for the position of: <strong>${escapeHtml(positionTitle)}</strong></p>
    <p>We will review your application and notify you of the next steps.</p>
    <p>Best regards,<br/>${escapeHtml(b.orgName)} Team</p>
  `;
}

export async function getPositionSelectionEmail(
  memberName: string,
  positionTitle: string
): Promise<string> {
  const b = await getBranding();
  return `
    <h2>Congratulations!</h2>
    <p>Dear ${escapeHtml(memberName)},</p>
    <p>We are delighted to inform you that you have been selected for the position of: <strong>${escapeHtml(positionTitle)}</strong></p>
    <p>Your appointment letter will be sent to you shortly.</p>
    <p>Best regards,<br/>${escapeHtml(b.orgName)} Team</p>
  `;
}

// ============================================================================
// Password setup email
// ============================================================================

export interface PasswordSetupEmailParams {
  memberName: string;
  membershipId: string;
  recipientEmail: string;
  setupUrl: string;
  expiresAt: Date;
}

/**
 * Build the password-setup email subject (branding-aware).
 */
async function getPasswordSetupSubject(): Promise<string> {
  const orgName = await getOrgName();
  return `[${orgName}] Set Up Your Member Portal Account`;
}

// Exported for backward compatibility
export async function getPasswordSetupEmailSubject(): Promise<string> {
  return getPasswordSetupSubject();
}

/**
 * Branded password-setup email. Never contains the password or the raw setup
 * token beyond the clickable URL itself.
 */
export async function getPasswordSetupEmail({
  memberName,
  membershipId,
  setupUrl,
  expiresAt,
}: PasswordSetupEmailParams): Promise<string> {
  const branding = await getBranding();
  const emailBranding = await getEmailBranding();
  const name = escapeHtml(memberName);
  const memId = escapeHtml(membershipId);
  const hours = Math.max(
    1,
    Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))
  );
  const expiresLabel = `${hours} hour${hours === 1 ? "" : "s"}`;

  const content = `
    <h2 style="margin:0 0 16px;color:#122840;font-size:20px;line-height:1.4;">Congratulations, ${name}! 🎉</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.7;">
      Your membership has been approved and your member portal account is ready.
      Your Membership ID is:
    </p>
    <div style="margin:0 0 24px;padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;text-align:center;font-size:18px;font-weight:700;color:#166534;letter-spacing:1px;">${memId}</div>
    <a href="${setupUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:10px;">Set Up My Password</a>
    <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.7;">
      This secure link expires in <strong>${expiresLabel}</strong>. If it expires, contact your
      Local Council president or the VPM at
      <a href="mailto:${escapeHtml(emailBranding.supportEmail)}" style="color:#16a34a;">${escapeHtml(emailBranding.supportEmail)}</a> to request a new link.
    </p>
    <p style="margin:16px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.6;">
      ⚠️ <strong>Security note:</strong> ${escapeHtml(branding.orgShortName)} staff will never ask you for your password.
      Only use this link to set a password, and never share it with anyone.
    </p>
  `;

  return wrapEmail("Member Portal", content);
}

/** Queue the one-time password-setup email for an approved member. */
export async function queuePasswordSetupEmail(
  params: PasswordSetupEmailParams
): Promise<number | null> {
  const subject = await getPasswordSetupSubject();
  return queueEmail({
    recipientEmail: params.recipientEmail,
    subject,
    emailType: "PASSWORD_SETUP",
    htmlBody: await getPasswordSetupEmail(params),
  });
}

// ============================================================================
// Official setup email (super-admin provisioned officials)
// ============================================================================

async function getOfficialSetupSubject(): Promise<string> {
  const orgName = await getOrgName();
  return `[${orgName}] Set Up Your Official Portal Account`;
}

/**
 * Branded password-setup email for an official portal account. Same link
 * mechanics as the member email but framed for officials (SUPCO, National
 * President, VPs, LC Presidents).
 */
export async function getOfficialSetupEmail({
  name,
  positionLabel,
  setupUrl,
  expiresAt,
}: {
  name: string;
  positionLabel: string;
  setupUrl: string;
  expiresAt: Date;
}): Promise<string> {
  const branding = await getBranding();
  const safeName = escapeHtml(name);
  const safePosition = escapeHtml(positionLabel);
  const hours = Math.max(
    1,
    Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))
  );
  const expiresLabel = `${hours} hour${hours === 1 ? "" : "s"}`;

  const content = `
    <h2 style="margin:0 0 16px;color:#122840;font-size:20px;line-height:1.4;">Welcome, ${safeName} 👋</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.7;">
      You have been given access to the ${escapeHtml(branding.orgShortName)} Official Portal as
      <strong>${safePosition}</strong>. Set a password to sign in:
    </p>
    <a href="${setupUrl}" style="display:inline-block;background:${branding.primaryColor};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:10px;">Set Up My Password</a>
    <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.7;">
      This secure link expires in <strong>${expiresLabel}</strong>. If it expires, the
      super admin can issue a new link from the Officials Management page.
    </p>
    <p style="margin:16px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.6;">
      ⚠️ <strong>Security note:</strong> Never share this link or your password.
    </p>
  `;

  return wrapEmail("Official Portal", content);
}

/** Queue the one-time password-setup email for an official account. */
export async function queueOfficialSetupEmail(params: {
  name: string;
  positionLabel: string;
  recipientEmail: string;
  setupUrl: string;
  expiresAt: Date;
}): Promise<number | null> {
  const subject = await getOfficialSetupSubject();
  return queueEmail({
    recipientEmail: params.recipientEmail,
    subject,
    emailType: "OFFICIAL_SETUP",
    htmlBody: await getOfficialSetupEmail(params),
  });
}

// ============================================================================
// Membership lifecycle emails (suspend / terminate / reinstate)
// ============================================================================

export type MembershipStatusEmailAction =
  | "suspend"
  | "terminate"
  | "reinstate";

async function getLifecycleSubject(action: MembershipStatusEmailAction): Promise<string> {
  const orgName = await getOrgName();
  const labels: Record<MembershipStatusEmailAction, string> = {
    suspend: "Membership Suspended",
    terminate: "Membership Terminated",
    reinstate: "Membership Reinstated",
  };
  return `[${orgName}] ${labels[action]}`;
}

/**
 * Build the lifecycle email subjects (branding-aware).
 */
export async function getMembershipStatusEmailSubjects(): Promise<
  Record<MembershipStatusEmailAction, string>
> {
  return {
    suspend: await getLifecycleSubject("suspend"),
    terminate: await getLifecycleSubject("terminate"),
    reinstate: await getLifecycleSubject("reinstate"),
  };
}

// Legacy export for backward compatibility (sync version using env defaults)
export const MEMBERSHIP_STATUS_EMAIL_SUBJECTS: Record<
  MembershipStatusEmailAction,
  string
> = {
  suspend: "[MSA Pakistan] Membership Suspended",
  terminate: "[MSA Pakistan] Membership Terminated",
  reinstate: "[MSA Pakistan] Membership Reinstated",
};

export interface MembershipStatusEmailParams {
  memberName: string;
  membershipId: string;
  recipientEmail: string;
  action: MembershipStatusEmailAction;
  reason: string;
  effectiveDate: Date;
}

/**
 * Official notification sent to a member when an approved lifecycle decision
 * (suspend / terminate / reinstate) takes effect. The reason is shown as-is
 * (escaped); the message never contains internal review notes.
 */
export async function getMembershipStatusEmail({
  memberName,
  membershipId,
  action,
  reason,
  effectiveDate,
}: MembershipStatusEmailParams): Promise<string> {
  const branding = await getBranding();
  const emailBranding = await getEmailBranding();
  const name = escapeHtml(memberName);
  const memId = escapeHtml(membershipId);
  const safeReason = escapeHtml(reason);
  const dateLabel = escapeHtml(effectiveDate.toLocaleDateString());
  const orgName = escapeHtml(branding.orgName);

  const body =
    action === "suspend"
      ? `Your ${orgName} membership has been <strong>suspended</strong>, effective <strong>${dateLabel}</strong>. This means you cannot access the member portal or membership benefits until the matter is resolved.`
      : action === "terminate"
        ? `Your ${orgName} membership has been <strong>terminated</strong>, effective <strong>${dateLabel}</strong>.`
        : `Your ${orgName} membership has been <strong>reinstated as Active</strong>, effective <strong>${dateLabel}</strong>. You can sign in to the member portal again.`;

  const content = `
    <h2 style="margin:0 0 16px;color:#122840;font-size:20px;line-height:1.4;">Dear ${name},</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.7;">${body}</p>
    <div style="margin:0 0 16px;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;color:#475569;line-height:1.6;">
      <strong>Membership ID:</strong> ${memId}<br/>
      <strong>Reason recorded:</strong> ${safeReason}
    </div>
    <p style="margin:0 0 0;color:#64748b;font-size:13px;line-height:1.7;">
      If you believe this is in error, contact the
      <a href="mailto:${escapeHtml(emailBranding.supportEmail)}" style="color:#16a34a;">Vice President for Members</a>.
    </p>
  `;

  return wrapEmail("Membership Status", content);
}

/** Queue the membership-status notification (approved lifecycle decision). */
export async function queueMembershipStatusEmail(
  params: MembershipStatusEmailParams
): Promise<number | null> {
  const subject = await getLifecycleSubject(params.action);
  return queueEmail({
    recipientEmail: params.recipientEmail,
    subject,
    emailType: `MEMBERSHIP_${params.action.toUpperCase()}`,
    htmlBody: await getMembershipStatusEmail(params),
  });
}

// ============================================================================
// Helper: get org name (re-export for convenience)
// ============================================================================

async function getOrgName(): Promise<string> {
  return (await getBranding()).orgName;
}

// ============================================================================
// Test helpers (used by unit tests)
// ============================================================================

/**
 * Build nodemailer mail options from an EmailOptions object.
 * Used by tests to verify email content without actually sending.
 */
export function buildMailOptions(options: EmailOptions) {
  const config = getSmtpConfig();
  return {
    from: `"${config.fromName}" <${config.from}>`,
    to: options.recipientEmail,
    subject: options.subject,
    html: options.htmlBody,
    text: stripHtml(options.htmlBody),
  };
}

/**
 * Strip HTML tags for plain-text fallback.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * In-memory email log for testing (when no database is configured).
 */
const memoryEmailLog: EmailOptions[] = [];

export function clearMemoryEmailLog(): void {
  memoryEmailLog.length = 0;
}

export function getMemoryEmailLog(): EmailOptions[] {
  return [...memoryEmailLog];
}

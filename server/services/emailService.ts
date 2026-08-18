import { getDb } from "../db";
import { emailQueue } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import nodemailer, { type Transporter } from "nodemailer";

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
export function getMailTransport(): Transporter | null {
  const config = getSmtpConfig();
  if (!config.host) return null;
  if (cachedTransport === undefined) {
    cachedTransport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      // Some local relays are unauthenticated; only send auth when both are set.
      auth:
        config.user && config.pass
          ? { user: config.user, pass: config.pass }
          : undefined,
    });
  }
  return cachedTransport;
}

/** Best-effort plain-text version of an HTML body for clients that refuse HTML. */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Build the nodemailer mail options for a queued email. */
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

/** Send a test email through the configured relay. Throws on failure. */
export async function sendTestEmail(
  to: string,
  subject = "[MSA Pakistan] Test Email"
): Promise<void> {
  const transport = getMailTransport();
  if (!transport) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST (plus SMTP_USER, SMTP_PASSWORD and FROM_EMAIL as needed)."
    );
  }
  try {
    await transport.sendMail(
      buildMailOptions({
        recipientEmail: to,
        subject,
        emailType: "TEST",
        htmlBody: `
        <div style="font-family:Montserrat,Arial,sans-serif;padding:24px;">
          <h2 style="color:#122840;">✅ SMTP test successful</h2>
          <p style="color:#475569;">This email confirms the MSAP member portal can send mail through its configured SMTP relay.</p>
        </div>`,
      })
    );
  } catch (error) {
    // Rethrow a sanitized message so routers never echo raw nodemailer text
    // (auth failures can include the SMTP username).
    throw new Error(sanitizeEmailError(error));
  }
}

/**
 * In-memory email outbox used when no database is configured. Keeps the
 * password-setup flow observable in local development and in tests.
 */
const memoryEmailLog: EmailOptions[] = [];

export function getMemoryEmailLog(): readonly EmailOptions[] {
  return memoryEmailLog;
}

export function clearMemoryEmailLog() {
  memoryEmailLog.length = 0;
}

/**
 * Queue an email for sending
 */
export async function queueEmail(options: EmailOptions): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    // No database - keep a process-local outbox so the email lifecycle is
    // still observable in dev. Real sending is handled by processPendingEmails.
    memoryEmailLog.push(options);
    console.log(
      `[Email] (memory outbox) to=${options.recipientEmail} subject=${options.subject}`
    );
    return memoryEmailLog.length;
  }

  try {
    const result = await db.insert(emailQueue).values({
      recipientEmail: options.recipientEmail,
      subject: options.subject,
      emailType: options.emailType,
      htmlBody: options.htmlBody,
      status: "Pending",
      retryCount: 0,
      maxRetries: MAX_RETRIES,
    });

    return result[0].insertId || null;
  } catch (error) {
    console.error("[Email] Failed to queue email:", error);
    return null;
  }
}

/**
 * Process pending emails with retry logic.
 *
 * The process-local memory outbox (dev mode, no database) is always flushed
 * first so emails queued before a database became available are never
 * stranded. Then, when a database is present, up to 10 pending rows are
 * delivered over SMTP with the retry/perm-fail state machine.
 */
export async function processPendingEmails(): Promise<void> {
  await flushMemoryOutbox();

  const db = await getDb();
  if (!db) return;

  try {
    const pendingEmails = await db
      .select()
      .from(emailQueue)
      .where(eq(emailQueue.status, "Pending"))
      .limit(10);

    for (const email of pendingEmails) {
      await deliverQueuedEmail(email);
    }
  } catch (error) {
    console.error("[Email] Failed to process pending emails:", error);
  }
}

/** Flush the dev memory outbox. Failed sends are kept for the next tick. */
async function flushMemoryOutbox(): Promise<void> {
  if (memoryEmailLog.length === 0) return;
  const batch = memoryEmailLog.splice(0, memoryEmailLog.length);

  const transport = getMailTransport();
  if (!transport) {
    for (const mail of batch) {
      console.log(
        `[Email] (memory outbox, SMTP not configured) ${mail.recipientEmail}: ${mail.subject}`
      );
    }
    return;
  }

  for (const mail of batch) {
    try {
      await transport.sendMail(buildMailOptions(mail));
      console.log(
        `[Email] (memory outbox) SENT to ${mail.recipientEmail}: ${mail.subject}`
      );
    } catch (error) {
      console.error(
        `[Email] (memory outbox) FAILED to ${mail.recipientEmail}: ${mail.subject}`,
        sanitizeEmailError(error)
      );
      memoryEmailLog.push(mail); // retry on the next tick (matches DB behavior)
    }
  }
}

/**
 * Deliver one queued row and transition its status:
 *   Sent               on success
 *   retryCount + 1     on transient failure
 *   Permanent Failure  after maxRetries
 */
async function deliverQueuedEmail(email: {
  id: number;
  recipientEmail: string;
  subject: string;
  htmlBody: string | null;
  retryCount: number | null;
  maxRetries: number | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const retryCount = email.retryCount || 0;
  const maxRetries = email.maxRetries || MAX_RETRIES;

  if (retryCount >= maxRetries) {
    // Give up: mark as permanent failure and stop retrying.
    await db
      .update(emailQueue)
      .set({ status: "Permanent Failure", lastAttemptAt: new Date() })
      .where(eq(emailQueue.id, email.id));
    console.error(
      `[Email] Permanent failure after ${retryCount} retries: ${email.recipientEmail}: ${email.subject}`
    );
    return;
  }

  const transport = getMailTransport();
  if (!transport) {
    // SMTP not configured - don't burn retries; leave as pending so the email
    // is still delivered once a relay is configured. Warn once, not per tick.
    if (!warnedSmtpUnconfigured) {
      warnedSmtpUnconfigured = true;
      console.warn(
        "[Email] SMTP not configured - queued emails stay pending until SMTP_HOST (and SMTP_USER/SMTP_PASSWORD/FROM_EMAIL) are set."
      );
    }
    return;
  }

  try {
    await transport.sendMail(
      buildMailOptions({
        recipientEmail: email.recipientEmail,
        subject: email.subject,
        emailType: "",
        htmlBody: email.htmlBody ?? "",
      })
    );
    await db
      .update(emailQueue)
      .set({ status: "Sent", sentAt: new Date(), lastAttemptAt: new Date() })
      .where(eq(emailQueue.id, email.id));
    console.log(
      `[Email] Sent to ${email.recipientEmail}: ${email.subject}`
    );
  } catch (error) {
    console.error(
      `[Email] Delivery failed (attempt ${retryCount + 1}/${maxRetries}) to ${email.recipientEmail}: ${email.subject}`,
      sanitizeEmailError(error)
    );
    await db
      .update(emailQueue)
      .set({ retryCount: retryCount + 1, lastAttemptAt: new Date() })
      .where(eq(emailQueue.id, email.id));
  }
}

/**
 * Email templates for MSAP Member Portal.
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

export function getMembershipConfirmationEmail(memberName: string, membershipId: string): string {
  return `
    <h2>Welcome to MSAP Pakistan!</h2>
    <p>Dear ${escapeHtml(memberName)},</p>
    <p>Thank you for applying for membership with Medical Students' Association of Pakistan.</p>
    <p><strong>Your Membership ID:</strong> ${escapeHtml(membershipId)}</p>
    <p>Your application is under review. You will receive an email once it has been approved.</p>
    <p>Best regards,<br/>MSAP Pakistan Team</p>
  `;
}

export function getMembershipApprovedEmail(memberName: string, membershipId: string): string {
  return `
    <h2>Membership Approved!</h2>
    <p>Dear ${escapeHtml(memberName)},</p>
    <p>Congratulations! Your membership application has been approved.</p>
    <p><strong>Membership ID:</strong> ${escapeHtml(membershipId)}</p>
    <p>You can now access your membership portal and download your membership letter and card.</p>
    <p>Best regards,<br/>MSAP Pakistan Team</p>
  `;
}

export function getOpportunityApplicationEmail(
  memberName: string,
  opportunityTitle: string
): string {
  return `
    <h2>Application Received</h2>
    <p>Dear ${escapeHtml(memberName)},</p>
    <p>Thank you for applying to: <strong>${escapeHtml(opportunityTitle)}</strong></p>
    <p>We will review your application and get back to you soon.</p>
    <p>Best regards,<br/>MSAP Pakistan Team</p>
  `;
}

export function getVotingNotificationEmail(
  memberName: string,
  votingTitle: string,
  votingLink: string
): string {
  return `
    <h2>You're Invited to Vote</h2>
    <p>Dear ${escapeHtml(memberName)},</p>
    <p>You have been nominated as a voter for: <strong>${escapeHtml(votingTitle)}</strong></p>
    <p><a href="${safeLink(votingLink)}">Click here to vote</a></p>
    <p>Best regards,<br/>MSAP Pakistan Team</p>
  `;
}

export function getPositionApplicationEmail(
  memberName: string,
  positionTitle: string
): string {
  return `
    <h2>Position Application Received</h2>
    <p>Dear ${escapeHtml(memberName)},</p>
    <p>Thank you for applying for the position of: <strong>${escapeHtml(positionTitle)}</strong></p>
    <p>We will review your application and notify you of the next steps.</p>
    <p>Best regards,<br/>MSAP Pakistan Team</p>
  `;
}

export function getPositionSelectionEmail(
  memberName: string,
  positionTitle: string
): string {
  return `
    <h2>Congratulations!</h2>
    <p>Dear ${escapeHtml(memberName)},</p>
    <p>We are delighted to inform you that you have been selected for the position of: <strong>${escapeHtml(positionTitle)}</strong></p>
    <p>Your appointment letter will be sent to you shortly.</p>
    <p>Best regards,<br/>MSAP Pakistan Team</p>
  `;
}

// ============================================================================
// Password setup email
// ============================================================================

export const PASSWORD_SETUP_EMAIL_SUBJECT =
  "[MSA Pakistan] Set Up Your Member Portal Account";

export interface PasswordSetupEmailParams {
  memberName: string;
  membershipId: string;
  recipientEmail: string;
  setupUrl: string;
  expiresAt: Date;
}

/**
 * Branded password-setup email. Never contains the password or the raw setup
 * token beyond the clickable URL itself.
 */
export function getPasswordSetupEmail({
  memberName,
  membershipId,
  setupUrl,
  expiresAt,
}: PasswordSetupEmailParams): string {
  const name = escapeHtml(memberName);
  const memId = escapeHtml(membershipId);
  const hours = Math.max(
    1,
    Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))
  );
  const expiresLabel = `${hours} hour${hours === 1 ? "" : "s"}`;

  return `
    <div style="margin:0;padding:0;background:#f3f7f6;font-family:'Montserrat',Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f7f6;padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
              <tr>
                <td style="background:#122840;padding:28px 32px;text-align:center;">
                  <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">MSA Pakistan</div>
                  <div style="color:#4ade80;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Member Portal</div>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
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
                    <a href="mailto:vpm@msapakistan.org" style="color:#16a34a;">vpm@msapakistan.org</a> to request a new link.
                  </p>
                  <p style="margin:16px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.6;">
                    ⚠️ <strong>Security note:</strong> MSAP staff will never ask you for your password.
                    Only use this link to set a password, and never share it with anyone.
                  </p>
                </td>
              </tr>
            </table>
            <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">Medical Students' Association of Pakistan</p>
          </td>
        </tr>
      </table>
    </div>
  `;
}

/** Queue the one-time password-setup email for an approved member. */
export async function queuePasswordSetupEmail(
  params: PasswordSetupEmailParams
): Promise<number | null> {
  return queueEmail({
    recipientEmail: params.recipientEmail,
    subject: PASSWORD_SETUP_EMAIL_SUBJECT,
    emailType: "PASSWORD_SETUP",
    htmlBody: getPasswordSetupEmail(params),
  });
}

// ============================================================================
// Official setup email (super-admin provisioned officials)
// ============================================================================

export const OFFICIAL_SETUP_EMAIL_SUBJECT =
  "[MSA Pakistan] Set Up Your Official Portal Account";

/**
 * Branded password-setup email for an official portal account. Same link
 * mechanics as the member email but framed for officials (SUPCO, National
 * President, VPs, LC Presidents).
 */
export function getOfficialSetupEmail({
  name,
  positionLabel,
  setupUrl,
  expiresAt,
}: {
  name: string;
  positionLabel: string;
  setupUrl: string;
  expiresAt: Date;
}): string {
  const safeName = escapeHtml(name);
  const safePosition = escapeHtml(positionLabel);
  const hours = Math.max(
    1,
    Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))
  );
  const expiresLabel = `${hours} hour${hours === 1 ? "" : "s"}`;

  return `
    <div style="margin:0;padding:0;background:#f3f7f6;font-family:'Montserrat',Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f7f6;padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
              <tr>
                <td style="background:#122840;padding:28px 32px;text-align:center;">
                  <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">MSA Pakistan</div>
                  <div style="color:#4ade80;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Official Portal</div>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <h2 style="margin:0 0 16px;color:#122840;font-size:20px;line-height:1.4;">Welcome, ${safeName} 👋</h2>
                  <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.7;">
                    You have been given access to the MSAP Official Portal as
                    <strong>${safePosition}</strong>. Set a password to sign in:
                  </p>
                  <a href="${setupUrl}" style="display:inline-block;background:#1b355e;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:10px;">Set Up My Password</a>
                  <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.7;">
                    This secure link expires in <strong>${expiresLabel}</strong>. If it expires, the
                    super admin can issue a new link from the Officials Management page.
                  </p>
                  <p style="margin:16px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.6;">
                    ⚠️ <strong>Security note:</strong> Never share this link or your password.
                  </p>
                </td>
              </tr>
            </table>
            <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">Medical Students' Association of Pakistan</p>
          </td>
        </tr>
      </table>
    </div>
  `;
}

/** Queue the one-time password-setup email for an official account. */
export async function queueOfficialSetupEmail(params: {
  name: string;
  positionLabel: string;
  recipientEmail: string;
  setupUrl: string;
  expiresAt: Date;
}): Promise<number | null> {
  return queueEmail({
    recipientEmail: params.recipientEmail,
    subject: OFFICIAL_SETUP_EMAIL_SUBJECT,
    emailType: "OFFICIAL_SETUP",
    htmlBody: getOfficialSetupEmail(params),
  });
}

// ============================================================================
// Membership lifecycle emails (suspend / terminate / reinstate)
// ============================================================================

export type MembershipStatusEmailAction =
  | "suspend"
  | "terminate"
  | "reinstate";

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
export function getMembershipStatusEmail({
  memberName,
  membershipId,
  action,
  reason,
  effectiveDate,
}: MembershipStatusEmailParams): string {
  const name = escapeHtml(memberName);
  const memId = escapeHtml(membershipId);
  const safeReason = escapeHtml(reason);
  const dateLabel = escapeHtml(effectiveDate.toLocaleDateString());

  const body =
    action === "suspend"
      ? `Your MSA Pakistan membership has been <strong>suspended</strong>, effective <strong>${dateLabel}</strong>. This means you cannot access the member portal or membership benefits until the matter is resolved.`
      : action === "terminate"
        ? `Your MSA Pakistan membership has been <strong>terminated</strong>, effective <strong>${dateLabel}</strong>.`
        : `Your MSA Pakistan membership has been <strong>reinstated as Active</strong>, effective <strong>${dateLabel}</strong>. You can sign in to the member portal again.`;

  return `
    <div style="margin:0;padding:0;background:#f3f7f6;font-family:'Montserrat',Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f7f6;padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
              <tr>
                <td style="background:#122840;padding:28px 32px;text-align:center;">
                  <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">MSA Pakistan</div>
                  <div style="color:#4ade80;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Membership Status</div>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <h2 style="margin:0 0 16px;color:#122840;font-size:20px;line-height:1.4;">Dear ${name},</h2>
                  <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.7;">${body}</p>
                  <div style="margin:0 0 16px;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;color:#475569;line-height:1.6;">
                    <strong>Membership ID:</strong> ${memId}<br/>
                    <strong>Reason recorded:</strong> ${safeReason}
                  </div>
                  <p style="margin:0 0 0;color:#64748b;font-size:13px;line-height:1.7;">
                    If you believe this is in error, contact the
                    <a href="mailto:vpm@msapakistan.org" style="color:#16a34a;">Vice President for Members</a>.
                  </p>
                </td>
              </tr>
            </table>
            <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">Medical Students' Association of Pakistan</p>
          </td>
        </tr>
      </table>
    </div>
  `;
}

/** Queue the membership-status notification (approved lifecycle decision). */
export async function queueMembershipStatusEmail(
  params: MembershipStatusEmailParams
): Promise<number | null> {
  return queueEmail({
    recipientEmail: params.recipientEmail,
    subject: MEMBERSHIP_STATUS_EMAIL_SUBJECTS[params.action],
    emailType: `MEMBERSHIP_${params.action.toUpperCase()}`,
    htmlBody: getMembershipStatusEmail(params),
  });
}

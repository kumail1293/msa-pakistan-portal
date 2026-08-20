/**
 * MSAP membership workflow bridge.
 *
 * When MSAP_APPS_SCRIPT_URL is configured, the Google Apps Script is the
 * source of truth for membership workflow, approvals, and membership IDs.
 * When it is NOT configured, the portal operates fully offline: form
 * submissions are stored in the local membership_applications table and
 * admin approval creates the member account directly.
 */

import { childLogger } from "../_core/logger";

const log = childLogger("MembershipLocal");

export interface MembershipUpload {
  fileName: string;
  mimeType: string;
  base64: string;
}

export type MembershipApplication = {
  email: string;
  fullName: string;
  personalEmail?: string;
  contactNumber: string;
  age: number;
  dateOfBirth: string;
  cnic: string;
  gender: string;
  cityOfResidence: string;
  address: string;
  reasonForJoining: string;
  courseLevel: string;
  courseOfStudy: string;
  otherCourse?: string;
  yearOfStudy: string;
  institute: string;
  otherInstitute?: string;
  collegeRollNumber: string;
  discoverySources: string[];
  otherDiscoverySource?: string;
  profilePhoto: MembershipUpload;
  feeReceipt?: MembershipUpload;
  termsAccepted: true;
  undertakingAccepted: true;
  introductionAcknowledged: true;
  incompleteAcknowledgement: true;
  graduationDate?: string;
  cnicCopy?: MembershipUpload;
  conflictOfInterest: string;
  conflictOrganization?: string;
  conflictRole?: string;
  paymentAccountName: string;
};

export interface AppsScriptResponse<T = unknown> {
  ok: boolean;
  message?: string;
  data?: T;
  code?: string;
  error?: string;
}

function getAppsScriptUrl(): string {
  const url = process.env.MSAP_APPS_SCRIPT_URL?.trim();
  if (!url) {
    throw new Error("MSAP_APPS_SCRIPT_URL is not configured");
  }
  return url;
}

function hasAppsScript(): boolean {
  return !!process.env.MSAP_APPS_SCRIPT_URL?.trim();
}

function parseAppsScriptResponse<T>(text: string, status: number): AppsScriptResponse<T> {
  try {
    return JSON.parse(text) as AppsScriptResponse<T>;
  } catch {
    throw new Error(
      `MSAP Apps Script returned invalid JSON (${status}). ` +
      `The Apps Script Web App may have returned an HTML page or an unexpected response.`
    );
  }
}

/**
 * Apps Script Web Apps commonly return HTTP 302 from /exec and place the
 * actual response at the googleusercontent.com echo URL. Node fetch does not
 * safely preserve the POST method across a 302. We therefore follow the
 * redirect explicitly with another POST.
 */
async function postJsonWithAppsScriptRedirect<T>(
  payload: Record<string, unknown>
): Promise<AppsScriptResponse<T>> {
  const body = JSON.stringify(payload);
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  let url = getAppsScriptUrl();
  const maxRedirects = 3;

  for (let attempt = 0; attempt <= maxRedirects; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(
          `MSAP Apps Script returned HTTP ${response.status} without a redirect location.`
        );
      }
      url = new URL(location, url).toString();
      continue;
    }

    const text = await response.text();
    const parsed = parseAppsScriptResponse<T>(text, response.status);

    if (!response.ok || parsed.ok !== true) {
      throw new Error(
        parsed.message ||
          parsed.error ||
          `MSAP Apps Script request failed (${response.status})`
      );
    }

    return parsed;
  }

  throw new Error("MSAP Apps Script redirect chain exceeded the allowed limit.");
}

export async function postToMSAPAppsScript<T = unknown>(
  action: string,
  payload: Record<string, unknown>
): Promise<AppsScriptResponse<T>> {
  return postJsonWithAppsScriptRedirect<T>({
    action,
    ...payload,
  });
}

export async function submitMembershipApplication(
  application: MembershipApplication
) {
  // When Apps Script is not configured, store locally
  if (!hasAppsScript()) {
    return submitMembershipApplicationLocal(application);
  }

  const response = await postToMSAPAppsScript<{
    applicationRef?: string;
    applicationId?: string;
  }>("submitApplication", application);

  return response;
}

/**
 * Store a membership application locally (no Google Apps Script).
 * The application will be reviewed by an admin through the portal.
 */
async function submitMembershipApplicationLocal(
  application: MembershipApplication
): Promise<AppsScriptResponse<{ applicationRef?: string }>> {
  // Import here to avoid circular dependencies at module load
  const { getPoolDirect } = await import("../db");
  const pool = getPoolDirect();
  if (!pool) {
    throw new Error(
      "Neither MSAP_APPS_SCRIPT_URL nor DATABASE_URL is configured. " +
      "Cannot store membership application."
    );
  }

  try {
    const conn = await pool.getConnection();
    try {
      // Check for duplicate CNIC
      const [existing] = await conn.query(
        "SELECT id, status FROM membership_applications WHERE cnic = ?",
        [application.cnic]
      );
      const rows = existing as any[];
      if (rows.length > 0) {
        if (rows[0].status === "approved") {
          return {
            ok: false,
            message: "An application with this CNIC has already been approved.",
          };
        }
        if (rows[0].status === "pending") {
          return {
            ok: false,
            message: "An application with this CNIC is already pending review.",
          };
        }
      }

      // Check for duplicate email
      const [emailRows] = await conn.query(
        "SELECT id, status FROM membership_applications WHERE email = ?",
        [application.email]
      );
      const eRows = emailRows as any[];
      if (eRows.length > 0) {
        if (eRows[0].status === "approved") {
          return {
            ok: false,
            message: "An application with this email has already been approved.",
          };
        }
        if (eRows[0].status === "pending") {
          return {
            ok: false,
            message: "An application with this email is already pending review.",
          };
        }
      }

      // Store uploads in the local filesystem via storagePut
      const { storagePut } = await import("../storage");
      let profilePhotoUrl: string | null = null;
      let feeReceiptUrl: string | null = null;
      let cnicCopyUrl: string | null = null;

      if (application.profilePhoto) {
        const buf = Buffer.from(application.profilePhoto.base64, "base64");
        const ext = application.profilePhoto.mimeType.includes("png") ? ".png" : ".jpg";
        const key = `applications/photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        const result = await storagePut(key, buf, application.profilePhoto.mimeType);
        profilePhotoUrl = result.url;
      }

      if (application.feeReceipt) {
        const buf = Buffer.from(application.feeReceipt.base64, "base64");
        const ext = application.feeReceipt.mimeType.includes("pdf") ? ".pdf" : ".jpg";
        const key = `applications/receipts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        const result = await storagePut(key, buf, application.feeReceipt.mimeType);
        feeReceiptUrl = result.url;
      }

      if (application.cnicCopy) {
        const buf = Buffer.from(application.cnicCopy.base64, "base64");
        const ext = application.cnicCopy.mimeType.includes("pdf") ? ".pdf" : ".jpg";
        const key = `applications/cnic/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        const result = await storagePut(key, buf, application.cnicCopy.mimeType);
        cnicCopyUrl = result.url;
      }

      // Insert the application
      await conn.query(
        `INSERT INTO membership_applications
          (email, fullName, personalEmail, contactNumber, age, dateOfBirth,
           cnic, gender, cityOfResidence, address, reasonForJoining,
           courseLevel, courseOfStudy, otherCourse, yearOfStudy, institute,
           otherInstitute, collegeRollNumber, discoverySources, otherDiscoverySource,
           paymentAccountName, graduationDate, conflictOfInterest, conflictOrganization,
           conflictRole, profilePhotoUrl, feeReceiptUrl, cnicCopyUrl,
           termsAccepted, undertakingAccepted, introductionAcknowledged,
           incompleteAcknowledgement, status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          application.email,
          application.fullName,
          application.personalEmail || null,
          application.contactNumber,
          application.age,
          application.dateOfBirth,
          application.cnic,
          application.gender,
          application.cityOfResidence,
          application.address,
          application.reasonForJoining,
          application.courseLevel,
          application.courseOfStudy,
          application.otherCourse || null,
          application.yearOfStudy,
          application.institute,
          application.otherInstitute || null,
          application.collegeRollNumber,
          JSON.stringify(application.discoverySources),
          application.otherDiscoverySource || null,
          application.paymentAccountName,
          application.graduationDate || null,
          application.conflictOfInterest || "No",
          application.conflictOrganization || null,
          application.conflictRole || null,
          profilePhotoUrl,
          feeReceiptUrl,
          cnicCopyUrl,
          application.termsAccepted,
          application.undertakingAccepted,
          application.introductionAcknowledged,
          application.incompleteAcknowledgement,
          "pending",
        ]
      );

      return {
        ok: true,
        message: "Application submitted successfully. It will be reviewed by an administrator.",
        data: { applicationRef: `LOCAL-${Date.now()}` },
      };
    } finally {
      conn.release();
    }
  } catch (error) {
    log.error({ err: error }, "Failed to store application");
    throw new Error("Failed to store membership application locally.");
  }
}

// ============ Local membership lookup (offline mode) ============

/**
 * Look up a member from the local membership_applications table.
 * Used when MSAP_APPS_SCRIPT_URL is not configured.
 */
export async function lookupLocalMembership(
  identifier: string
): Promise<MembershipLookup | null> {
  const { getPoolDirect } = await import("../db");
  const pool = getPoolDirect();
  if (!pool) return null;

  try {
    const conn = await pool.getConnection();
    try {
      // Search by membership ID, email, or CNIC
      const [rows] = await conn.query(
        `SELECT * FROM membership_applications
         WHERE status = 'approved'
           AND (membershipId = ? OR email = ? OR personalEmail = ? OR cnic = ?)
         LIMIT 1`,
        [identifier, identifier, identifier, identifier]
      );
      const appRows = rows as any[];
      if (appRows.length === 0) return null;

      const row = appRows[0];
      return {
        found: true,
        approved: true,
        membershipId: row.membershipId ?? undefined,
        email: row.email ?? undefined,
        personalEmail: row.personalEmail ?? undefined,
        name: row.fullName ?? undefined,
        phone: row.contactNumber ?? undefined,
        discipline: row.courseOfStudy ?? undefined,
        yearOfStudy: row.yearOfStudy ?? undefined,
        graduationYear: row.graduationDate ?? undefined,
        institute: row.institute ?? undefined,
        localCouncil: undefined,
        status: "Active",
        profilePhotoUrl: row.profilePhotoUrl ?? undefined,
      };
    } finally {
      conn.release();
    }
  } catch (error) {
    log.warn({ err: error }, "Lookup failed");
    return null;
  }
}

/**
 * Safe subset of an approved member's workflow record exposed to the portal.
 * Deliberately excludes CNIC, address, admin comments and internal notes.
 */
export type MembershipLookup = {
  found: boolean;
  approved: boolean;
  membershipId?: string;
  email?: string;
  personalEmail?: string;
  name?: string;
  phone?: string;
  discipline?: string;
  yearOfStudy?: string;
  graduationYear?: string;
  institute?: string;
  localCouncil?: string;
  status?: string;
  letterUrl?: string;
  cardUrl?: string;
  profilePhotoUrl?: string;
};

/**
 * Look up an approved member in the Google Apps Script registry.
 * Returns `null` when the registry is unreachable (or the deployed script
 * does not yet implement the lookupMember action), so callers can distinguish
 * "registry unavailable" from "member not found".
 */
export async function lookupMembership(
  identifier: string
): Promise<MembershipLookup | null> {
  // When Apps Script is not configured, fall back to local lookup
  if (!hasAppsScript()) {
    return lookupLocalMembership(identifier);
  }

  try {
    const response = await postToMSAPAppsScript<MembershipLookup>(
      "lookupMember",
      { identifier }
    );
    return response.data ?? null;
  } catch (error) {
    log.warn({ err: (error as Error).message }, "AppsScript lookupMember unavailable");
    return null;
  }
}

/**
 * MSAP membership workflow bridge.
 *
 * The Google Apps Script remains the source of truth for membership workflow,
 * approvals, membership IDs and document generation. The portal server talks
 * to the Apps Script web app server-to-server so the Google endpoint never
 * needs to be exposed to browser CORS or hold credentials in the client.
 */

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

function getAppsScriptUrl() {
  const url = process.env.MSAP_APPS_SCRIPT_URL?.trim();
  if (!url) {
    throw new Error("MSAP_APPS_SCRIPT_URL is not configured");
  }
  return url;
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
  const response = await postToMSAPAppsScript<{
    applicationRef?: string;
    applicationId?: string;
  }>("submitApplication", application);

  return response;
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
  try {
    const response = await postToMSAPAppsScript<MembershipLookup>(
      "lookupMember",
      { identifier }
    );
    return response.data ?? null;
  } catch (error) {
    console.warn(
      "[AppsScript] lookupMember unavailable:",
      (error as Error).message
    );
    return null;
  }
}

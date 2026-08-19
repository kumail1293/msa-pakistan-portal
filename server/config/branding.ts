/**
 * Branding Provider
 *
 * Single source of truth for all organization-specific display values.
 * Replaces hardcoded "MSA Pakistan" / "vpm@msapakistan.org" / colors
 * with database-configurable values from the configService.
 *
 * Usage:
 *   import { getBranding, getOrgName, getOrgEmail } from "./branding";
 *
 *   const branding = await getBranding();
 *   doc.text(`${branding.orgName} MEMBERSHIP LETTER`);
 *
 *   // Quick single-value access:
 *   const name = await getOrgName();          // "MSA Pakistan"
 *   const email = await getOrgEmail();        // "vpm@msapakistan.org"
 *   const primary = await getPrimaryColor();  // "#1B355E"
 */

import { getConfig } from "./configService";

// ============================================================================
// Full branding object (batch read for hot paths)
// ============================================================================

export interface Branding {
  orgName: string;
  orgFullName: string;
  orgShortName: string;
  orgEmail: string;
  orgWebsite: string;
  presidentName: string;
  presidentTitle: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
  faviconUrl: string;
}

/**
 * Get the full branding configuration. Use this when you need multiple
 * values at once (e.g., PDF generation, email templates).
 */
export async function getBranding(): Promise<Branding> {
  const [
    orgName,
    orgFullName,
    orgShortName,
    orgEmail,
    orgWebsite,
    presidentName,
    presidentTitle,
    primaryColor,
    secondaryColor,
    accentColor,
    logoUrl,
    faviconUrl,
  ] = await Promise.all([
    getConfig("brand.name", "MSA Pakistan"),
    getConfig("brand.fullName", "Medical Students' Association of Pakistan"),
    getConfig("brand.shortName", "MSAP"),
    getConfig("brand.email", "vpm@msapakistan.org"),
    getConfig("brand.website", "https://msapakistan.org"),
    getConfig("brand.presidentName", "Kumail Danial"),
    getConfig("brand.presidentTitle", "National President"),
    getConfig("brand.color.primary", "#1B355E"),
    getConfig("brand.color.secondary", "#2E7D32"),
    getConfig("brand.color.accent", "#FFC107"),
    getConfig("brand.logoUrl", ""),
    getConfig("brand.faviconUrl", ""),
  ]);

  return {
    orgName,
    orgFullName,
    orgShortName,
    orgEmail,
    orgWebsite,
    presidentName,
    presidentTitle,
    primaryColor,
    secondaryColor,
    accentColor,
    logoUrl,
    faviconUrl,
  };
}

// ============================================================================
// Quick single-value accessors (for when you only need one value)
// ============================================================================

export async function getOrgName(): Promise<string> {
  return getConfig("brand.name", "MSA Pakistan");
}

export async function getOrgFullName(): Promise<string> {
  return getConfig("brand.fullName", "Medical Students' Association of Pakistan");
}

export async function getOrgShortName(): Promise<string> {
  return getConfig("brand.shortName", "MSAP");
}

export async function getOrgEmail(): Promise<string> {
  return getConfig("brand.email", "vpm@msapakistan.org");
}

export async function getOrgWebsite(): Promise<string> {
  return getConfig("brand.website", "https://msapakistan.org");
}

export async function getPresidentName(): Promise<string> {
  return getConfig("brand.presidentName", "Kumail Danial");
}

export async function getPresidentTitle(): Promise<string> {
  return getConfig("brand.presidentTitle", "National President");
}

export async function getPrimaryColor(): Promise<string> {
  return getConfig("brand.color.primary", "#1B355E");
}

export async function getSecondaryColor(): Promise<string> {
  return getConfig("brand.color.secondary", "#2E7D32");
}

export async function getAccentColor(): Promise<string> {
  return getConfig("brand.color.accent", "#FFC107");
}

// ============================================================================
// Email-specific branding
// ============================================================================

export interface EmailBranding {
  senderName: string;
  senderEmail: string;
  supportEmail: string;
  headerBgColor: string;
  footerText: string;
}

/**
 * Get email-specific branding configuration.
 */
export async function getEmailBranding(): Promise<EmailBranding> {
  const [senderName, senderEmail, supportEmail, headerBgColor, footerText] =
    await Promise.all([
      getConfig("email.senderName", "MSA Pakistan"),
      getConfig("email.senderEmail", "no-reply@msapakistan.org"),
      getConfig("email.supportEmail", "vpm@msapakistan.org"),
      getConfig("email.headerBgColor", "#1B355E"),
      getConfig(
        "email.footerText",
        "Best regards,<br/>MSA Pakistan Team"
      ),
    ]);

  return { senderName, senderEmail, supportEmail, headerBgColor, footerText };
}

// ============================================================================
// Membership-specific branding
// ============================================================================

/**
 * Get the membership ID prefix (e.g., "MSAP" for MSAP-K1-0001).
 */
export async function getMembershipPrefix(): Promise<string> {
  return getConfig("membership.prefix", "MSAP");
}

/**
 * Get the card serial number prefix.
 */
export async function getSerialPrefix(): Promise<string> {
  return getConfig("membership.serialPrefix", "MSAP");
}

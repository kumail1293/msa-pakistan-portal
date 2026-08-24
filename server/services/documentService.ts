import { storagePut } from "../storage";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { MemberCardData } from "./memberAccountService";
import { getBranding, getOrgName, getOrgFullName, getOrgShortName, getPresidentName, getSerialPrefix } from "../config/branding";
import { getTermDisplayString } from "../config/termService";
import { childLogger } from "../_core/logger";

const log = childLogger("CardPdf");

/**
 * Directory of this module, independent of the process working directory.
 * The logo PNGs live in client/src/assets/msap/ relative to server/services/.
 */
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const MSAP_ASSETS_DIR = path.resolve(MODULE_DIR, "..", "..", "client", "src", "assets", "msap");

/**
 * Document Service for MSAP Member Portal
 * Generates membership letters, cards, and certificates
 */

interface MembershipLetterContext {
  memberName: string;
  cnic: string;
  membershipId: string;
  institution: string;
  degree: string;
  localCouncilName: string;
  issueDate: Date;
  presidentName?: string;
  presidentSignature?: string;
}

interface MembershipCardContext {
  memberName: string;
  cnic: string;
  membershipId: string;
  localCouncilName: string;
  position?: string;
  issueDate: Date;
  expiryDate: Date;
  presidentName?: string;
  lcLogoUrl?: string;
}

interface CertificateContext {
  memberName: string;
  certificateType: string;
  achievementTitle: string;
  issueDate: Date;
  presidentName?: string;
  presidentSignature?: string;
}

/**
 * Generate membership letter PDF
 */
export async function generateMembershipLetter(
  memberId: number,
  context: MembershipLetterContext
): Promise<{ url: string; key: string }> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
  });

  // Create PDF content (branding-aware)
  const branding = await getBranding();
  doc.fontSize(20).font("Helvetica-Bold").text(`${branding.orgShortName.toUpperCase()} PAKISTAN`, { align: "center" });
  doc.fontSize(12).font("Helvetica").text(branding.orgFullName, { align: "center" });
  doc.moveDown();

  doc.fontSize(14).font("Helvetica-Bold").text("MEMBERSHIP LETTER", { align: "center" });
  doc.moveDown(2);

  doc.fontSize(11).font("Helvetica").text(`Date: ${context.issueDate.toLocaleDateString()}`);
  doc.moveDown();

  doc.text(context.memberName);
  doc.text(context.institution);
  doc.moveDown();

  doc.fontSize(12).font("Helvetica-Bold").text(`Dear ${context.memberName},`);
  doc.moveDown();

  doc.fontSize(11).font("Helvetica").text(
    `This is to certify that ${context.memberName} is a member of Medical Students' Association of Pakistan.`
  );
  doc.moveDown();

  doc.text(`Membership ID: ${context.membershipId}`);
  doc.text(`CNIC: ${context.cnic}`);
  doc.text(`Degree: ${context.degree}`);
  doc.text(`Local Council: ${context.localCouncilName}`);
  doc.moveDown();

  doc.text(
    `The member is entitled to all privileges and benefits as per the Constitution and Bylaws of ${branding.orgName}.`
  );
  doc.moveDown(2);

  doc.text("Authorized by:");
  doc.moveDown();
  doc.text(context.presidentName || `${branding.presidentName}, ${branding.presidentTitle}`);

  // Convert to buffer
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on("end", async () => {
      const buffer = Buffer.concat(chunks);
      const key = `membership-letters/${memberId}-${Date.now()}.pdf`;

      try {
        const result = await storagePut(key, buffer, "application/pdf");
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });

    doc.on("error", reject);
    doc.end();
  });
}

/**
 * Generate membership card PDF
 */
export async function generateMembershipCard(
  memberId: number,
  context: MembershipCardContext
): Promise<{ url: string; key: string }> {
  const doc = new PDFDocument({
    size: [200, 320], // Card size in points (approximately 3.5" x 5.6")
    margin: 10,
  });

  // Card background (simulated with border)
  doc.rect(10, 10, 180, 300).stroke();

  // Logo area (branding-aware)
  const letterBranding = await getBranding();
  doc.fontSize(10).font("Helvetica-Bold").text(letterBranding.orgShortName, { align: "center" });
  doc.fontSize(8).font("Helvetica").text(letterBranding.orgName.replace(/.*of\s*/i, ""), { align: "center" });
  doc.moveDown();

  // Member name
  doc.fontSize(12).font("Helvetica-Bold").text(context.memberName, { align: "center" });
  doc.moveDown();

  // Membership ID
  doc.fontSize(9).font("Helvetica").text(`ID: ${context.membershipId}`, { align: "center" });

  // CNIC (last 4 digits)
  const cnicLast4 = context.cnic.slice(-4);
  doc.fontSize(8).font("Helvetica").text(`CNIC: ****${cnicLast4}`, { align: "center" });
  doc.moveDown();

  // Local Council
  doc.fontSize(9).font("Helvetica").text(context.localCouncilName, { align: "center" });

  // Position if available
  if (context.position) {
    doc.fontSize(8).font("Helvetica").text(context.position, { align: "center" });
  }

  doc.moveDown();

  // Validity dates
  doc.fontSize(7).font("Helvetica").text(
    `Valid: ${context.issueDate.toLocaleDateString()} - ${context.expiryDate.toLocaleDateString()}`,
    { align: "center" }
  );

  // President signature area
  doc.moveDown(2);
  doc.fontSize(8).font("Helvetica").text("President Signature", { align: "center" });

  // Convert to buffer
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on("end", async () => {
      const buffer = Buffer.concat(chunks);
      const key = `membership-cards/${memberId}-${Date.now()}.pdf`;

      try {
        const result = await storagePut(key, buffer, "application/pdf");
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });

    doc.on("error", reject);
    doc.end();
  });
}

/**
 * ============================================================================
 * PREMIUM MEMBERSHIP CARD PDF (print-ready CR80)
 *
 * Mirrors the client-side card: navy->teal gradient, gold guilloche frame,
 * rippled-ring pattern, holographic patch, microtext band, HMAC verification
 * QR, MSAP logos, holder + National President signatures and issue/expiry.
 * Renders into a PDF Buffer (no storage dependency) so it can be streamed
 * directly to the browser for printing.
 * ============================================================================
 */

// CR80 credit card: 85.6mm x 54mm in PostScript points.
const CR80_W = 242.65;
const CR80_H = 153.07;
// Client card was 340x214 CSS px; everything scales by this factor.
const S = CR80_W / 340;

const C_NAVY = "#16284A";
const C_NAVY_2 = "#1B355E";
const C_TEAL = "#0E5D4D";
const C_GOLD = "#C9A227";
const C_GOLD_SOFT = "#E4C568";
const C_GOLD_MID = "#D9B45A";
const C_GOLD_LIGHT = "#F2DEA0";
const C_GOLD_DARK = "#8F6B1C";
const C_IVORY = "#F7F4EA";
const C_INK = "#23344E";
const C_INK_SOFT = "#4A5B74";

/** Deterministic serial number: {prefix}-{year}-{digits from the membership ID}. */
async function serialOfPdf(
  membershipId: string,
  issuedAt: string | Date | null | undefined
): Promise<string> {
  const prefix = await getSerialPrefix();
  const digits = (membershipId.match(/\d+/g) ?? []).join("").slice(0, 6);
  const year = issuedAt ? new Date(issuedAt).getFullYear() : new Date().getFullYear();
  return `${prefix}-${year}-${(digits || "0001").padStart(4, "0")}`;
}

/** Draw a deterministic Code-128-style barcode (bars only, navy ink). */
function drawBarcodePdf(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  membershipId: string
) {
  let seed = 0;
  for (let i = 0; i < membershipId.length; i++) {
    seed = (seed * 31 + membershipId.charCodeAt(i)) >>> 0;
  }
  doc.save().fillColor(C_NAVY);
  let bx = x;
  for (let i = 0; i < 40; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const bw = 0.5 + (seed % 10) * 0.12;
    const gap = 0.7 + (seed % 5) * 0.12;
    if (seed % 3 !== 0) doc.rect(bx, y, bw, h).fill();
    bx += bw + gap;
  }
  doc.restore();
}

const MONO_FONT = "Courier";
const MONO_FONT_BOLD = "Courier-Bold";

let warnedMissingPortalBaseUrl = false;

/** Base URL embedded in the verification QR; defaults to localhost in dev. */
function portalBaseUrl(): string {
  const base = process.env.PORTAL_BASE_URL;
  if (!base && !warnedMissingPortalBaseUrl) {
    warnedMissingPortalBaseUrl = true;
    log.warn("PORTAL_BASE_URL not set — verification QRs will point at localhost");
  }
  return base || `http://localhost:${process.env.PORT || 3000}`;
}

/** px (client design) -> pt (pdfkit). */
const pt = (px: number) => px * 0.75;
const px = (v: number) => v * S;

/**
 * Guilloché rippled rings — same algorithm as the client card, returned as
 * SVG path strings that pdfkit's doc.path() can stroke directly.
 */
function guillocheRings(): string[] {
  const cx = 170;
  const cy = 110;
  const paths: string[] = [];
  for (let r = 22; r <= 230; r += 11) {
    let d = "";
    const steps = 96;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const ripple = r + Math.sin(a * 7 + r * 0.25) * 2.4;
      const x = cx + Math.cos(a) * ripple;
      const y = cy + Math.sin(a) * ripple;
      d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    paths.push(`${d} Z`);
  }
  return paths;
}

function guillocheRays(): Array<[number, number, number, number]> {
  const cx = 170;
  const cy = 110;
  const rays: Array<[number, number, number, number]> = [];
  for (let a = 0; a < 360; a += 6) {
    const rad = (a * Math.PI) / 180;
    rays.push([cx, cy, cx + Math.cos(rad) * 200, cy + Math.sin(rad) * 200]);
  }
  return rays;
}

let cachedLogoWhite: Buffer | null | undefined;
let cachedLogoVertical: Buffer | null | undefined;

function loadLogo(
  file: "logo-horizontal-compact-white.png" | "logo-vertical-white.png"
): Buffer | null {
  const cache = file === "logo-horizontal-compact-white.png" ? cachedLogoWhite : cachedLogoVertical;
  if (cache !== undefined) return cache;
  try {
    const logoPath = path.join(MSAP_ASSETS_DIR, file);
    const buffer = fs.readFileSync(logoPath);
    if (file === "logo-horizontal-compact-white.png") cachedLogoWhite = buffer;
    else cachedLogoVertical = buffer;
    return buffer;
  } catch {
    if (file === "logo-horizontal-compact-white.png") cachedLogoWhite = null;
    else cachedLogoVertical = null;
    return null;
  }
}

/**
 * True for hostnames that could reach internal infrastructure (SSRF guard).
 * Blocks literal IP literals in private/loopback/link-local/documentation
 * ranges and ambiguous localhost aliases before any DNS resolution happens.
 */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h === "localhost.localdomain" || h.endsWith(".localhost")) {
    return true;
  }
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const octets = ipv4.slice(1).map(Number);
  if (octets.some((o) => o > 255)) return true; // malformed
  const [a, b] = octets;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 ||
    a === 192 && b === 168 ||
    a >= 224
  );
}

/** Max bytes we will fetch from a remote image (1 MB) to bound memory. */
const MAX_REMOTE_IMAGE_BYTES = 1_000_000;

/**
 * Fetch an http(s) image or decode a data URL into a Buffer (best effort).
 * Remote fetches are SSRF-guarded: https only (no plaintext http), no
 * private/loopback hosts, and a hard size cap.
 */
async function imageToBuffer(
  src: string | null | undefined
): Promise<Buffer | null> {
  if (!src) return null;
  try {
    if (src.startsWith("data:")) {
      const comma = src.indexOf(",");
      if (comma === -1) return null;
      return Buffer.from(src.slice(comma + 1), "base64");
    }
    if (/^https:\/\//i.test(src)) {
      const url = new URL(src);
      if (isPrivateHost(url.hostname)) return null;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const contentLength = Number(resp.headers.get("content-length") || "0");
      if (contentLength > MAX_REMOTE_IMAGE_BYTES) return null;
      const reader = resp.body?.getReader();
      if (!reader) return null;
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_REMOTE_IMAGE_BYTES) return null;
        chunks.push(value);
      }
      return Buffer.concat(chunks.map((c) => Buffer.from(c)));
    }
    return null;
  } catch {
    return null;
  }
}

function formatDatePdf(
  d: string | Date | null | undefined,
  monthYear = false
): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(
    "en-GB",
    monthYear
      ? { month: "short", year: "numeric" }
      : { day: "2-digit", month: "short", year: "numeric" }
  );
}

function initialsOf(name: string | null | undefined): string {
  if (!name) return "M";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "M"
  );
}

/** A flowing calligraphic flourish used under the President's name. */
function drawPresidentFlourish(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number
) {
  doc
    .save()
    .strokeColor(C_GOLD_SOFT)
    .lineWidth(1.1)
    .strokeOpacity(0.9)
    .moveTo(x, y + h * 0.55)
    .bezierCurveTo(x + w * 0.15, y, x + w * 0.3, y + h, x + w * 0.42, y + h * 0.35)
    .bezierCurveTo(x + w * 0.52, y - h * 0.2, x + w * 0.62, y + h * 0.9, x + w * 0.72, y + h * 0.3)
    .bezierCurveTo(x + w * 0.82, y - h * 0.15, x + w * 0.92, y + h * 0.6, x + w, y + h * 0.45)
    .stroke()
    .restore();
}

/**
 * Render the premium membership card to a PDF Buffer.
 */
export async function generatePremiumMembershipCardPdf(
  card: MemberCardData
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [CR80_W, CR80_H],
    margin: 0,
    info: {
      Title: `${await getOrgShortName()} Membership Card - ${card.memberName}`,
      Author: "Medical Students' Association of Pakistan",
      Subject: "National Membership Card",
      CreationDate: new Date(),
    },
  });

  // ---------- Background ----------
  const bg = doc.linearGradient(0, CR80_H, CR80_W, 0);
  bg.stop(0, C_NAVY).stop(0.42, C_NAVY_2).stop(1, C_TEAL);
  doc.rect(0, 0, CR80_W, CR80_H).fill(bg);

  // Clip everything decorative to the rounded card shape.
  doc.save().roundedRect(0, 0, CR80_W, CR80_H, px(12)).clip();

  // Guilloché pattern (subtle rays + rippled rings — no dense cross-hatch).
  doc.save();
  for (const [x1, y1, x2, y2] of guillocheRays()) {
    doc
      .moveTo(px(x1), px(y1))
      .lineTo(px(x2), px(y2))
      .lineWidth(0.3)
      .strokeColor("#ffffff")
      .strokeOpacity(0.028)
      .stroke();
  }
  const ringTones = ["#ffffff", C_GOLD_SOFT];
  guillocheRings().forEach((d, i) => {
    doc
      .save()
      .path(d)
      .lineWidth(0.45)
      .strokeColor(ringTones[i % 2] ?? "#ffffff")
      .strokeOpacity(0.055)
      .stroke()
      .restore();
  });
  doc.restore();

  // Diagonal sheen — subtle light sweep matching the client card.
  const sheen = doc.linearGradient(0, CR80_H, CR80_W, 0);
  sheen
    .stop(0, "#ffffff")
    .stop(0.42, "#ffffff")
    .stop(0.62, C_NAVY)
    .stop(1, C_NAVY);
  doc.save().opacity(0.1).rect(0, 0, CR80_W, CR80_H).fill(sheen).restore();

  // Watermark emblem (faint vertical logo, right side).
  const verticalLogo = loadLogo("logo-vertical-white.png");
  if (verticalLogo) {
    doc.save().opacity(0.08).image(verticalLogo, px(248), px(56), { width: px(96) }).restore();
  }

  // Corner ornaments (gold flourishes).
  doc.save().strokeColor(C_GOLD_SOFT).lineWidth(0.9).strokeOpacity(0.9);
  const c = 8 * S;
  doc
    .moveTo(px(6) + c, px(6))
    .lineTo(px(6), px(6))
    .lineTo(px(6), px(6) + c)
    .moveTo(CR80_W - px(6) - c, px(6))
    .lineTo(CR80_W - px(6), px(6))
    .lineTo(CR80_W - px(6), px(6) + c)
    .moveTo(CR80_W - px(6) - c, CR80_H - px(6))
    .lineTo(CR80_W - px(6), CR80_H - px(6))
    .lineTo(CR80_W - px(6), CR80_H - px(6) - c)
    .moveTo(px(6) + c, CR80_H - px(6))
    .lineTo(px(6), CR80_H - px(6))
    .lineTo(px(6), CR80_H - px(6) - c)
    .stroke();
  doc.restore();

  // ---------- Header ----------
  const logo = loadLogo("logo-horizontal-compact-white.png");
  const headerBranding = await getBranding();
  if (logo) {
    doc.image(logo, px(14), px(11), { width: px(90) });
  } else {
    doc
      .font("Helvetica-Bold")
      .fontSize(pt(8))
      .fillColor("#ffffff")
      .text(`${headerBranding.orgShortName.toUpperCase()} PAKISTAN`, px(14), px(14));
  }
  doc
    .font("Helvetica-Bold")
    .fontSize(pt(5.7))
    .fillColor("#ffffff")
    .text("NATIONAL MEMBERSHIP CARD", px(110), px(11), {
      width: CR80_W - px(14) - px(110) - px(8),
      align: "right",
      characterSpacing: 1.1,
    });
  doc
    .font("Helvetica")
    .fontSize(pt(4.2))
    .fillColor(C_GOLD_SOFT)
    .text(
      `${await getTermDisplayString()} · ${(card.status || "MEMBER").toUpperCase()}`,
      px(110),
      px(18.5),
      {
        width: CR80_W - px(14) - px(110) - px(8),
        align: "right",
        characterSpacing: 1.4,
      }
    );

  // Gold hairline under the header.
  const headLineY = px(37);
  const headLine = doc.linearGradient(px(14), headLineY, CR80_W - px(14), headLineY);
  headLine
    .stop(0, C_GOLD_SOFT)
    .stop(1, "#1B355E");
  doc.save().opacity(0.85).rect(px(14), headLineY, CR80_W - px(28), 0.75).fill(headLine).restore();

  // ---------- Holographic security seal (gold foil, matching the card) ----------
  const holCx = CR80_W - px(12) - px(15);
  const holCy = px(10) + px(15);
  const holR = px(15);
  const holGrad = doc.linearGradient(holCx - holR, holCy - holR, holCx + holR, holCy + holR);
  holGrad
    .stop(0, "#ffffff")
    .stop(0.38, C_GOLD_SOFT)
    .stop(0.75, "#A0781E")
    .stop(1, C_GOLD);
  doc.save().circle(holCx, holCy, holR).fill(holGrad);
  doc
    .circle(holCx, holCy, holR)
    .lineWidth(0.8)
    .strokeColor("#ffffff")
    .strokeOpacity(0.55)
    .stroke();
  const shortName = await getOrgShortName();
  doc
    .font("Helvetica-Bold")
    .fontSize(pt(5.2))
    .fillColor(C_NAVY)
    .text(shortName, holCx - holR, holCy - pt(3.5), { width: holR * 2, align: "center" });
  doc.restore();

  // ---------- Body: photo + identity ----------
  const bodyTop = px(45);
  const bodyLeft = px(14);
  const photoW = px(58);
  const photoH = px(72);

  // Photo box.
  const photo = await imageToBuffer(card.photoUrl);
  doc.save().roundedRect(bodyLeft, bodyTop, photoW, photoH, px(9)).clip();
  if (photo) {
    doc.image(photo, bodyLeft, bodyTop, { width: photoW, height: photoH });
  } else {
    doc
      .rect(bodyLeft, bodyTop, photoW, photoH)
      .fillOpacity(0.12)
      .fill("#ffffff");
    doc
      .font("Helvetica-Bold")
      .fontSize(pt(18))
      .fillColor("#ffffff")
      .text(initialsOf(card.memberName), bodyLeft, bodyTop + photoH / 2 - pt(10), {
        width: photoW,
        align: "center",
      });
  }
  doc.restore();
  // Gold photo border.
  doc.save().roundedRect(bodyLeft, bodyTop, photoW, photoH, px(9)).lineWidth(1).strokeColor(C_GOLD_SOFT).strokeOpacity(0.9).stroke().restore();
  doc
    .font("Helvetica-Bold")
    .fontSize(pt(3.6))
    .fillColor("#ffffff")
    .fillOpacity(0.85)
    .text("MEMBER", bodyLeft, bodyTop + photoH - pt(6), {
      width: photoW,
      align: "center",
      characterSpacing: 1.4,
    });
  doc.fillOpacity(1);

  // Identity column.
  const identityX = bodyLeft + photoW + px(11);
  const identityW = CR80_W - px(14) - px(46) - identityX; // leave room for the QR
  doc
    .font("Helvetica-Bold")
    .fontSize(pt(11))
    .fillColor("#ffffff")
    .text(card.memberName, identityX, bodyTop - 2, {
      width: identityW,
      ellipsis: true,
      lineBreak: false,
    });

  // Membership ID chip.
  const idText = card.membershipId || "—";
  const idWidth = Math.min(
    identityW,
    doc.font(MONO_FONT_BOLD).fontSize(pt(6)).widthOfString(idText) + px(12)
  );
  doc.save().roundedRect(identityX, bodyTop + pt(11), idWidth, pt(8), 2).lineWidth(0.6).strokeColor(C_GOLD_SOFT).strokeOpacity(0.8).stroke();
  doc
    .font(MONO_FONT_BOLD)
    .fontSize(pt(5.2))
    .fillColor(C_GOLD_SOFT)
    .text(idText, identityX + px(6), bodyTop + pt(12.4));
  doc.restore();

  // Serial number + revision (mono, gold) under the ID chip.
  doc
    .font(MONO_FONT)
    .fontSize(pt(3.4))
    .fillColor(C_GOLD_SOFT)
    .fillOpacity(0.95)
    .text(
      `SERIAL ${serialOfPdf(card.membershipId, card.issuedAt)} · REV ${card.version}`,
      identityX,
      bodyTop + pt(21.5),
      { width: identityW, characterSpacing: 0.6 }
    );
  doc.fillOpacity(1);

  // Local council / institute.
  const detailTop = bodyTop + pt(22);
  const colW = identityW / 2;
  const label = (text: string) =>
    doc.font("Helvetica-Bold").fontSize(pt(3.2)).fillColor("#ffffff").fillOpacity(0.6);
  const value = (text: string) =>
    doc.font("Helvetica-Bold").fontSize(pt(4.6)).fillColor("#ffffff").fillOpacity(1);
  label("LOCAL COUNCIL").text("LOCAL COUNCIL", identityX, detailTop, { width: colW, characterSpacing: 1 });
  value(card.localCouncil || "—").text(card.localCouncil || "—", identityX, detailTop + pt(4));
  label("INSTITUTE").text("INSTITUTE", identityX + colW, detailTop, { width: colW, characterSpacing: 1 });
  value(card.institution || "—").text(card.institution || "—", identityX + colW, detailTop + pt(4), { width: colW });

  const detailTop2 = detailTop + pt(12);
  label("DISCIPLINE").text("DISCIPLINE", identityX, detailTop2, { width: colW, characterSpacing: 1 });
  value(card.discipline || "—").text(card.discipline || "—", identityX, detailTop2 + pt(4), { width: colW });
  label("YEAR").text("YEAR", identityX + colW, detailTop2, { width: colW, characterSpacing: 1 });
  value(card.graduationYear ? `GRADUATE ${card.graduationYear}` : card.yearOfStudy || "—").text(
    card.graduationYear ? `Graduate ${card.graduationYear}` : card.yearOfStudy || "—",
    identityX + colW,
    detailTop2 + pt(4),
    { width: colW }
  );

  // ---------- QR verification chip ----------
  const qrSize = px(42);
  const qrX = CR80_W - px(14) - qrSize - px(4);
  const qrY = bodyTop;
  if (card.verificationToken && card.membershipId) {
    const verifyUrl = `${portalBaseUrl()}/verify?m=${encodeURIComponent(card.membershipId)}&t=${encodeURIComponent(card.verificationToken)}`;
    const qrBuf = await QRCode.toBuffer(verifyUrl, {
      width: 260,
      margin: 0,
      errorCorrectionLevel: "M",
    });
    doc.save().roundedRect(qrX, qrY, qrSize + px(6), qrSize + px(6), px(4)).fill("#ffffff");
    doc.image(qrBuf, qrX + px(3), qrY + px(3), { width: qrSize, height: qrSize });
    doc
      .font("Helvetica-Bold")
      .fontSize(pt(3))
      .fillColor("#ffffff")
      .fillOpacity(0.8)
      .text("SCAN TO VERIFY", qrX, qrY + qrSize + px(8), {
        width: qrSize + px(6),
        align: "center",
        characterSpacing: 1.4,
      });
    doc.restore();
  } else {
    doc.save().circle(qrX + qrSize / 2, qrY + qrSize / 2, px(12)).strokeColor(C_GOLD_SOFT).strokeOpacity(0.9).lineWidth(1).stroke();
    doc
      .font("Helvetica-Bold")
      .fontSize(pt(3.4))
      .fillColor("#ffffff")
      .fillOpacity(0.85)
      .text("AWAITING\nISSUANCE", qrX, qrY + qrSize / 2 - pt(4), {
        width: qrSize + px(6),
        align: "center",
        lineGap: 1,
      });
    doc.restore();
  }
  doc.fillOpacity(1);

  // ---------- Bottom band: signatures + validity ----------
  const microH = px(9);
  const bandBottom = CR80_H - microH - px(6);
  const bandTop = bandBottom - px(34);
  const bandLeft = px(14);
  const bandRight = CR80_W - px(14);
  const bandW = bandRight - bandLeft;

  // Holder signature — on a white signing panel so it survives PVC printing.
  const holderW = bandW * 0.27;
  const panelH = px(15);
  const panelY = bandTop + px(5);
  doc
    .font("Helvetica-Bold")
    .fontSize(pt(3.2))
    .fillColor("#ffffff")
    .fillOpacity(0.7)
    .text("SIGNATURE OF HOLDER", bandLeft, bandTop, { width: holderW, characterSpacing: 1.1 });
  doc.save().roundedRect(bandLeft, panelY, holderW, panelH, px(3)).fill("#ffffff").restore();
  const holderSig = card.holderSignature.dataUrl
    ? await imageToBuffer(card.holderSignature.dataUrl)
    : null;
  if (holderSig && card.holderSignature.status === "approved") {
    doc.save();
    doc.roundedRect(bandLeft, panelY, holderW, panelH, px(3)).clip();
    doc.image(holderSig, bandLeft + px(3), panelY + px(1), {
      fit: [holderW - px(6), panelH - px(2)],
    });
    doc.restore();
  } else {
    doc
      .font("Helvetica-Oblique")
      .fontSize(pt(3.5))
      .fillColor("#8A9BAE")
      .text(
        card.holderSignature.status === "pending"
          ? "awaiting approval"
          : card.holderSignature.status === "rejected"
            ? "rejected - resubmit"
            : "pending signature",
        bandLeft + px(4),
        panelY + pt(4.5),
        { width: holderW - px(8) }
      );
  }

  // Issuance / expiry (center) — metallic gold chip.
  const centerW = bandW * 0.34;
  const centerX = bandLeft + (bandW - centerW) / 2;
  const statusText = card.issued ? `ISSUED · REV ${card.version}` : "PENDING ISSUANCE";
  const chipW = centerW * 0.72;
  const chipX = centerX + (centerW - chipW) / 2;
  const chipGrad = doc.linearGradient(chipX, bandTop, chipX + chipW, bandTop);
  chipGrad
    .stop(0, C_GOLD_DARK)
    .stop(0.4, C_GOLD_LIGHT)
    .stop(0.55, C_GOLD)
    .stop(0.8, C_GOLD_DARK)
    .stop(1, C_GOLD_MID);
  doc.save().roundedRect(chipX, bandTop - px(0.5), chipW, px(7), px(2)).fill(chipGrad).restore();
  doc
    .font("Helvetica-Bold")
    .fontSize(pt(3.4))
    .fillColor(C_NAVY)
    .text(statusText, chipX, bandTop + px(1.2), {
      width: chipW,
      align: "center",
      characterSpacing: 0.8,
    });
  const dateRowY = bandTop + px(11);
  doc
    .font("Helvetica-Bold")
    .fontSize(pt(3))
    .fillColor("#ffffff")
    .fillOpacity(0.65)
    .text("ISSUED", centerX, dateRowY, { width: centerW / 2 - px(2), align: "center", characterSpacing: 1 });
  doc
    .font(MONO_FONT_BOLD)
    .fontSize(pt(4))
    .fillColor("#ffffff")
    .text(formatDatePdf(card.issuedAt), centerX, dateRowY + pt(4), {
      width: centerW / 2 - px(2),
      align: "center",
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(pt(3))
    .fillColor("#ffffff")
    .fillOpacity(0.65)
    .text("EXPIRES", centerX + centerW / 2 + px(2), dateRowY, {
      width: centerW / 2 - px(2),
      align: "center",
      characterSpacing: 1,
    });
  doc
    .font(MONO_FONT_BOLD)
    .fontSize(pt(4))
    .fillColor("#ffffff")
    .text(formatDatePdf(card.expiresAt, true), centerX + centerW / 2 + px(2), dateRowY + pt(4), {
      width: centerW / 2 - px(2),
      align: "center",
    });
  doc.fillOpacity(1);

  // National President — real handwritten signature on a white panel, with
  // the name as a legible gold caption below (signatures alone are hard to read).
  const presW = bandW * 0.27;
  const presX = bandRight - presW;
  doc
    .font("Helvetica-Bold")
    .fontSize(pt(3.2))
    .fillColor("#ffffff")
    .fillOpacity(0.7)
    .text(card.president.title.toUpperCase(), presX, bandTop, { width: presW, align: "right", characterSpacing: 1.1 });
  doc.save().roundedRect(presX, panelY, presW, panelH, px(3)).fill("#ffffff").restore();
  const presSig = card.president.signatureUrl
    ? await imageToBuffer(card.president.signatureUrl)
    : null;
  if (presSig) {
    doc.save();
    doc.roundedRect(presX, panelY, presW, panelH, px(3)).clip();
    doc.image(presSig, presX + px(2), panelY + px(1), {
      fit: [presW - px(4), panelH - px(2)],
    });
    doc.restore();
  } else {
    drawPresidentFlourish(doc, presX + presW * 0.2, panelY + pt(3), presW * 0.6, pt(8));
  }
  doc
    .font("Helvetica-Bold")
    .fontSize(pt(3.2))
    .fillColor(C_GOLD_SOFT)
    .text(card.president.name, presX, bandBottom - pt(9), { width: presW, align: "right" });
  doc
    .font("Helvetica-Bold")
    .fontSize(pt(3))
    .fillColor("#ffffff")
    .fillOpacity(0.7)
    .text("MSA PAKISTAN", presX, bandBottom - pt(5.5), { width: presW, align: "right", characterSpacing: 1.4 });
  doc.fillOpacity(1);

  // ---------- Microtext security strip ----------
  const microText =
    "MSA PAKISTAN • MEMBER PORTAL • VERIFIED • AUTHENTICATED BY NATIONAL OFFICE • THIS CARD IS THE PROPERTY OF MSA PAKISTAN • ";
  doc.save().rect(0, CR80_H - microH, CR80_W, microH).fill("#000000").fillOpacity(0.22);
  doc.rect(0, CR80_H - microH, CR80_W, microH).clip();
  doc
    .font(MONO_FONT)
    .fontSize(pt(2.2))
    .fillColor("#ffffff")
    .fillOpacity(0.75)
    .text(microText.repeat(4), 0, CR80_H - microH + pt(1.5), {
      width: CR80_W * 2,
      characterSpacing: 0.8,
    });
  doc.restore();
  doc.fillOpacity(1);

  // Gold + white frames on top.
  doc
    .save()
    .roundedRect(px(2.5), px(2.5), CR80_W - px(5), CR80_H - px(5), px(11))
    .lineWidth(0.8)
    .strokeColor(C_GOLD_SOFT)
    .strokeOpacity(0.55)
    .stroke()
    .restore();
  doc
    .save()
    .roundedRect(px(6), px(6), CR80_W - px(12), CR80_H - px(12), px(9))
    .lineWidth(0.35)
    .strokeColor("#ffffff")
    .strokeOpacity(0.25)
    .stroke()
    .restore();

  doc.restore(); // end rounded-card clip

  // ---------- Buffer ----------
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

/**
 * Generate certificate PDF
 */
export async function generateCertificate(
  memberId: number,
  context: CertificateContext
): Promise<{ url: string; key: string }> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
  });

  // Certificate header
  doc.fontSize(24).font("Helvetica-Bold").text("CERTIFICATE", { align: "center" });
  doc.fontSize(14).font("Helvetica").text("of " + context.certificateType, { align: "center" });
  doc.moveDown(2);

  // Certificate body
  doc.fontSize(12).font("Helvetica").text("This certifies that");
  doc.moveDown();

  doc.fontSize(16).font("Helvetica-Bold").text(context.memberName, { align: "center" });
  doc.moveDown();

  doc.fontSize(12).font("Helvetica").text("has successfully completed");
  doc.moveDown();

  doc.fontSize(14).font("Helvetica-Bold").text(context.achievementTitle, { align: "center" });
  doc.moveDown(2);

  doc.fontSize(11).font("Helvetica").text(`Date: ${context.issueDate.toLocaleDateString()}`, {
    align: "center",
  });
  doc.moveDown(2);

  doc.text("Authorized by:");
  doc.moveDown();
  doc.text(context.presidentName || `${await getOrgName()}`);

  // Convert to buffer
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on("end", async () => {
      const buffer = Buffer.concat(chunks);
      const key = `certificates/${memberId}-${Date.now()}.pdf`;

      try {
        const result = await storagePut(key, buffer, "application/pdf");
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });

    doc.on("error", reject);
    doc.end();
  });
}

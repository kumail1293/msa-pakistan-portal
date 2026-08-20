import { useMemo, type CSSProperties } from "react";
import { MSAPLogo } from "@/components/MSAPLogo";
import { QRCodeCanvas } from "qrcode.react";

// ============================================================================
// MSA Pakistan — National Membership Card (premium CR80 system)
// Two faces at CR80 proportions (85.60 × 53.98 mm → 340 × 214 px,
// scale 3 = 300 DPI). html2canvas-safe: inline styles, data-URI patterns.
// Safe margins ≥ 11 px (≈ 3 mm) inside corner radius.
// ============================================================================

export const CARD_W = 340;
export const CARD_H = 214;
export const CARD_RADIUS = 14;

// ---- Palette ----
const NAVY_DEEP = "#0C1A33";
const NAVY = "#16284A";
const NAVY_MID = "#1B355E";
const TEAL = "#138A73";
const TEAL_DARK = "#0E5D4D";
const GOLD = "#C9A227";
const GOLD_LIGHT = "#F2DEA0";
const GOLD_MID = "#D9B45A";
const GOLD_DARK = "#8F6B1C";
const IVORY = "#F7F4EA";
const INK = "#23344E";
const INK_SOFT = "#4A5B74";

const FONT = "'Montserrat', ui-sans-serif, system-ui, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const GOLD_GRAD =
  "linear-gradient(105deg, #8F6B1C 0%, #D9B45A 22%, #F6E7B2 40%, #C9A227 55%, #8F6B1C 78%, #D9B45A 100%)";
const GOLD_GRAD_VERT =
  "linear-gradient(180deg, #F6E7B2 0%, #D9B45A 30%, #9A7420 52%, #E8CC7E 74%, #B98F2E 100%)";

// ============================================================================
// Security patterns
// ============================================================================

function buildFrontGuillocheSvg(): string {
  const cx = 260;
  const cy = 100;
  let rings = "";
  for (let r = 30; r <= 250; r += 12) {
    let d = "";
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const ripple = r + Math.sin(a * 5 + r * 0.22) * 1.5;
      const x = cx + Math.cos(a) * ripple;
      const y = cy + Math.sin(a) * ripple;
      d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    rings += `<path d="${d} Z" fill="none" stroke="${r % 24 < 12 ? "#ffffff" : "#E9CE8B"}" stroke-opacity="0.04" stroke-width="0.5"/>`;
  }
  let rays = "";
  for (let a = 0; a < 360; a += 12) {
    const rad = (a * Math.PI) / 180;
    rays += `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(rad) * 200).toFixed(1)}" y2="${(cy + Math.sin(rad) * 200).toFixed(1)}" stroke="#ffffff" stroke-opacity="0.018" stroke-width="0.5"/>`;
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}">` +
    `<rect x="6" y="6" width="${CARD_W - 12}" height="${CARD_H - 12}" rx="10" fill="none" stroke="#F2DEA0" stroke-width="0.7" stroke-opacity="0.35"/>` +
    rays + rings +
    `<path d="M14 8 h-5 a6 6 0 0 0 -6 6 v4" fill="none" stroke="#D9B45A" stroke-width="1.2" stroke-opacity="0.85"/>` +
    `<path d="M${CARD_W - 14} 8 h5 a6 6 0 0 1 6 6 v4" fill="none" stroke="#D9B45A" stroke-width="1.2" stroke-opacity="0.85"/>` +
    `<path d="M${CARD_W - 14} ${CARD_H - 8} h5 a6 6 0 0 0 6 -6 v-4" fill="none" stroke="#D9B45A" stroke-width="1.2" stroke-opacity="0.85"/>` +
    `<path d="M14 ${CARD_H - 8} h-5 a6 6 0 0 1 -6 -6 v-4" fill="none" stroke="#D9B45A" stroke-width="1.2" stroke-opacity="0.85"/>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function buildBackGuillocheSvg(): string {
  const cx = 170;
  const cy = 110;
  let rings = "";
  for (let r = 28; r <= 190; r += 10) {
    let d = "";
    const steps = 72;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const ripple = r + Math.sin(a * 4 + r * 0.2) * 1.4;
      d += `${i === 0 ? "M" : "L"}${(cx + Math.cos(a) * ripple).toFixed(1)},${(cy + Math.sin(a) * ripple).toFixed(1)}`;
    }
    rings += `<path d="${d} Z" fill="none" stroke="#16284A" stroke-opacity="0.03" stroke-width="0.45"/>`;
  }
  let lines = "";
  for (let y = 8; y < CARD_H; y += 3.5) {
    lines += `<line x1="0" y1="${y.toFixed(1)}" x2="${CARD_W}" y2="${y.toFixed(1)}" stroke="#16284A" stroke-opacity="0.02" stroke-width="0.35"/>`;
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}">` +
    lines + rings +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function buildBarcodeSvg(membershipId: string): string {
  let seed = 0;
  for (let i = 0; i < membershipId.length; i++) {
    seed = (seed * 31 + membershipId.charCodeAt(i)) >>> 0;
  }
  let bars = "";
  let x = 0;
  for (let i = 0; i < 44; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const w = 0.9 + (seed % 10) * 0.14;
    const gap = 1.15 + (seed % 5) * 0.18;
    if (seed % 3 !== 0) {
      bars += `<rect x="${x.toFixed(2)}" y="2" width="${w.toFixed(2)}" height="22" fill="#16284A"/>`;
    }
    x += w + gap;
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x.toFixed(1)} 26" width="${x.toFixed(1)}" height="26">` +
    bars + `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ============================================================================
// Helpers
// ============================================================================

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "M";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

export function formatDate(
  d: string | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions
): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", opts ?? { day: "2-digit", month: "short", year: "numeric" });
}

export function serialOf(membershipId: string, issuedAt: string | Date | null | undefined): string {
  const digits = (membershipId.match(/\d+/g) ?? []).join("").slice(0, 6);
  const year = issuedAt ? new Date(issuedAt).getFullYear() : new Date().getFullYear();
  return `MSAP-${year}-${(digits || "0001").padStart(4, "0")}`;
}

export type HolderSignature = {
  dataUrl: string | null;
  status: "none" | "pending" | "approved" | "rejected";
  submittedAt: Date | string | null;
  reviewedAt: Date | string | null;
};

export type CardData = {
  memberName: string;
  membershipId: string;
  institution: string;
  discipline: string;
  yearOfStudy: string;
  localCouncil: string;
  graduationYear: number | null;
  photoUrl: string;
  status: string;
  role: string;
  issued: boolean;
  version: number;
  issuedAt: Date | string | null;
  expiresAt: Date | string | null;
  verificationToken: string | null;
  dataChangedSinceIssuance: boolean;
  reissueRequested: boolean;
  holderSignature: HolderSignature;
  president: { name: string; title: string; signatureUrl: string | null };
};

// Shared label/value styles
const labelStyle: CSSProperties = {
  fontSize: 5.0,
  letterSpacing: 1.2,
  opacity: 0.6,
  textTransform: "uppercase",
  fontWeight: 600,
};

const valueStyle: CSSProperties = {
  fontSize: 7.8,
  fontWeight: 700,
  marginTop: 1,
  lineHeight: 1.2,
};

// ============================================================================
// FRONT — Clean modern design: navy header + white body + gold accents
// ============================================================================

export function MembershipCardFront({
  card,
  verifyUrl,
  signatureFailed,
  onSignatureFailed,
}: {
  card: CardData;
  verifyUrl: string;
  signatureFailed: boolean;
  onSignatureFailed: () => void;
}) {
  const guilloche = useMemo(buildFrontGuillocheSvg, []);
  const name = card.memberName || "MSAP Member";
  const sig = card.holderSignature;
  const showPresidentSig = Boolean(card.president.signatureUrl) && !signatureFailed;
  const serial = serialOf(card.membershipId, card.issuedAt);
  const isPendingIssuance = !card.issued;

  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        borderRadius: CARD_RADIUS,
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(155deg, ${NAVY_DEEP} 0%, ${NAVY} 40%, ${NAVY_MID} 70%, ${TEAL_DARK} 115%)`,
        boxShadow:
          "0 16px 40px -12px rgba(12,26,51,.55), 0 4px 12px rgba(12,26,51,.25), inset 0 0 0 1px rgba(255,255,255,.08)",
        color: "#ffffff",
        fontFamily: FONT,
      }}
    >
      {/* Guilloché background */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: `url("${guilloche}")`, backgroundSize: "cover" }} />

      {/* Diagonal sheen */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,.1) 0%, transparent 35%, rgba(255,255,255,.04) 65%, transparent 100%)" }} />

      {/* Ghost watermark */}
      <div style={{ position: "absolute", right: 14, bottom: 16, width: 60, opacity: 0.04 }}>
        <MSAPLogo variant="vertical" tone="white" className="w-full" />
      </div>

      {/* ============ HEADER BAND ============ */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 40,
        background: `linear-gradient(135deg, ${NAVY_DEEP} 0%, ${NAVY} 60%, ${TEAL_DARK} 100%)`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 14px",
        borderBottom: `1.5px solid ${GOLD_MID}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MSAPLogo variant="horizontal-compact" tone="white" className="w-[72px]" />
          <div>
            <div style={{ fontSize: 6.5, fontWeight: 800, letterSpacing: 1.5, lineHeight: 1.1 }}>
              NATIONAL MEMBERSHIP CARD
            </div>
            <div style={{ fontSize: 4.2, fontWeight: 600, letterSpacing: 1.8, color: GOLD_LIGHT, marginTop: 1.5 }}>
              {isPendingIssuance ? "TERM 2025–26 · PENDING ISSUANCE" : `TERM 2025–26 · ${(card.status || "MEMBER").toUpperCase()}`}
            </div>
          </div>
        </div>
        {/* Metallic foil seal */}
        <div style={{
          width: 24, height: 24, borderRadius: "50%",
          background: GOLD_GRAD_VERT,
          boxShadow: "0 2px 6px rgba(0,0,0,.4), inset 0 0 0 1.5px rgba(255,255,255,.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 5.5, fontWeight: 900, color: NAVY_DEEP, letterSpacing: 0.3 }}>MSAP</span>
        </div>
      </div>

      {/* ============ BODY ============ */}
      <div style={{
        position: "absolute", top: 48, left: 14, right: 14, bottom: 42,
        display: "flex", gap: 12, alignItems: "flex-start",
      }}>
        {/* Photo */}
        <div style={{
          width: 58, height: 74, borderRadius: 6,
          border: `1.3px solid ${GOLD_MID}`,
          background: "#0F2040",
          boxShadow: "inset 0 0 0 2px rgba(255,255,255,.14), inset 0 3px 8px rgba(0,0,0,.45)",
          overflow: "hidden", flexShrink: 0, position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {card.photoUrl ? (
            <img src={card.photoUrl} alt="Member" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 24, fontWeight: 800, color: "rgba(255,255,255,.9)", textShadow: "0 2px 6px rgba(0,0,0,.4)" }}>
              {initialsOf(name)}
            </span>
          )}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, fontSize: 4.2, fontWeight: 800, letterSpacing: 1.8, textAlign: "center", padding: "1.5px 0", color: GOLD_LIGHT, background: "rgba(10,22,44,.8)" }}>
            MEMBER PHOTO
          </div>
        </div>

        {/* Identity block */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 0.3, lineHeight: 1.12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {name}
          </div>
          <div style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{
              fontFamily: MONO, fontSize: 7.2, fontWeight: 700, letterSpacing: 0.6,
              color: GOLD_LIGHT,
              background: "linear-gradient(90deg, rgba(201,162,39,.25), rgba(201,162,39,.1))",
              border: `1px solid rgba(217,180,90,.5)`, borderRadius: 3, padding: "1.5px 5px",
            }}>
              {card.membershipId || "—"}
            </span>
          </div>
          <div style={{ marginTop: 1.5, fontFamily: MONO, fontSize: 4.2, letterSpacing: 1, color: GOLD_LIGHT, opacity: 0.8 }}>
            SERIAL {serial} · REV {card.version}
          </div>

          {/* Info grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            columnGap: 10, rowGap: 3.5, marginTop: 5,
          }}>
            <div>
              <div style={labelStyle}>Local Council</div>
              <div style={{ ...valueStyle, fontSize: 7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {card.localCouncil || "—"}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Institute</div>
              <div style={{ ...valueStyle, fontSize: 7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {card.institution || "—"}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Discipline</div>
              <div style={{ ...valueStyle, fontSize: 7 }}>{card.discipline || "—"}</div>
            </div>
            <div>
              <div style={labelStyle}>Year</div>
              <div style={{ ...valueStyle, fontSize: 7 }}>
                {card.graduationYear ? `Grad ${card.graduationYear}` : card.yearOfStudy || "—"}
              </div>
            </div>
          </div>
        </div>

        {/* QR panel */}
        {verifyUrl ? (
          <div style={{
            flexShrink: 0, width: 72, borderRadius: 6,
            background: "rgba(255,255,255,.95)",
            border: `1px solid ${GOLD_MID}`,
            boxShadow: "0 2px 8px rgba(0,0,0,.3)",
            padding: "4px 4px 3px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          }}>
            <div style={{ background: "#fff", borderRadius: 3, padding: 1.5, boxShadow: "0 1px 3px rgba(0,0,0,.2)" }}>
              <QRCodeCanvas value={verifyUrl} size={44} level="M" bgColor="#ffffff" fgColor="#0C1A33" />
            </div>
            <div style={{ fontSize: 4.4, fontWeight: 800, letterSpacing: 1.2, color: NAVY_DEEP }}>SCAN TO VERIFY</div>
            <div style={{ fontSize: 3.6, letterSpacing: 0.8, color: GOLD_DARK, fontWeight: 600 }}>MSAP VERIFICATION</div>
          </div>
        ) : (
          <div style={{ flexShrink: 0, width: 56, borderRadius: 6, border: "1px solid rgba(217,180,90,.45)", padding: "6px 4px", textAlign: "center" }}>
            <div style={{ fontSize: 4.8, letterSpacing: 1, opacity: 0.8, lineHeight: 1.6 }}>AWAITING<br />ISSUANCE</div>
          </div>
        )}
      </div>

      {/* ============ SIGNATURE BAND ============ */}
      <div style={{
        position: "absolute", left: 14, right: 14, bottom: 14,
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      }}>
        {/* Holder signature */}
        <div style={{ width: 90 }}>
          <div style={{
            height: 22, borderRadius: 4,
            background: "rgba(255,255,255,.93)",
            border: "1px solid rgba(217,180,90,.5)",
            boxShadow: "inset 0 1px 2px rgba(12,26,51,.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 5, borderBottom: "1px solid rgba(12,26,51,.14)" }} />
            {sig?.status === "approved" && sig.dataUrl ? (
              <img src={sig.dataUrl} alt="Holder signature" style={{ position: "relative", maxWidth: 80, maxHeight: 16, objectFit: "contain" }} />
            ) : (
              <span style={{ position: "relative", fontSize: 5, fontStyle: "italic", letterSpacing: 0.3, color: "#8A9BAE" }}>
                {sig?.status === "pending" ? "awaiting approval" : sig?.status === "rejected" ? "rejected — resubmit" : "signature pending"}
              </span>
            )}
          </div>
          <div style={{ marginTop: 2, fontSize: 4.4, letterSpacing: 1.2, textAlign: "center", opacity: 0.75 }}>SIGNATURE OF HOLDER</div>
        </div>

        {/* Issuance badge */}
        <div style={{ textAlign: "center", paddingBottom: 2 }}>
          <div style={{
            display: "inline-block", fontSize: 5.2, fontWeight: 800, letterSpacing: 1.4,
            color: NAVY_DEEP, background: GOLD_GRAD, borderRadius: 3,
            padding: "2px 7px", boxShadow: "0 1px 3px rgba(0,0,0,.25)",
          }}>
            {isPendingIssuance ? "PENDING ISSUANCE" : `ISSUED · REV ${card.version}`}
          </div>
          <div style={{ marginTop: 2.5, display: "flex", gap: 10, justifyContent: "center" }}>
            <div>
              <div style={{ fontSize: 4.2, letterSpacing: 1.1, opacity: 0.6 }}>ISSUED</div>
              <div style={{ fontSize: 5.8, fontWeight: 700, marginTop: 1, fontFamily: MONO }}>{formatDate(card.issuedAt)}</div>
            </div>
            <div>
              <div style={{ fontSize: 4.2, letterSpacing: 1.1, opacity: 0.6 }}>EXPIRES</div>
              <div style={{ fontSize: 5.8, fontWeight: 700, marginTop: 1, fontFamily: MONO }}>
                {formatDate(card.expiresAt, { month: "short", year: "numeric" })}
              </div>
            </div>
          </div>
        </div>

        {/* National President signature */}
        <div style={{ width: 90, textAlign: "right" }}>
          <div style={{
            height: 22, borderRadius: 4,
            background: "rgba(255,255,255,.93)",
            border: "1px solid rgba(217,180,90,.5)",
            boxShadow: "inset 0 1px 2px rgba(12,26,51,.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", position: "relative",
          }}>
            {showPresidentSig ? (
              <img
                src={card.president.signatureUrl ?? ""}
                alt="National President signature"
                onError={onSignatureFailed}
                style={{ maxWidth: 82, maxHeight: 16, objectFit: "contain" }}
              />
            ) : (
              <span style={{ fontFamily: "'Segoe Script','Snell Roundhand','Brush Script MT',cursive", fontSize: 11, color: "rgba(12,26,51,.4)", lineHeight: 1.2 }}>
                {card.president.name}
              </span>
            )}
          </div>
          <div style={{ marginTop: 2, fontSize: 4.4, letterSpacing: 1.2, color: GOLD_LIGHT }}>NATIONAL PRESIDENT</div>
          <div style={{ marginTop: 1, fontSize: 5, fontWeight: 700 }}>{card.president.name}</div>
        </div>
      </div>

      {/* Microtext strip */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: 8,
        overflow: "hidden", whiteSpace: "nowrap",
        background: "linear-gradient(90deg, rgba(7,16,32,.9), rgba(12,26,51,.85) 50%, rgba(7,16,32,.9))",
        borderTop: `1px solid rgba(217,180,90,.45)`,
        display: "flex", alignItems: "center",
      }}>
        <span style={{ fontSize: 3, letterSpacing: 0.8, opacity: 0.8, fontFamily: MONO }}>
          {"MSA PAKISTAN • MEDICAL STUDENTS' ASSOCIATION OF PAKISTAN • MEMBER PORTAL • VERIFIED • AUTHENTICATED BY NATIONAL OFFICE • THIS CARD IS THE PROPERTY OF MSA PAKISTAN • ".repeat(8)}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// BACK — Matching design language with front
// ============================================================================

export function MembershipCardBack({
  card,
  verifyUrl,
}: {
  card: CardData;
  verifyUrl: string;
}) {
  const ghost = useMemo(buildBackGuillocheSvg, []);
  const barcode = useMemo(() => buildBarcodeSvg(card.membershipId || "MSAP"), [card.membershipId]);
  const serial = serialOf(card.membershipId, card.issuedAt);

  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        borderRadius: CARD_RADIUS,
        position: "relative",
        overflow: "hidden",
        background: IVORY,
        boxShadow:
          "0 16px 40px -12px rgba(12,26,51,.55), 0 4px 12px rgba(12,26,51,.25), inset 0 0 0 1px rgba(12,26,51,.1)",
        color: INK,
        fontFamily: FONT,
      }}
    >
      {/* Ghost guilloché */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: `url("${ghost}")`, backgroundSize: "cover" }} />

      {/* ============ HEADER BAND (matches front) ============ */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 40,
        background: `linear-gradient(135deg, ${NAVY_DEEP} 0%, ${NAVY} 60%, ${TEAL_DARK} 100%)`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 14px",
        borderBottom: `1.5px solid ${GOLD_MID}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MSAPLogo variant="horizontal-compact" tone="white" className="w-[72px]" />
          <div>
            <div style={{ fontSize: 6.5, fontWeight: 800, letterSpacing: 1.5, color: "#ffffff", lineHeight: 1.1 }}>
              OFFICIAL MEMBERSHIP CARD
            </div>
            <div style={{ fontSize: 4.2, fontWeight: 600, letterSpacing: 1.8, color: GOLD_LIGHT, marginTop: 1.5 }}>
              VERIFICATION & TERMS OF USE
            </div>
          </div>
        </div>
        {/* Metallic foil seal */}
        <div style={{
          width: 24, height: 24, borderRadius: "50%",
          background: GOLD_GRAD_VERT,
          boxShadow: "0 2px 6px rgba(0,0,0,.4), inset 0 0 0 1.5px rgba(255,255,255,.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 5.5, fontWeight: 900, color: NAVY_DEEP, letterSpacing: 0.3 }}>MSAP</span>
        </div>
      </div>

      {/* ============ BODY ============ */}
      <div style={{
        position: "absolute", top: 48, left: 14, right: 14, bottom: 54,
        display: "flex", gap: 12,
      }}>
        {/* Left: statement + record */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 7, fontWeight: 800, letterSpacing: 1.5, color: NAVY }}>
            MEMBERSHIP VERIFICATION
          </div>
          <div style={{ marginTop: 2.5, width: 30, height: 1.5, background: `linear-gradient(90deg, ${GOLD_MID}, ${GOLD_LIGHT} 60%, transparent)` }} />
          <div style={{ marginTop: 4, fontSize: 5.5, lineHeight: 1.6, color: INK_SOFT, fontWeight: 500 }}>
            This card certifies that the bearer is a registered member of the Medical
            Students&apos; Association of Pakistan (MSA Pakistan), subject to the
            organization&apos;s Constitution, Bylaws, and membership regulations.
          </div>

          {/* Record grid */}
          <div style={{ marginTop: 7, display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 12, rowGap: 4 }}>
            <div>
              <div style={{ fontSize: 4.4, letterSpacing: 1.1, color: "#7C8CA0", textTransform: "uppercase" }}>Membership No.</div>
              <div style={{ fontSize: 7, fontWeight: 700, color: NAVY, fontFamily: MONO, marginTop: 1 }}>{card.membershipId || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 4.4, letterSpacing: 1.1, color: "#7C8CA0", textTransform: "uppercase" }}>Local Council</div>
              <div style={{ fontSize: 6.5, fontWeight: 700, color: NAVY, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.localCouncil || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 4.4, letterSpacing: 1.1, color: "#7C8CA0", textTransform: "uppercase" }}>Issued</div>
              <div style={{ fontSize: 6.5, fontWeight: 700, color: NAVY, fontFamily: MONO, marginTop: 1 }}>{formatDate(card.issuedAt)}</div>
            </div>
            <div>
              <div style={{ fontSize: 4.4, letterSpacing: 1.1, color: "#7C8CA0", textTransform: "uppercase" }}>Expires</div>
              <div style={{ fontSize: 6.5, fontWeight: 700, color: NAVY, fontFamily: MONO, marginTop: 1 }}>
                {formatDate(card.expiresAt, { month: "short", year: "numeric" })}
              </div>
            </div>
          </div>

          {/* Terms */}
          <div style={{ marginTop: "auto", paddingTop: 5, fontSize: 4.6, lineHeight: 1.6, color: "#5A6B82" }}>
            <div style={{ display: "flex", gap: 3.5 }}>
              <span style={{ color: GOLD_DARK, fontWeight: 800 }}>•</span>
              <span>This card remains the property of MSA Pakistan and must be surrendered upon request.</span>
            </div>
            <div style={{ display: "flex", gap: 3.5 }}>
              <span style={{ color: GOLD_DARK, fontWeight: 800 }}>•</span>
              <span>Valid only for the member named herein, while membership is active.</span>
            </div>
            <div style={{ display: "flex", gap: 3.5 }}>
              <span style={{ color: GOLD_DARK, fontWeight: 800 }}>•</span>
              <span>Report loss to vpm@msapakistan.org for replacement after verification.</span>
            </div>
          </div>
        </div>

        {/* Right: QR */}
        <div style={{
          flexShrink: 0, width: 82, borderRadius: 7,
          background: "#ffffff",
          border: `1px solid ${GOLD_MID}`,
          boxShadow: "0 2px 8px rgba(12,26,51,.14)",
          padding: "5px 4px 4px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2.5,
          alignSelf: "flex-start",
        }}>
          {verifyUrl ? (
            <div style={{ background: "#ffffff", borderRadius: 3, padding: 2 }}>
              <QRCodeCanvas value={verifyUrl} size={54} level="M" bgColor="#ffffff" fgColor="#0C1A33" />
            </div>
          ) : (
            <div style={{
              width: 54, height: 54, borderRadius: 3,
              border: "1px dashed rgba(12,26,51,.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 4.5, color: "#7C8CA0", textAlign: "center", lineHeight: 1.5,
            }}>
              PENDING<br />ISSUANCE
            </div>
          )}
          <div style={{ fontSize: 4.6, fontWeight: 800, letterSpacing: 1.2, color: NAVY }}>SCAN TO VERIFY</div>
          <div style={{ fontSize: 3.8, letterSpacing: 0.8, color: "#7C8CA0", textAlign: "center", lineHeight: 1.4 }}>
            msapakistan.org/verify
          </div>
        </div>
      </div>

      {/* Gold security strip */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 40, height: 5,
        background: `linear-gradient(90deg, ${GOLD_DARK}, ${GOLD_LIGHT} 25%, ${GOLD_MID} 50%, ${GOLD_LIGHT} 75%, ${GOLD_DARK})`,
        display: "flex", alignItems: "center", overflow: "hidden", whiteSpace: "nowrap",
      }}>
        <span style={{ fontSize: 3.2, fontWeight: 800, letterSpacing: 1.8, color: "rgba(12,26,51,.7)", fontFamily: MONO }}>
          {"MSAP • MSAP • AUTHENTIC • MSAP • MSAP • VERIFIED • MSAP • ".repeat(8)}
        </span>
      </div>

      {/* Bottom band: barcode + serial + contact */}
      <div style={{
        position: "absolute", left: 14, right: 14, bottom: 8,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ background: "#ffffff", borderRadius: 3, padding: "2px 4px", border: "1px solid rgba(12,26,51,.15)" }}>
            <img src={barcode} alt="Barcode" style={{ width: 100, height: 24, objectFit: "contain" }} />
          </div>
          <div>
            <div style={{ fontSize: 4.2, letterSpacing: 1.1, color: "#7C8CA0" }}>SERIAL NO.</div>
            <div style={{ fontSize: 6, fontWeight: 700, color: NAVY, fontFamily: MONO, marginTop: 1 }}>{serial}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 5.2, fontWeight: 800, color: NAVY, letterSpacing: 0.5 }}>msapakistan.org</div>
          <div style={{ fontSize: 4.4, color: INK_SOFT, marginTop: 1.5, fontFamily: MONO }}>vpm@msapakistan.org</div>
          <div style={{ fontSize: 4, color: "#7C8CA0", marginTop: 1.5, letterSpacing: 0.7 }}>MSA PAKISTAN · NATIONAL OFFICE · TERM 2025–26</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Export helper — 300 DPI PNG
// ============================================================================

export async function exportCardFacePng(
  element: HTMLElement,
  card: CardData,
  face: "front" | "back",
  html2canvas: (el: HTMLElement, opts?: object) => Promise<HTMLCanvasElement>
): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    scale: 3,
    useCORS: true,
    width: CARD_W,
    height: CARD_H,
    windowWidth: CARD_W,
    windowHeight: CARD_H,
  });
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `MSAP-Membership-Card-${face === "front" ? "FRONT" : "BACK"}-${card.membershipId || "member"}.png`;
  link.click();
}

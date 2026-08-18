import { useMemo, type CSSProperties } from "react";
import { MSAPLogo } from "@/components/MSAPLogo";
import { QRCodeCanvas } from "qrcode.react";

// ============================================================================
// MSA Pakistan — National Membership Card (premium CR80 system)
// ----------------------------------------------------------------------------
// Two faces rendered at CR80 proportions (85.60 × 53.98 mm → 340 × 214 px,
// scale 3 = exactly 300 DPI). Everything is html2canvas-friendly: inline
// styles only, decorative patterns as background-image data URIs, canvas QR.
// Safe margins are designed in (≥ 11 px ≈ 3 mm) so nothing is clipped by the
// card corner radius or the cutter.
// ============================================================================

export const CARD_W = 340;
export const CARD_H = 214;
export const CARD_RADIUS = 14;

// ---- Palette: deep navy / midnight / white / metallic gold / teal ----------
const NAVY_DEEP = "#0C1A33";
const NAVY = "#16284A";
const NAVY_MID = "#1B355E";
const TEAL = "#0E5D4D";
const TEAL_SOFT = "#138A73";
const GOLD = "#C9A227";
const GOLD_LIGHT = "#F2DEA0";
const GOLD_MID = "#D9B45A";
const GOLD_DARK = "#8F6B1C";
const IVORY = "#F7F4EA";
const INK = "#23344E";
const INK_SOFT = "#4A5B74";

const FONT =
  "'Montserrat', ui-sans-serif, system-ui, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

// ---- Metallic gold gradient (reads like foil, not flat yellow) -------------
const GOLD_GRAD =
  "linear-gradient(105deg, #8F6B1C 0%, #D9B45A 22%, #F6E7B2 40%, #C9A227 55%, #8F6B1C 78%, #D9B45A 100%)";
const GOLD_GRAD_VERT =
  "linear-gradient(180deg, #F6E7B2 0%, #D9B45A 30%, #9A7420 52%, #E8CC7E 74%, #B98F2E 100%)";

// ============================================================================
// Security pattern builders (SVG data URIs so html2canvas can rasterize them)
// ============================================================================

/**
 * Refined banknote guilloché for the front: softly rippled concentric rings
 * offset toward the QR corner plus faint radiating hairlines. Deliberately
 * quieter than the old version so the identity block stays the hero.
 */
function buildFrontGuillocheSvg(): string {
  const cx = 232;
  const cy = 96;
  let rings = "";
  let idx = 0;
  for (let r = 26; r <= 270; r += 11) {
    let d = "";
    const steps = 96;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const ripple = r + Math.sin(a * 5 + r * 0.24) * 1.8;
      const x = cx + Math.cos(a) * ripple;
      const y = cy + Math.sin(a) * ripple;
      d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    rings += `<path d="${d} Z" fill="none" stroke="${idx % 2 === 0 ? "#ffffff" : "#E9CE8B"}" stroke-opacity="0.05" stroke-width="0.55"/>`;
    idx += 1;
  }
  let rays = "";
  for (let a = 0; a < 360; a += 10) {
    const rad = (a * Math.PI) / 180;
    rays += `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(rad) * 225).toFixed(1)}" y2="${(cy + Math.sin(rad) * 225).toFixed(1)}" stroke="#ffffff" stroke-opacity="0.02" stroke-width="0.5"/>`;
  }
  // Fine top-left "wave bank" — horizontal hairline waves under the header.
  let waves = "";
  for (let y = 46; y <= 150; y += 4) {
    waves += `<path d="M14 ${y} q 18 -2.5 36 0 t 36 0 t 36 0 t 36 0 t 36 0 t 36 0 t 36 0 t 36 0" fill="none" stroke="#ffffff" stroke-opacity="0.035" stroke-width="0.5"/>`;
  }

  const corners = `
    <path d="M13 7 h-5 a6 6 0 0 0 -6 6 v5" fill="none" stroke="#D9B45A" stroke-width="1.4" stroke-opacity="0.9"/>
    <path d="M327 7 h5 a6 6 0 0 1 6 6 v5" fill="none" stroke="#D9B45A" stroke-width="1.4" stroke-opacity="0.9"/>
    <path d="M327 207 h5 a6 6 0 0 0 6 -6 v-5" fill="none" stroke="#D9B45A" stroke-width="1.4" stroke-opacity="0.9"/>
    <path d="M13 207 h-5 a6 6 0 0 1 -6 -6 v-5" fill="none" stroke="#D9B45A" stroke-width="1.4" stroke-opacity="0.9"/>
  `;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}">` +
    `<rect x="5" y="5" width="${CARD_W - 10}" height="${CARD_H - 10}" rx="10" fill="none" stroke="#F2DEA0" stroke-width="0.9" stroke-opacity="0.4"/>` +
    rays +
    waves +
    rings +
    corners +
    `</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Faint navy ghost guilloché for the back (drawn on ivory, printed as a
 * subtle tint — the classic ID-card reverse treatment).
 */
function buildBackGuillocheSvg(): string {
  const cx = 170;
  const cy = 118;
  let rings = "";
  for (let r = 30; r <= 210; r += 10) {
    let d = "";
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const ripple = r + Math.sin(a * 4 + r * 0.2) * 1.6;
      d += `${i === 0 ? "M" : "L"}${(cx + Math.cos(a) * ripple).toFixed(1)},${(cy + Math.sin(a) * ripple).toFixed(1)}`;
    }
    rings += `<path d="${d} Z" fill="none" stroke="#16284A" stroke-opacity="0.035" stroke-width="0.5"/>`;
  }
  let lines = "";
  for (let y = 8; y < CARD_H; y += 3.2) {
    lines += `<line x1="0" y1="${y.toFixed(1)}" x2="${CARD_W}" y2="${y.toFixed(1)}" stroke="#16284A" stroke-opacity="0.025" stroke-width="0.4"/>`;
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}">` +
    lines +
    rings +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Fine anti-copy hatch used inside the UV-style QR panels. Drawn as an SVG
 * data URI so html2canvas rasterizes it reliably (repeating-linear-gradient
 * is not consistently supported).
 */
function buildHatchSvg(tone: "navy" | "navy-soft"): string {
  const color = tone === "navy" ? "rgba(12,26,51,.055)" : "rgba(12,26,51,.045)";
  let lines = "";
  for (let x = -60; x < 260; x += 4) {
    lines += `<line x1="${x}" y1="0" x2="${x + 60}" y2="220" stroke="${color}" stroke-width="0.7"/>`;
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 220" width="240" height="220">` +
    lines +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Deterministic Code-128-style barcode from the membership ID — decorative
 * but plausible, so the back reads as a real machine-readable credential.
 */
function buildBarcodeSvg(membershipId: string): string {
  let seed = 0;
  for (let i = 0; i < membershipId.length; i++) {
    seed = (seed * 31 + membershipId.charCodeAt(i)) >>> 0;
  }
  let bars = "";
  let x = 0;
  const barCount = 44;
  for (let i = 0; i < barCount; i++) {
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
    bars +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ============================================================================
// Shared helpers
// ============================================================================

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "M";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
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

/** Deterministic serial: MSAP-{issueYear}-{digits from membership ID}. */
export function serialOf(
  membershipId: string,
  issuedAt: string | Date | null | undefined
): string {
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

const labelStyle: CSSProperties = {
  fontSize: 5.2,
  letterSpacing: 1.3,
  opacity: 0.66,
  textTransform: "uppercase",
};

const valueStyle: CSSProperties = {
  fontSize: 8.4,
  fontWeight: 700,
  marginTop: 1.5,
  lineHeight: 1.25,
};

// ============================================================================
// FRONT
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
  const hatch = useMemo(() => buildHatchSvg("navy"), []);
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
        background: `linear-gradient(152deg, ${NAVY_DEEP} 0%, ${NAVY} 34%, ${NAVY_MID} 62%, ${TEAL} 118%)`,
        boxShadow:
          "0 18px 44px -14px rgba(12,26,51,.6), 0 4px 14px rgba(12,26,51,.28), inset 0 0 0 1px rgba(255,255,255,.09)",
        color: "#ffffff",
        fontFamily: FONT,
      }}
    >
      {/* Guilloché */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("${guilloche}")`,
          backgroundSize: "cover",
        }}
      />

      {/* Diagonal sheen */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(116deg, rgba(255,255,255,.12) 0%, rgba(255,255,255,.02) 28%, rgba(255,255,255,0) 50%, rgba(255,255,255,.05) 72%, rgba(255,255,255,0) 100%)",
        }}
      />

      {/* Ghost watermark — vertical lockup, safely inside the corner */}
      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 14,
          width: 78,
          opacity: 0.05,
        }}
      >
        <MSAPLogo variant="vertical" tone="white" className="w-full" />
      </div>

      {/* ============ Header ============ */}
      <div
        style={{
          position: "absolute",
          top: 9,
          left: 13,
          right: 13,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <MSAPLogo variant="horizontal-compact" tone="white" className="w-[84px]" />
        <div style={{ textAlign: "right", paddingRight: 30 }}>
          <div
            style={{
              fontSize: 7.4,
              fontWeight: 800,
              letterSpacing: 1.5,
              lineHeight: 1.1,
              whiteSpace: "nowrap",
            }}
          >
            NATIONAL MEMBERSHIP CARD
          </div>
          <div
            style={{
              marginTop: 2,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${GOLD_LIGHT} 30%, ${GOLD_MID} 50%, ${GOLD_LIGHT} 70%, transparent)`,
            }}
          />
          <div
            style={{
              marginTop: 2,
              fontSize: 4.4,
              fontWeight: 600,
              letterSpacing: 1.6,
              color: GOLD_LIGHT,
              whiteSpace: "nowrap",
            }}
          >
            {isPendingIssuance
              ? "TERM 2025 – 26 · PENDING ISSUANCE"
              : `TERM 2025 – 26 · ${(card.status || "MEMBER").toUpperCase()}`}
          </div>
        </div>
      </div>

      {/* Metallic foil seal (safely inside the corner, clear of the QR panel) */}
      <div
        style={{
          position: "absolute",
          top: 9,
          right: 13,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: GOLD_GRAD_VERT,
          boxShadow:
            "0 2px 6px rgba(0,0,0,.45), inset 0 0 0 1.5px rgba(255,255,255,.65), inset 0 0 8px rgba(255,255,255,.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 3,
        }}
      >
        <span style={{ fontSize: 5.6, fontWeight: 900, color: NAVY_DEEP, letterSpacing: 0.3 }}>
          MSAP
        </span>
      </div>

      {/* ============ Body: photo + identity + QR ============ */}
      <div
        style={{
          position: "absolute",
          top: 44,
          left: 13,
          right: 13,
          display: "flex",
          gap: 11,
          alignItems: "flex-start",
        }}
      >
        {/* ---- Photo (credential treatment: gold frame, white inner, veil) ---- */}
        <div
          style={{
            width: 62,
            height: 80,
            borderRadius: 7,
            border: `1.4px solid ${GOLD_MID}`,
            background: "#0F2040",
            boxShadow: "inset 0 0 0 2px rgba(255,255,255,.16), inset 0 3px 10px rgba(0,0,0,.5)",
            overflow: "hidden",
            flexShrink: 0,
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {card.photoUrl ? (
            <img
              src={card.photoUrl}
              alt="Member"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span
              style={{
                fontSize: 27,
                fontWeight: 800,
                letterSpacing: 1,
                color: "rgba(255,255,255,.94)",
                textShadow: "0 2px 6px rgba(0,0,0,.4)",
              }}
            >
              {initialsOf(name)}
            </span>
          )}
          {/* Ghost emblem inside the photo */}
          <div style={{ position: "absolute", inset: 0, opacity: 0.08, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MSAPLogo variant="vertical" tone="white" className="w-[26px]" />
          </div>
          {/* Top veil + bottom caption */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 12,
              background: "linear-gradient(180deg, rgba(12,26,51,.55), rgba(12,26,51,0))",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              fontSize: 4.8,
              fontWeight: 800,
              letterSpacing: 2,
              textAlign: "center",
              padding: "1.5px 0",
              color: GOLD_LIGHT,
              background: "rgba(10,22,44,.82)",
            }}
          >
            MEMBER PHOTO
          </div>
        </div>

        {/* ---- Identity ---- */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: 0.3,
              lineHeight: 1.14,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </div>
          <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 7.4,
                fontWeight: 700,
                letterSpacing: 0.8,
                color: GOLD_LIGHT,
                background: "linear-gradient(90deg, rgba(201,162,39,.28), rgba(201,162,39,.12))",
                border: "1px solid rgba(217,180,90,.55)",
                borderRadius: 3,
                padding: "1.5px 6px",
              }}
            >
              {card.membershipId || "—"}
            </div>
          </div>
          <div style={{ marginTop: 2, fontFamily: MONO, fontSize: 4.4, letterSpacing: 1.1, color: GOLD_LIGHT, opacity: 0.85 }}>
            SERIAL {serial} · REV {card.version}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              columnGap: 10,
              rowGap: 4.5,
              marginTop: 6,
            }}
          >
            <div>
              <div style={labelStyle}>Local Council</div>
              <div style={{ ...valueStyle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {card.localCouncil || "—"}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Institute</div>
              <div style={{ ...valueStyle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {card.institution || "—"}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Discipline</div>
              <div style={valueStyle}>{card.discipline || "—"}</div>
            </div>
            <div>
              <div style={labelStyle}>Year</div>
              <div style={valueStyle}>
                {card.graduationYear ? `Grad ${card.graduationYear}` : card.yearOfStudy || "—"}
              </div>
            </div>
          </div>
        </div>

        {/* ---- QR verification zone (UV-style security panel) ---- */}
        {verifyUrl ? (
          <div
            style={{
              flexShrink: 0,
              width: 74,
              marginTop: 2,
              borderRadius: 7,
              background: "rgba(255,255,255,.94)",
              border: `1px solid ${GOLD_MID}`,
              boxShadow: "0 3px 10px rgba(0,0,0,.35), inset 0 0 0 1px rgba(12,26,51,.12)",
              padding: "5px 5px 4px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* fine anti-copy diagonal lines inside the panel */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url("${hatch}")`,
                backgroundSize: "cover",
              }}
            />
            <div style={{ position: "relative", background: "#ffffff", borderRadius: 4, padding: 2, boxShadow: "0 1px 4px rgba(0,0,0,.25)" }}>
              <QRCodeCanvas value={verifyUrl} size={48} level="M" bgColor="#ffffff" fgColor="#0C1A33" />
            </div>
            <div style={{ position: "relative", fontSize: 4.6, fontWeight: 800, letterSpacing: 1.4, color: NAVY_DEEP }}>
              SCAN TO VERIFY
            </div>
            <div style={{ position: "relative", fontSize: 3.9, letterSpacing: 1.1, color: GOLD_DARK, fontWeight: 600 }}>
              MSAP VERIFICATION
            </div>
          </div>
        ) : (
          <div
            style={{
              flexShrink: 0,
              width: 62,
              borderRadius: 7,
              border: "1px solid rgba(217,180,90,.5)",
              padding: "8px 5px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 5, letterSpacing: 1.2, opacity: 0.85, lineHeight: 1.6 }}>
              AWAITING
              <br />
              ISSUANCE
            </div>
          </div>
        )}
      </div>

      {/* ============ Signature band ============ */}
      <div
        style={{
          position: "absolute",
          left: 13,
          right: 13,
          bottom: 22,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        {/* Holder signing panel */}
        <div style={{ width: 97 }}>
          <div
            style={{
              height: 25,
              borderRadius: 5,
              background: "rgba(255,255,255,.94)",
              border: "1px solid rgba(217,180,90,.6)",
              boxShadow: "inset 0 1px 3px rgba(12,26,51,.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 6,
                borderBottom: "1px solid rgba(12,26,51,.16)",
              }}
            />
            {sig?.status === "approved" && sig.dataUrl ? (
              <img
                src={sig.dataUrl}
                alt="Holder signature"
                style={{ position: "relative", maxWidth: 86, maxHeight: 19, objectFit: "contain" }}
              />
            ) : (
              <span
                style={{
                  position: "relative",
                  fontSize: 5.4,
                  fontStyle: "italic",
                  letterSpacing: 0.4,
                  color: "#8A9BAE",
                }}
              >
                {sig?.status === "pending"
                  ? "awaiting approval"
                  : sig?.status === "rejected"
                    ? "rejected — resubmit"
                    : "signature pending"}
              </span>
            )}
          </div>
          <div style={{ marginTop: 2.5, fontSize: 4.8, letterSpacing: 1.3, textAlign: "center", opacity: 0.8 }}>
            SIGNATURE OF HOLDER
          </div>
        </div>

        {/* Issuance / validity */}
        <div style={{ textAlign: "center", paddingBottom: 3 }}>
          <div
            style={{
              display: "inline-block",
              fontSize: 5.6,
              fontWeight: 800,
              letterSpacing: 1.6,
              color: NAVY_DEEP,
              background: GOLD_GRAD,
              borderRadius: 3,
              padding: "2.5px 8px",
              boxShadow: "0 1px 3px rgba(0,0,0,.3)",
            }}
          >
            {isPendingIssuance ? "PENDING ISSUANCE" : `ISSUED · REV ${card.version}`}
          </div>
          <div style={{ marginTop: 3, display: "flex", gap: 11, justifyContent: "center" }}>
            <div>
              <div style={{ fontSize: 4.4, letterSpacing: 1.2, opacity: 0.66 }}>ISSUED</div>
              <div style={{ fontSize: 6.4, fontWeight: 700, marginTop: 1, fontFamily: MONO }}>
                {formatDate(card.issuedAt)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 4.4, letterSpacing: 1.2, opacity: 0.66 }}>EXPIRES</div>
              <div style={{ fontSize: 6.4, fontWeight: 700, marginTop: 1, fontFamily: MONO }}>
                {formatDate(card.expiresAt, { month: "short", year: "numeric" })}
              </div>
            </div>
          </div>
        </div>

        {/* National President signing panel — real handwritten signature */}
        <div style={{ width: 97, textAlign: "right" }}>
          <div
            style={{
              height: 25,
              borderRadius: 5,
              background: "rgba(255,255,255,.94)",
              border: "1px solid rgba(217,180,90,.6)",
              boxShadow: "inset 0 1px 3px rgba(12,26,51,.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {showPresidentSig ? (
              <img
                src={card.president.signatureUrl ?? ""}
                alt="National President signature"
                onError={onSignatureFailed}
                style={{ maxWidth: 90, maxHeight: 19, objectFit: "contain" }}
              />
            ) : (
              <span
                style={{
                  fontFamily: "'Segoe Script','Snell Roundhand','Brush Script MT',cursive",
                  fontSize: 12,
                  color: "rgba(12,26,51,.45)",
                  lineHeight: 1.2,
                }}
              >
                {card.president.name}
              </span>
            )}
          </div>
          <div style={{ marginTop: 2.5, fontSize: 4.8, letterSpacing: 1.3, color: GOLD_LIGHT }}>
            NATIONAL PRESIDENT
          </div>
          <div style={{ marginTop: 1, fontSize: 5.4, fontWeight: 700, color: "#ffffff" }}>
            {card.president.name}
          </div>
        </div>
      </div>

      {/* ============ Microtext security strip ============ */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 10,
          overflow: "hidden",
          whiteSpace: "nowrap",
          background: "linear-gradient(90deg, rgba(7,16,32,.92), rgba(12,26,51,.88) 50%, rgba(7,16,32,.92))",
          borderTop: "1px solid rgba(217,180,90,.5)",
          display: "flex",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 3.1,
            letterSpacing: 1,
            opacity: 0.85,
            fontFamily: MONO,
          }}
        >
          {"MSA PAKISTAN • MEDICAL STUDENTS' ASSOCIATION OF PAKISTAN • MEMBER PORTAL • VERIFIED • AUTHENTICATED BY NATIONAL OFFICE • THIS CARD IS THE PROPERTY OF MSA PAKISTAN • ".repeat(7)}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// BACK
// ============================================================================

export function MembershipCardBack({
  card,
  verifyUrl,
}: {
  card: CardData;
  verifyUrl: string;
}) {
  const ghost = useMemo(buildBackGuillocheSvg, []);
  const hatch = useMemo(() => buildHatchSvg("navy-soft"), []);
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
          "0 18px 44px -14px rgba(12,26,51,.6), 0 4px 14px rgba(12,26,51,.28), inset 0 0 0 1px rgba(12,26,51,.12)",
        color: INK,
        fontFamily: FONT,
      }}
    >
      {/* Ghost guilloché */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: `url("${ghost}")`, backgroundSize: "cover" }} />

      {/* ============ Top navy band ============ */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 42,
          background: `linear-gradient(135deg, ${NAVY_DEEP} 0%, ${NAVY} 55%, ${NAVY_MID} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 13px",
        }}
      >
        <MSAPLogo variant="horizontal-compact" tone="white" className="w-[78px]" />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 7, fontWeight: 800, letterSpacing: 1.7, color: "#ffffff" }}>
            OFFICIAL MEMBERSHIP CARD
          </div>
          <div style={{ fontSize: 4.6, fontWeight: 600, letterSpacing: 2.2, color: GOLD_LIGHT, marginTop: 1.5 }}>
            VERIFICATION &amp; TERMS OF USE
          </div>
        </div>
        {/* Metallic gold hairline under the band */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 2,
            background: `linear-gradient(90deg, ${GOLD_DARK}, ${GOLD_LIGHT} 28%, ${GOLD_MID} 50%, ${GOLD_LIGHT} 72%, ${GOLD_DARK})`,
          }}
        />
      </div>

      {/* ============ Body ============ */}
      <div
        style={{
          position: "absolute",
          top: 50,
          left: 13,
          right: 13,
          bottom: 62,
          display: "flex",
          gap: 12,
        }}
      >
        {/* Left: statement + record */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 7.2, fontWeight: 800, letterSpacing: 1.6, color: NAVY }}>
            MEMBERSHIP VERIFICATION
          </div>
          <div
            style={{
              marginTop: 3,
              width: 34,
              height: 2,
              background: `linear-gradient(90deg, ${GOLD_MID}, ${GOLD_LIGHT} 60%, transparent)`,
            }}
          />
          <div
            style={{
              marginTop: 5,
              fontSize: 5.8,
              lineHeight: 1.62,
              color: INK_SOFT,
              fontWeight: 500,
            }}
          >
            This card certifies that the bearer is a registered member of the Medical
            Students&apos; Association of Pakistan (MSA Pakistan), subject to the
            organization&apos;s Constitution, Bylaws, membership regulations and
            verification procedures.
          </div>

          {/* Record grid */}
          <div
            style={{
              marginTop: 8,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              columnGap: 14,
              rowGap: 5,
            }}
          >
            <div>
              <div style={{ fontSize: 4.6, letterSpacing: 1.2, color: "#7C8CA0", textTransform: "uppercase" }}>
                Membership No.
              </div>
              <div style={{ fontSize: 7.4, fontWeight: 700, color: NAVY, fontFamily: MONO, marginTop: 1 }}>
                {card.membershipId || "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 4.6, letterSpacing: 1.2, color: "#7C8CA0", textTransform: "uppercase" }}>
                Local Council
              </div>
              <div style={{ fontSize: 7, fontWeight: 700, color: NAVY, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {card.localCouncil || "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 4.6, letterSpacing: 1.2, color: "#7C8CA0", textTransform: "uppercase" }}>
                Issued
              </div>
              <div style={{ fontSize: 7, fontWeight: 700, color: NAVY, fontFamily: MONO, marginTop: 1 }}>
                {formatDate(card.issuedAt)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 4.6, letterSpacing: 1.2, color: "#7C8CA0", textTransform: "uppercase" }}>
                Expires
              </div>
              <div style={{ fontSize: 7, fontWeight: 700, color: NAVY, fontFamily: MONO, marginTop: 1 }}>
                {formatDate(card.expiresAt, { month: "short", year: "numeric" })}
              </div>
            </div>
          </div>

          {/* Terms */}
          <div
            style={{
              marginTop: "auto",
              paddingTop: 6,
              fontSize: 4.9,
              lineHeight: 1.62,
              color: "#5A6B82",
            }}
          >
            <div style={{ display: "flex", gap: 4 }}>
              <span style={{ color: GOLD_DARK, fontWeight: 800 }}>•</span>
              <span>This card remains the property of MSA Pakistan and must be surrendered upon request.</span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <span style={{ color: GOLD_DARK, fontWeight: 800 }}>•</span>
              <span>Valid only for the member named herein, while membership is active, and together with a valid signature.</span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <span style={{ color: GOLD_DARK, fontWeight: 800 }}>•</span>
              <span>Report loss to vpm@msapakistan.org. A replacement is issued only after National Office verification.</span>
            </div>
          </div>
        </div>

        {/* Right: verification QR */}
        <div
          style={{
            flexShrink: 0,
            width: 86,
            borderRadius: 8,
            background: "#ffffff",
            border: `1px solid ${GOLD_MID}`,
            boxShadow: "0 2px 8px rgba(12,26,51,.16)",
            padding: "6px 5px 5px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            alignSelf: "flex-start",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url("${hatch}")`,
              backgroundSize: "cover",
            }}
          />
          {verifyUrl ? (
            <div style={{ position: "relative", background: "#ffffff", borderRadius: 4, padding: 2 }}>
              <QRCodeCanvas value={verifyUrl} size={56} level="M" bgColor="#ffffff" fgColor="#0C1A33" />
            </div>
          ) : (
            <div
              style={{
                position: "relative",
                width: 56,
                height: 56,
                borderRadius: 4,
                border: "1px dashed rgba(12,26,51,.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 5,
                color: "#7C8CA0",
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              PENDING
              <br />
              ISSUANCE
            </div>
          )}
          <div style={{ position: "relative", fontSize: 4.8, fontWeight: 800, letterSpacing: 1.3, color: NAVY }}>
            SCAN TO VERIFY
          </div>
          <div style={{ position: "relative", fontSize: 4, letterSpacing: 1, color: "#7C8CA0", textAlign: "center", lineHeight: 1.5 }}>
            {"msapakistan.org\n/verify"}
          </div>
        </div>
      </div>

      {/* ============ Gold security strip (microtext, bank-card style) ============ */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 44,
          height: 6,
          background: `linear-gradient(90deg, ${GOLD_DARK}, ${GOLD_LIGHT} 25%, ${GOLD_MID} 50%, ${GOLD_LIGHT} 75%, ${GOLD_DARK})`,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            fontSize: 3.4,
            fontWeight: 800,
            letterSpacing: 2,
            color: "rgba(12,26,51,.75)",
            fontFamily: MONO,
          }}
        >
          {"MSAP • MSAP • AUTHENTIC • MSAP • MSAP • VERIFIED • MSAP • ".repeat(8)}
        </span>
      </div>

      {/* ============ Bottom band: barcode + serial + contact ============ */}
      <div
        style={{
          position: "absolute",
          left: 13,
          right: 13,
          bottom: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ background: "#ffffff", borderRadius: 4, padding: "3px 5px", border: "1px solid rgba(12,26,51,.18)" }}>
            <img src={barcode} alt="Barcode" style={{ width: 104, height: 26, objectFit: "contain" }} />
          </div>
          <div>
            <div style={{ fontSize: 4.4, letterSpacing: 1.2, color: "#7C8CA0" }}>SERIAL NO.</div>
            <div style={{ fontSize: 6.4, fontWeight: 700, color: NAVY, fontFamily: MONO, marginTop: 1 }}>{serial}</div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 5.6, fontWeight: 800, color: NAVY, letterSpacing: 0.6 }}>
            msapakistan.org
          </div>
          <div style={{ fontSize: 4.6, color: INK_SOFT, marginTop: 1.5, fontFamily: MONO }}>
            vpm@msapakistan.org
          </div>
          <div style={{ fontSize: 4.2, color: "#7C8CA0", marginTop: 1.5, letterSpacing: 0.8 }}>
            MSA PAKISTAN · NATIONAL OFFICE · TERM 2025–26
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Export helper — 300 DPI PNG for a given face (CR80 = 85.6 × 53.98 mm)
// ============================================================================

export async function exportCardFacePng(
  element: HTMLElement,
  card: CardData,
  face: "front" | "back",
  html2canvas: (el: HTMLElement, opts?: object) => Promise<HTMLCanvasElement>
): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    scale: 3, // 340×214 × 3 = 1020×642 px = exactly 300 DPI at CR80
    useCORS: true,
  });
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `MSAP-Membership-Card-${face === "front" ? "FRONT" : "BACK"}-${card.membershipId || "member"}.png`;
  link.click();
}

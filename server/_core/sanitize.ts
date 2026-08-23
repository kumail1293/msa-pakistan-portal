/**
 * HTML/CSS Sanitizer for Page Builder Widgets
 *
 * Prevents stored XSS by stripping dangerous elements and attributes
 * from user/admin-provided content. Used by the Page Builder to sanitize
 * all widget settings before storage.
 *
 * This is a defense-in-depth measure: even admin-controlled content
 * is treated as untrusted. A compromised lower-level admin account
 * should not be able to plant persistent JavaScript.
 */

// ============================================================================
// DANGEROUS TAGS — stripped entirely (content preserved, tag removed)
// ============================================================================

const DANGEROUS_TAGS = new Set([
  "script",
  "iframe",
  "object",
  "embed",
  "applet",
  "form",
  "input",
  "textarea",
  "button",
  "select",
  "link",
  "meta",
  "base",
  "source",
  "template",
  "noscript",
]);

// ============================================================================
// DANGEROUS ATTRIBUTES — stripped from all elements
// ============================================================================

const DANGEROUS_ATTRS = new Set([
  // Event handlers
  "onclick", "ondblclick", "onmousedown", "onmouseup", "onmouseover",
  "onmousemove", "onmouseout", "onkeypress", "onkeydown", "onkeyup",
  "onfocus", "onblur", "onchange", "onsubmit", "onreset", "onselect",
  "onload", "onerror", "onunload", "onresize", "onscroll",
  "oncontextmenu", "oninput", "oninvalid", "onsearch",
  "onwheel", "oncopy", "oncut", "onpaste",
  "onanimationend", "onanimationiteration", "onanimationstart",
  "ontransitionend", "onpointerdown", "onpointerup", "onpointermove",
  // Dangerous attributes
  "formaction", "xlink:href", "xmlns",
]);

// ============================================================================
// DANGEROUS CSS PROPERTIES
// ============================================================================

const DANGEROUS_CSS = [
  "expression(",
  "javascript:",
  "vbscript:",
  "url(",
  "behavior:",
  "@import",
  "binding(",
  "-moz-binding(",
  "chrome:",
  "data:",
];

// ============================================================================
// SANITIZE FUNCTIONS
// ============================================================================

/**
 * Sanitize a plain text string (no HTML allowed).
 */
export function sanitizeText(text: string): string {
  if (!text) return "";
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}

/**
 * Sanitize a URL — only allow safe protocols.
 */
export function sanitizeUrl(url: string): string {
  if (!url) return "";
  const trimmed = url.trim().toLowerCase();
  // Block dangerous protocols
  if (trimmed.startsWith("javascript:") || trimmed.startsWith("vbscript:") ||
      trimmed.startsWith("data:") || trimmed.startsWith("file:")) {
    return "";
  }
  // Allow http, https, mailto, tel, #
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") ||
      trimmed.startsWith("mailto:") || trimmed.startsWith("tel:") ||
      trimmed.startsWith("#") || trimmed.startsWith("/")) {
    return url;
  }
  // Relative URLs are okay
  if (!trimmed.includes(":")) return url;
  return "";
}

/**
 * Sanitize HTML content — strip dangerous tags and attributes.
 *
 * This is a lightweight sanitizer. For production, consider using
 * DOMPurify on the client side and this server-side guard as a backup.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  let result = html;

  // Remove dangerous tags entirely (with their content for script/iframe)
  for (const tag of Array.from(DANGEROUS_TAGS)) {
    // Remove self-closing and paired tags, including content for dangerous ones
    const pairedRegex = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "gi");
    const selfClosingRegex = new RegExp(`<${tag}\\b[^>]*/?>`, "gi");
    result = result.replace(pairedRegex, "");
    result = result.replace(selfClosingRegex, "");
  }

  // Remove event handler attributes
  for (const attr of Array.from(DANGEROUS_ATTRS)) {
    const regex = new RegExp(`\\s+${attr}\\s*=\\s*["'][^"']*["']`, "gi");
    result = result.replace(regex, "");
    // Also handle unquoted values
    const regexUnquoted = new RegExp(`\\s+${attr}\\s*=\\s*\\S+`, "gi");
    result = result.replace(regexUnquoted, "");
  }

  // Remove on* attributes generically (catch any we missed)
  result = result.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
  result = result.replace(/\s+on\w+\s*=\s*\S+/gi, "");

  // Remove javascript: in href/src attributes
  result = result.replace(/((?:href|src|action)\s*=\s*)["']?\s*javascript\s*:/gi, "$1\"#\"");

  // Remove data: in src attributes
  result = result.replace(/(src\s*=\s*)["']?\s*data\s*:/gi, "$1\"#\"");

  return result;
}

/**
 * Sanitize CSS style string — remove dangerous properties.
 */
export function sanitizeCss(css: string): string {
  if (!css) return "";
  let result = css;
  for (const dangerous of DANGEROUS_CSS) {
    const regex = new RegExp(dangerous.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    result = result.replace(regex, "");
  }
  return result;
}

/**
 * Sanitize Page Builder widget settings recursively.
 * Strips dangerous content from all string values.
 */
export function sanitizeWidgetSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(settings)) {
    if (typeof value === "string") {
      // URL fields
      if (key === "url" || key === "href" || key === "link" || key === "canonicalUrl") {
        sanitized[key] = sanitizeUrl(value);
      }
      // HTML/code fields
      else if (key === "code" || key === "content" || key === "html" || key === "customHtml") {
        sanitized[key] = sanitizeHtml(value);
      }
      // CSS fields
      else if (key === "css" || key === "style" || key === "customCss") {
        sanitized[key] = sanitizeCss(value);
      }
      // Regular text fields
      else {
        sanitized[key] = sanitizeText(value);
      }
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeWidgetSettings(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === "object" && item !== null
          ? sanitizeWidgetSettings(item as Record<string, unknown>)
          : typeof item === "string" ? sanitizeText(item) : item
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize an entire PageBuilder section before storage.
 */
export function sanitizePageContent(content: unknown): unknown {
  if (!content || typeof content !== "object") return content;

  const obj = content as Record<string, unknown>;

  if ("sections" in obj && Array.isArray(obj.sections)) {
    return {
      ...obj,
      sections: obj.sections.map((section: unknown) => {
        if (!section || typeof section !== "object") return section;
        const s = section as Record<string, unknown>;
        if ("columns" in s && Array.isArray(s.columns)) {
          return {
            ...s,
            columns: s.columns.map((col: unknown) => {
              if (!col || typeof col !== "object") return col;
              const c = col as Record<string, unknown>;
              if ("widgets" in c && Array.isArray(c.widgets)) {
                return {
                  ...c,
                  widgets: c.widgets.map((widget: unknown) => {
                    if (!widget || typeof widget !== "object") return widget;
                    const w = widget as Record<string, unknown>;
                    if ("settings" in w && typeof w.settings === "object") {
                      return { ...w, settings: sanitizeWidgetSettings(w.settings as Record<string, unknown>) };
                    }
                    return widget;
                  }),
                };
              }
              return col;
            }),
          };
        }
        return section;
      }),
    };
  }

  return content;
}

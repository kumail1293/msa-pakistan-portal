/**
 * useBrandingTheme — applies brand colors from the config service as CSS
 * custom properties on the document root, so the existing msap-brand.css
 * variables are overridden at runtime.
 *
 * Usage:
 *   useBrandingTheme();  // call once in the app root
 *
 * When no branding is configured the defaults from msap-brand.css apply
 * (navy #1B355E, teal #106E5B, etc.), so existing deployments are unaffected.
 */

import { useEffect } from "react";
import { trpc } from "../lib/trpc";

/**
 * Apply a hex color to a CSS custom property on :root.
 * Silently skips invalid or empty values.
 */
function applyColor(variable: string, hex: string | null | undefined) {
  if (!hex || !hex.trim()) return;
  // Validate hex format
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex)) {
    document.documentElement.style.setProperty(variable, hex);
  }
}

/**
 * Map brand.* config keys to the CSS custom properties used by
 * msap-brand.css. The CSS already uses these as its design tokens.
 */
const COLOR_MAP: Array<[string, string]> = [
  ["brand.color.primary", "--msap-navy"],
  ["brand.color.secondary", "--msap-teal"],
  ["brand.color.accent", "--msap-accent"],
];

export function useBrandingTheme() {
  const { data: configs } = trpc.config.getAll.useQuery(
    { category: "branding" },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  useEffect(() => {
    if (!configs) return;

    // Build a key→value map from the config rows
    const map = new Map<string, string>();
    for (const c of configs) {
      if (c.value) map.set(c.key, c.value);
    }

    // Apply brand colors to CSS variables
    for (const [configKey, cssVar] of COLOR_MAP) {
      applyColor(cssVar, map.get(configKey));
    }

    // Apply org name as a data attribute (useful for i18n / meta)
    const orgName = map.get("brand.name");
    if (orgName) {
      document.documentElement.setAttribute("data-brand-name", orgName);
    }

    // Set the favicon if configured
    const favicon = map.get("brand.faviconUrl");
    if (favicon) {
      const link = document.querySelector<HTMLLinkElement>(
        "link[rel='icon']"
      );
      if (link) {
        link.href = favicon;
      }
    }
  }, [configs]);
}

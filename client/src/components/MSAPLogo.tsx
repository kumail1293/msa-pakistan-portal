import type { ImgHTMLAttributes } from "react";

import compactColored from "@/assets/msap/logo-horizontal-compact-colored.png";
import compactWhite from "@/assets/msap/logo-horizontal-compact-white.png";
import expandedColored from "@/assets/msap/logo-horizontal-expanded-colored.png";
import expandedWhite from "@/assets/msap/logo-horizontal-expanded-white.png";
import verticalColored from "@/assets/msap/logo-vertical-colored.png";
import verticalWhite from "@/assets/msap/logo-vertical-white.png";

export type MSAPLogoVariant = "horizontal-compact" | "horizontal-expanded" | "vertical";
export type MSAPLogoTone = "brand" | "white";

type MSAPLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  variant?: MSAPLogoVariant;
  tone?: MSAPLogoTone;
  alt?: string;
};

const sources = {
  "horizontal-compact": {
    brand: compactColored,
    white: compactWhite,
  },
  "horizontal-expanded": {
    brand: expandedColored,
    white: expandedWhite,
  },
  vertical: {
    brand: verticalColored,
    white: verticalWhite,
  },
} as const;

/**
 * MSAP logo. The caller's `className`/`style` size the `<picture>` container;
 * the `<img>` always fills that container with `object-contain`, so the logo
 * scales proportionally (never renders at its raw 2048px natural size) and
 * stays centered inside the box it is given.
 */
export function MSAPLogo({
  variant = "horizontal-expanded",
  tone = "brand",
  alt = "Medical Students' Association of Pakistan",
  className = "",
  ...props
}: MSAPLogoProps) {
  const selected = sources[variant];
  // The picture must be block-level so width classes (e.g. w-36) apply;
  // an inline <picture> ignores width and the image then expands to fill
  // the whole line box.
  return (
    <picture className={`block ${className}`}>
      <img
        src={tone === "white" ? selected.white : selected.brand}
        alt={alt}
        className="h-full w-full object-contain"
        {...props}
      />
    </picture>
  );
}

import type { Express, NextFunction, Request, Response } from "express";
import { ENV } from "./env";
import { childLogger } from "./logger";

const log = childLogger("Security");

/**
 * Global security middleware.
 *
 * - securityHeaders: X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
 *   Permissions-Policy always; CSP + HSTS in production only (CSP would break
 *   Vite's dev HMR, and HSTS over plain http is invalid).
 * - sameOriginGuard: fail-closed CORS — never emit Access-Control-Allow-Origin,
 *   and reject cross-origin requests outright in production.
 * - errorHandler: convert unexpected errors into a generic 500 so stack
 *   traces and internal messages never reach the client.
 */

const isProduction = ENV.isProduction;

function buildCsp(): string {
  const directives = [
    "default-src 'self'",
    "script-src 'self'",
    // React inline style props require 'unsafe-inline' for styles.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ];

  // The MapView component loads the Google Maps JS API through the configured
  // Forge proxy origin; allow that origin for scripts/images/connections when
  // it is configured.
  const forgeOrigin = ENV.forgeApiUrl?.trim();
  if (forgeOrigin) {
    let origin: string;
    try {
      origin = new URL(forgeOrigin).origin;
    } catch {
      origin = "";
    }
    if (origin) {
      directives.push(`script-src 'self' ${origin}`);
      directives.push(`img-src 'self' data: https: ${origin}`);
      directives.push(`connect-src 'self' ${origin}`);
    }
  }

  return directives.join("; ");
}

export function registerSecurityMiddleware(app: Express) {
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    );

    if (isProduction) {
      res.setHeader("Content-Security-Policy", buildCsp());
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    next();
  });

  // Fail-closed CORS: the portal is same-origin only. Block cross-origin
  // requests in production rather than reflecting an Origin header.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      const host = req.headers.host;
      const sameOrigin =
        host !== undefined &&
        (origin === `http://${host}` || origin === `https://${host}`);
      if (!sameOrigin) {
        if (isProduction) {
          res.status(403).send("Cross-origin requests are not allowed.");
          return;
        }
        // Dev tooling (e.g. browser extensions) may send arbitrary Origins;
        // log and continue rather than breaking local development.
        log.warn({ origin }, "Cross-origin request blocked in dev");
      }
    }
    next();
  });
}

export function registerErrorHandler(app: Express) {
  // Must be registered AFTER all routes. Catches anything not handled above.
  app.use(
    (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      log.error({ err }, "Unhandled error");
      if (res.headersSent) return;
      // Preserve body-parser's statuses (malformed JSON -> 400, body too
      // large -> 413) without ever echoing the underlying message.
      const status =
        err && typeof err === "object" && "status" in err
          ? Number((err as { status?: unknown }).status)
          : 500;
      const safeStatus =
        Number.isInteger(status) && status >= 400 && status <= 599
          ? status
          : 500;
      res.status(safeStatus).send(
        safeStatus === 500 ? "Internal server error." : "Bad request."
      );
    }
  );
}

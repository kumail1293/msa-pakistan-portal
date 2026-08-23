import "./dotenv";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import {
  registerErrorHandler,
  registerSecurityMiddleware,
} from "./securityMiddleware";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import { TRPCError } from "@trpc/server";
import { sdk } from "./sdk";
import { checkRateLimit, rateLimitKey } from "./rateLimit";
import { childLogger } from "./logger";
import { seedMockData, getMockDataStats } from "../config/mockDataSeeder";
import { googleDriveEngine } from "../config/googleDriveEngine";
import { documentUploadEngine } from "../config/documentUploadEngine";
import { registerHealthRoutes, markReady } from "./health";

const log = childLogger("Server");
import { buildMemberCard } from "../services/memberAccountService";
import { generatePremiumMembershipCardPdf } from "../services/documentService";
import {
  initEmailBranding,
  isSmtpConfigured,
  processPendingEmails,
} from "../services/emailService";

/**
 * Drains the email queue every minute (first pass shortly after boot).
 * The in-flight guard prevents overlapping runs when a delivery is slow.
 */
function startEmailQueueProcessor() {
  const INTERVAL_MS = 60_000;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processPendingEmails();
    } catch (error) {
      log.error({ err: error }, "Email queue processor error");
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 5_000);
  setInterval(tick, INTERVAL_MS);
  log.info("Email queue processor started (every 60s)");
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Security headers, CORS guard and body-size cap. 30mb is the parsed-JSON
  // ceiling for a membership submission (photo 4mb + receipt 8mb + CNIC 8mb
  // base64 + form fields) and bounds memory use on every other endpoint.
  registerSecurityMiddleware(app);
  app.use(express.json({ limit: "30mb" }));
  app.use(express.urlencoded({ limit: "30mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerHealthRoutes(app);

  // Print-ready premium membership card PDF. Streamed straight from the
  // server (no storage dependency) so it works even before Forge storage is
  // provisioned. Session-authenticated via the same httpOnly cookie as tRPC.
  app.get("/api/card-pdf", async (req, res) => {
    // PDF generation is CPU/memory heavy; cap per-IP regeneration. The
    // limiter keys on the socket address only (same as every tRPC procedure).
    const limit = checkRateLimit(rateLimitKey(req), 30, 15 * 60 * 1000);
    if (!limit.allowed) {
      res
        .status(429)
        .setHeader("Retry-After", String(Math.ceil((limit.retryAfterMs ?? 0) / 1000)))
        .send("Too many card downloads. Try again shortly.");
      return;
    }
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.redirect(302, "/login");
      return;
    }
    try {
      const card = await buildMemberCard(user.id);
      if (!card) {
        res.status(404).send("Membership card not found.");
        return;
      }
      const pdf = await generatePremiumMembershipCardPdf(card);
      const safeId = (card.membershipId || "member").replace(
        /[^A-Za-z0-9_-]/g,
        "-"
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="MSAP-Membership-Card-${safeId}.pdf"`
      );
      res.setHeader("Content-Length", String(pdf.length));
      res.setHeader("Cache-Control", "no-store");
      res.send(pdf);
    } catch (error) {
      log.error({ err: error }, "Card PDF generation failed");
      res.status(500).send("Could not generate the membership card PDF.");
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path, type }) {
        // Log everything server-side; never leak internals to the client.
        if (error instanceof TRPCError) {
          // Expected application errors (auth, validation, rate limit) are
          // already user-safe; log at debug level.
          if (error.code === "INTERNAL_SERVER_ERROR") {
            log.error({ err: error, path: path ?? "", type }, "tRPC internal error");
          } else {
            log.debug({ err: error, path: path ?? "", type }, "tRPC application error");
          }
        } else {
          log.error({ err: error, path: path ?? "", type }, "tRPC unexpected error");
        }
      },
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  // Global catch-all AFTER every route: generic 500, full details server-side.
  registerErrorHandler(app);

  const port = 3000;

  // Pre-load branding defaults so sync getSmtpConfig() uses real values.
  await initEmailBranding();

  server.listen(port, () => {
    log.info({ port }, "Server listening");

    // Mark server ready for traffic (enables /health/ready and /health).
    markReady();

    // Seed mock data and initialize engines
    seedMockData().then(() => {
      const stats = getMockDataStats();
      log.info({ mockData: stats }, "Mock data seeded");
    }).catch(err => log.warn({ err }, "Mock data seeding failed"));
    documentUploadEngine.seedSampleDocuments();
    log.info({ driveStats: googleDriveEngine.getStats() }, "Google Drive engine initialized");
    log.info({ docStats: documentUploadEngine.getStats() }, "Document Upload engine initialized");

    // Real SMTP delivery, or the dev memory-outbox flush when SMTP is absent.
    if (isSmtpConfigured() || !ENV.isProduction) {
      startEmailQueueProcessor();
    } else {
      // Production without a relay: never fail silently - the queue would
      // never drain and members would never receive their setup emails.
      log.error("SMTP not configured — member emails will NOT be delivered");
    }
  });
}

startServer().catch(err => log.fatal({ err }, "Server failed to start"));

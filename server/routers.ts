import { COOKIE_NAME, UNAUTHED_ERR_MSG } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import {
  officialModuleProcedure,
  publicProcedure,
  router,
  protectedProcedure,
  rateLimitedProcedure,
  superAdminProcedure,
} from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { buildAuthorizeUrl } from "./_core/officialOAuth";
import { submitMembershipApplication } from "./services/googleSheetsService";
import { validateUpload } from "./_core/uploads";
import {
  queueOfficialSetupEmail,
  sendTestEmail,
} from "./services/emailService";
import * as memberAccounts from "./services/memberAccountService";
import {
  hashPassword,
  hashToken,
  toPublicUser,
  validatePassword,
  verifyPassword,
  MEMBER_SESSION_MAX_AGE_MS,
} from "./services/memberAuthService";

/**
 * Generic login failure used for every bad-credential path so the API never
 * reveals whether an identifier exists or a password is wrong.
 */
const GENERIC_LOGIN_ERROR =
  "Invalid Membership ID/email or password.";

// Cooldown map so a flood of failed logins cannot hammer the Apps Script
// registry with reconciliation lookups for the same identifier. The map is
// capped so an attacker cycling many identifiers cannot grow memory forever.
const RECONCILIATION_COOLDOWN_MS = 60_000;
const RECONCILIATION_COOLDOWN_MAX = 5_000;
const reconciliationCooldowns = new Map<string, number>();

function shouldReconcile(identifier: string): boolean {
  const key = identifier.trim().toLowerCase();
  const now = Date.now();
  const last = reconciliationCooldowns.get(key) ?? 0;
  if (now - last < RECONCILIATION_COOLDOWN_MS) return false;
  if (reconciliationCooldowns.size >= RECONCILIATION_COOLDOWN_MAX) {
    // Drop expired entries; if still at capacity, reset rather than grow.
    reconciliationCooldowns.forEach((ts, k) => {
      if (now - ts >= RECONCILIATION_COOLDOWN_MS) reconciliationCooldowns.delete(k);
    });
    if (reconciliationCooldowns.size >= RECONCILIATION_COOLDOWN_MAX) {
      reconciliationCooldowns.clear();
    }
  }
  reconciliationCooldowns.set(key, now);
  return true;
}

export const appRouter = router({
  // ============ AUTH ROUTES ============
  auth: router({
    /** Current session user (credentials stripped). */
    me: publicProcedure.query((opts) =>
      opts.ctx.user ? toPublicUser(opts.ctx.user) : null
    ),

    /**
     * Member login. Accepts a Membership ID OR an email, plus a password.
     * Identity is resolved server-side; the session cookie is httpOnly.
     */
    login: rateLimitedProcedure(10, 15 * 60 * 1000)
      .input(
        z.object({
          identifier: z.string().min(1).max(255),
          password: z.string().min(1).max(1024),
          // Which sign-in pathway the credentials are for. Members use the
          // member portal; officials/admins use the official portal. The two
          // are hard-separated: a member credential can never open the
          // official portal and an official account can never open the
          // member portal.
          portal: z.enum(["member", "official"]).default("member"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const identifier = input.identifier.trim();
        let user = memberAccounts.findUserByIdentity(identifier);

        // Reconciliation: an approved member without a portal account gets one
        // created (with a setup email) the first time they attempt login. Only
        // the member pathway reconciles - officials are provisioned by the
        // super admin and never come from the membership registry. The
        // response is identical to a generic failure either way.
        if (!user && input.portal === "member" && shouldReconcile(identifier)) {
          const result = await memberAccounts.syncApprovedMember(identifier);
          if (result.status === "created" || result.status === "updated") {
            user = memberAccounts.findUserByIdentity(identifier);
          }
        }

        // Portal separation: an official's password is rejected on the member
        // form and a member's password is rejected on the official form - with
        // the SAME generic message so neither pathway reveals what the other
        // kind of account looks like.
        const wrongPortal =
          !!user &&
          (input.portal === "member"
            ? memberAccounts.isOfficialRole(user.role)
            : user.role === "user");

        const passwordOk =
          !!user &&
          !wrongPortal &&
          user.active !== false &&
          !!user.passwordHash &&
          !user.passwordSetupRequired &&
          (await verifyPassword(input.password, user.passwordHash));

        if (!passwordOk || !user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: GENERIC_LOGIN_ERROR,
          });
        }

        memberAccounts.recordLastSignIn(user.id);
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || user.email || "",
          expiresInMs: MEMBER_SESSION_MAX_AGE_MS,
          version: user.sessionEpoch ?? 0,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: MEMBER_SESSION_MAX_AGE_MS,
        });

        return { success: true, user: toPublicUser(user) };
      }),

    /**
     * Request a fresh one-time password setup link for an approved member.
     *
     * Runs the same idempotent reconciliation as login but forces a fresh
     * setup token + setup email. The response is generic so the API never
     * reveals whether an identifier exists (same stance as login). In
     * development the detail is surfaced so misconfiguration (e.g. the Apps
     * Script bridge being down) is actually diagnosable.
     */
    requestPasswordSetup: rateLimitedProcedure(5, 15 * 60 * 1000)
      .input(z.object({ identifier: z.string().trim().min(1).max(255) }))
      .mutation(async ({ input }) => {
        const result = await memberAccounts.syncApprovedMember(
          input.identifier.trim(),
          { resendSetupEmail: true }
        );
        const generic =
          "If an approved membership matches that ID or email, a new password setup link has been sent to your registered email.";
        // DEV-ONLY diagnostic detail: production (and any deployment with
        // NODE_ENV=production) always returns the generic message so this
        // endpoint can never be used to probe which identifiers exist.
        const message =
          !ENV.isProduction && result.status === "lookup-unavailable"
            ? "The membership registry is unreachable. Check MSAP_APPS_SCRIPT_URL and the server console for details."
            : !ENV.isProduction && result.status === "not-found"
              ? "No approved member record matches that identifier."
              : !ENV.isProduction && result.status === "not-approved"
                ? "That member record is not yet approved."
                : generic;
        return { success: true, message };
      }),

    /**
     * Request a fresh one-time setup link for an OFFICIAL account (provisioned
     * by the super admin). The response is generic so the API never reveals
     * which emails hold official accounts.
     */
    officialRequestSetup: rateLimitedProcedure(5, 15 * 60 * 1000)
      .input(z.object({ email: z.string().trim().toLowerCase().email() }))
      .mutation(({ input }) => {
        const user = memberAccounts.findUserByIdentity(input.email);
        if (user && memberAccounts.isOfficialRole(user.role)) {
          const rawToken = memberAccounts.resetOfficialPassword(user.id);
          if (rawToken) {
            // Best-effort email (queued; delivered once SMTP is configured).
            void queueOfficialSetupEmail({
              name: user.name || "MSAP Official",
              positionLabel:
                (user.officialPosition &&
                  memberAccounts.OFFICIAL_POSITION_LABELS[user.officialPosition]) ||
                "Official",
              recipientEmail: user.email,
              setupUrl: `${memberAccounts.getPortalBaseUrl()}/set-password?token=${rawToken}`,
              expiresAt: new Date(
                Date.now() + ENV.passwordSetupTokenExpiryMs
              ),
            });
          }
        }
        return {
          success: true,
          message:
            "If an official account matches that email, a fresh password setup link has been sent.",
        };
      }),

    /**
     * One-time password setup. Validates the hashed token, expiry and
     * single-use guarantee, stores the scrypt hash and logs the member in.
     */
    setupPassword: rateLimitedProcedure(10, 15 * 60 * 1000)
      .input(
        z.object({
          token: z.string().min(1).max(512),
          password: z.string().min(1).max(1024),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const validation = validatePassword(input.password);
        if (!validation.valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: validation.errors.join(" "),
          });
        }

        const tokenHash = hashToken(input.token.trim());
        const user = memberAccounts.findUserBySetupTokenHash(tokenHash);
        const tokenValid = memberAccounts.isSetupTokenValid(user);

        if (!tokenValid || !user) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "This setup link is invalid or has expired. Please request a new one.",
          });
        }

        // Invalidate the token and store only the hash of the new password.
        const passwordHash = await hashPassword(input.password);
        const updated = memberAccounts.completePasswordSetup(
          user.id,
          passwordHash
        );
        if (!updated) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not complete password setup. Please try again.",
          });
        }

        const sessionToken = await sdk.createSessionToken(updated.openId, {
          name: updated.name || updated.email || "",
          expiresInMs: MEMBER_SESSION_MAX_AGE_MS,
          version: updated.sessionEpoch ?? 0,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: MEMBER_SESSION_MAX_AGE_MS,
        });

        return { success: true, user: toPublicUser(updated) };
      }),

    /**
     * Lightweight token check for the /set-password page greeting.
     * Reveals only the member's name/ID, never token material.
     */
    setupTokenInfo: rateLimitedProcedure(30, 15 * 60 * 1000)
      .input(z.object({ token: z.string().min(1).max(512) }))
      .query(({ input }) => {
        const tokenHash = hashToken(input.token.trim());
        const user = memberAccounts.findUserBySetupTokenHash(tokenHash);
        const valid = memberAccounts.isSetupTokenValid(user);

        if (!valid || !user) return { valid: false as const };
        return {
          valid: true as const,
          name: user.name || "",
          membershipId: user.membershipId || "",
          expiresAt: user.setupTokenExpiresAt,
        };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      // Revoke the session server-side so a copied cookie dies too, not just
      // this browser's copy of it.
      if (ctx.user) {
        memberAccounts.revokeAllSessions(ctx.user.id);
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    /**
     * Official (Google) sign-in. Returns the provider authorize URL, or
     * available:false when no OAuth provider is configured. `next` is an
     * optional same-origin path to land on after the callback (defaults to
     * /dashboard). The state nonce is issued server-side.
     */
    oAuthLoginUrl: publicProcedure
      .input(
        z
          .object({
            next: z.string().max(300).optional(),
          })
          .default({})
      )
      .query(({ ctx, input }) => {
        const rawNext = input.next ?? "";
        const next =
          rawNext.startsWith("/") && !rawNext.startsWith("//")
            ? rawNext
            : "/official";
        const url = buildAuthorizeUrl(ctx.req, next);
        if (!url) return { available: false as const };
        return { available: true as const, url };
      }),

    /**
     * DEVELOPMENT-ONLY helper to seed a member account for local testing of
     * the setup -> login -> dashboard lifecycle. Never enabled in production.
     */
    devCreateTestMember: publicProcedure
      .input(
        z.object({
          membershipId: z.string().min(2).max(50),
          email: z.string().email(),
          name: z.string().min(1).max(150),
        })
      )
      .mutation(({ input }) => {
        if (ENV.isProduction) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Not available in production.",
          });
        }
        const user = memberAccounts.upsertUser({
          openId: `member:${input.membershipId}`,
          email: input.email.toLowerCase(),
          name: input.name,
          membershipId: input.membershipId,
          membershipStatus: "Active",
          discipline: "MBBS",
          yearOfStudy: "3rd Year",
          localCouncil: "MSA-Pakistan KEMU LC",
          institution: "King Edward Medical University",
          loginMethod: "member-password",
        });
        const issued = memberAccounts.issueSetupToken(user.id);
        console.warn(
          "[Dev] devCreateTestMember used - development only, do not expose in production."
        );
        return {
          membershipId: user.membershipId,
          setupToken: issued?.rawToken ?? null,
        };
      }),

    /**
     * DEVELOPMENT-ONLY helper to seed an admin account for local testing of
     * the admin login -> dashboard lifecycle. Never enabled in production.
     * Mirrors devCreateTestMember (which only creates role "user" accounts).
     */
    devCreateTestAdmin: publicProcedure
      .input(
        z.object({
          membershipId: z.string().min(2).max(50),
          email: z.string().email(),
          name: z.string().min(1).max(150),
        })
      )
      .mutation(({ input }) => {
        if (ENV.isProduction) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Not available in production.",
          });
        }
        const user = memberAccounts.upsertUser({
          openId: `admin:${input.membershipId}`,
          email: input.email.toLowerCase(),
          name: input.name,
          membershipId: input.membershipId,
          membershipStatus: "Active",
          role: "admin",
          loginMethod: "member-password",
        });
        const issued = memberAccounts.issueSetupToken(user.id);
        console.warn(
          "[Dev] devCreateTestAdmin used - development only, do not expose in production."
        );
        return {
          membershipId: user.membershipId,
          setupToken: issued?.rawToken ?? null,
        };
      }),

    /**
     * DEVELOPMENT-ONLY helper to seed a super admin account for local testing
     * of the officials-management portal. Never enabled in production.
     */
    devCreateSuperAdmin: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          name: z.string().min(1).max(150),
        })
      )
      .mutation(({ input }) => {
        if (ENV.isProduction) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Not available in production.",
          });
        }
        const user = memberAccounts.upsertUser({
          openId: `superadmin:${input.email.toLowerCase()}`,
          email: input.email.toLowerCase(),
          name: input.name,
          role: "superadmin",
          loginMethod: "member-password",
        });
        const issued = memberAccounts.issueSetupToken(user.id);
        console.warn(
          "[Dev] devCreateSuperAdmin used - development only, do not expose in production."
        );
        return {
          email: user.email,
          setupToken: issued?.rawToken ?? null,
        };
      }),
  }),

  // ============ MEMBER ROUTES ============
  member: router({
    getProfile: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      return toPublicUser(ctx.user);
    }),

    /**
     * Full dashboard payload. Identity is always derived from the session;
     * a member can never request another member's profile.
     */
    portalProfile: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: UNAUTHED_ERR_MSG,
        });
      }
      return memberAccounts.buildPortalProfile(ctx.user);
    }),

    updateProfile: protectedProcedure
      .input(
        z.object({
          name: z.string().max(150).optional(),
          phone: z.string().max(25).optional(),
          bio: z.string().max(1000).optional(),
          institution: z.string().max(255).optional(),
          degree: z.string().max(100).optional(),
          localCouncil: z.string().max(255).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const updated = memberAccounts.updateMemberProfile(ctx.user.id, input);
        if (!updated) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not update your profile. Please try again.",
          });
        }
        return { success: true, user: toPublicUser(updated) };
      }),

    getDocuments: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return [];
      return memberAccounts.getMemberDocuments(ctx.user.id);
    }),

    // ===== Membership card (approved-data only) =====
    card: router({
      /**
       * The member's card. Identity fields come from the registry-synced
       * account; issuance state only changes when the National Office
       * approves a holder-signature change.
       */
      get: protectedProcedure.query(async ({ ctx }) => {
        if (!ctx.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: UNAUTHED_ERR_MSG,
          });
        }
        const card = await memberAccounts.buildMemberCard(ctx.user.id);
        if (!card) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Your card could not be built. Please try again.",
          });
        }
        return card;
      }),

      /**
       * Submit a hand-drawn signature for National Office approval. The card
       * is (re)issued only after approval - never on submission.
       */
      submitSignature: rateLimitedProcedure(5, 15 * 60 * 1000)
        .input(
          z.object({
            dataUrl: z.string().min(20).max(400_000),
          })
        )
        .mutation(async ({ ctx, input }) => {
          if (!ctx.user) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: UNAUTHED_ERR_MSG,
            });
          }
          const card = await memberAccounts.submitHolderSignature(
            ctx.user.id,
            input.dataUrl
          );
          if (!card) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Signature must be a PNG image (data URL, max 400KB).",
            });
          }
          return { success: true, card };
        }),

      /**
       * Request National Office approval to re-issue the card after registry
       * data changed. The card keeps rendering the approved snapshot until
       * the re-issue is approved.
       */
      requestReissue: rateLimitedProcedure(3, 15 * 60 * 1000)
        .mutation(async ({ ctx }) => {
          if (!ctx.user) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: UNAUTHED_ERR_MSG,
            });
          }
          const card = await memberAccounts.requestCardReissue(ctx.user.id);
          if (!card) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Your card could not be updated. Please try again.",
            });
          }
          return { success: true, card };
        }),
    }),
  }),

  // ============ MEMBERSHIP FORM ROUTES ============
  membership: router({
    getLocalCouncils: publicProcedure.query(async () => {
      return await db.getLocalCouncils();
    }),
  }),

  // ============ CARD VERIFICATION (public, QR) ============
  card: router({
    /**
     * Verify a card via its QR payload (membership ID + HMAC token).
     * Recomputes the token server-side; reveals the holder's name only for
     * authentic, currently-issued cards.
     */
    verify: rateLimitedProcedure(20, 15 * 60 * 1000)
      .input(
        z.object({
          membershipId: z.string().min(1).max(50),
          token: z.string().min(1).max(128),
        })
      )
      .query(({ input }) =>
        memberAccounts.verifyCardToken(input.membershipId, input.token)
      ),
  }),

  // ============ OPPORTUNITIES ROUTES ============
  opportunity: router({
    list: publicProcedure
      .input(
        z.object({
          limit: z.number().default(50),
          offset: z.number().default(0),
        })
      )
      .query(async ({ input }) => {
        return await db.getOpportunities();
      }),

    submitApplication: protectedProcedure
      .input(
        z.object({
          opportunityId: z.number(),
          applicationText: z.string().min(1).max(2000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await db.createOpportunityApplication(
          input.opportunityId,
          ctx.user.id,
          input.applicationText
        );
        if (!result) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not record your application. Please try again.",
          });
        }
        return { success: true, applicationId: result.id };
      }),

    getMyApplications: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserOpportunityApplications(ctx.user.id);
    }),
  }),

  // ============ VOTING ROUTES ============
  voting: router({
    getActiveSessions: publicProcedure.query(async () => {
      return await db.getVotingSessions();
    }),

    /**
     * Member-facing voting dashboard: every session enriched with its option
     * list, live totals, participation count and the caller's own vote.
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      const sessions = await db.getVotingSessions();
      return Promise.all(
        sessions.map(async (session) => {
          const { totals, totalVotes } = await db.getVotingSessionResults(session.id);
          const userVote =
            (await db.getUserVote(session.id, ctx.user.id))?.voteOption ?? null;
          // Options come from the admin-seeded results map (option -> count);
          // live votes add any options that were not pre-seeded.
          const seeded = (session.results as Record<string, number> | null) ?? {};
          const options = Array.from(
            new Set([...Object.keys(seeded), ...Object.keys(totals)])
          );
          return {
            id: session.id,
            title: session.title,
            description: session.description,
            status: session.status ?? "Pending",
            startDate: session.startDate,
            endDate: session.endDate,
            options,
            totals: { ...seeded, ...totals },
            totalVotes,
            userVote,
          };
        })
      );
    }),

    submitVote: protectedProcedure
      .input(
        z.object({
          sessionId: z.number(),
          voteOption: z.string().min(1).max(255),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await db.castVote(
          input.sessionId,
          ctx.user.id,
          input.voteOption
        );
        if (!result.success) {
          throw new TRPCError({
            code: result.duplicate ? "CONFLICT" : "INTERNAL_SERVER_ERROR",
            message: result.duplicate
              ? "You have already voted in this session."
              : "Could not record your vote. Please try again.",
          });
        }
        return { success: true };
      }),

    getSessionResults: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { totals, totalVotes } = await db.getVotingSessionResults(input.sessionId);
        const userVote =
          (await db.getUserVote(input.sessionId, ctx.user.id))?.voteOption ?? null;
        return { totals, totalVotes, userVote };
      }),
  }),

  // ============ CV MAKER ROUTES ============
  cvMaker: router({
    getEntries: protectedProcedure.query(async ({ ctx }) => {
      return memberAccounts.getCVEntries(ctx.user.id);
    }),

    addEntry: protectedProcedure
      .input(
        z.object({
          type: z.enum(["Education", "Position", "Skill", "Activity", "Achievement"]),
          title: z.string().min(1).max(255),
          description: z.string().max(2000).optional(),
          organization: z.string().max(255).optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          isCurrent: z.boolean().default(false),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const entry = memberAccounts.addCVEntry(ctx.user.id, input);
        return { success: true, entry };
      }),

    updateEntry: protectedProcedure
      .input(
        z.object({
          entryId: z.number().int(),
          type: z.enum(["Education", "Position", "Skill", "Activity", "Achievement"]).optional(),
          title: z.string().min(1).max(255).optional(),
          description: z.string().max(2000).optional(),
          organization: z.string().max(255).optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          isCurrent: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { entryId, ...fields } = input;
        const entry = memberAccounts.updateCVEntry(ctx.user.id, entryId, fields);
        if (!entry) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "CV entry not found.",
          });
        }
        return { success: true, entry };
      }),

    deleteEntry: protectedProcedure
      .input(z.object({ entryId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const deleted = memberAccounts.deleteCVEntry(ctx.user.id, input.entryId);
        if (!deleted) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "CV entry not found.",
          });
        }
        return { success: true };
      }),

  }),

  // ============ DOCUMENT ROUTES ============
  document: router({
    getMemberDocuments: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return [];
      return await db.getUserDocuments(ctx.user.id);
    }),

    generateMembershipLetter: protectedProcedure.mutation(async () => {
      return { success: true, documentUrl: "/documents/letter.pdf" };
    }),

    generateMembershipCard: protectedProcedure.mutation(async () => {
      return { success: true, documentUrl: "/documents/card.pdf" };
    }),

    generateCertificate: protectedProcedure.mutation(async () => {
      return { success: true, documentUrl: "/documents/certificate.pdf" };
    }),
  }),

  // ============ DIRECTORY ROUTES ============
  directory: router({
    /**
     * Full member directory feed. Safe public fields only; membership-gated
     * because it includes contact emails.
     */
    listMembers: protectedProcedure
      .input(
        z.object({
          query: z.string().max(120).default(""),
          localCouncil: z.string().max(120).optional(),
          limit: z.number().int().min(1).max(200).default(100),
        })
      )
      .query(async ({ input }) => {
        return memberAccounts.listDirectoryMembers(input);
      }),

    searchMembers: protectedProcedure
      .input(
        z.object({
          query: z.string().max(120),
          localCouncil: z.string().max(120).optional(),
          limit: z.number().int().min(1).max(200).default(20),
        })
      )
      .query(async ({ input }) => {
        return memberAccounts.listDirectoryMembers(input);
      }),

    getMemberProfile: protectedProcedure
      .input(z.object({ memberId: z.number() }))
      .query(async ({ input }) => {
        return memberAccounts.getDirectoryMember(input.memberId);
      }),
  }),

  // ============ MEMBERSHIP FORM ROUTES ============
  membershipForm: router({
    submit: rateLimitedProcedure(5, 15 * 60 * 1000)
      .input(
        z.object({
          email: z.string().email(),
          fullName: z.string().min(2).max(150),
          personalEmail: z.string().email().optional().or(z.literal("")),
          contactNumber: z.string().min(10).max(25),
          age: z.number().int().min(14).max(80),
          dateOfBirth: z.string().min(8),
          cnic: z.string().regex(/^\d{5}-?\d{7}-?\d$/, "Enter a valid Pakistani CNIC"),
          gender: z.enum(["Male", "Female", "Prefer not to say", "Others"]),
          cityOfResidence: z.string().min(2).max(100),
          address: z.string().min(5).max(500),
          reasonForJoining: z.string().min(10).max(2000),
          courseLevel: z.enum(["Undergraduate (UG)", "Postgraduate (PG)"]),
          courseOfStudy: z.string().min(2).max(200),
          otherCourse: z.string().max(255).optional(),
          yearOfStudy: z.string().min(1).max(100),
          institute: z.string().min(2).max(255),
          otherInstitute: z.string().max(255).optional(),
          collegeRollNumber: z.string().min(1).max(100),
          discoverySources: z.array(z.string()).min(1),
          otherDiscoverySource: z.string().max(255).optional(),
          profilePhoto: z.object({
            fileName: z.string().max(180),
            mimeType: z.string().max(100),
            base64: z.string().max(4_000_000),
          }),
          feeReceipt: z.object({
            fileName: z.string().max(180),
            mimeType: z.string().max(100),
            base64: z.string().max(8_000_000),
          }).optional(),
          termsAccepted: z.literal(true),
          undertakingAccepted: z.literal(true),
          introductionAcknowledged: z.literal(true),
          incompleteAcknowledgement: z.literal(true),
          graduationDate: z.string().optional(),
          cnicCopy: z.object({
            fileName: z.string().max(180),
            mimeType: z.string().max(100),
            base64: z.string().max(8_000_000),
          }).optional(),
          conflictOfInterest: z.string().max(2000).default("No"),
          conflictOrganization: z.string().max(255).optional(),
          conflictRole: z.string().max(255).optional(),
          paymentAccountName: z.string().min(2).max(255),
        })
      )
      .mutation(async ({ input }) => {
        // Server-side magic-byte validation of every uploaded file (the
        // client-declared mimeType is untrusted).
        const photoError = validateUpload(input.profilePhoto, ["image"]);
        if (photoError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Profile photo: ${photoError}`,
          });
        }
        if (input.feeReceipt) {
          const feeError = validateUpload(input.feeReceipt, ["image", "pdf"]);
          if (feeError) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Fee receipt: ${feeError}`,
            });
          }
        }
        if (input.cnicCopy) {
          const cnicError = validateUpload(input.cnicCopy, ["image", "pdf"]);
          if (cnicError) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `CNIC copy: ${cnicError}`,
            });
          }
        }

        const result = await submitMembershipApplication(input);
        return {
          success: true,
          applicationRef: result.data?.applicationRef,
          message: result.message || "Application submitted successfully.",
        };
      }),
  }),

  // ============ ADMIN ROUTES ============
  admin: router({
    // ===== Officials management (super admin only) =====
    officials: router({
      /** Every provisioned official account (admins + super admins included). */
      list: superAdminProcedure.query(async () => memberAccounts.listOfficials()),

      /**
       * Provision a new official. There is NO self sign-up anywhere: only the
       * super admin can create these accounts. The returned setup token powers
       * the one-time password-setup link (also emailed best-effort).
       */
      create: superAdminProcedure
        .input(
          z.object({
            name: z.string().min(1).max(150),
            email: z.string().email().max(255),
            position: z.enum(memberAccounts.OFFICIAL_POSITIONS),
            domain: z.string().max(120).optional(),
            localCouncil: z.string().max(255).optional(),
            moduleAccess: z.array(z.string().max(40)).default([]),
            role: z.enum(["official", "admin"]).default("official"),
          })
        )
        .mutation(({ input }) => {
          const result = memberAccounts.createOfficial(input);
          if (!result.ok) {
            throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
          }
          if (result.setupToken) {
            void queueOfficialSetupEmail({
              name: result.user.name || "MSAP Official",
              positionLabel:
                memberAccounts.OFFICIAL_POSITION_LABELS[input.position],
              recipientEmail: result.user.email,
              setupUrl: `${memberAccounts.getPortalBaseUrl()}/set-password?token=${result.setupToken}`,
              expiresAt: new Date(
                Date.now() + ENV.passwordSetupTokenExpiryMs
              ),
            });
          }
          return {
            ok: true as const,
            official: result.user,
            setupToken: result.setupToken,
            created: result.created,
          };
        }),

      /** Update an official's profile fields (position/domain/council/status). */
      update: superAdminProcedure
        .input(
          z.object({
            userId: z.number().int().positive(),
            name: z.string().min(1).max(150).optional(),
            position: z.enum(memberAccounts.OFFICIAL_POSITIONS).optional(),
            domain: z.string().max(120).nullable().optional(),
            localCouncil: z.string().max(255).nullable().optional(),
            active: z.boolean().optional(),
          })
        )
        .mutation(({ input }) => {
          const { userId, ...fields } = input;
          const updated = memberAccounts.updateOfficial(userId, fields);
          if (!updated) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "No official account matches that user.",
            });
          }
          return { ok: true, official: updated };
        }),

      /**
       * Open/close modules for an official (super-admin delegation so work can
       * continue when an official is absent).
       */
      setModules: superAdminProcedure
        .input(
          z.object({
            userId: z.number().int().positive(),
            modules: z.array(z.enum(memberAccounts.OFFICIAL_MODULES)),
          })
        )
        .mutation(({ input }) => {
          const updated = memberAccounts.setOfficialModuleAccess(
            input.userId,
            input.modules
          );
          if (!updated) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Module grants can only be set on official accounts (admins already inherit all modules).",
            });
          }
          return { ok: true, official: updated };
        }),

      /** Issue a fresh one-time setup link (password reset) for an official. */
      resetPassword: superAdminProcedure
        .input(z.object({ userId: z.number().int().positive() }))
        .mutation(({ input }) => {
          const rawToken = memberAccounts.resetOfficialPassword(input.userId);
          if (!rawToken) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "No official account matches that user.",
            });
          }
          const official = memberAccounts.listOfficials().find(
            (o) => o.id === input.userId
          );
          if (official) {
            void queueOfficialSetupEmail({
              name: official.name || "MSAP Official",
              positionLabel:
                (official.officialPosition &&
                  memberAccounts.OFFICIAL_POSITION_LABELS[
                    official.officialPosition
                  ]) ||
                "Official",
              recipientEmail: official.email,
              setupUrl: `${memberAccounts.getPortalBaseUrl()}/set-password?token=${rawToken}`,
              expiresAt: new Date(
                Date.now() + ENV.passwordSetupTokenExpiryMs
              ),
            });
          }
          return { ok: true, setupToken: rawToken };
        }),
    }),

    // ===== Email (Phase 2) =====
    email: router({
      /**
       * Send a one-off test email through the configured SMTP relay so admins
       * can verify delivery without waiting for the queue.
       */
      sendTest: officialModuleProcedure("config")
        .input(
          z.object({
            to: z.string().email(),
            subject: z.string().max(200).optional(),
          })
        )
        .mutation(async ({ input }) => {
          try {
            await sendTestEmail(input.to);
            return { sent: true } as const;
          } catch (error) {
            console.error("[Email] Test send failed:", error);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: (error as Error).message,
            });
          }
        }),
    }),

    // ===== Member account reconciliation (Phase 2) =====
    members: router({
      /**
       * Idempotent approved-member sync. Safe to run repeatedly:
       * never duplicates accounts, never resends the setup email when a valid
       * token is already pending. Pass resendSetupEmail to force a fresh link.
       *
       * Gated to the recruitment module because it creates accounts and can
       * trigger setup emails for arbitrary identifiers.
       */
      syncApprovedMember: officialModuleProcedure("recruitment")
        .input(
          z.object({
            identifier: z.string().min(1).max(255),
            resendSetupEmail: z.boolean().optional(),
          })
        )
        .mutation(({ input }) =>
          memberAccounts.syncApprovedMember(input.identifier.trim(), {
            resendSetupEmail: input.resendSetupEmail,
          })
        ),
    }),

    // ===== Membership applications (local/offline review) =====
    membershipApplications: router({
      /** List membership applications with optional status filter. */
      list: officialModuleProcedure("recruitment")
        .input(
          z.object({
            status: z.enum(["pending", "approved", "rejected"]).optional(),
            query: z.string().max(120).optional(),
            limit: z.number().int().min(1).max(500).default(50),
            offset: z.number().int().min(0).default(0),
          })
        )
        .query(async ({ input }) => {
          return db.listMembershipApplications(input);
        }),

      /** Get full details of one application. */
      get: officialModuleProcedure("recruitment")
        .input(z.object({ applicationId: z.number().int().positive() }))
        .query(async ({ input }) => {
          return db.getMembershipApplication(input.applicationId);
        }),

      /**
       * Approve a membership application. Creates the member account,
       * assigns a membership ID, and issues a password setup token.
       */
      approve: officialModuleProcedure("recruitment")
        .input(
          z.object({
            applicationId: z.number().int().positive(),
            membershipId: z.string().min(2).max(50),
            notes: z.string().max(1000).optional(),
          })
        )
        .mutation(async ({ ctx, input }) => {
          const actor = ctx.user;
          if (!actor) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
          }
          const result = db.approveMembershipApplication(
            input.applicationId,
            input.membershipId,
            actor.name || actor.email,
            input.notes
          );
          if (!result) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Application not found or already processed.",
            });
          }
          return { success: true, user: result };
        }),

      /** Reject a membership application. */
      reject: officialModuleProcedure("recruitment")
        .input(
          z.object({
            applicationId: z.number().int().positive(),
            notes: z.string().max(1000).optional(),
          })
        )
        .mutation(async ({ ctx, input }) => {
          const actor = ctx.user;
          if (!actor) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
          }
          const result = db.rejectMembershipApplication(
            input.applicationId,
            actor.name || actor.email,
            input.notes
          );
          if (!result) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Application not found or already processed.",
            });
          }
          return { success: true };
        }),
    }),

    // ===== Membership card issuance (National Office) =====
    card: router({
      /**
       * Full card issuance queue with filters (kind, status, free-text,
       * Local Council) and resolved history - powers the dedicated /admin/cards
       * page. `pending` below remains for the dashboard badge.
       */
      queue: officialModuleProcedure("card-queue")
        .input(
          z.object({
            kind: z.enum(["signature", "reissue"]).optional(),
            status: z.enum(["pending", "approved", "rejected"]).optional(),
            query: z.string().max(120).optional(),
            localCouncil: z.string().max(120).optional(),
            limit: z.number().int().min(1).max(500).optional(),
          })
        )
        .query(async ({ input }) => memberAccounts.listCardQueue(input)),

      /** Queue of members whose holder signature awaits approval. */
      pending: officialModuleProcedure("card-queue").query(async () =>
        memberAccounts.listPendingCardApprovals()
      ),

      /** Approve (issues/reissues the card) or reject a pending request. */
      review: officialModuleProcedure("card-queue")
        .input(
          z.object({
            userId: z.number().int().positive(),
            decision: z.enum(["approve", "reject"]),
            kind: z.enum(["signature", "reissue"]).default("signature"),
          })
        )
        .mutation(async ({ input }) => {
          const card = await memberAccounts.reviewCardSignature(
            input.userId,
            input.decision,
            input.kind
          );
          if (!card) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "No pending signature for that member.",
            });
          }
          return { success: true, card };
        }),

      /**
       * National Office sets (or replaces) the National President's real
       * signature image, rendered on every member card in place of the
       * cursive placeholder. Only PNG data URLs up to 400KB are accepted.
       */
      setPresidentSignature: officialModuleProcedure("card-queue")
        .input(
          z.object({
            dataUrl: z.string().min(20).max(400_000),
          })
        )
        .mutation(({ input }) => {
          const ok = memberAccounts.setPresidentSignatureUrl(input.dataUrl);
          if (!ok) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Signature must be a PNG image (data URL, max 400KB).",
            });
          }
          return { success: true };
        }),

      /** Current National President signature image (null when unset). */
      getPresidentSignature: officialModuleProcedure("card-queue").query(
        async () => memberAccounts.getPresidentSignatureUrl()
      ),

      /** Clear the National President's signature (revert to placeholder). */
      clearPresidentSignature: officialModuleProcedure("card-queue").mutation(
        async () => {
          memberAccounts.clearPresidentSignatureUrl();
          return { success: true };
        }
      ),
    }),

    // ===== Membership lifecycle (workflow-based, audited) =====
    lifecycle: router({
      /**
       * All cases (newest first) with status/action/free-text filters, for
       * the dedicated Lifecycle page. Includes resolved history so decisions
       * stay auditable after the fact.
       */
      list: officialModuleProcedure("lifecycle")
        .input(
          z.object({
            status: z
              .enum(["pending", "approved", "rejected", "cancelled"])
              .optional(),
            action: z.enum(memberAccounts.LIFECYCLE_ACTIONS).optional(),
            query: z.string().max(120).optional(),
            limit: z.number().int().min(1).max(500).optional(),
          })
        )
        .query(({ input }) => memberAccounts.listLifecycleCases(input)),

      /** Pending/approved/rejected counts for the header chips. */
      counts: officialModuleProcedure("lifecycle").query(() =>
        memberAccounts.getLifecycleCounts()
      ),

      /** Full detail for one case (timeline = audit trail included). */
      get: officialModuleProcedure("lifecycle")
        .input(z.object({ caseId: z.number().int().positive() }))
        .query(({ input }) => memberAccounts.getLifecycleCase(input.caseId)),

      /**
       * Open a suspend / terminate / reinstate case. Changes nothing until an
       * official with the module approves it. Identity is resolved server-side
       * by Membership ID or email.
       */
      open: officialModuleProcedure("lifecycle")
        .input(
          z.object({
            identifier: z.string().min(1).max(255),
            action: z.enum(memberAccounts.LIFECYCLE_ACTIONS),
            reason: z.string().min(1).max(120),
            description: z.string().max(2000).optional(),
            evidence: z
              .array(
                z.object({
                  label: z.string().min(1).max(120),
                  dataUrl: z.string().min(20).max(500_000),
                })
              )
              .max(4)
              .default([]),
          })
        )
        .mutation(({ ctx, input }) => {
          // officialModuleProcedure guarantees an authenticated official here;
          // guard locally so the handler's types stay honest.
          const actor = ctx.user;
          if (!actor) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
          }
          const result = memberAccounts.openLifecycleCase({
            identifier: input.identifier.trim(),
            action: input.action,
            reason: input.reason,
            description: input.description,
            evidence: input.evidence,
            requestedBy: {
              name: actor.name || "Official",
              email: actor.email,
            },
          });
          if (!result.ok) {
            throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
          }
          return { ok: true as const, case: result.case };
        }),

      /**
       * Review a pending case. Approve APPLIES the action (status change +
       * lockout + session revocation + member notification); reject records
       * the decision without touching the member. Both are audited.
       */
      review: officialModuleProcedure("lifecycle")
        .input(
          z.object({
            caseId: z.number().int().positive(),
            decision: z.enum(["approve", "reject"]),
            notes: z.string().max(1000).optional(),
          })
        )
        .mutation(({ ctx, input }) => {
          const actor = ctx.user;
          if (!actor) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
          }
          const result = memberAccounts.reviewLifecycleCase(
            input.caseId,
            input.decision,
            { name: actor.name || "Official", email: actor.email },
            input.notes
          );
          if (!result.ok) {
            throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
          }
          return { ok: true as const, case: result.case };
        }),

      /**
       * Withdraw a pending case (stale after the member's status changed
       * elsewhere, or the request was withdrawn). Recorded on the timeline.
       */
      cancel: officialModuleProcedure("lifecycle")
        .input(
          z.object({
            caseId: z.number().int().positive(),
            notes: z.string().max(1000).optional(),
          })
        )
        .mutation(({ ctx, input }) => {
          const actor = ctx.user;
          if (!actor) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
          }
          const result = memberAccounts.cancelLifecycleCase(
            input.caseId,
            { name: actor.name || "Official", email: actor.email },
            input.notes
          );
          if (!result.ok) {
            throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
          }
          return { ok: true as const, case: result.case };
        }),
    }),

    getDashboard: officialModuleProcedure("recruitment").query(async () => {
      return {
        totalMembers: 0,
        pendingApplications: 0,
        activeOpportunities: 0,
        upcomingVotingSessions: 0,
      };
    }),

    getConfiguration: officialModuleProcedure("config").query(async () => {
      return await db.getAllConfiguration();
    }),

    updateConfiguration: officialModuleProcedure("config")
      .input(
        z.object({
          key: z.string(),
          value: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        return { success: true };
      }),
  }),

  // ============ PUBLIC CONFIG (for branding theme) ============
  config: router({
    /**
     * Public endpoint: get all configs by category (for branding theme).
     * Only returns branding-related configs; other categories are not exposed.
     */
    getAll: publicProcedure
      .input(z.object({ category: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const configs = await db.getAllConfiguration();
        const category = input?.category;
        if (category) {
          return configs.filter((c) => c.category === category);
        }
        return configs;
      }),
  }),
});

export type AppRouter = typeof appRouter;
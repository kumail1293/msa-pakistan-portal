import {
  NOT_ADMIN_ERR_MSG,
  NOT_OFFICIAL_ERR_MSG,
  NOT_SUPER_ADMIN_ERR_MSG,
  UNAUTHED_ERR_MSG,
} from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { canAccessModule, isOfficialRole } from "../services/memberAccountService";
import { checkRateLimit, rateLimitKey } from "./rateLimit";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  // tRPC echoes a thrown Error's message by default; only TRPCError messages
  // (auth, validation, rate limit) are user-safe, so unexpected errors get a
  // generic client-facing message while the full detail stays server-side.
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    message:
      error instanceof TRPCError ? error.message : "Internal server error.",
  }),
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

/**
 * Rate-limited public procedure. Counts every request against a per-IP
 * sliding window keyed on the socket address (never X-Forwarded-For).
 * Over-limit requests receive tRPC code TOO_MANY_REQUESTS (HTTP 429).
 */
export function rateLimitedProcedure(limit: number, windowMs: number) {
  return t.procedure.use(
    t.middleware(async opts => {
      const { ctx, next } = opts;
      const result = checkRateLimit(rateLimitKey(ctx.req), limit, windowMs);
      if (!result.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Please try again later.",
        });
      }
      return next({ ctx });
    }),
  );
}

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * Any authenticated account on the official portal pathway: admins, super
 * admins and provisioned officials. Members are always rejected.
 */
export const officialProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || !isOfficialRole(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_OFFICIAL_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/** Only the super admin can pass. Powers the officials-management portal. */
export const superAdminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "superadmin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: NOT_SUPER_ADMIN_ERR_MSG,
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * Official-procedure gated on one module grant. Admins inherit every official
 * module; super admins inherit everything; officials only pass when the super
 * admin opened the module for them. The "officials" module itself is guarded
 * to the super admin by canAccessModule.
 */
export function officialModuleProcedure(module: string) {
  return officialProcedure.use(
    t.middleware(async opts => {
      const { ctx, next } = opts;

      if (!canAccessModule(ctx.user, module)) {
        throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
      }

      return next({ ctx });
    }),
  );
}

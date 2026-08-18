/**
 * Environment bootstrap.
 *
 * MUST be the first import in the server entry point: ES module imports are
 * evaluated in source order, so `server/_core/env.ts` (which captures
 * process.env values into a frozen ENV object) only sees the real values if
 * .env is loaded before it is evaluated.
 *
 * `override: true` is required because the hosting shell pre-exports some
 * variables (e.g. an empty JWT_SECRET) that would otherwise shadow the real
 * values in the project's .env file and silently disable session auth.
 */
import dotenv from "dotenv";

dotenv.config({ override: true, quiet: true });

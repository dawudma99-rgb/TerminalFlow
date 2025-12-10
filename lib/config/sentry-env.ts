// lib/config/sentry-env.ts

// Centralized Sentry environment configuration.
// - Provides SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN, and SENTRY_ENVIRONMENT
// - Logs clear warnings in production if DSNs are missing, but does not throw.
//   If you want to enforce strict configuration, this is the place to do it.

const isProd = process.env.NODE_ENV === "production";

// Runtime detection: safe to use on server (typeof window is undefined on server)
const isBrowser = typeof window !== "undefined";
const isServerOrEdge = !isBrowser;

export const SENTRY_DSN = process.env.SENTRY_DSN ?? "";
export const NEXT_PUBLIC_SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";
export const SENTRY_ENVIRONMENT =
  process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";

// Server/edge runtime check: only warn about SENTRY_DSN on server/edge
if (isProd && isServerOrEdge && !SENTRY_DSN) {
  // eslint-disable-next-line no-console
  console.error(
    "[Sentry] Missing SENTRY_DSN in production environment. " +
      "Errors from server/edge runtimes will not be reported to Sentry."
  );
}

// Browser runtime check: only warn about NEXT_PUBLIC_SENTRY_DSN in browser
if (isProd && isBrowser && !NEXT_PUBLIC_SENTRY_DSN) {
  // eslint-disable-next-line no-console
  console.error(
    "[Sentry] Missing NEXT_PUBLIC_SENTRY_DSN in production environment. " +
      "Errors from browser runtime will not be reported to Sentry."
  );
}


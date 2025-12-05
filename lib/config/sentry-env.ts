// lib/config/sentry-env.ts

// Centralized Sentry environment configuration.
// - Provides SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN, and SENTRY_ENVIRONMENT
// - Logs clear warnings in production if DSNs are missing, but does not throw.
//   If you want to enforce strict configuration, this is the place to do it.

const isProd = process.env.NODE_ENV === "production";

export const SENTRY_DSN = process.env.SENTRY_DSN ?? "";
export const NEXT_PUBLIC_SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";
export const SENTRY_ENVIRONMENT =
  process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";

if (isProd) {
  if (!SENTRY_DSN) {
    // eslint-disable-next-line no-console
    console.error(
      "[Sentry] Missing SENTRY_DSN in production environment. " +
        "Errors from server/edge runtimes will not be reported to Sentry."
    );
  }

  if (!NEXT_PUBLIC_SENTRY_DSN) {
    // eslint-disable-next-line no-console
    console.error(
      "[Sentry] Missing NEXT_PUBLIC_SENTRY_DSN in production environment. " +
        "Errors from the browser/client will not be reported to Sentry."
    );
  }
}


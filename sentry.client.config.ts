// Sentry configuration for the browser (client) runtime.
// - DSN and environment are sourced from lib/config/sentry-env.ts
// - Sampling is environment-aware to avoid 100% tracing in production
// - Default PII is disabled; user identification must be wired explicitly if needed.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import {
  NEXT_PUBLIC_SENTRY_DSN,
  SENTRY_ENVIRONMENT,
} from "./lib/config/sentry-env";

const environment = SENTRY_ENVIRONMENT;

// NOTE: Sampling is environment-aware to avoid 100% tracing in production.
// Production: 10% of transactions, Non-production: 100% for debugging.
Sentry.init({
  dsn: NEXT_PUBLIC_SENTRY_DSN || undefined,
  environment,

  // In production we only sample 10% of transactions to control volume/cost.
  // In non-production we sample 100% for easier debugging.
  tracesSampleRate: environment === "production" ? 0.1 : 1.0,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Disable default PII to keep the integration privacy-friendly by default.
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: false,
});


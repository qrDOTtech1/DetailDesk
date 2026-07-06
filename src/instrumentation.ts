import * as Sentry from "@sentry/nextjs";

/**
 * Server-side error monitoring. Only active when SENTRY_DSN is set —
 * without it the app behaves exactly as before.
 */
export async function register() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.APP_ENV ?? "development",
      tracesSampleRate: 0.05,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;

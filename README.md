This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Sentry Error Monitoring

The app is instrumented with Sentry for client, server, and edge runtimes.

- Config files:
  - `sentry.client.config.ts`
  - `sentry.server.config.ts`
  - `sentry.edge.config.ts`
- Shared env config:
  - `lib/config/sentry-env.ts`

Required environment variables:

- `SENTRY_DSN` – DSN for server/edge runtimes
- `NEXT_PUBLIC_SENTRY_DSN` – DSN for the browser runtime
- `SENTRY_ENVIRONMENT` (optional) – overrides `NODE_ENV` for Sentry

Notes:

- Production uses ~10% tracing; non-production uses 100% for easier debugging.
- `sendDefaultPii` is disabled; user identification must be wired explicitly if needed.
- If DSNs are missing in production, `sentry-env.ts` logs a clear warning.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

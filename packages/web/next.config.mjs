import { withSentryConfig } from "@sentry/nextjs";


/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",

    // This is required when using standalone builds.
    // @see: https://env.t3.gg/docs/nextjs#create-your-schema
    transpilePackages: ["@t3-oss/env-core"],

    // @see : https://posthog.com/docs/advanced/proxy/nextjs
    async rewrites() {
        return [
            {
                source: "/ingest/static/:path*",
                destination: `https://us-assets.i.posthog.com/static/:path*`,
            },
            {
                source: "/ingest/:path*",
                destination: `https://us.i.posthog.com/:path*`,
            },
            {
                source: "/ingest/decide",
                destination: `https://us.i.posthog.com/decide`,
            },
        ];
    },
    // This is required to support PostHog trailing slash API requests
    skipTrailingSlashRedirect: true,

    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ]
    },

    turbopack: {},

    // @see: https://github.com/vercel/next.js/issues/58019#issuecomment-1910531929
    ...(process.env.NODE_ENV === 'development' ? {
        experimental: {
            serverActions: {
                allowedOrigins: [
                    'localhost:3000'
                ]
            }
        }
    } : {}),
};

export default withSentryConfig(nextConfig, {
    // For all available options, see:
    // https://www.npmjs.com/package/@sentry/webpack-plugin#options

    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_WEBAPP_PROJECT,
    authToken: process.env.SENTRY_SMUAT,
    release: process.env.SENTRY_RELEASE,

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Automatically annotate React components to show their full name in breadcrumbs and session replay
    reactComponentAnnotation: {
        enabled: true,
    },

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    tunnelRoute: "/monitoring",

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,
});
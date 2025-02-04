/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",

    // @see : https://posthog.com/docs/advanced/proxy/nextjs
    async rewrites() {
        return [
            {
                source: "/ingest/static/:path*",
                destination: `${process.env.NEXT_PUBLIC_POSTHOG_ASSET_HOST}/static/:path*`,
            },
            {
                source: "/ingest/:path*",
                destination: `${process.env.NEXT_PUBLIC_POSTHOG_HOST}/:path*`,
            },
            {
                source: "/ingest/decide",
                destination: `${process.env.NEXT_PUBLIC_POSTHOG_HOST}/decide`,
            },
        ];
    },
    // This is required to support PostHog trailing slash API requests
    skipTrailingSlashRedirect: true,

    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'avatars.githubusercontent.com',
            }
        ]
    }

    // @nocheckin: This was interfering with the the `matcher` regex in middleware.ts,
    // causing regular expressions parsing errors when making a request. It's unclear
    // why exactly this was happening, but it's likely due to a bad replacement happening
    // in the `sed` command.
    // @note: this is evaluated at build time.
    // ...(process.env.NEXT_PUBLIC_DOMAIN_SUB_PATH ? {
    //     basePath: process.env.NEXT_PUBLIC_DOMAIN_SUB_PATH,
    // } : {})
};

export default nextConfig;

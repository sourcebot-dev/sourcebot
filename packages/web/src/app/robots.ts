import type { MetadataRoute } from 'next';

// Sourcebot exposes an unbounded URL space (every file × every revision ×
// every commit), and crawlers walking it generate heavy server-side rendering
// load. Disallow all crawling, except for link-preview fetchers so that
// shared links (e.g. chat pages) still unfurl with their OpenGraph metadata
// in Slack, X, LinkedIn, etc. Notably NOT allowed: Applebot, GPTBot, and
// meta-externalagent, which are search/AI-training crawlers rather than
// preview fetchers.
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: [
                    'Slackbot',
                    'Twitterbot',
                    'LinkedInBot',
                    'Discordbot',
                    'facebookexternalhit',
                    'TelegramBot',
                    'WhatsApp',
                ],
                allow: '/',
            },
            {
                userAgent: '*',
                disallow: '/',
            },
        ],
    };
}

'use server';

import { minidenticon } from 'minidenticons';
import sharp from 'sharp';
import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/apiHandler';

// Generates a minidenticon avatar PNG from an email address.
// Used as a fallback avatar in emails where data URIs aren't supported.
export const GET = apiHandler(async (request: NextRequest) => {
    const email = request.nextUrl.searchParams.get('email');
    if (!email) {
        return new Response('Missing email parameter', { status: 400 });
    }

    const svg = minidenticon(email, 50, 50);
    const png = await sharp(Buffer.from(svg))
        .flatten({ background: { r: 241, g: 245, b: 249 } })
        .resize(128, 128)
        .png()
        .toBuffer();

    return new Response(new Uint8Array(png), {
        headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    });
}, { track: false });

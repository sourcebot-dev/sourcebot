'use server';

import { cookies } from 'next/headers';
import { DISMISS_COOKIE_PREFIX, type BannerId } from './types';

export async function dismissBanner(id: BannerId) {
    const cookieStore = await cookies();
    const today = new Date().toISOString().slice(0, 10);
    cookieStore.set(`${DISMISS_COOKIE_PREFIX}${id}`, today, {
        maxAge: 60 * 60 * 25,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
    });
}

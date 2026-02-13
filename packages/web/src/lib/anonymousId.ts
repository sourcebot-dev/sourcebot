import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

const ANONYMOUS_ID_COOKIE_NAME = 'sb.anonymous-id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds

/**
 * Gets the anonymous session ID from the cookie, or creates one if it doesn't exist.
 * This is used to track ownership of chats created by anonymous (non-authenticated) users.
 */
export const getOrCreateAnonymousId = async (): Promise<string> => {
    const cookieStore = await cookies();
    const existingId = cookieStore.get(ANONYMOUS_ID_COOKIE_NAME)?.value;

    if (existingId) {
        return existingId;
    }

    const newId = uuidv4();
    cookieStore.set(ANONYMOUS_ID_COOKIE_NAME, newId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
    });

    return newId;
};

/**
 * Gets the anonymous session ID from the cookie if it exists.
 * Returns undefined if no anonymous ID has been set.
 */
export const getAnonymousId = async (): Promise<string | undefined> => {
    const cookieStore = await cookies();
    return cookieStore.get(ANONYMOUS_ID_COOKIE_NAME)?.value;
};

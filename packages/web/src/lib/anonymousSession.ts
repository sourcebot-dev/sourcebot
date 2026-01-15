'use server';

import { cookies } from 'next/headers';
import { ANONYMOUS_SESSION_ID_COOKIE_NAME } from './constants';
import { createLogger } from '@sourcebot/shared';

const logger = createLogger('anonymous-session');



// This ID is used to track chats created before authentication so they can be migrated when the user signs in. It returns A stable UUID that persists across browser sessions
export async function getOrCreateAnonymousSessionId(): Promise<string> {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get(ANONYMOUS_SESSION_ID_COOKIE_NAME)?.value;
  
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    
    cookieStore.set(ANONYMOUS_SESSION_ID_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    });
    
    logger.info(`Created new anonymous session ID: ${sessionId}`);
  }
  
  return sessionId;
}

// Gets the current anonymous session ID if it exists. Does not create a new one if it doesn't exist.
export async function getAnonymousSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ANONYMOUS_SESSION_ID_COOKIE_NAME)?.value ?? null;
}



//  Should be called after migrating anonymous chats to an authenticated user.
export async function clearAnonymousSessionId(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ANONYMOUS_SESSION_ID_COOKIE_NAME);
  logger.info('Cleared anonymous session ID');
}


export function getAnonymousSessionIdFromCookie(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  
  const cookies = document.cookie.split('; ');
  const cookie = cookies.find(c => c.startsWith(`${ANONYMOUS_SESSION_ID_COOKIE_NAME}=`));
  
  if (!cookie) {
    return null;
  }
  
  return cookie.split('=')[1] || null;
}
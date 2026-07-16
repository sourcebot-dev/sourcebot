import 'server-only';

import { Token } from '@sourcebot/schemas/v3/shared.type';
import { env, getTokenFromConfig } from '@sourcebot/shared';
import { getAuthContext } from '@/middleware/withAuth';

export const SOURCEBOT_USER_EMAIL_HEADER = 'X-Sourcebot-User-Email';
const PLACEHOLDER_EMAIL_PATTERN = /^placeholder-.+@no-email\.invalid$/i;

export const resolveLanguageModelHeaders = async (
    configuredHeaders: Record<string, string | Token> | undefined,
): Promise<Record<string, string> | undefined> => {
    const headers: Record<string, string> = {};

    for (const [key, value] of Object.entries(configuredHeaders ?? {})) {
        headers[key] = typeof value === 'string'
            ? value
            : await getTokenFromConfig(value);
    }

    const userEmail = await (async () => {
        if (env.SOURCEBOT_LLM_USER_EMAIL_HEADER_ENABLED !== 'true') {
            return undefined;
        }

        const authContext = await getAuthContext();
        return 'statusCode' in authContext ? undefined : authContext.user?.email;
    })();
    if (
        userEmail &&
        !PLACEHOLDER_EMAIL_PATTERN.test(userEmail)
    ) {
        // Header names are case-insensitive. Remove any configured variant so
        // the authenticated user's email is always the authoritative value.
        for (const key of Object.keys(headers)) {
            if (key.toLowerCase() === SOURCEBOT_USER_EMAIL_HEADER.toLowerCase()) {
                delete headers[key];
            }
        }

        headers[SOURCEBOT_USER_EMAIL_HEADER] = userEmail.toLowerCase();
    }

    return Object.keys(headers).length > 0 ? headers : undefined;
};

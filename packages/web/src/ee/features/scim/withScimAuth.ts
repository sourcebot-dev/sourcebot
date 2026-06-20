import { __unsafePrisma } from "@/prisma";
import { hasEntitlement } from "@/lib/entitlements";
import { hashSecret, SCIM_TOKEN_PREFIX, createLogger } from "@sourcebot/shared";
import { Org, PrismaClient } from "@sourcebot/db";
import { NextRequest } from "next/server";
import { scimError } from "./mapper";

const logger = createLogger('scim-auth');

export type ScimAuthContext = {
    org: Org;
    prisma: PrismaClient;
};

/**
 * Authenticates a SCIM request via its `Authorization: Bearer sbscim_…` token
 * and runs `fn` with an org-scoped (userless) context. Unlike `withAuth`, this
 * does NOT resolve a user/role or apply the user-scoped Prisma extension: the
 * caller is the IdP provisioning integration, acting org-wide. All responses
 * (including errors) use the SCIM content type and error envelope.
 */
export const withScimAuth = async (
    request: NextRequest,
    fn: (ctx: ScimAuthContext) => Promise<Response>,
): Promise<Response> => {
    const authorization = request.headers.get("Authorization") ?? undefined;
    if (!authorization?.startsWith("Bearer ")) {
        return scimError(401, "Missing or malformed Authorization header");
    }

    const bearer = authorization.slice("Bearer ".length);
    if (!bearer.startsWith(SCIM_TOKEN_PREFIX)) {
        return scimError(401, "Invalid SCIM token");
    }

    const secret = bearer.slice(SCIM_TOKEN_PREFIX.length);
    if (!secret) {
        return scimError(401, "Invalid SCIM token");
    }

    const scimToken = await __unsafePrisma.scimToken.findUnique({
        where: { hash: hashSecret(secret) },
        include: { org: true },
    });
    if (!scimToken) {
        return scimError(401, "Invalid SCIM token");
    }

    // Enforce the entitlement per-request so a license downgrade disables SCIM
    // immediately, even with valid tokens still configured in the IdP.
    if (!await hasEntitlement('scim')) {
        return scimError(403, "SCIM provisioning is not available in your current plan");
    }

    // SCIM is an explicit opt-in: a valid token is rejected unless an owner has
    // toggled provisioning on. Disabling acts as a kill switch that pauses all
    // provisioning without requiring tokens to be revoked.
    if (!scimToken.org.isScimEnabled) {
        return scimError(403, "SCIM provisioning is disabled for this organization");
    }

    // Best-effort usage tracking; never block the request on it.
    __unsafePrisma.scimToken.update({
        where: { hash: scimToken.hash },
        data: { lastUsedAt: new Date() },
    }).catch(() => { /* ignore */ });

    try {
        return await fn({
            org: scimToken.org,
            prisma: __unsafePrisma
        });
    } catch (error) {
        logger.error(`Unhandled SCIM error: ${error instanceof Error ? error.message : String(error)}`);
        return scimError(500, "Internal server error");
    }
};

import { Prisma } from "@sourcebot/db";
import { env } from "@sourcebot/shared";
import {
    SCIM_CONTENT_TYPE,
    SCIM_ERROR_SCHEMA,
    SCIM_LIST_RESPONSE_SCHEMA,
    SCIM_USER_SCHEMA,
} from "./constants";

// A membership row with its linked user, as returned by the SCIM endpoints.
export type ScimMembership = Prisma.UserToOrgGetPayload<{ include: { user: true } }>;

const scimUserLocation = (userId: string): string =>
    `${env.AUTH_URL.replace(/\/$/, '')}/scim/v2/Users/${userId}`;

/**
 * Maps a Sourcebot membership + user into a SCIM 2.0 User resource. The SCIM
 * `id` is the stable `User.id`; `userName` and the primary email are the
 * user's email; `active` reflects the membership's `isActive` flag.
 */
export const toScimUser = (membership: ScimMembership) => {
    const { user } = membership;
    const [givenName, ...rest] = (user.name ?? "").split(" ");
    const familyName = rest.join(" ");

    return {
        schemas: [SCIM_USER_SCHEMA],
        id: user.id,
        ...(membership.scimExternalId ? { externalId: membership.scimExternalId } : {}),
        userName: user.email ?? undefined,
        name: user.name ? {
            formatted: user.name,
            givenName: givenName || undefined,
            familyName: familyName || undefined,
        } : undefined,
        emails: user.email ? [{ value: user.email, primary: true }] : [],
        active: membership.isActive,
        meta: {
            resourceType: "User",
            created: membership.joinedAt.toISOString(),
            lastModified: membership.joinedAt.toISOString(),
            location: scimUserLocation(user.id),
        },
    };
};

/** Wraps a list of SCIM resources in a SCIM ListResponse envelope. */
export const toScimListResponse = (
    resources: unknown[],
    totalResults: number,
    startIndex: number,
) => ({
    schemas: [SCIM_LIST_RESPONSE_SCHEMA],
    totalResults,
    startIndex,
    itemsPerPage: resources.length,
    Resources: resources,
});

/** Builds a `Response` with the SCIM content type. */
export const scimJson = (body: unknown, status: number, headers?: Record<string, string>): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": SCIM_CONTENT_TYPE,
            ...headers,
        },
    });

/**
 * Builds a SCIM error `Response`. Per RFC 7644 the `status` in the body is a
 * string and must match the HTTP status.
 */
export const scimError = (status: number, detail: string, scimType?: string): Response =>
    scimJson({
        schemas: [SCIM_ERROR_SCHEMA],
        status: status.toString(),
        ...(scimType ? { scimType } : {}),
        detail,
    }, status);

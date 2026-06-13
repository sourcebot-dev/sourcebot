import { z } from "zod";
import {
    SCIM_RESOURCE_TYPE_SCHEMA,
    SCIM_SERVICE_PROVIDER_CONFIG_SCHEMA,
    SCIM_USER_SCHEMA,
} from "./constants";

// ----- Request body schemas (lenient: IdPs send extra attributes) -----

const scimEmailSchema = z.object({
    value: z.string(),
    primary: z.boolean().optional(),
    type: z.string().optional(),
}).passthrough();

const scimNameSchema = z.object({
    formatted: z.string().optional(),
    givenName: z.string().optional(),
    familyName: z.string().optional(),
}).passthrough();

export const scimUserCreateSchema = z.object({
    userName: z.string(),
    externalId: z.string().optional(),
    name: scimNameSchema.optional(),
    emails: z.array(scimEmailSchema).optional(),
    // `active` may arrive as a boolean or a string ("true"/"false").
    active: z.union([z.boolean(), z.string()]).optional(),
    displayName: z.string().optional(),
}).passthrough();
export type ScimUserCreate = z.infer<typeof scimUserCreateSchema>;

export const scimUserReplaceSchema = scimUserCreateSchema;
export type ScimUserReplace = z.infer<typeof scimUserReplaceSchema>;

export const scimPatchOpSchema = z.object({
    schemas: z.array(z.string()).optional(),
    Operations: z.array(z.object({
        op: z.string(),
        path: z.string().optional(),
        value: z.unknown().optional(),
    }).passthrough()),
}).passthrough();
export type ScimPatchOp = z.infer<typeof scimPatchOpSchema>;

/** Coerces a SCIM `active` value (boolean | "true"/"false" | undefined). */
export const coerceActive = (value: unknown): boolean | undefined => {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "string") {
        if (value.toLowerCase() === "true") {
            return true;
        }
        if (value.toLowerCase() === "false") {
            return false;
        }
    }
    return undefined;
};

/** Resolves the primary email from a SCIM user payload. */
export const resolveEmail = (payload: ScimUserCreate): string => {
    const primary = payload.emails?.find((e) => e.primary)?.value;
    return (primary ?? payload.emails?.[0]?.value ?? payload.userName).toLowerCase();
};

// ----- Filter parsing -----

export type ScimFilter =
    | { attribute: "userName" | "externalId"; value: string }
    | null;

/**
 * Parses the narrow set of SCIM filters IdPs actually send:
 * `userName eq "value"` and `externalId eq "value"`. Operator and attribute
 * are matched case-insensitively. Anything else returns `null`, which callers
 * treat as "no matching results" rather than an error.
 */
export const parseScimFilter = (filter: string | null): ScimFilter => {
    if (!filter) {
        return null;
    }
    const match = filter.match(/^\s*(userName|externalId)\s+eq\s+"([^"]*)"\s*$/i);
    if (!match) {
        return null;
    }
    const attribute = match[1].toLowerCase() === "username" ? "userName" : "externalId";
    return { attribute, value: match[2] };
};

// ----- Static discovery documents -----

export const serviceProviderConfig = {
    schemas: [SCIM_SERVICE_PROVIDER_CONFIG_SCHEMA],
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [{
        type: "oauthbearertoken",
        name: "OAuth Bearer Token",
        description: "Authentication via the SCIM bearer token generated in Sourcebot settings.",
        primary: true,
    }],
    meta: { resourceType: "ServiceProviderConfig" },
};

export const userResourceType = {
    schemas: [SCIM_RESOURCE_TYPE_SCHEMA],
    id: "User",
    name: "User",
    endpoint: "/Users",
    description: "User Account",
    schema: SCIM_USER_SCHEMA,
    meta: { resourceType: "ResourceType" },
};

export const userSchemaDefinition = {
    id: SCIM_USER_SCHEMA,
    name: "User",
    description: "User Account",
    attributes: [
        { name: "userName", type: "string", multiValued: false, required: true, caseExact: false, mutability: "readWrite", returned: "default", uniqueness: "server" },
        { name: "active", type: "boolean", multiValued: false, required: false, mutability: "readWrite", returned: "default" },
        {
            name: "name", type: "complex", multiValued: false, required: false, mutability: "readWrite", returned: "default",
            subAttributes: [
                { name: "formatted", type: "string", multiValued: false, required: false },
                { name: "givenName", type: "string", multiValued: false, required: false },
                { name: "familyName", type: "string", multiValued: false, required: false },
            ],
        },
        {
            name: "emails", type: "complex", multiValued: true, required: false, mutability: "readWrite", returned: "default",
            subAttributes: [
                { name: "value", type: "string", multiValued: false, required: false },
                { name: "primary", type: "boolean", multiValued: false, required: false },
            ],
        },
    ],
    meta: { resourceType: "Schema" },
};

import { z } from "zod";
import {
    SCIM_DEFAULT_COUNT,
    SCIM_MAX_COUNT,
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

export const scimListUsersQueryParamsSchema = z.object({
    filter: z.string().optional(),
    startIndex: z.coerce.number().int().positive().default(1),
    count: z.coerce.number().int().nonnegative().max(SCIM_MAX_COUNT).default(SCIM_DEFAULT_COUNT),
});

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

/** The subset of attributes Sourcebot persists from a SCIM PatchOp. */
export interface ScimPatchChanges {
    name?: string;
    email?: string;
    active?: boolean;
}

// Resolves a display name from a SCIM `name` complex value / `displayName`,
// mirroring the precedence used elsewhere (formatted, then displayName).
const resolveNameFromValue = (value: Record<string, unknown>): string | undefined => {
    const name = value.name;
    const formatted = (name && typeof name === "object" && !Array.isArray(name))
        ? (name as Record<string, unknown>).formatted
        : undefined;
    if (typeof formatted === "string") {
        return formatted;
    }
    if (typeof value.displayName === "string") {
        return value.displayName;
    }
    return undefined;
};

// Resolves the primary email from a SCIM `emails` array / `userName` value.
const resolveEmailFromValue = (value: Record<string, unknown>): string | undefined => {
    const emails = value.emails;
    if (Array.isArray(emails)) {
        const primary = emails.find((e) => e && typeof e === "object" && (e as Record<string, unknown>).primary)
            ?? emails[0];
        const email = (primary && typeof primary === "object") ? (primary as Record<string, unknown>).value : undefined;
        if (typeof email === "string") {
            return email.toLowerCase();
        }
    }
    if (typeof value.userName === "string") {
        return value.userName.toLowerCase();
    }
    return undefined;
};

/**
 * Reduces a SCIM PatchOp's operations into the subset of changes Sourcebot
 * persists: display name, email, and active state. Handles both path-based ops
 * (`{op,path,value}`, e.g. `name.formatted`, `userName`, `active`) and the
 * no-path bulk form (`{op,value:{...}}`). Operator and attribute names are
 * matched case-insensitively. Later operations override earlier ones, and any
 * unrecognized op/path is ignored (lenient, never an error).
 */
export const parseScimPatchOperations = (operations: ScimPatchOp["Operations"]): ScimPatchChanges => {
    const changes: ScimPatchChanges = {};

    for (const operation of operations) {
        const op = operation.op.toLowerCase();
        if (op !== "replace" && op !== "add") {
            continue;
        }

        const value = operation.value;
        const path = operation.path?.toLowerCase();

        // No-path bulk form: `value` is an object of attributes to replace.
        if (path === undefined) {
            if (value && typeof value === "object" && !Array.isArray(value)) {
                const record = value as Record<string, unknown>;
                const active = coerceActive(record.active);
                if (active !== undefined) {
                    changes.active = active;
                }
                const name = resolveNameFromValue(record);
                if (name !== undefined) {
                    changes.name = name;
                }
                const email = resolveEmailFromValue(record);
                if (email !== undefined) {
                    changes.email = email;
                }
            }
            continue;
        }

        if (path === "active") {
            const active = coerceActive(value);
            if (active !== undefined) {
                changes.active = active;
            }
        } else if (path === "username") {
            if (typeof value === "string") {
                changes.email = value.toLowerCase();
            }
        } else if (path === "displayname" || path === "name.formatted") {
            if (typeof value === "string") {
                changes.name = value;
            }
        } else if (path.startsWith("emails")) {
            // e.g. `emails[type eq "work"].value` → maps to the primary email.
            if (typeof value === "string") {
                changes.email = value.toLowerCase();
            }
        }
    }

    return changes;
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

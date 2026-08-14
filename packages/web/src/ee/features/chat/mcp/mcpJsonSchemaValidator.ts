import Ajv, { type AnySchema, type ErrorObject, type ValidateFunction } from 'ajv';
import Ajv2019 from 'ajv/dist/2019.js';
import Ajv2020 from 'ajv/dist/2020.js';

const AJV_OPTIONS = {
    addUsedSchema: false,
    allErrors: true,
    strict: false,
} as const;

const JSON_SCHEMA_DIALECT = {
    DRAFT_07: 'draft-07',
    DRAFT_2019_09: '2019-09',
    DRAFT_2020_12: '2020-12',
} as const;

type JsonSchemaDialect = typeof JSON_SCHEMA_DIALECT[keyof typeof JSON_SCHEMA_DIALECT];

const MCP_JSON_SCHEMA_VALIDATOR_CACHE_MAX_ENTRIES = 100;
const MCP_JSON_SCHEMA_VALIDATOR_CACHE_MAX_KEY_LENGTH = 64 * 1024;

// Ajv caches every schema object it compiles for the lifetime of the Ajv
// instance. MCP tool definitions are deserialized from Redis on each request,
// so even unchanged schemas have a new object identity and would grow that
// internal cache indefinitely. Keep a bounded, content-keyed cache instead and
// compile cache misses with a short-lived Ajv instance.
const validatorCache = new Map<string, ValidateFunction>();
const errorFormatterAjv = new Ajv2020(AJV_OPTIONS);

const DIALECT_BY_META_SCHEMA_URI = new Map<string, JsonSchemaDialect>([
    ['http://json-schema.org/draft-07/schema', JSON_SCHEMA_DIALECT.DRAFT_07],
    ['https://json-schema.org/draft/2019-09/schema', JSON_SCHEMA_DIALECT.DRAFT_2019_09],
    ['https://json-schema.org/draft/2020-12/schema', JSON_SCHEMA_DIALECT.DRAFT_2020_12],
]);

export class UnsupportedMcpJsonSchemaDialectError extends Error {
    readonly reason = 'unsupported_json_schema_dialect';

    constructor() {
        super('MCP tool schema declares an unsupported JSON Schema dialect. Supported dialects are draft-07, 2019-09, and 2020-12.');
        this.name = 'UnsupportedMcpJsonSchemaDialectError';
    }
}

export class UnsupportedMcpJsonSchemaFeatureError extends Error {
    readonly reason = 'unsupported_json_schema_feature';

    constructor() {
        super('MCP tool schema uses an unsupported JSON Schema extension.');
        this.name = 'UnsupportedMcpJsonSchemaFeatureError';
    }
}

/**
 * Compiles an MCP tool schema with the Ajv implementation for its declared
 * JSON Schema dialect. MCP 2025-11-25 defines 2020-12 as the default when a
 * schema does not explicitly declare another dialect.
 */
export function compileMcpJsonSchemaValidator(schema: unknown): ValidateFunction {
    rejectAsyncSchema(schema);
    const dialect = getJsonSchemaDialect(schema);
    const cacheKey = getValidatorCacheKey(schema);
    if (cacheKey !== undefined) {
        const cachedValidator = validatorCache.get(cacheKey);
        if (cachedValidator) {
            // Refresh insertion order so the map acts as an LRU cache.
            validatorCache.delete(cacheKey);
            validatorCache.set(cacheKey, cachedValidator);
            return cachedValidator;
        }
    }

    const validator = createAjv(dialect).compile(schema as AnySchema);
    if (cacheKey !== undefined) {
        validatorCache.set(cacheKey, validator);
        if (validatorCache.size > MCP_JSON_SCHEMA_VALIDATOR_CACHE_MAX_ENTRIES) {
            const oldestCacheKey = validatorCache.keys().next().value;
            if (oldestCacheKey !== undefined) {
                validatorCache.delete(oldestCacheKey);
            }
        }
    }

    return validator;
}

export function formatMcpJsonSchemaValidationErrors(
    errors: ErrorObject[] | null | undefined,
): string {
    // Ajv's error representation and formatter are shared across dialects.
    return errorFormatterAjv.errorsText(errors);
}

function createAjv(dialect: JsonSchemaDialect): Ajv | Ajv2019 | Ajv2020 {
    switch (dialect) {
        case JSON_SCHEMA_DIALECT.DRAFT_07:
            return new Ajv(AJV_OPTIONS);
        case JSON_SCHEMA_DIALECT.DRAFT_2019_09:
            return new Ajv2019(AJV_OPTIONS);
        case JSON_SCHEMA_DIALECT.DRAFT_2020_12:
            return new Ajv2020(AJV_OPTIONS);
    }
}

function getValidatorCacheKey(schema: unknown): string | undefined {
    try {
        const serializedSchema = JSON.stringify(schema);
        if (
            serializedSchema === undefined
            || serializedSchema.length > MCP_JSON_SCHEMA_VALIDATOR_CACHE_MAX_KEY_LENGTH
        ) {
            return undefined;
        }
        return serializedSchema;
    } catch {
        // Ajv will report the useful compilation error for non-JSON inputs.
        return undefined;
    }
}

function rejectAsyncSchema(schema: unknown): void {
    if (
        typeof schema === 'object'
        && schema !== null
        && (schema as Record<string, unknown>).$async === true
    ) {
        // $async is an Ajv extension rather than a JSON Schema keyword. The
        // surrounding AI SDK validation contract is synchronous, so accepting
        // it would treat a returned Promise as a successful validation.
        throw new UnsupportedMcpJsonSchemaFeatureError();
    }
}

function getJsonSchemaDialect(schema: unknown): JsonSchemaDialect {
    if (typeof schema !== 'object' || schema === null || !Object.prototype.hasOwnProperty.call(schema, '$schema')) {
        return JSON_SCHEMA_DIALECT.DRAFT_2020_12;
    }

    const declaredDialect = (schema as Record<string, unknown>).$schema;
    if (typeof declaredDialect !== 'string') {
        throw new UnsupportedMcpJsonSchemaDialectError();
    }

    // An empty URI fragment does not change the selected dialect. Normalizing
    // it also accepts both forms used by draft-07 schemas in the wild.
    const normalizedDialect = declaredDialect.endsWith('#')
        ? declaredDialect.slice(0, -1)
        : declaredDialect;
    const dialect = DIALECT_BY_META_SCHEMA_URI.get(normalizedDialect);
    if (!dialect) {
        throw new UnsupportedMcpJsonSchemaDialectError();
    }

    return dialect;
}

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

const draft07Ajv = new Ajv(AJV_OPTIONS);
const draft2019Ajv = new Ajv2019(AJV_OPTIONS);
const draft2020Ajv = new Ajv2020(AJV_OPTIONS);

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

    switch (dialect) {
        case JSON_SCHEMA_DIALECT.DRAFT_07:
            return compileWithAjv(draft07Ajv, schema);
        case JSON_SCHEMA_DIALECT.DRAFT_2019_09:
            return compileWithAjv(draft2019Ajv, schema);
        case JSON_SCHEMA_DIALECT.DRAFT_2020_12:
            return compileWithAjv(draft2020Ajv, schema);
    }
}

export function formatMcpJsonSchemaValidationErrors(
    errors: ErrorObject[] | null | undefined,
): string {
    // Ajv's error representation and formatter are shared across dialects.
    return draft2020Ajv.errorsText(errors);
}

function compileWithAjv(
    ajv: Ajv | Ajv2019 | Ajv2020,
    schema: unknown,
): ValidateFunction {
    // addUsedSchema: false prevents remote root $id values from entering Ajv's
    // shared schema registry or conflicting across MCP servers.
    return ajv.compile(schema as AnySchema);
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

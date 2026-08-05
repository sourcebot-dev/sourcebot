import { describe, expect, test } from 'vitest';
import { parseScimPatchOperations, scimPatchOpSchema } from './schemas';

// Builds a typed Operations array via the schema, mirroring what the route
// passes into parseScimPatchOperations after validation.
const ops = (operations: unknown[]): ReturnType<typeof scimPatchOpSchema.parse>['Operations'] =>
    scimPatchOpSchema.parse({ Operations: operations }).Operations;

describe('parseScimPatchOperations', () => {
    test('extracts active from a path-based replace (boolean)', () => {
        expect(parseScimPatchOperations(ops([
            { op: 'replace', path: 'active', value: false },
        ]))).toEqual({ active: false });
    });

    test('coerces a stringified active value', () => {
        expect(parseScimPatchOperations(ops([
            { op: 'replace', path: 'active', value: 'false' },
        ]))).toEqual({ active: false });
    });

    test('extracts active from the no-path bulk form', () => {
        expect(parseScimPatchOperations(ops([
            { op: 'replace', value: { active: false } },
        ]))).toEqual({ active: false });
    });

    test('extracts a name change from displayName', () => {
        expect(parseScimPatchOperations(ops([
            { op: 'replace', path: 'displayName', value: 'Jane Doe' },
        ]))).toEqual({ name: 'Jane Doe' });
    });

    test('extracts a name change from name.formatted', () => {
        expect(parseScimPatchOperations(ops([
            { op: 'replace', path: 'name.formatted', value: 'Jane Doe' },
        ]))).toEqual({ name: 'Jane Doe' });
    });

    test('extracts an email change from userName (lowercased)', () => {
        expect(parseScimPatchOperations(ops([
            { op: 'replace', path: 'userName', value: 'Jane.New@Corp.COM' },
        ]))).toEqual({ email: 'jane.new@corp.com' });
    });

    test('extracts an email change from a filtered emails path', () => {
        expect(parseScimPatchOperations(ops([
            { op: 'replace', path: 'emails[type eq "work"].value', value: 'jane@corp.com' },
        ]))).toEqual({ email: 'jane@corp.com' });
    });

    test('matches op and path case-insensitively', () => {
        expect(parseScimPatchOperations(ops([
            { op: 'REPLACE', path: 'Active', value: true },
        ]))).toEqual({ active: true });
    });

    test('honors `add` operations as well as `replace`', () => {
        expect(parseScimPatchOperations(ops([
            { op: 'add', path: 'displayName', value: 'New Name' },
        ]))).toEqual({ name: 'New Name' });
    });

    test('ignores unrecognized operations (e.g. remove)', () => {
        expect(parseScimPatchOperations(ops([
            { op: 'remove', path: 'name.givenName' },
        ]))).toEqual({});
    });

    test('ignores unrecognized paths', () => {
        expect(parseScimPatchOperations(ops([
            { op: 'replace', path: 'title', value: 'Engineer' },
        ]))).toEqual({});
    });

    test('combines name, email, and active across multiple operations', () => {
        expect(parseScimPatchOperations(ops([
            { op: 'replace', path: 'name.formatted', value: 'Jane Doe' },
            { op: 'replace', path: 'userName', value: 'jane@corp.com' },
            { op: 'replace', path: 'active', value: false },
        ]))).toEqual({ name: 'Jane Doe', email: 'jane@corp.com', active: false });
    });

    test('handles a no-path bulk object with multiple attributes', () => {
        expect(parseScimPatchOperations(ops([
            {
                op: 'replace',
                value: {
                    active: true,
                    userName: 'jane@corp.com',
                    name: { formatted: 'Jane Doe' },
                },
            },
        ]))).toEqual({ name: 'Jane Doe', email: 'jane@corp.com', active: true });
    });

    test('prefers the primary email from a bulk emails array', () => {
        expect(parseScimPatchOperations(ops([
            {
                op: 'replace',
                value: {
                    emails: [
                        { value: 'secondary@corp.com', primary: false },
                        { value: 'primary@corp.com', primary: true },
                    ],
                },
            },
        ]))).toEqual({ email: 'primary@corp.com' });
    });

    test('later operations override earlier ones', () => {
        expect(parseScimPatchOperations(ops([
            { op: 'replace', path: 'active', value: true },
            { op: 'replace', path: 'active', value: false },
        ]))).toEqual({ active: false });
    });

    test('returns an empty object when no relevant operations are present', () => {
        expect(parseScimPatchOperations(ops([
            { op: 'replace', path: 'locale', value: 'en-US' },
            { op: 'remove', path: 'title' },
        ]))).toEqual({});
    });
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { declaredSchema } from '../schemaSnapshot.mjs';

test('telemetry fields and enum values match the reviewed independent schema snapshot', () => {
    const approved = JSON.parse(readFileSync(new URL('../approvedSchema.json', import.meta.url), 'utf8'));
    assert.deepEqual(declaredSchema(), approved, 'Review telemetry plan and update the approved snapshot when changing the wire contract');
});

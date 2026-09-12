import assert from 'node:assert/strict';
import { artifact, scenario, minimal } from './harness.mjs';
assert.ok(process.env.SETUP_TEST_DEV_TOKEN, 'Provide the designated dev project token; never use the production project.');
assert.notEqual(process.env.SETUP_TEST_DEV_TOKEN, 'phc_lLPuFFi5LH6c94eFJcqvYVFwiJffVcV6HD8U4a1OnRW');
const packed = artifact();
try {
    const result = await scenario(packed, { live: true }, async d => {
        await minimal(d);
        await d.answer('Download docker-compose.yml?', 'n');
    });
    console.log(JSON.stringify({ artifactSha256: packed.digest, distinctId: result.events[0].distinct_id, eventsForwarded: result.events.length, ingestion: 'accepted; query verification still required' }));
} finally {
    packed.cleanup();
}

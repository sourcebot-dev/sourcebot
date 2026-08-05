import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import crypto from 'crypto';
import {
    __clearDpopReplayCacheForTests,
    calculateDpopJkt,
    getDpopAccessTokenHash,
    verifyDpopProof,
} from './dpop';

vi.mock('server-only', () => ({ default: vi.fn() }));

vi.mock('@sourcebot/shared', () => ({
    env: {
        AUTH_URL: 'https://sourcebot.test',
    },
}));

type PublicEcJwk = {
    kty: 'EC';
    crv: 'P-256';
    x: string;
    y: string;
};

type KeyPair = {
    privateKey: CryptoKey;
    publicJwk: PublicEcJwk;
};

beforeEach(() => {
    __clearDpopReplayCacheForTests();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('verifyDpopProof', () => {
    test('accepts a valid resource request proof for a DPoP-bound access token', async () => {
        const keyPair = await generateKeyPair();
        const accessToken = 'sboa_access-token';
        const request = new Request('http://internal.test/api/ee/mcp?ignored=true', { method: 'POST' });
        const proof = await signDpopProof({
            ...keyPair,
            htm: 'POST',
            htu: 'https://sourcebot.test/api/mcp',
            accessToken,
        });

        const result = await verifyDpopProof({
            request,
            proof,
            expectedJkt: calculateDpopJkt(keyPair.publicJwk),
            accessToken,
            requireAccessTokenHash: true,
        });

        expect(result).toEqual({
            ok: true,
            jkt: calculateDpopJkt(keyPair.publicJwk),
        });
    });

    test('accepts a token endpoint proof without an access-token hash', async () => {
        const keyPair = await generateKeyPair();
        const request = new Request('http://internal.test/api/ee/oauth/token', { method: 'POST' });
        const proof = await signDpopProof({
            ...keyPair,
            htm: 'POST',
            htu: 'https://sourcebot.test/api/ee/oauth/token',
        });

        const result = await verifyDpopProof({
            request,
            proof,
        });

        expect(result).toEqual({
            ok: true,
            jkt: calculateDpopJkt(keyPair.publicJwk),
        });
    });

    test('rejects a resource request proof with the wrong access-token hash', async () => {
        const keyPair = await generateKeyPair();
        const request = new Request('http://internal.test/api/ee/mcp', { method: 'POST' });
        const proof = await signDpopProof({
            ...keyPair,
            htm: 'POST',
            htu: 'https://sourcebot.test/api/mcp',
            accessToken: 'sboa_other-token',
        });

        const result = await verifyDpopProof({
            request,
            proof,
            expectedJkt: calculateDpopJkt(keyPair.publicJwk),
            accessToken: 'sboa_access-token',
            requireAccessTokenHash: true,
        });

        expect(result).toMatchObject({
            ok: false,
            error: 'invalid_dpop_proof',
        });
    });

    test('rejects replayed proof ids', async () => {
        const keyPair = await generateKeyPair();
        const request = new Request('http://internal.test/api/ee/oauth/token', { method: 'POST' });
        const proof = await signDpopProof({
            ...keyPair,
            htm: 'POST',
            htu: 'https://sourcebot.test/api/ee/oauth/token',
            jti: 'replayed-proof',
        });

        await expect(verifyDpopProof({ request, proof })).resolves.toMatchObject({ ok: true });
        await expect(verifyDpopProof({ request, proof })).resolves.toMatchObject({
            ok: false,
            error: 'invalid_dpop_proof',
        });
    });

    test('does not record a proof id before access-token hash validation passes', async () => {
        const keyPair = await generateKeyPair();
        const request = new Request('http://internal.test/api/ee/mcp', { method: 'POST' });
        const proof = await signDpopProof({
            ...keyPair,
            htm: 'POST',
            htu: 'https://sourcebot.test/api/mcp',
            accessToken: 'sboa_actual-token',
            jti: 'ath-mismatch-not-recorded',
        });

        await expect(verifyDpopProof({
            request,
            proof,
            expectedJkt: calculateDpopJkt(keyPair.publicJwk),
            accessToken: 'sboa_other-token',
            requireAccessTokenHash: true,
        })).resolves.toMatchObject({
            ok: false,
            error: 'invalid_dpop_proof',
        });

        await expect(verifyDpopProof({
            request,
            proof,
            expectedJkt: calculateDpopJkt(keyPair.publicJwk),
            accessToken: 'sboa_actual-token',
            requireAccessTokenHash: true,
        })).resolves.toMatchObject({ ok: true });
    });

    test('expires replay cache entries based on proof iat plus the accepted window', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

        const keyPair = await generateKeyPair();
        const request = new Request('http://internal.test/api/ee/oauth/token', { method: 'POST' });
        const proof = await signDpopProof({
            ...keyPair,
            htm: 'POST',
            htu: 'https://sourcebot.test/api/ee/oauth/token',
            iat: Math.floor(Date.now() / 1000) + 60,
            jti: 'future-iat-replay',
        });

        await expect(verifyDpopProof({ request, proof })).resolves.toMatchObject({ ok: true });

        vi.setSystemTime(new Date('2026-01-01T00:05:01.000Z'));

        await expect(verifyDpopProof({ request, proof })).resolves.toMatchObject({
            ok: false,
            error: 'invalid_dpop_proof',
            errorDescription: 'DPoP proof jti has already been used.',
        });
    });

    test.each([
        { header: null, payload: {} },
        { header: [], payload: {} },
        { header: 'header', payload: {} },
        { header: {}, payload: null },
        { header: {}, payload: [] },
        { header: {}, payload: 'payload' },
    ])('rejects non-object JWT JSON values %#', async ({ header, payload }) => {
        const request = new Request('http://internal.test/api/ee/oauth/token', { method: 'POST' });
        const proof = `${base64UrlJson(header)}.${base64UrlJson(payload)}.signature`;

        await expect(verifyDpopProof({ request, proof })).resolves.toMatchObject({
            ok: false,
            error: 'invalid_dpop_proof',
        });
    });
});

async function generateKeyPair(): Promise<KeyPair> {
    const keyPair = await crypto.webcrypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify'],
    );
    const publicJwk = await crypto.webcrypto.subtle.exportKey('jwk', keyPair.publicKey);

    return {
        privateKey: keyPair.privateKey,
        publicJwk: {
            kty: 'EC',
            crv: 'P-256',
            x: publicJwk.x!,
            y: publicJwk.y!,
        },
    };
}

async function signDpopProof({
    privateKey,
    publicJwk,
    htm,
    htu,
    accessToken,
    iat = Math.floor(Date.now() / 1000),
    jti = crypto.randomUUID(),
}: KeyPair & {
    htm: string;
    htu: string;
    accessToken?: string;
    iat?: number;
    jti?: string;
}): Promise<string> {
    const encodedHeader = base64UrlJson({
        typ: 'dpop+jwt',
        alg: 'ES256',
        jwk: publicJwk,
    });
    const encodedPayload = base64UrlJson({
        htm,
        htu,
        iat,
        jti,
        ...(accessToken ? { ath: getDpopAccessTokenHash(accessToken) } : {}),
    });
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = await crypto.webcrypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        privateKey,
        new TextEncoder().encode(signingInput),
    );

    return `${signingInput}.${Buffer.from(signature).toString('base64url')}`;
}

function base64UrlJson(value: unknown): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
}

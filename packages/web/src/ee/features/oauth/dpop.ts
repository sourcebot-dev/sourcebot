import 'server-only';

import crypto from 'crypto';
import { env } from '@sourcebot/shared';

export const DPOP_AUTH_SCHEME = 'DPoP';
export const DPOP_PROOF_HEADER = 'DPoP';
export const DPOP_TOKEN_TYPE = 'DPoP';
export const SUPPORTED_DPOP_SIGNING_ALGS = ['ES256'];

const DPOP_PROOF_IAT_WINDOW_SECONDS = 5 * 60;
const DPOP_JKT_PATTERN = /^[A-Za-z0-9_-]{43}$/;

type DpopJwk = {
    kty?: string;
    crv?: string;
    x?: string;
    y?: string;
    d?: string;
    [key: string]: unknown;
};

type DpopHeader = {
    typ?: string;
    alg?: string;
    jwk?: DpopJwk;
};

type DpopPayload = {
    htm?: unknown;
    htu?: unknown;
    iat?: unknown;
    jti?: unknown;
    ath?: unknown;
};

type VerifyDpopProofOptions = {
    request: Request;
    proof: string | null;
    expectedJkt?: string | null;
    accessToken?: string;
    requireAccessTokenHash?: boolean;
};

type VerifyDpopProofResult =
    | { ok: true; jkt: string }
    | { ok: false; error: 'invalid_dpop_proof'; errorDescription: string };

const seenProofJtis = new Map<string, number>();

export function getCanonicalRequestUri(request: Request): string {
    const requestUrl = new URL(request.url);
    const issuer = env.AUTH_URL?.replace(/\/$/, '');
    const pathname = requestUrl.pathname === '/api/ee/mcp' ? '/api/mcp' : requestUrl.pathname;

    if (issuer) {
        return `${issuer}${pathname}`;
    }

    return `${requestUrl.origin}${pathname}`;
}

export function getDpopAccessTokenHash(accessToken: string): string {
    return crypto.createHash('sha256').update(accessToken).digest('base64url');
}

export function isValidDpopJkt(value: string): boolean {
    return DPOP_JKT_PATTERN.test(value);
}

export function calculateDpopJkt(jwk: DpopJwk): string | undefined {
    if (!isSupportedPublicJwk(jwk)) {
        return undefined;
    }

    const thumbprintInput = JSON.stringify({
        crv: jwk.crv,
        kty: jwk.kty,
        x: jwk.x,
        y: jwk.y,
    });

    return crypto.createHash('sha256').update(thumbprintInput).digest('base64url');
}

export async function verifyDpopProof({
    request,
    proof,
    expectedJkt,
    accessToken,
    requireAccessTokenHash = false,
}: VerifyDpopProofOptions): Promise<VerifyDpopProofResult> {
    if (!proof) {
        return invalidDpopProof('Missing DPoP proof.');
    }

    const parts = proof.split('.');
    if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
        return invalidDpopProof('DPoP proof must be a compact JWT.');
    }

    let header: DpopHeader;
    let payload: DpopPayload;
    try {
        header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8')) as DpopHeader;
        payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8')) as DpopPayload;
    } catch {
        return invalidDpopProof('DPoP proof header or payload is not valid JSON.');
    }

    if (header.typ?.toLowerCase() !== 'dpop+jwt') {
        return invalidDpopProof('DPoP proof typ must be dpop+jwt.');
    }

    if (header.alg !== 'ES256') {
        return invalidDpopProof('DPoP proof alg is not supported.');
    }

    if (!header.jwk || !isSupportedPublicJwk(header.jwk)) {
        return invalidDpopProof('DPoP proof must include a supported public JWK.');
    }

    const jkt = calculateDpopJkt(header.jwk);
    if (!jkt) {
        return invalidDpopProof('DPoP proof JWK thumbprint could not be calculated.');
    }

    if (expectedJkt && jkt !== expectedJkt) {
        return invalidDpopProof('DPoP proof key does not match the token binding.');
    }

    const signatureIsValid = await verifyEs256Signature({
        jwk: header.jwk,
        signingInput: `${parts[0]}.${parts[1]}`,
        signature: parts[2],
    });
    if (!signatureIsValid) {
        return invalidDpopProof('DPoP proof signature is invalid.');
    }

    const expectedHtm = request.method.toUpperCase();
    if (payload.htm !== expectedHtm) {
        return invalidDpopProof('DPoP proof htm does not match the request method.');
    }

    const expectedHtu = getCanonicalRequestUri(request);
    if (payload.htu !== expectedHtu) {
        return invalidDpopProof('DPoP proof htu does not match the request URI.');
    }

    if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat)) {
        return invalidDpopProof('DPoP proof iat must be a numeric timestamp.');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - payload.iat) > DPOP_PROOF_IAT_WINDOW_SECONDS) {
        return invalidDpopProof('DPoP proof iat is outside the accepted time window.');
    }

    if (typeof payload.jti !== 'string' || payload.jti.length === 0) {
        return invalidDpopProof('DPoP proof jti is required.');
    }

    if (!recordProofJti(jkt, payload.jti)) {
        return invalidDpopProof('DPoP proof jti has already been used.');
    }

    if (accessToken || requireAccessTokenHash) {
        if (typeof payload.ath !== 'string' || !accessToken) {
            return invalidDpopProof('DPoP proof ath is required.');
        }

        if (payload.ath !== getDpopAccessTokenHash(accessToken)) {
            return invalidDpopProof('DPoP proof ath does not match the access token.');
        }
    }

    return { ok: true, jkt };
}

export function __clearDpopReplayCacheForTests() {
    seenProofJtis.clear();
}

function invalidDpopProof(errorDescription: string): VerifyDpopProofResult {
    return {
        ok: false,
        error: 'invalid_dpop_proof',
        errorDescription,
    };
}

function isSupportedPublicJwk(jwk: DpopJwk): jwk is Required<Pick<DpopJwk, 'kty' | 'crv' | 'x' | 'y'>> & DpopJwk {
    return (
        jwk.kty === 'EC' &&
        jwk.crv === 'P-256' &&
        typeof jwk.x === 'string' &&
        typeof jwk.y === 'string' &&
        typeof jwk.d !== 'string'
    );
}

async function verifyEs256Signature({
    jwk,
    signingInput,
    signature,
}: {
    jwk: Required<Pick<DpopJwk, 'kty' | 'crv' | 'x' | 'y'>>;
    signingInput: string;
    signature: string;
}): Promise<boolean> {
    try {
        const key = await crypto.webcrypto.subtle.importKey(
            'jwk',
            {
                kty: jwk.kty,
                crv: jwk.crv,
                x: jwk.x,
                y: jwk.y,
            },
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            ['verify'],
        );

        return await crypto.webcrypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            key,
            base64UrlDecode(signature),
            new TextEncoder().encode(signingInput),
        );
    } catch {
        return false;
    }
}

function base64UrlDecode(value: string): Buffer {
    return Buffer.from(value, 'base64url');
}

function recordProofJti(jkt: string, jti: string): boolean {
    const now = Date.now();
    for (const [cacheKey, expiresAt] of seenProofJtis.entries()) {
        if (expiresAt <= now) {
            seenProofJtis.delete(cacheKey);
        }
    }

    const cacheKey = `${jkt}:${jti}`;
    if (seenProofJtis.has(cacheKey)) {
        return false;
    }

    seenProofJtis.set(cacheKey, now + DPOP_PROOF_IAT_WINDOW_SECONDS * 1000);
    return true;
}

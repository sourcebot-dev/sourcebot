import { describe, expect, test } from 'vitest';
import { getExternalMcpErrorLogFields } from './externalMcpError';

describe('getExternalMcpErrorLogFields', () => {
    test('does not include raw error messages or response bodies', () => {
        class OAuthProviderError extends Error {
            statusCode = 401;
            response = {
                status: 401,
                body: JSON.stringify({
                    error: 'invalid_client',
                    error_description: 'client_secret=client-secret refresh_token=refresh-token',
                }),
            };
        }
        const error = new OAuthProviderError('invalid_client client_secret=client-secret');

        const fields = getExternalMcpErrorLogFields(error);

        expect(fields).toEqual({
            errorClass: 'OAuthProviderError',
            errorName: 'Error',
            oauthError: 'invalid_client',
            statusCode: 401,
        });
        expect(JSON.stringify(fields)).not.toContain('client-secret');
        expect(JSON.stringify(fields)).not.toContain('refresh-token');
    });

    test('drops unsafe custom names', () => {
        const fields = getExternalMcpErrorLogFields({
            name: 'client_secret=client-secret',
            status: 502,
        });

        expect(fields).toEqual({
            errorClass: 'Object',
            statusCode: 502,
        });
        expect(JSON.stringify(fields)).not.toContain('client-secret');
    });

    test('reads HTTP status from SDK transport error code fields', () => {
        class StreamableHTTPError extends Error {
            code = 403;
        }

        const fields = getExternalMcpErrorLogFields(new StreamableHTTPError('Streamable HTTP error'));

        expect(fields).toEqual({
            errorClass: 'StreamableHTTPError',
            errorName: 'Error',
            statusCode: 403,
        });
    });

    test('preserves known safe diagnostic reasons without raw messages', () => {
        const fields = getExternalMcpErrorLogFields(
            new Error('Incompatible auth server: does not support dynamic client registration'),
        );

        expect(fields).toEqual({
            errorClass: 'Error',
            reason: 'dynamic_client_registration_unsupported',
        });
        expect(JSON.stringify(fields)).not.toContain('Incompatible auth server');
    });

    test('finds allowlisted OAuth codes anywhere in a message', () => {
        const fields = getExternalMcpErrorLogFields(
            new Error('Request failed at invalid_grant after token exchange'),
        );

        expect(fields).toEqual({
            errorClass: 'Error',
            oauthError: 'invalid_grant',
        });
        expect(JSON.stringify(fields)).not.toContain('Request failed');
    });
});

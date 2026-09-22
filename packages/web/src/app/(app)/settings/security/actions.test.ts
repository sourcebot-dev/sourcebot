import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ErrorCode } from '@/lib/errorCodes';

const mocks = vi.hoisted(() => ({
    authenticated: true,
    role: 'OWNER' as 'OWNER' | 'MEMBER',
    update: vi.fn(),
    captureException: vi.fn(),
}));

vi.mock('@/auth', () => ({ getProviders: vi.fn() }));
vi.mock('@/lib/entitlements', () => ({ isAnonymousAccessAvailable: vi.fn() }));
vi.mock('@sourcebot/shared', () => ({
    env: {},
    createLogger: () => ({ error: vi.fn() }),
}));
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.captureException }));
vi.mock('@/middleware/withAuth', () => ({
    withAuth: async (fn: (context: unknown) => unknown) => {
        if (!mocks.authenticated) {
            return { statusCode: 401, errorCode: 'NOT_AUTHENTICATED', message: 'Not authenticated' };
        }
        return fn({ org: { id: 42 }, role: mocks.role, prisma: { org: { update: mocks.update } } });
    },
}));

const { setDefaultHomeView, setLoginMessage } = await import('./actions');

beforeEach(() => {
    vi.resetAllMocks();
    mocks.authenticated = true;
    mocks.role = 'OWNER';
    mocks.update.mockResolvedValue({});
});

describe('setLoginMessage', () => {
    test('stores raw Markdown on the authenticated organization, preserving meaningful whitespace', async () => {
        const message = '    Indented code\n\n[Request access](https://example.com/access)  \nContact **IT**.';
        await expect(setLoginMessage(message)).resolves.toEqual({ success: true });
        expect(mocks.update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: { loginMessage: message },
        });
    });

    test.each([null, '', ' \n\t '])('clears the message for %j', async (message) => {
        await expect(setLoginMessage(message)).resolves.toEqual({ success: true });
        expect(mocks.update).toHaveBeenCalledWith({ where: { id: 42 }, data: { loginMessage: null } });
    });

    test('accepts exactly 5,000 characters', async () => {
        await expect(setLoginMessage('x'.repeat(5000))).resolves.toEqual({ success: true });
    });

    test('rejects messages over 5,000 characters without writing', async () => {
        await expect(setLoginMessage('x'.repeat(5001))).resolves.toMatchObject({
            statusCode: 400, errorCode: ErrorCode.INVALID_REQUEST_BODY,
        });
        expect(mocks.update).not.toHaveBeenCalled();
    });

    test.each([[undefined], [42], [{}], [[]]])('rejects invalid input %j without writing', async (message) => {
        await expect(setLoginMessage(message as string)).resolves.toMatchObject({
            statusCode: 400, errorCode: ErrorCode.INVALID_REQUEST_BODY,
        });
        expect(mocks.update).not.toHaveBeenCalled();
    });

    test('denies organization members through the owner role check', async () => {
        mocks.role = 'MEMBER';
        await expect(setLoginMessage('Unauthorized edit')).resolves.toMatchObject({
            statusCode: 403, errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        });
        expect(mocks.update).not.toHaveBeenCalled();
    });

    test('requires authentication', async () => {
        mocks.authenticated = false;
        await expect(setLoginMessage('Unauthorized edit')).resolves.toMatchObject({
            statusCode: 401, errorCode: ErrorCode.NOT_AUTHENTICATED,
        });
        expect(mocks.update).not.toHaveBeenCalled();
    });

    test('returns a service error when persistence fails', async () => {
        const error = new Error('Database unavailable');
        mocks.update.mockRejectedValue(error);
        await expect(setLoginMessage('Message')).resolves.toMatchObject({
            statusCode: 500, errorCode: ErrorCode.UNEXPECTED_ERROR,
        });
        expect(mocks.captureException).toHaveBeenCalledWith(error);
    });
});

describe('setDefaultHomeView', () => {
    test('stores the deployment default on the authenticated organization', async () => {
        await expect(setDefaultHomeView('ask')).resolves.toEqual({ success: true });
        expect(mocks.update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: { defaultHomeView: 'ASK' },
        });
    });

    test('rejects invalid values without writing', async () => {
        await expect(setDefaultHomeView('invalid')).resolves.toMatchObject({
            statusCode: 400,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
        });
        expect(mocks.update).not.toHaveBeenCalled();
    });

    test('denies organization members through the owner role check', async () => {
        mocks.role = 'MEMBER';
        await expect(setDefaultHomeView('ask')).resolves.toMatchObject({
            statusCode: 403,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        });
        expect(mocks.update).not.toHaveBeenCalled();
    });
});

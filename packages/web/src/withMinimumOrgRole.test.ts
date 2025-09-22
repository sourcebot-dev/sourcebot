import { expect, test, vi, describe } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { OrgRole } from '@sourcebot/db';
import { withMinimumOrgRole } from './withMinimumOrgRole';
import { ErrorCode } from './lib/errorCodes';

describe('withMinimumOrgRole', () => {
    test('should execute function when user has sufficient permissions', async () => {
        const mockFn = vi.fn().mockResolvedValue('success');
        
        const result = await withMinimumOrgRole(
            OrgRole.OWNER,
            OrgRole.MEMBER,
            mockFn
        );
        
        expect(mockFn).toHaveBeenCalledOnce();
        expect(result).toBe('success');
    });

    test('should return forbidden error when user has insufficient permissions', async () => {
        const mockFn = vi.fn().mockResolvedValue('success');
        
        const result = await withMinimumOrgRole(
            OrgRole.MEMBER,
            OrgRole.OWNER,
            mockFn
        );
        
        expect(mockFn).not.toHaveBeenCalled();
        expect(result).toEqual({
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "You do not have sufficient permissions to perform this action.",
        });
    });

    test('should respect role hierarchy: OWNER > MEMBER > GUEST', async () => {
        const mockFn = vi.fn().mockResolvedValue('success');
        
        // Test OWNER can access MEMBER-required functions
        const ownerResult = await withMinimumOrgRole(
            OrgRole.OWNER,
            OrgRole.MEMBER,
            mockFn
        );
        expect(ownerResult).toBe('success');
        
        // Test MEMBER can access MEMBER-required functions
        const memberResult = await withMinimumOrgRole(
            OrgRole.MEMBER,
            OrgRole.MEMBER,
            mockFn
        );
        expect(memberResult).toBe('success');
        
        // Test GUEST cannot access MEMBER-required functions
        const guestResult = await withMinimumOrgRole(
            OrgRole.GUEST,
            OrgRole.MEMBER,
            mockFn
        );
        expect(guestResult).toEqual({
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "You do not have sufficient permissions to perform this action.",
        });
        
        expect(mockFn).toHaveBeenCalledTimes(2); // Only successful calls
    });
});

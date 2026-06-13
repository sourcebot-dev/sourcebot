import { apiHandler } from '@/lib/apiHandler';
import { deactivateScimMember, reactivateScimMember } from '@/ee/features/scim/membership';
import { scimError, scimJson, toScimUser, type ScimMembership } from '@/ee/features/scim/mapper';
import {
    coerceActive,
    resolveEmail,
    scimPatchOpSchema,
    scimUserReplaceSchema,
} from '@/ee/features/scim/schemas';
import { withScimAuth, type ScimAuthContext } from '@/ee/features/scim/withScimAuth';
import { isServiceError } from '@/lib/utils';
import { NextRequest } from 'next/server';

const loadMembership = (prisma: ScimAuthContext['prisma'], orgId: number, userId: string): Promise<ScimMembership | null> =>
    prisma.userToOrg.findUnique({
        where: { orgId_userId: { orgId, userId } },
        include: { user: true },
    });

// Applies an active state transition, running the deactivate/reactivate helper
// only when the value actually changes. Returns a SCIM error Response on failure.
const applyActive = async (orgId: number, userId: string, current: boolean, next: boolean | undefined): Promise<Response | null> => {
    if (next === undefined || next === current) {
        return null;
    }
    const result = next
        ? await reactivateScimMember(orgId, userId)
        : await deactivateScimMember(orgId, userId);
    if (isServiceError(result)) {
        return scimError(result.statusCode, result.message);
    }
    return null;
};

// eslint-disable-next-line authz/require-auth-wrapper -- SCIM bearer auth via withScimAuth
export const GET = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
    withScimAuth(request, async ({ org, prisma }) => {
        const { id } = await params;
        const membership = await loadMembership(prisma, org.id, id);
        if (!membership) {
            return scimError(404, `User ${id} not found`);
        }
        return scimJson(toScimUser(membership), 200);
    }));

// eslint-disable-next-line authz/require-auth-wrapper -- SCIM bearer auth via withScimAuth
export const PUT = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
    withScimAuth(request, async ({ org, prisma }) => {
        const { id } = await params;
        const membership = await loadMembership(prisma, org.id, id);
        if (!membership) {
            return scimError(404, `User ${id} not found`);
        }

        const parsed = scimUserReplaceSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return scimError(400, 'Invalid SCIM user payload', 'invalidValue');
        }
        const payload = parsed.data;

        const name = payload.name?.formatted ?? payload.displayName ?? undefined;
        const email = resolveEmail(payload);
        await prisma.user.update({
            where: { id },
            data: { name, email },
        });

        const activeError = await applyActive(org.id, id, membership.isActive, coerceActive(payload.active));
        if (activeError) {
            return activeError;
        }

        const refreshed = await loadMembership(prisma, org.id, id);
        return scimJson(toScimUser(refreshed!), 200);
    }));

// eslint-disable-next-line authz/require-auth-wrapper -- SCIM bearer auth via withScimAuth
export const PATCH = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
    withScimAuth(request, async ({ org, prisma }) => {
        const { id } = await params;
        const membership = await loadMembership(prisma, org.id, id);
        if (!membership) {
            return scimError(404, `User ${id} not found`);
        }

        const parsed = scimPatchOpSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return scimError(400, 'Invalid SCIM PatchOp payload', 'invalidValue');
        }

        // Extract the desired `active` value. IdPs send it two ways:
        //   { op: "replace", path: "active", value: false }
        //   { op: "replace", value: { active: false } }
        // `op` is case-insensitive. Other operations are ignored (lenient).
        let nextActive: boolean | undefined;
        for (const operation of parsed.data.Operations) {
            const op = operation.op.toLowerCase();
            if (op !== 'replace' && op !== 'add') {
                continue;
            }
            if (operation.path === 'active') {
                nextActive = coerceActive(operation.value);
            } else if (!operation.path && operation.value && typeof operation.value === 'object') {
                const maybe = (operation.value as Record<string, unknown>).active;
                if (maybe !== undefined) {
                    nextActive = coerceActive(maybe);
                }
            }
        }

        const activeError = await applyActive(org.id, id, membership.isActive, nextActive);
        if (activeError) {
            return activeError;
        }

        const refreshed = await loadMembership(prisma, org.id, id);
        return scimJson(toScimUser(refreshed!), 200);
    }));

// eslint-disable-next-line authz/require-auth-wrapper -- SCIM bearer auth via withScimAuth
export const DELETE = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
    withScimAuth(request, async ({ org, prisma }) => {
        const { id } = await params;
        const membership = await loadMembership(prisma, org.id, id);
        if (!membership) {
            return scimError(404, `User ${id} not found`);
        }
        // DELETE is treated as deactivation, not a hard delete, so the IdP can
        // reactivate later and we preserve the user's data/history.
        const result = await deactivateScimMember(org.id, id);
        if (isServiceError(result)) {
            return scimError(result.statusCode, result.message);
        }
        return new Response(null, { status: 204 });
    }));

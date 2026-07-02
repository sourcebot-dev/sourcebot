import { apiHandler } from '@/lib/apiHandler';
import { removeMember, setMembershipSuspended } from '@/features/membership/membership.service';
import { scimError, scimJson, toScimUser, type ScimMembership } from '@/ee/features/scim/mapper';
import {
    coerceActive,
    parseScimPatchOperations,
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

// Applies an active state transition, toggling the membership only when the
// value actually changes. Returns a SCIM error Response on failure.
const applyActive = async (orgId: number, userId: string, current: boolean, next: boolean | undefined): Promise<Response | null> => {
    if (next === undefined || next === current) {
        return null;
    }
    const result = await setMembershipSuspended(orgId, userId, !next, {
        actor: { id: 'scim', type: 'scim_token' },
    });
    if (isServiceError(result)) {
        return scimError(result.statusCode, result.message);
    }
    return null;
};

const ensureEmailAvailable = async (prisma: ScimAuthContext['prisma'], userId: string, email: string): Promise<Response | null> => {
    const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
    });
    if (existing && existing.id !== userId) {
        return scimError(409, 'User email is already in use', 'uniqueness');
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
        const emailError = await ensureEmailAvailable(prisma, id, email);
        if (emailError) {
            return emailError;
        }

        const activeError = await applyActive(org.id, id, membership.suspendedAt == null, coerceActive(payload.active));
        if (activeError) {
            return activeError;
        }

        await prisma.user.update({
            where: { id },
            data: { name, email },
        });

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

        // Reduce the operations into the attributes we persist (name, email,
        // active). IdPs send these via path-based ops or a no-path bulk object;
        // `parseScimPatchOperations` normalizes both. Unrecognized ops/paths are
        // ignored rather than rejected, per the SCIM lenient-parsing convention.
        const changes = parseScimPatchOperations(parsed.data.Operations);

        if (changes.email !== undefined) {
            const emailError = await ensureEmailAvailable(prisma, id, changes.email);
            if (emailError) {
                return emailError;
            }
        }

        const activeError = await applyActive(org.id, id, membership.suspendedAt == null, changes.active);
        if (activeError) {
            return activeError;
        }

        if (changes.name !== undefined || changes.email !== undefined) {
            await prisma.user.update({
                where: { id },
                data: {
                    ...(changes.name !== undefined ? { name: changes.name } : {}),
                    ...(changes.email !== undefined ? { email: changes.email } : {}),
                },
            });
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
        // Per RFC 7644, DELETE removes the resource: hard-delete the membership
        // (the User row is preserved so re-provisioning reuses the same SCIM id).
        // Reversible suspension is still available via PATCH/PUT `active: false`.
        const result = await removeMember(org.id, id, {
            actor: { id: 'scim', type: 'scim_token' },
        });
        if (isServiceError(result)) {
            return scimError(result.statusCode, result.message);
        }
        return new Response(null, { status: 204 });
    }));

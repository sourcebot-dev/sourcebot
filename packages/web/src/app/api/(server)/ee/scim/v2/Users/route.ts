import { apiHandler } from '@/lib/apiHandler';
import { orgHasAvailability } from '@/lib/authUtils';
import { reactivateScimMember } from '@/ee/features/scim/membership';
import { scimError, scimJson, toScimListResponse, toScimUser } from '@/ee/features/scim/mapper';
import {
    coerceActive,
    parseScimFilter,
    resolveEmail,
    scimUserCreateSchema,
} from '@/ee/features/scim/schemas';
import { withScimAuth } from '@/ee/features/scim/withScimAuth';
import { isServiceError } from '@/lib/utils';
import { OrgRole } from '@sourcebot/db';
import { env } from '@sourcebot/shared';
import { NextRequest } from 'next/server';
import { SCIM_DEFAULT_COUNT, SCIM_MAX_COUNT } from '@/ee/features/scim/constants';

// eslint-disable-next-line authz/require-auth-wrapper -- SCIM bearer auth via withScimAuth
export const GET = apiHandler(async (request: NextRequest) =>
    withScimAuth(request, async ({ org, prisma }) => {
        const params = request.nextUrl.searchParams;
        const filterParam = params.get('filter');
        const startIndex = Math.max(1, parseInt(params.get('startIndex') ?? '1', 10) || 1);
        const count = Math.min(SCIM_MAX_COUNT, Math.max(0, parseInt(params.get('count') ?? `${SCIM_DEFAULT_COUNT}`, 10) || SCIM_DEFAULT_COUNT));

        // A filter that's present but unrecognized yields an empty result set
        // (never a 404/400) so the IdP can decide create-vs-update safely.
        const filter = parseScimFilter(filterParam);
        if (filterParam && !filter) {
            return scimJson(toScimListResponse([], 0, startIndex), 200);
        }

        const where = {
            orgId: org.id,
            ...(filter?.attribute === 'userName' ? { user: { email: { equals: filter.value, mode: 'insensitive' as const } } } : {}),
            ...(filter?.attribute === 'externalId' ? { scimExternalId: filter.value } : {}),
        };

        const [total, memberships] = await Promise.all([
            prisma.userToOrg.count({ where }),
            prisma.userToOrg.findMany({
                where,
                include: { user: true },
                orderBy: { joinedAt: 'asc' },
                skip: startIndex - 1,
                take: count,
            }),
        ]);

        return scimJson(toScimListResponse(memberships.map(toScimUser), total, startIndex), 200);
    }));

// eslint-disable-next-line authz/require-auth-wrapper -- SCIM bearer auth via withScimAuth
export const POST = apiHandler(async (request: NextRequest) =>
    withScimAuth(request, async ({ org, prisma }) => {
        const parsed = scimUserCreateSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return scimError(400, 'Invalid SCIM user payload', 'invalidValue');
        }
        const payload = parsed.data;
        const email = resolveEmail(payload);
        const name = payload.name?.formatted ?? payload.displayName ?? undefined;
        const isActive = coerceActive(payload.active) ?? true;

        // Find-or-create the user by email. We deliberately bypass `onCreateUser`
        // (its JIT/bootstrap logic is for interactive login, not provisioning).
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma.user.create({ data: { email, name } });
        }

        const existing = await prisma.userToOrg.findUnique({
            where: { orgId_userId: { orgId: org.id, userId: user.id } },
            include: { user: true },
        });

        if (existing) {
            if (existing.isActive) {
                return scimError(409, 'User is already a member of this organization', 'uniqueness');
            }
            // Re-provisioning a previously deactivated user → reactivate.
            const result = await reactivateScimMember(org.id, user.id, payload.externalId);
            if (isServiceError(result)) {
                return scimError(result.statusCode, result.message);
            }
            const refreshed = await prisma.userToOrg.findUniqueOrThrow({
                where: { orgId_userId: { orgId: org.id, userId: user.id } },
                include: { user: true },
            });
            return scimJson(toScimUser(refreshed), 200, { Location: `${env.AUTH_URL.replace(/\/$/, '')}/scim/v2/Users/${user.id}` });
        }

        // New membership: enforce the seat cap before creating.
        if (isActive && !(await orgHasAvailability(org.id))) {
            return scimError(400, 'Organization seat limit reached', 'tooMany');
        }

        const membership = await prisma.userToOrg.create({
            data: {
                userId: user.id,
                orgId: org.id,
                role: OrgRole.MEMBER,
                isActive,
                scimExternalId: payload.externalId,
            },
            include: { user: true },
        });

        return scimJson(toScimUser(membership), 201, { Location: `${env.AUTH_URL.replace(/\/$/, '')}/scim/v2/Users/${user.id}` });
    }));

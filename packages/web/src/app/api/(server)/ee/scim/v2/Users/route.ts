import { apiHandler } from '@/lib/apiHandler';
import { ensureActiveMember, setMembershipSuspended } from '@/features/membership/membership.service';
import { scimError, scimJson, toScimListResponse, toScimUser } from '@/ee/features/scim/mapper';
import {
    coerceActive,
    parseScimFilter,
    resolveEmail,
    scimListUsersQueryParamsSchema,
    scimUserCreateSchema,
} from '@/ee/features/scim/schemas';
import { withScimAuth } from '@/ee/features/scim/withScimAuth';
import { ErrorCode } from '@/lib/errorCodes';
import { isServiceError } from '@/lib/utils';
import { OrgRole } from '@sourcebot/db';
import { env } from '@sourcebot/shared';
import { NextRequest } from 'next/server';

// eslint-disable-next-line authz/require-auth-wrapper -- SCIM bearer auth via withScimAuth
export const GET = apiHandler(async (request: NextRequest) =>
    withScimAuth(request, async ({ org, prisma }) => {
        const rawParams = Object.fromEntries(
            Object.keys(scimListUsersQueryParamsSchema.shape).map(key => [
                key,
                request.nextUrl.searchParams.get(key) ?? undefined,
            ])
        );
        const parsed = scimListUsersQueryParamsSchema.safeParse(rawParams);
        if (!parsed.success) {
            return scimError(400, 'Invalid SCIM query parameters', 'invalidValue');
        }
        const { filter: filterParam, startIndex, count } = parsed.data;

        // A filter that's present but unrecognized yields an empty result set
        // (never a 404/400) so the IdP can decide create-vs-update safely.
        const filter = parseScimFilter(filterParam ?? null);
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
        const desiredActive = coerceActive(payload.active) ?? true;

        const user = await prisma.user.upsert({
            where: { email },
            create: { email, name },
            update: { email, name },
        });

        const scimActor = { id: 'scim', type: 'scim_token' } as const;
        const existing = await prisma.userToOrg.findUnique({
            where: { orgId_userId: { orgId: org.id, userId: user.id } },
        });

        // Map the membership state to the SCIM response: an unsuspended member
        // is a conflict, a suspended member is reactivated (role preserved), and
        // a brand-new member is created.
        let httpStatus: number;
        if (existing && existing.suspendedAt == null) {
            return scimError(409, 'User is already a member of this organization', 'uniqueness');
        } else if (existing) {
            const result = await setMembershipSuspended(org.id, user.id, false, {
                actor: scimActor,
                scimExternalId: payload.externalId,
            });
            if (isServiceError(result)) {
                const scimType = result.errorCode === ErrorCode.ORG_SEAT_COUNT_REACHED ? 'tooMany' : undefined;
                return scimError(result.statusCode, result.message, scimType);
            }
            httpStatus = 200;
        } else {
            const result = await ensureActiveMember(org.id, user.id, {
                actor: scimActor,
                role: OrgRole.MEMBER,
                scimExternalId: payload.externalId,
            });
            if (isServiceError(result)) {
                const scimType = result.errorCode === ErrorCode.ORG_SEAT_COUNT_REACHED ? 'tooMany' : undefined;
                return scimError(result.statusCode, result.message, scimType);
            }
            httpStatus = 201;
        }

        // IdPs normally provision active and suspend later via PATCH; honor a rare
        // explicit `active: false` on provisioning.
        if (!desiredActive) {
            const deactivated = await setMembershipSuspended(org.id, user.id, true, { actor: scimActor });
            if (isServiceError(deactivated)) {
                return scimError(deactivated.statusCode, deactivated.message);
            }
        }

        const membership = await prisma.userToOrg.findUniqueOrThrow({
            where: { orgId_userId: { orgId: org.id, userId: user.id } },
            include: { user: true },
        });
        return scimJson(toScimUser(membership), httpStatus, {
            Location: `${env.AUTH_URL.replace(/\/$/, '')}/scim/v2/Users/${user.id}`,
        });
    }));

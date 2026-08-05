import { Prisma } from "@sourcebot/db";

export type MembershipWithUser = Prisma.UserToOrgGetPayload<{ include: { user: true } }>;

export const toPublicUser = (membership: MembershipWithUser) => ({
    id: membership.user.id,
    name: membership.user.name,
    email: membership.user.email,
    role: membership.role,
    suspendedAt: membership.suspendedAt,
    createdAt: membership.user.createdAt,
    updatedAt: membership.user.updatedAt,
    lastActivityAt: membership.lastActiveAt,
});

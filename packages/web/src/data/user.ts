import 'server-only';
import { prisma } from "@/prisma";

export const getUser = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    });

    return user;
}

export const getUserOrgs = async (userId: string) => {
    const orgs = await prisma.org.findMany({
        where: {
            members: {
                some: {
                    userId: userId,
                },
            },
        },
    });

    return orgs;
}

export const getUserRoleInOrg = async (userId: string, orgId: number) => {
    const userToOrg = await prisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                userId,
                orgId,
            }
        },
    });

    return userToOrg?.role;
}
'use server';

import { auth } from "./auth";
import { notAuthenticated, notFound } from "./lib/serviceError";
import { prisma } from "@/prisma";


export const createOrg = async (name: string) => {
    const session = await auth();
    if (!session) {
        return notAuthenticated();
    }

    // Create the org
    const org = await prisma.org.create({
        data: {
            name,
            members: {
                create: {
                    userId: session.user.id,
                    role: "OWNER",
                },
            },
        }
    });

    return {
        id: org.id,
    }
}

export const switchActiveOrg = async (orgId: number) => {
    const session = await auth();
    if (!session) {
        return notAuthenticated();
    }

    // Check to see if the user is a member of the org
    const membership = await prisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                userId: session.user.id,
                orgId,
            }
        },
    });
    if (!membership) {
        return notFound();
    }

    // Update the user's active org
    await prisma.user.update({
        where: {
            id: session.user.id,
        },
        data: {
            activeOrgId: orgId,
        }
    });

    return {
        id: orgId,
    }
}
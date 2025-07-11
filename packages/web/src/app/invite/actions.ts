"use server";

import { withAuth } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { orgNotFound } from "@/lib/serviceError";
import { sew } from "@/actions";
import { addUserToOrganization } from "@/lib/authUtils";
import { prisma } from "@/prisma";

export const joinOrganization = (orgId: number) => sew(async () =>
    withAuth(async (userId) => {
        const org = await prisma.org.findUnique({
            where: {
                id: orgId,
            },
        });
        
        if (!org) {
            return orgNotFound();
        }

        const addUserToOrgRes = await addUserToOrganization(userId, org.id);
        if (isServiceError(addUserToOrgRes)) {
            return addUserToOrgRes;
        }

        return {
            success: true,
        }
    })
) 
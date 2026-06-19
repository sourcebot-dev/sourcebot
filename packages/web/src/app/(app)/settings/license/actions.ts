'use server';

import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";
import { ServiceError } from "@/lib/serviceError";

export interface ServicePingHistoryEntry {
    createdAt: string;
    payload: unknown;
}

// Returns the recorded Service Ping history so offline deployments can export
// it and send it back to us out-of-band (they can't reach Lighthouse directly).
export const getServicePingHistory = async (): Promise<ServicePingHistoryEntry[] | ServiceError> => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const events = await prisma.servicePingEvent.findMany({
                where: { orgId: org.id },
                orderBy: { createdAt: 'asc' },
            });

            return events.map((event) => ({
                createdAt: event.createdAt.toISOString(),
                payload: event.payload,
            }));
        })
    )
);

import type { ConnectionQuery } from '@/lib/types';
import { sew } from '@/middleware/sew';
import { withOptionalAuth } from '@/middleware/withAuth';

export const listConnections = async () => sew(() =>
    withOptionalAuth(async ({ org, prisma }) => {
        const repositories = await prisma.repo.findMany({
            where: {
                orgId: org.id,
            },
            select: {
                connections: {
                    select: {
                        connection: {
                            select: {
                                id: true,
                                name: true,
                                connectionType: true,
                            },
                        },
                    },
                },
            },
        });

        const connectionsById = new Map<number, ConnectionQuery>();
        for (const repository of repositories) {
            for (const { connection } of repository.connections) {
                connectionsById.set(connection.id, connection);
            }
        }

        return [...connectionsById.values()].sort((a, b) =>
            a.name.localeCompare(b.name) || a.id - b.id
        );
    })
);

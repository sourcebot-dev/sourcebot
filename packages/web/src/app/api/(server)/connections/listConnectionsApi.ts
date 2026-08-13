import { sew } from '@/middleware/sew';
import { withOptionalAuth } from '@/middleware/withAuth';
import { ConnectionType } from '@sourcebot/db';
import { z } from 'zod';

export const connectionQuerySchema = z.object({
    id: z.number().int(),
    name: z.string(),
    connectionType: z.nativeEnum(ConnectionType),
});

export const listConnectionsResponseSchema = connectionQuerySchema.array();

export type ConnectionQuery = z.infer<typeof connectionQuerySchema>;
export type ListConnectionsResponse = z.infer<typeof listConnectionsResponseSchema>;

export const listConnections = async () => sew(() =>
    withOptionalAuth(async ({ org, prisma }) => {
        // Query through repos so the scoped Prisma client applies repository visibility;
        // querying Connection directly would expose connections unrelated to visible repos.
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

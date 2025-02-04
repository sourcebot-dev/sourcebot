import { prisma } from '@/prisma';
import 'server-only';

export const getConnection = async (connectionId: number, orgId: number) => {
    const connection = await prisma.connection.findUnique({
        where: {
            id: connectionId,
            orgId: orgId,
        },
    });

    return connection;
}

export const getLinkedRepos = async (connectionId: number, orgId: number) => {
    const linkedRepos = await prisma.repoToConnection.findMany({
        where: {
            connection: {
                id: connectionId,
                orgId: orgId,
            }
        },
        include: {
            repo: true,
        }
    });

    return linkedRepos;
}
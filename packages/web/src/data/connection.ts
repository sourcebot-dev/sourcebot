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

export const getConnectionByDomain = async (connectionId: number, domain: string) => {
    const connection = await prisma.connection.findUnique({
        where: {
            id: connectionId,
            org: {
                domain: domain,
            }
        },
    });

    return connection;
}

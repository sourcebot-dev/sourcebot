import 'server-only';
import { prisma } from '@/prisma';

export const getOrgFromDomain = async (domain: string) => {
    const org = await prisma.org.findUnique({
        where: {
            domain: domain
        }
    });

    return org;
}
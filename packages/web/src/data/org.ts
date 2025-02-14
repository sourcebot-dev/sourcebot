import { prisma } from '@/prisma';
import 'server-only';

export const getOrgFromDomain = async (domain: string) => {
    const org = await prisma.org.findUnique({
        where: {
            domain: domain
        }
    });

    return org;
}
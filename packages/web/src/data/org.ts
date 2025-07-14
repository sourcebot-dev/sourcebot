import 'server-only';
import { prisma } from '@/prisma';

export const getOrgFromDomain = async (domain: string) => {
    try {
        const org = await prisma.org.findUnique({
            where: {
                domain: domain
            }
        });

        return org;
    } catch (error) {
        // During build time we won't be able to access the database, so we catch and return null in this case
        // so that we can statically build pages that hit the DB (ex. to check if the org is onboarded)
        console.error('Error fetching org from domain:', error);
        return null;
    }
}
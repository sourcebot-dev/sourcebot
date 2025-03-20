import { OrgRole } from '@sourcebot/db';
import { env } from './env.mjs';
import { prisma } from "@/prisma";
import { SINGLE_TENANT_USER_ID, SINGLE_TENANT_ORG_ID, SINGLE_TENANT_ORG_DOMAIN, SINGLE_TENANT_ORG_NAME, SINGLE_TENANT_USER_EMAIL } from './lib/constants';

if (env.SOURCEBOT_AUTH_ENABLED === 'false' && env.SOURCEBOT_TENANCY_MODE === 'multi') {
    throw new Error('SOURCEBOT_AUTH_ENABLED must be true when SOURCEBOT_TENANCY_MODE is multi');
}

const initSingleTenancy = async () => {
    await prisma.org.upsert({
        where: {
            id: SINGLE_TENANT_ORG_ID,
        },
        update: {},
        create: {
            name: SINGLE_TENANT_ORG_NAME,
            domain: SINGLE_TENANT_ORG_DOMAIN,
            id: SINGLE_TENANT_ORG_ID,
            isOnboarded: env.SOURCEBOT_AUTH_ENABLED === 'false',
        }
    });

    if (env.SOURCEBOT_AUTH_ENABLED === 'false') {
        // Default user for single tenancy unauthed access
        await prisma.user.upsert({
            where: {
                id: SINGLE_TENANT_USER_ID,
            },
            update: {},
            create: {
                id: SINGLE_TENANT_USER_ID,
                email: SINGLE_TENANT_USER_EMAIL,
            },
        });

        await prisma.org.update({
            where: {
                id: SINGLE_TENANT_ORG_ID,
            },
            data: {
                members: {
                    create: {
                        role: OrgRole.MEMBER,
                        user: {
                            connect: { id: SINGLE_TENANT_USER_ID }
                        }
                    }
                }
            }
        });
    }
}

if (env.SOURCEBOT_TENANCY_MODE === 'single') {
    await initSingleTenancy();
}
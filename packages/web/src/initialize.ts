import { OrgRole } from '@sourcebot/db';
import { env } from './env.mjs';
import { prisma } from "@/prisma";
import { SINGLE_TENANT_USER_ID, SINGLE_TENANT_ORG_ID, SINGLE_TENANT_ORG_DOMAIN, SINGLE_TENANT_ORG_NAME, SINGLE_TENANT_USER_EMAIL } from './lib/constants';

const initSingleTenancy = async () => {
    const user = await prisma.user.upsert({
        where: {
            id: SINGLE_TENANT_USER_ID,
        },
        update: {},
        create: {
            id: SINGLE_TENANT_USER_ID,
            email: SINGLE_TENANT_USER_EMAIL,
        },
    });

    await prisma.org.upsert({
        where: {
            id: SINGLE_TENANT_ORG_ID,
        },
        update: {},
        create: {
            name: SINGLE_TENANT_ORG_NAME,
            domain: SINGLE_TENANT_ORG_DOMAIN,
            id: SINGLE_TENANT_ORG_ID,
            isOnboarded: true,
            members: {
                create: {
                    role: OrgRole.OWNER,
                    user: {
                        connect: {
                            id: user.id,
                        }
                    }
                }
            }
        }
    });

    console.log('init!');
}

if (env.SOURCEBOT_TENANCY_MODE === 'single') {
    await initSingleTenancy();
}
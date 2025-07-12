'use server';

import { prisma } from '@/prisma';
import { SINGLE_TENANT_ORG_DOMAIN } from '@/lib/constants';
import { createLogger } from "@sourcebot/logger";

const logger = createLogger('onboarded-check');

export async function GET() {
    try {
        const org = await prisma.org.findUnique({
            where: {
                domain: SINGLE_TENANT_ORG_DOMAIN
            },
            select: {
                isOnboarded: true
            }
        });

        if (!org) {
            logger.warn(`Organization with domain ${SINGLE_TENANT_ORG_DOMAIN} not found`);
            return Response.json({ isOnboarded: false }, { status: 404 });
        }

        logger.info(`Organization onboarded status: ${org.isOnboarded}`);
        return Response.json({ isOnboarded: org.isOnboarded });

    } catch (error) {
        logger.error('Error checking onboarded status:', error);
        return Response.json({ isOnboarded: false }, { status: 500 });
    }
} 
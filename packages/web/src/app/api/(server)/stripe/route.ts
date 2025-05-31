import { headers } from 'next/headers';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/prisma';
import { ConnectionSyncStatus, StripeSubscriptionStatus } from '@sourcebot/db';
import { stripeClient } from '@/ee/features/billing/stripe';
import { env } from '@/env.mjs';
import { createLogger } from "@sourcebot/logger";

const logger = createLogger('stripe-webhook');

export async function POST(req: NextRequest) {
    const body = await req.text();
    const signature = headers().get('stripe-signature');

    if (!signature) {
        return new Response('No signature', { status: 400 });
    }

    if (!stripeClient) {
        return new Response('Stripe client not initialized', { status: 500 });
    }

    if (!env.STRIPE_WEBHOOK_SECRET) {
        return new Response('Stripe webhook secret not set', { status: 500 });
    }

    try {
        const event = stripeClient.webhooks.constructEvent(
            body,
            signature,
            env.STRIPE_WEBHOOK_SECRET
        );

        if (event.type === 'customer.subscription.deleted') {
            const subscription = event.data.object as Stripe.Subscription;
            const customerId = subscription.customer as string;

            const org = await prisma.org.findFirst({
                where: {
                    stripeCustomerId: customerId
                }
            });

            if (!org) {
                return new Response('Org not found', { status: 404 });
            }

            await prisma.org.update({
                where: {
                    id: org.id
                },
                data: {
                    stripeSubscriptionStatus: StripeSubscriptionStatus.INACTIVE,
                    stripeLastUpdatedAt: new Date()
                }
            });
            logger.info(`Org ${org.id} subscription status updated to INACTIVE`);

            return new Response(JSON.stringify({ received: true }), {
                status: 200
            });
        } else if (event.type === 'customer.subscription.created') {
            const subscription = event.data.object as Stripe.Subscription;
            const customerId = subscription.customer as string;

            const org = await prisma.org.findFirst({
                where: {
                    stripeCustomerId: customerId
                }
            });

            if (!org) {
                return new Response('Org not found', { status: 404 });
            }

            await prisma.org.update({
                where: {
                    id: org.id
                },
                data: {
                    stripeSubscriptionStatus: StripeSubscriptionStatus.ACTIVE,
                    stripeLastUpdatedAt: new Date()
                }
            });
            logger.info(`Org ${org.id} subscription status updated to ACTIVE`);

            // mark all of this org's connections for sync, since their repos may have been previously garbage collected
            await prisma.connection.updateMany({
                where: {
                    orgId: org.id
                },
                data: {
                    syncStatus: ConnectionSyncStatus.SYNC_NEEDED
                }
            });

            return new Response(JSON.stringify({ received: true }), {
                status: 200
            });
        } else {
            logger.info(`Received unknown event type: ${event.type}`);
            return new Response(JSON.stringify({ received: true }), {
                status: 202
            });
        }

    } catch (err) {
        logger.error('Error processing webhook:', err);
        return new Response(
            'Webhook error: ' + (err as Error).message,
            { status: 400 }
        );
    }
}

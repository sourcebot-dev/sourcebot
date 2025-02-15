import { headers } from 'next/headers';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/prisma';
import { STRIPE_WEBHOOK_SECRET } from '@/lib/environment';
import { getStripe } from '@/lib/stripe';
import { ConnectionSyncStatus, StripeSubscriptionStatus } from '@sourcebot/db';
export async function POST(req: NextRequest) {
    const body = await req.text();
    const signature = headers().get('stripe-signature');

    if (!signature) {
        return new Response('No signature', { status: 400 });
    }

    try {
        const stripe = getStripe();
        const event = stripe.webhooks.constructEvent(
            body,
            signature,
            STRIPE_WEBHOOK_SECRET!
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
            console.log(`Org ${org.id} subscription status updated to INACTIVE`);

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
            console.log(`Org ${org.id} subscription status updated to ACTIVE`);

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
            console.log(`Received unknown event type: ${event.type}`);
            return new Response(JSON.stringify({ received: true }), {
                status: 202
            });
        }

    } catch (err) {
        console.error('Error processing webhook:', err);
        return new Response(
            'Webhook error: ' + (err as Error).message,
            { status: 400 }
        );
    }
}

import 'server-only';

import { notFound, orgInvalidSubscription, ServiceError, stripeClientNotInitialized } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { Prisma } from "@sourcebot/db";
import Stripe from "stripe";
import { stripeClient } from "./stripe";

export const incrementOrgSeatCount = async (orgId: number, prisma: Prisma.TransactionClient) => {
    if (!stripeClient) {
        return stripeClientNotInitialized();
    }

    const subscription = await getSubscriptionForOrg(orgId, prisma);
    if (isServiceError(subscription)) {
        return subscription;
    }

    const existingSeatCount = subscription.items.data[0].quantity;
    const newSeatCount = (existingSeatCount || 1) + 1;

    await stripeClient.subscriptionItems.update(
        subscription.items.data[0].id,
        {
            quantity: newSeatCount,
            proration_behavior: 'create_prorations',
        }
    );
}

export const decrementOrgSeatCount = async (orgId: number, prisma: Prisma.TransactionClient) => {
    if (!stripeClient) {
        return stripeClientNotInitialized();
    }

    const subscription = await getSubscriptionForOrg(orgId, prisma);
    if (isServiceError(subscription)) {
        return subscription;
    }

    const existingSeatCount = subscription.items.data[0].quantity;
    const newSeatCount = (existingSeatCount || 1) - 1;

    await stripeClient.subscriptionItems.update(
        subscription.items.data[0].id,
        {
            quantity: newSeatCount,
            proration_behavior: 'create_prorations',
        }
    );
}

export const getSubscriptionForOrg = async (orgId: number, prisma: Prisma.TransactionClient): Promise<Stripe.Subscription | ServiceError> => {
    const org = await prisma.org.findUnique({
        where: {
            id: orgId,
        },
    });

    if (!org) {
        return notFound();
    }

    if (!org.stripeCustomerId) {
        return notFound();
    }

    if (!stripeClient) {
        return stripeClientNotInitialized();
    }

    const subscriptions = await stripeClient.subscriptions.list({
        customer: org.stripeCustomerId
    });

    if (subscriptions.data.length === 0) {
        return orgInvalidSubscription();
    }
    return subscriptions.data[0];
}
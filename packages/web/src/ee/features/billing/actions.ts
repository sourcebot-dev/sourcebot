'use server';

import { getMe, sew, withAuth } from "@/actions";
import { ServiceError, stripeClientNotInitialized, notFound } from "@/lib/serviceError";
import { withOrgMembership } from "@/actions";
import { prisma } from "@/prisma";
import { OrgRole } from "@sourcebot/db";
import { stripeClient } from "./stripe";
import { isServiceError } from "@/lib/utils";
import { env } from "@/env.mjs";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { headers } from "next/headers";
import { getSubscriptionForOrg } from "./serverUtils";
import { createLogger } from "@sourcebot/logger";

const logger = createLogger('billing-actions');

export const createOnboardingSubscription = async (domain: string) => sew(() =>
    withAuth(async (userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const user = await getMe();
            if (isServiceError(user)) {
                return user;
            }

            if (!stripeClient) {
                return stripeClientNotInitialized();
            }

            const test_clock = env.STRIPE_ENABLE_TEST_CLOCKS === 'true' ? await stripeClient.testHelpers.testClocks.create({
                frozen_time: Math.floor(Date.now() / 1000)
            }) : null;

            // Use the existing customer if it exists, otherwise create a new one.
            const customerId = await (async () => {
                if (org.stripeCustomerId) {
                    return org.stripeCustomerId;
                }

                const customer = await stripeClient.customers.create({
                    name: org.name,
                    email: user.email ?? undefined,
                    test_clock: test_clock?.id,
                    description: `Created by ${user.email} on ${domain} (id: ${org.id})`,
                });

                await prisma.org.update({
                    where: {
                        id: org.id,
                    },
                    data: {
                        stripeCustomerId: customer.id,
                    }
                });

                return customer.id;
            })();

            const existingSubscription = await getSubscriptionForOrg(org.id, prisma);
            if (!isServiceError(existingSubscription)) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.SUBSCRIPTION_ALREADY_EXISTS,
                    message: "Attemped to create a trial subscription for an organization that already has an active subscription",
                } satisfies ServiceError;
            }


            const prices = await stripeClient.prices.list({
                product: env.STRIPE_PRODUCT_ID,
                expand: ['data.product'],
            });

            try {
                const subscription = await stripeClient.subscriptions.create({
                    customer: customerId,
                    items: [{
                        price: prices.data[0].id,
                    }],
                    trial_period_days: 14,
                    trial_settings: {
                        end_behavior: {
                            missing_payment_method: 'cancel',
                        },
                    },
                    payment_settings: {
                        save_default_payment_method: 'on_subscription',
                    },
                });

                if (!subscription) {
                    return {
                        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                        errorCode: ErrorCode.STRIPE_CHECKOUT_ERROR,
                        message: "Failed to create subscription",
                    } satisfies ServiceError;
                }

                return {
                    subscriptionId: subscription.id,
                }
            } catch (e) {
                logger.error(e);
                return {
                    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                    errorCode: ErrorCode.STRIPE_CHECKOUT_ERROR,
                    message: "Failed to create subscription",
                } satisfies ServiceError;
            }
        }, /* minRequiredRole = */ OrgRole.OWNER)
    ));

export const createStripeCheckoutSession = async (domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            if (!org.stripeCustomerId) {
                return notFound();
            }

            if (!stripeClient) {
                return stripeClientNotInitialized();
            }

            const orgMembers = await prisma.userToOrg.findMany({
                where: {
                    orgId: org.id,
                },
                select: {
                    userId: true,
                }
            });
            const numOrgMembers = orgMembers.length;

            const origin = (await headers()).get('origin')!;
            const prices = await stripeClient.prices.list({
                product: env.STRIPE_PRODUCT_ID,
                expand: ['data.product'],
            });

            const stripeSession = await stripeClient.checkout.sessions.create({
                customer: org.stripeCustomerId as string,
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: prices.data[0].id,
                        quantity: numOrgMembers
                    }
                ],
                mode: 'subscription',
                payment_method_collection: 'always',
                success_url: `${origin}/${domain}/settings/billing`,
                cancel_url: `${origin}/${domain}`,
            });

            if (!stripeSession.url) {
                return {
                    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                    errorCode: ErrorCode.STRIPE_CHECKOUT_ERROR,
                    message: "Failed to create checkout session",
                } satisfies ServiceError;
            }

            return {
                url: stripeSession.url,
            }
        })
    ));

export const getCustomerPortalSessionLink = async (domain: string): Promise<string | ServiceError> => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            if (!org.stripeCustomerId) {
                return notFound();
            }

            if (!stripeClient) {
                return stripeClientNotInitialized();
            }

            const origin = (await headers()).get('origin')!;
            const portalSession = await stripeClient.billingPortal.sessions.create({
                customer: org.stripeCustomerId as string,
                return_url: `${origin}/${domain}/settings/billing`,
            });

            return portalSession.url;
        }, /* minRequiredRole = */ OrgRole.OWNER)
    ));

export const getSubscriptionBillingEmail = async (domain: string): Promise<string | ServiceError> => sew(() =>
    withAuth(async (userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            if (!org.stripeCustomerId) {
                return notFound();
            }

            if (!stripeClient) {
                return stripeClientNotInitialized();
            }

            const customer = await stripeClient.customers.retrieve(org.stripeCustomerId);
            if (!('email' in customer) || customer.deleted) {
                return notFound();
            }
            return customer.email!;
        })
    ));

export const changeSubscriptionBillingEmail = async (domain: string, newEmail: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            if (!org.stripeCustomerId) {
                return notFound();
            }

            if (!stripeClient) {
                return stripeClientNotInitialized();
            }

            await stripeClient.customers.update(org.stripeCustomerId, {
                email: newEmail,
            });

            return {
                success: true,
            }
        }, /* minRequiredRole = */ OrgRole.OWNER)
    ));

export const getSubscriptionInfo = async (domain: string) => sew(() =>
    withAuth(async (userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const subscription = await getSubscriptionForOrg(org.id, prisma);

            if (isServiceError(subscription)) {
                return subscription;
            }

            return {
                status: subscription.status,
                plan: "Team",
                seats: subscription.items.data[0].quantity!,
                perSeatPrice: subscription.items.data[0].price.unit_amount! / 100,
                nextBillingDate: subscription.current_period_end!,
            }
        })
    ));

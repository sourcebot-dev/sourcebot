import 'server-only';
import { env } from '@/env.mjs'
import Stripe from "stripe";
import { hasEntitlement } from '@sourcebot/shared';

export const IS_BILLING_ENABLED = hasEntitlement('billing') && env.STRIPE_SECRET_KEY !== undefined;

export const stripeClient =
  IS_BILLING_ENABLED
    ? new Stripe(env.STRIPE_SECRET_KEY!)
    : undefined;
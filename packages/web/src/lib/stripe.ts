import 'server-only';
import { env } from '@/env.mjs'
import Stripe from "stripe";

export const IS_BILLING_ENABLED = env.STRIPE_SECRET_KEY !== undefined;

export const stripeClient =
  IS_BILLING_ENABLED
    ? new Stripe(env.STRIPE_SECRET_KEY!)
    : undefined;
import 'server-only';

import Stripe from 'stripe'
import { STRIPE_SECRET_KEY } from './environment'

let stripeInstance: Stripe | null = null;
export const getStripe = () => {
    if (!stripeInstance) {
        stripeInstance = new Stripe(STRIPE_SECRET_KEY!);
    }
    return stripeInstance;
}
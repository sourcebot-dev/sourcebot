import 'server-only';

import Stripe from 'stripe'
import { STRIPE_SECRET_KEY } from './environment'

export const stripe = new Stripe(STRIPE_SECRET_KEY!)
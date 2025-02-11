'use server'

import { CheckoutButton } from "./checkoutButton"

export default async function BillingPage() {
    return (
        <div>
            <h1>Billing</h1>
            <CheckoutButton />
        </div>
    );
}
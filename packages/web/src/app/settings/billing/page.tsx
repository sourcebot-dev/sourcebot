'use server'

import { ManageSubscriptionButton } from "./manageSubscriptionButton"

export default async function BillingPage() {
    return (
        <div>
            <h1>Billing</h1>
            <ManageSubscriptionButton />
        </div>
    );
}
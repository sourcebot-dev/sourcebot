import { ErrorPage } from "../components/errorPage";
import { auth } from "@/auth";
import { getUser } from "@/data/user";
import { createOrg, switchActiveOrg, fetchStripeSession } from "../../../actions";
import { isServiceError } from "@/lib/utils";
import { redirect } from 'next/navigation';

interface OnboardCompleteProps {
    searchParams?: {
        session_id?: string;
        org_name?: string;
        org_domain?: string;
    };
}

export default async function OnboardComplete({ searchParams }: OnboardCompleteProps) {
    const sessionId = searchParams?.session_id;
    const orgName = searchParams?.org_name;
    const orgDomain = searchParams?.org_domain;
    
    const session = await auth();
    let user = undefined;
    if (!session) {
        return null;
    }
    
    user = await getUser(session.user.id);
    if (!user) {
        return null;
    }

    if (!sessionId || !orgName || !orgDomain) {
        console.error("Missing required parameters");
        return <ErrorPage />;
    }

    const stripeSession = await fetchStripeSession(sessionId);
    if(stripeSession.payment_status !== "paid") {
        console.error("Invalid stripe session");
        return <ErrorPage />;
    }

    const stripeCustomerId = stripeSession.customer as string;
    const res = await createOrg(orgName, orgDomain, stripeCustomerId);
    if (isServiceError(res)) {
        console.error("Failed to create org");
        return <ErrorPage />;
    }

    const orgSwitchRes = await switchActiveOrg(res.id);
    if (isServiceError(orgSwitchRes)) {
        console.error("Failed to switch active org");
        return <ErrorPage />;
    }

    redirect("/");
}
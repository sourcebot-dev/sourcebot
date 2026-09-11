import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { VerifyForm } from "./verifyForm";
import { normalizeCallbackUrl } from "@/lib/authRedirect";

interface VerifyPageProps {
    searchParams: Promise<{
        callbackUrl?: string;
    }>;
}

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
    const { callbackUrl: rawCallbackUrl } = await searchParams;
    const callbackUrl = normalizeCallbackUrl(rawCallbackUrl);
    const session = await auth();
    if (session) {
        return redirect(callbackUrl);
    }

    return <VerifyForm />;
}

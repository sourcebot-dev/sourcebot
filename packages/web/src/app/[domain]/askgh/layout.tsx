import { redirect } from "next/navigation";
import { env } from "@sourcebot/shared";

export default function AskGHLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: { domain: string };
}) {
    if (env.EXPERIMENT_ASK_GH_ENABLED !== 'true') {
        redirect(`/${params.domain}`);
    }

    return <>{children}</>;
}

import { redirect } from "next/navigation";
import { env } from "@sourcebot/shared";

export default async function AskGHLayout(props: {
    children: React.ReactNode;
    params: Promise<{ domain: string }>;
}) {
    const params = await props.params;
    if (env.EXPERIMENT_ASK_GH_ENABLED !== 'true') {
        redirect(`/${params.domain}`);
    }

    return <>{props.children}</>;
}

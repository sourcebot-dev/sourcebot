'use client';

import { useRouter } from "next/navigation";
import {
    GitHubConnectionCreationForm,
    GitLabConnectionCreationForm,
    GiteaConnectionCreationForm,
    GerritConnectionCreationForm,
    BitbucketCloudConnectionCreationForm,
    BitbucketDataCenterConnectionCreationForm
} from "@/app/[domain]/components/connectionCreationForms";
import { useCallback, use } from "react";
import { useDomain } from "@/hooks/useDomain";

export default function NewConnectionPage(props: { params: Promise<{ type: string }> }) {
    const params = use(props.params);
    const { type } = params;
    const router = useRouter();
    const domain = useDomain();

    const onCreated = useCallback(() => {
        router.push(`/${domain}/connections`);
    }, [domain, router]);

    if (type === 'github') {
        return <GitHubConnectionCreationForm onCreated={onCreated} />;
    }

    if (type === 'gitlab') {
        return <GitLabConnectionCreationForm onCreated={onCreated} />;
    }

    if (type === 'gitea') {
        return <GiteaConnectionCreationForm onCreated={onCreated} />;
    }

    if (type === 'gerrit') {
        return <GerritConnectionCreationForm onCreated={onCreated} />;
    }

    if (type === 'bitbucket-cloud') {
        return <BitbucketCloudConnectionCreationForm onCreated={onCreated} />;
    }

    if (type === 'bitbucket-server') {
        return <BitbucketDataCenterConnectionCreationForm onCreated={onCreated} />;
    }


    router.push(`/${domain}/connections`);
}

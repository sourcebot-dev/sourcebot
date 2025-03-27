import { env } from "@/env.mjs";

interface ZoektRequest {
    path: string,
    body: string,
    method: string,
    header?: Record<string, string>,
    cache?: RequestCache,
}

export const zoektFetch = async ({
    path,
    body,
    method,
    header,
    cache,
}: ZoektRequest) => {
    const response = await fetch(
        new URL(path, env.ZOEKT_WEBSERVER_URL),
        {
            method,
            headers: {
                ...header,
                "Content-Type": "application/json",
            },
            body,
            cache,
        }
    );

    // @todo : add metrics

    return response;
}
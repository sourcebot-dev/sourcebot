import { ZOEKT_WEBSERVER_URL } from "../environment"


interface ZoektRequest {
    path: string,
    body: string,
    method: string,
    cache?: RequestCache,
}

export const zoektFetch = async ({
    path,
    body,
    method,
    cache,
}: ZoektRequest) => {
    const response = await fetch(
        new URL(path, ZOEKT_WEBSERVER_URL),
        {
            method,
            headers: {
                "Content-Type": "application/json",
            },
            body,
            cache,
        }
    );

    // @todo : add metrics

    return response;
}
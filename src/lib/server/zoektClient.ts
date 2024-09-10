import { ZOEKT_WEBSERVER_URL } from "../environment"


interface ZoektRequest {
    path: string,
    body: string,
    method: string,
}

export const zoektFetch = async ({
    path,
    body,
    method,
}: ZoektRequest) => {
    const start = Date.now();

    const response = await fetch(
        new URL(path, ZOEKT_WEBSERVER_URL),
        {
            method,
            headers: {
                "Content-Type": "application/json",
            },
            body,
        }
    );

    const duration = Date.now() - start;
    console.log(`[zoektClient] ${method} ${path} ${response.status} ${duration}ms`);
    // @todo : add metrics

    return response;
}
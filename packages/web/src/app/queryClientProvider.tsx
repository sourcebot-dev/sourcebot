'use client';

import * as React from "react"
import { isServer, QueryClient, QueryClientProvider as QueryClientProviderBase, QueryClientProviderProps } from "@tanstack/react-query"

const makeQueryClient = () => {
    return new QueryClient();
}

let browserQueryClient: QueryClient | undefined = undefined;

/**
 * On the server, always create a fresh QueryClient so it lives and dies with
 * the request. A module-scoped client is rooted for the process lifetime and
 * every SSR render deposits query state into it — with request-derived query
 * keys (repos, file paths, searches) that cache only ever grows, and queries
 * never become inactive server-side (unmount/unsubscribe don't run during
 * SSR), so nothing is ever evicted. In production this retained whole render
 * graphs at ~400 MiB/h until the container was OOM-adjacent and liveness
 * probes killed it.
 *
 * In the browser a singleton is correct (one user, unmounts run, gcTime
 * evicts) and deliberately NOT stored in React state, so the client survives
 * React suspending during the initial render.
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
 */
const getQueryClient = () => {
    if (isServer) {
        return makeQueryClient();
    }

    if (!browserQueryClient) {
        browserQueryClient = makeQueryClient();
    }
    return browserQueryClient;
}

export const QueryClientProvider = ({ children, ...props }: Omit<QueryClientProviderProps, 'client'>) => {
    const queryClient = getQueryClient();

    return (
        <QueryClientProviderBase client={queryClient} {...props}>
            {children}
        </QueryClientProviderBase>
    )
}

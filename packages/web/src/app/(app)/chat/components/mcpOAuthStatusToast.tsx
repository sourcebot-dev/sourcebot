'use client';

import { useToast } from "@/components/hooks/use-toast";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export function McpOAuthStatusToast() {
    const didHandleStatusRef = useRef(false);
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    useEffect(() => {
        if (didHandleStatusRef.current) {
            return;
        }

        const status = searchParams.get('status');
        if (status !== 'connected' && status !== 'error') {
            return;
        }

        didHandleStatusRef.current = true;
        const server = searchParams.get('server');
        const message = searchParams.get('message');

        if (status === 'connected') {
            toast({ description: `Successfully connected${server ? ` to ${server}` : ''}.` });
        } else {
            toast({
                title: "Connection failed",
                description: message ?? 'Failed to connect MCP server.',
                variant: "destructive",
            });
        }

        const nextSearchParams = new URLSearchParams(searchParams.toString());
        nextSearchParams.delete('status');
        nextSearchParams.delete('server');
        nextSearchParams.delete('message');

        const query = nextSearchParams.toString();
        router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
    }, [pathname, router, searchParams, toast]);

    return null;
}

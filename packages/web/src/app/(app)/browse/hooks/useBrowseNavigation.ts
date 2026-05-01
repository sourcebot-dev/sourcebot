'use client';

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { getBrowsePath, BrowseProps } from "./utils";

export const useBrowseNavigation = () => {
    const router = useRouter();

    const navigateToPath = useCallback((props: BrowseProps) => {
        const browsePath = getBrowsePath({
            ...props,
            revisionName: props.revisionName ?? 'HEAD',
        });

        router.push(browsePath);
    }, [router]);

    return {
        navigateToPath,
    };
};
'use client';

import { trackRepoVisit } from "@/app/(app)/browse/actions";
import { isServiceError } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface TrackRepoVisitProps {
    repoName: string;
    isAuthenticated: boolean;
}

export function TrackRepoVisit({ repoName, isAuthenticated }: TrackRepoVisitProps) {
    const router = useRouter();
    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        trackRepoVisit({ repoName }).then((result) => {
            if (!isServiceError(result) && result.wasPromoted) {
                router.refresh();
            }
        });
    }, [repoName, router, isAuthenticated]);

    return null;
}

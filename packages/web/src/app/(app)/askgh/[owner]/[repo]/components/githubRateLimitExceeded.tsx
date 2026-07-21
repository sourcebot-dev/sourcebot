'use client';

import { Button } from "@/components/ui/button";
import { Clock3 } from "lucide-react";
import { useRouter } from "next/navigation";

export function GitHubRateLimitExceeded() {
    const router = useRouter();

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <Clock3 className="w-12 h-12 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">
                GitHub is temporarily busy
            </h2>
            <p className="text-muted-foreground text-center max-w-md">
                GitHub is receiving too many requests right now. Please wait a few minutes, then try again.
            </p>
            <Button
                className="mt-6"
                variant="outline"
                onClick={() => router.refresh()}
            >
                Try again
            </Button>
        </div>
    );
}

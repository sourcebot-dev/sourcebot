import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
    owner: string;
    repo: string;
}

export function RepoNotFound({ owner, repo }: Props) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <FileQuestion className="w-12 h-12 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">
                Repository not found
            </h2>
            <p className="text-muted-foreground text-center max-w-md">
                We couldn&apos;t find{" "}
                <span className="font-medium text-foreground">{owner}/{repo}</span>{" "}
                on GitHub. It may not exist, or it might be private.
            </p>
            <Link
                href="/"
                className={cn(buttonVariants({ variant: "outline" }), "mt-6")}
            >
                Go back home
            </Link>
        </div>
    );
}

import { formatDistanceToNow } from "date-fns";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/userAvatar";
import type { Commit } from "@/features/git";

interface CommitHeaderProps {
    commit: Commit;
}

export const CommitHeader = ({ commit }: CommitHeaderProps) => {
    const shortSha = commit.hash.slice(0, 7);
    const relativeDate = formatDistanceToNow(new Date(commit.date), { addSuffix: true });

    return (
        <div className="flex flex-row py-1 px-2 items-center justify-between gap-4 min-w-0">
            <div className="flex flex-row items-center gap-2 min-w-0 overflow-hidden">
                <UserAvatar
                    email={commit.authorEmail}
                    className="h-5 w-5 flex-shrink-0"
                />
                <span className="text-sm font-medium flex-shrink-0" title={commit.authorEmail}>
                    {commit.authorName}
                </span>
                <span className="text-sm text-muted-foreground truncate" title={commit.message}>
                    {commit.message}
                </span>
            </div>
            <div className="flex flex-row items-center gap-3 flex-shrink-0">
                <div className="flex flex-row items-center gap-1.5">
                    <span className="text-sm font-mono text-muted-foreground" title={commit.hash}>
                        {shortSha}
                    </span>
                    <span className="text-sm text-muted-foreground">·</span>
                    <span className="text-sm text-muted-foreground" title={commit.date}>
                        {relativeDate}
                    </span>
                </div>
                <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5">
                    <History className="h-4 w-4" />
                    <span className="text-sm">History</span>
                </Button>
            </div>
        </div>
    );
};

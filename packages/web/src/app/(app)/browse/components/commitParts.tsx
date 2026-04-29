import type { ReactNode } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/userAvatar";
import { cn } from "@/lib/utils";
import type { Author } from "./commitAuthors";

interface AuthorsAvatarGroupProps {
    authors: Author[];
    className?: string;
}

export const AuthorsAvatarGroup = ({ authors, className }: AuthorsAvatarGroupProps) => {
    const displayed = authors.slice(0, 2);
    const overflow = Math.max(0, authors.length - 2);

    return (
        <AvatarGroup className={cn("flex-shrink-0", className)}>
            {displayed.map((a) => (
                <UserAvatar
                    key={a.email}
                    email={a.email}
                    title={a.email}
                    className="h-5 w-5"
                />
            ))}
            {overflow > 0 && (
                <AvatarGroupCount className="size-5 text-xs">
                    +{overflow}
                </AvatarGroupCount>
            )}
        </AvatarGroup>
    );
};

interface CommitBodyToggleProps {
    pressed: boolean;
    onPressedChange: (pressed: boolean) => void;
}

export const CommitBodyToggle = ({ pressed, onPressedChange }: CommitBodyToggleProps) => (
    <Tooltip>
        <TooltipTrigger asChild>
            <Toggle
                pressed={pressed}
                onPressedChange={onPressedChange}
                aria-label="Open commit details"
            >
                <MoreHorizontal />
            </Toggle>
        </TooltipTrigger>
        <TooltipContent>Open commit details</TooltipContent>
    </Tooltip>
);

interface CommitBodyProps {
    body: string;
    className?: string;
}

export const CommitBody = ({ body, className }: CommitBodyProps) => (
    <div className={cn("px-3 py-2 bg-muted/30", className)}>
        <pre className="text-sm font-mono text-foreground whitespace-pre-wrap break-words">
            {body.trim()}
        </pre>
    </div>
);

interface CommitActionLinkProps {
    href: string;
    label: string;
    icon: ReactNode;
}

export const CommitActionLink = ({ href, label, icon }: CommitActionLinkProps) => (
    <Tooltip>
        <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="sm" className="h-6 w-6 text-muted-foreground">
                <Link href={href} aria-label={label}>
                    {icon}
                </Link>
            </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
    </Tooltip>
);

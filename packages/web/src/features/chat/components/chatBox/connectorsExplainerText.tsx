import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// TODO(ask): finalize the connectors docs URL once the page exists.
export const CONNECTORS_DOCS_URL = "https://docs.sourcebot.dev/docs/features/ask/connectors";

interface ConnectorsExplainerTextProps {
    /** Rendered inline before the shared description sentence. */
    leading?: ReactNode;
    /** Rendered inline after the shared description sentence, before "Learn more". */
    trailing?: ReactNode;
    className?: string;
}

/**
 * Shared connectors explainer copy. Intentionally NOT in ee/ so the free-plan
 * teaser and the licensed connectors menu can both render the same description
 * without the free path importing ee/ feature code.
 */
export const ConnectorsExplainerText = ({ leading, trailing, className }: ConnectorsExplainerTextProps) => {
    return (
        <p className={cn("px-2 pb-1.5 text-xs text-muted-foreground", className)}>
            {leading}
            Connect external tools like Linear or Jira so the agent can pull in context beyond your code.{" "}
            {trailing ? <>{trailing}{" "}</> : null}
            <a href={CONNECTORS_DOCS_URL} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">Learn more</a>
        </p>
    );
};

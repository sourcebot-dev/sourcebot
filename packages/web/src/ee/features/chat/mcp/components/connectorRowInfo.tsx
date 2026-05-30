import { McpFavicon } from "./mcpFavicon";
import { cn } from "@/lib/utils";

export function getDisplayServerUrl(serverUrl: string) {
    try {
        const url = new URL(serverUrl);
        return `${url.host}${url.pathname}${url.search}`.replace(/\/$/, "");
    } catch {
        return serverUrl;
    }
}

interface ConnectorRowInfoProps {
    faviconUrl: string | undefined;
    name: string;
    serverUrl: string;
    children?: React.ReactNode;
    size?: 'sm' | 'default';
}

export function ConnectorRowInfo({ faviconUrl, name, serverUrl, children, size = 'default' }: ConnectorRowInfoProps) {
    return (
        <>
            <div className={cn(
                "flex shrink-0 items-center justify-center rounded-lg",
                size === 'sm' ? "h-8 w-8 bg-muted/60" : "h-10 w-10 bg-muted"
            )}>
                <McpFavicon faviconUrl={faviconUrl} className={size === 'sm' ? "h-4.5 w-4.5" : "h-5 w-5"} />
            </div>
            <div className="min-w-0 flex-1">
                <p className={cn("font-medium truncate", size === 'sm' && "text-sm")}>
                    {name || serverUrl}
                </p>
                <p className={cn("text-muted-foreground truncate", size === 'sm' ? "text-xs" : "text-sm")}>
                    {getDisplayServerUrl(serverUrl)}
                </p>
                {children}
            </div>
        </>
    );
}

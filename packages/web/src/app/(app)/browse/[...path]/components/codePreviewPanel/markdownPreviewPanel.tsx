import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownPreviewPanelProps {
    source: string;
}

export const MarkdownPreviewPanel = ({ source }: MarkdownPreviewPanelProps) => {
    return (
        <ScrollArea className="h-full w-full">
            <article
                className={cn(
                    "prose prose-sm dark:prose-invert max-w-none px-6 py-5",
                    "prose-p:text-foreground prose-li:text-foreground prose-headings:text-foreground",
                    "prose-headings:mt-6 prose-p:my-3 prose-img:rounded-md prose-img:my-4 prose-hr:my-6",
                    "prose-headings:font-semibold prose-li:marker:text-foreground",
                    "prose-a:text-link prose-a:no-underline hover:prose-a:underline",
                    "prose-code:before:content-none prose-code:after:content-none",
                    "prose-code:bg-muted prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs",
                    "prose-pre:bg-muted prose-pre:text-foreground prose-pre:leading-snug",
                    "[&>*:first-child]:mt-0"
                )}
            >
                <Markdown remarkPlugins={[remarkGfm]}>
                    {source}
                </Markdown>
            </article>
        </ScrollArea>
    );
}

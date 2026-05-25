"use client";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ChangelogEntryDto } from "@/features/changelog/listEntriesApi";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { compareVersions, parseVersion, SOURCEBOT_VERSION } from "@sourcebot/shared/client";

const VIDEO_EXTENSIONS_RE = /\.(mp4|webm|ogg|mov)$/i;
const ABSOLUTE_URL_RE = /^(?:[a-z][a-z0-9+\-.]*:|\/\/|#)/i;

// Allow <video> + the attributes we'll set on it. rehypeSanitize otherwise strips them.
const SANITIZE_SCHEMA = {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames ?? []), "video", "source"],
    attributes: {
        ...defaultSchema.attributes,
        video: ["src", "controls", "poster", "width", "height", "className", "preload", "loop", "muted", "playsInline"],
        source: ["src", "type"],
    },
};

const buildUrlTransform = (entriesBaseUrl: string) => (url: string): string => {
    if (ABSOLUTE_URL_RE.test(url)) {
        return url;
    }
    try {
        return new URL(url, entriesBaseUrl).toString();
    } catch {
        return url;
    }
};

interface ZoomableImageProps {
    src: string;
    alt?: string | undefined;
}

const ZoomableImage = ({ src, alt }: ZoomableImageProps) => {
    const [zoomed, setZoomed] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Portal target is only available after mount.
    useEffect(() => {
        setMounted(true);
    }, []);

    // Intercept Escape during zoom so the changelog dialog doesn't close along with the zoom.
    useEffect(() => {
        if (!zoomed) {
            return;
        }
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                setZoomed(false);
            }
        };
        document.addEventListener("keydown", handleKey, true);
        return () => document.removeEventListener("keydown", handleKey, true);
    }, [zoomed]);

    const overlay = (
        <div
            className={cn(
                "fixed inset-0 z-[100] flex items-center justify-center bg-black/80 transition-opacity duration-200",
                zoomed ? "opacity-100 pointer-events-auto cursor-zoom-out" : "opacity-0 pointer-events-none"
            )}
            onClick={() => setZoomed(false)}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt={alt}
                className={cn(
                    "max-w-[90vw] max-h-[90vh] object-contain rounded-lg transition-transform duration-200",
                    zoomed ? "scale-100" : "scale-95"
                )}
            />
        </div>
    );

    return (
        <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt={alt}
                className="cursor-zoom-in"
                onClick={() => setZoomed(true)}
            />
            {mounted && createPortal(overlay, document.body)}
        </>
    );
};

interface ChangelogEntryDialogProps {
    entry: ChangelogEntryDto | null;
    entriesBaseUrl: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ChangelogEntryDialog({ entry, entriesBaseUrl, open, onOpenChange }: ChangelogEntryDialogProps) {
    const urlTransform = useMemo(() => buildUrlTransform(entriesBaseUrl), [entriesBaseUrl]);

    const upgradeAvailable = useMemo(() => {
        if (!entry) {
            return false;
        }
        const entryVersion = parseVersion(entry.version);
        const currentVersion = parseVersion(SOURCEBOT_VERSION);
        if (!entryVersion || !currentVersion) {
            return false;
        }
        return compareVersions(entryVersion, currentVersion) > 0;
    }, [entry]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0 focus:outline-none">
                {entry && (
                    <>
                        <DialogHeader className="px-6 pt-4 pb-4 border-b space-y-1">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{format(new Date(entry.publishedAt), "MMM d")}</span>
                                {upgradeAvailable && (
                                    <>
                                        <span>·</span>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <a
                                                    href={`https://github.com/sourcebot-dev/sourcebot/releases/tag/${entry.version}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30 gap-0.5">
                                                        Upgrade
                                                        <ArrowUpRight className="h-3 w-3" />
                                                    </Badge>
                                                </a>
                                            </TooltipTrigger>
                                            <TooltipPrimitive.Portal>
                                                <TooltipContent side="bottom">
                                                    This update requires <span className="font-mono">{entry.version}</span>. Your instance is on <span className="font-mono">{SOURCEBOT_VERSION}</span>.
                                                </TooltipContent>
                                            </TooltipPrimitive.Portal>
                                        </Tooltip>
                                    </>
                                )}
                            </div>
                            <DialogTitle className="sr-only">{entry.title}</DialogTitle>
                        </DialogHeader>
                        <div className="overflow-y-auto px-6 py-5">
                            <div
                                className={cn(
                                    "prose dark:prose-invert max-w-none",
                                    "prose-p:text-foreground prose-li:text-foreground prose-headings:text-foreground",
                                    "prose-headings:mt-6 prose-p:my-3 prose-img:rounded-md prose-img:my-4 prose-hr:my-6",
                                    "prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base",
                                    "prose-headings:font-semibold",
                                    "prose-p:text-sm prose-li:text-sm",
                                    "prose-p:leading-normal prose-li:leading-normal",
                                    "prose-li:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:marker:text-foreground",
                                    "prose-a:text-link prose-a:no-underline hover:prose-a:underline",
                                    "prose-blockquote:not-italic prose-blockquote:font-normal",
                                    "prose-code:before:content-none prose-code:after:content-none prose-code:font-normal",
                                    "prose-code:bg-muted prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs",
                                    "prose-pre:bg-muted prose-pre:text-foreground prose-pre:leading-snug",
                                    "[&_video]:rounded-md [&_video]:my-4 [&_video]:w-full",
                                    "[&>*:first-child]:mt-0"
                                )}
                            >
                                <Markdown
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeRaw, [rehypeSanitize, SANITIZE_SCHEMA]]}
                                    urlTransform={urlTransform}
                                    components={{
                                        img: ({ src, alt }) => {
                                            if (typeof src !== "string") {
                                                return null;
                                            }
                                            if (VIDEO_EXTENSIONS_RE.test(src)) {
                                                return <video src={src} controls className="aspect-video" />;
                                            }
                                            return <ZoomableImage src={src} alt={alt} />;
                                        },
                                    }}
                                >
                                    {entry.bodyMarkdown}
                                </Markdown>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

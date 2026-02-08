'use client';

import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "github-markdown-css/github-markdown.css";
import "highlight.js/styles/github-dark.css";
import rehypeRaw from "rehype-raw";

interface PureMarkDownPreviewPanelProps {
    source: string;
    repoName: string;
    revisionName: string;
}

export const PureMarkDownPreviewPanel = ({
    source,
    repoName,
    revisionName,
}: PureMarkDownPreviewPanelProps) => {
    const IMAGE_BASE_URL = "https://raw.githubusercontent.com/"+repoName.split("/").slice(1).join("/")+"/"+revisionName+"/";
    return (
        <ScrollArea className="h-full overflow-auto flex-1">
            <div className="w-full flex justify-center bg-white dark:bg-background">
                <article className="markdown-body dark dark:bg-background w-full max-w-4xl px-6 py-10">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw, rehypeHighlight]}
                        components={{
                            pre: ({ children }) => (
                                <pre className="rounded-md overflow-x-auto">
                                    {children}
                                </pre>
                            ),

                            source: ({ srcSet = "", ...props }) => {
                                if (typeof srcSet !== "string") return null;

                                let resolvedSrcset = srcSet;

                                if (
                                    srcSet.startsWith(".github/") ||
                                    !srcSet.startsWith("http")
                                ) {
                                    resolvedSrcset =
                                        IMAGE_BASE_URL +
                                        srcSet.replace(/^\.\//, "");
                                }

                                return (
                                    <source
                                        srcSet={resolvedSrcset}
                                        {...props}
                                    />
                                );
                            },

                            img: ({ src = "", alt, ...props }) => {
                                if (typeof src !== "string") return null;

                                let resolvedSrc = src;

                                if (
                                    src.startsWith(".github/") ||
                                    (!src.startsWith("http://") &&
                                        !src.startsWith("https://"))
                                ) {
                                    resolvedSrc =
                                        IMAGE_BASE_URL +
                                        src.replace(/^\.\//, "");
                                }

                                return (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={resolvedSrc}
                                        alt={alt || ""}
                                        className="max-w-full h-auto"
                                        loading="lazy"
                                        {...props}
                                    />
                                );
                            },

                            video: ({ src = "", ...props }) => {
                                return (
                                    <video
                                        src={src}
                                        controls
                                        preload="metadata"
                                        className="max-w-full h-auto my-4"
                                        {...props}
                                    >
                                        Your browser does not support the video
                                        tag.
                                    </video>
                                );
                            },

                            code({ className, children, ...props }) {
                                const isBlock =
                                    className?.startsWith("language-");

                                if (!isBlock) {
                                    return (
                                        <code
                                            className="px-1 py-0.5 rounded"
                                            {...props}
                                        >
                                            {children}
                                        </code>
                                    );
                                }

                                return (
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                );
                            },

                            table: ({ children }) => (
                                <div className="overflow-x-auto">
                                    <table>{children}</table>
                                </div>
                            ),

                            a: ({ children, href, ...props }) => {
                                // Check if link is a video URL
                                if (
                                    href &&
                                    href.match(
                                        /^https:\/\/github\.com\/user-attachments\/assets\/.+$/,
                                    )
                                ) {
                                    return (
                                        <video
                                            src={href}
                                            controls
                                            preload="metadata"
                                            className="max-w-full h-auto my-4"
                                        >
                                            Your browser does not support the
                                            video tag.
                                        </video>
                                    );
                                }

                                return (
                                    <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline"
                                        {...props}
                                    >
                                        {children}
                                    </a>
                                );
                            },
                        }}
                    >
                        {source}
                    </ReactMarkdown>
                </article>
            </div>
        </ScrollArea>
    );
}

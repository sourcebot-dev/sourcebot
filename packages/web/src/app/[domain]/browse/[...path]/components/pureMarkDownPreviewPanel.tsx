"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import { useTheme } from "next-themes";
import React, { useEffect } from "react";
import type { Components } from "react-markdown";
import type { Element, Text } from "hast";

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
    const { theme, resolvedTheme } = useTheme();
    const currentTheme = theme === "system" ? resolvedTheme : theme;

    /* ------------------ styles ------------------ */
    useEffect(() => {
        const isDark = currentTheme === "dark";

        document
            .querySelectorAll(
                "link[data-markdown-theme], link[data-highlight-theme]",
            )
            .forEach((el) => el.remove());

        const markdownLink = document.createElement("link");
        markdownLink.rel = "stylesheet";
        markdownLink.href = isDark
            ? "https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown-dark.min.css"
            : "https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown-light.min.css";
        markdownLink.setAttribute("data-markdown-theme", "true");
        document.head.appendChild(markdownLink);

        const highlightLink = document.createElement("link");
        highlightLink.rel = "stylesheet";
        highlightLink.href = isDark
            ? "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css"
            : "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css";
        highlightLink.setAttribute("data-highlight-theme", "true");
        document.head.appendChild(highlightLink);

        return () => {
            markdownLink.remove();
            highlightLink.remove();
        };
    }, [currentTheme]);

    /* ------------------ helpers ------------------ */
    const IMAGE_BASE_URL =
        "https://raw.githubusercontent.com/" +
        repoName.split("/").slice(1).join("/") +
        "/" +
        revisionName +
        "/";

    const resolveUrl = (url: string) => {
        if (url.startsWith("http://") || url.startsWith("https://")) return url;
        return IMAGE_BASE_URL + url.replace(/^\.\//, "");
    };

    const isVideoUrl = (url?: string | Blob | null): url is string =>
        typeof url === "string" &&
        /^https:\/\/github\.com\/user-attachments\/assets\/.+$/.test(
            url.trim(),
        );

    const Video = ({ src }: { src: string }) => (
        <video
            src={src}
            controls
            playsInline
            preload="metadata"
            className="max-w-full h-auto my-6 rounded-md"
        >
            Your browser does not support the video tag.
        </video>
    );

    /* ------------------ markdown components ------------------ */
    const components: Components = {
        /* -------- PICTURE (theme-aware) -------- */
        picture: ({ node }) => {
            const element = node as Element;

            return (
                <picture>
                    {element.children?.map((child, i) => {
                        if (child.type !== "element") return null;

                        const el = child as Element;

                        if (el.tagName === "source") {
                            const srcSet = el.properties?.srcSet as
                                | string
                                | undefined;
                            const media = el.properties?.media as
                                | string
                                | undefined;

                            if (media?.includes("prefers-color-scheme: dark")) {
                                if (currentTheme !== "dark") return null;
                            } else if (
                                media?.includes("prefers-color-scheme: light")
                            ) {
                                if (currentTheme === "dark") return null;
                            }

                            return (
                                <source
                                    key={i}
                                    media={media}
                                    srcSet={
                                        srcSet ? resolveUrl(srcSet) : undefined
                                    }
                                />
                            );
                        }

                        if (el.tagName === "img") {
                            return (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    key={i}
                                    src={resolveUrl(
                                        el.properties?.src as string,
                                    )}
                                    alt={(el.properties?.alt as string) ?? ""}
                                    height={el.properties?.height as number}
                                    className="max-w-full h-auto"
                                    loading="lazy"
                                />
                            );
                        }

                        return null;
                    })}
                </picture>
            );
        },

        /* -------- IMG (image or video) -------- */
        img: ({ src, alt }) => {
            if (!src || typeof src !== "string") return null;

            return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={resolveUrl(src)}
                    alt={alt ?? ""}
                    className="max-w-full h-auto"
                    loading="lazy"
                />
            );
        },

        /* -------- LINK (video or anchor) -------- */
        a: ({ href, children, node }) => {
            if (isVideoUrl(href)) {
                return <Video src={href.trim()} />;
            }

            const element = node as Element;
            if (element.children && element.children.length === 1) {
                const child = element.children[0];
                if (child.type === "text") {
                    const textNode = child as Text;
                    const textValue = textNode.value?.trim();
                    if (isVideoUrl(textValue)) {
                        return <Video src={textValue} />;
                    }
                }
            }

            return (
                <a
                    href={href ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                >
                    {children}
                </a>
            );
        },

        /* -------- PARAGRAPH (bare video URL) -------- */
        p: ({ node, children }) => {
            const element = node as Element;

            if (element.children && element.children.length === 1) {
                const child = element.children[0];

                if (child.type === "text") {
                    const textNode = child as Text;
                    const value = textNode.value?.trim();

                    if (isVideoUrl(value)) {
                        return <Video src={value} />;
                    }
                }
            }

            return <p>{children}</p>;
        },

        /* -------- RAW VIDEO TAG -------- */
        video: ({ src }) => {
            if (!src || typeof src !== "string") return null;
            return <Video src={src} />;
        },

        pre: ({ children }) => (
            <pre className="rounded-md overflow-x-auto">{children}</pre>
        ),

        code({ className, children, ...props }) {
            const isBlock = className?.startsWith("language-");

            if (!isBlock) {
                return (
                    <code className="px-1 py-0.5 rounded" {...props}>
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
    };

    /* ------------------ render ------------------ */
    return (
        <ScrollArea className="h-full overflow-auto flex-1">
            <div className="w-full flex justify-center bg-white dark:bg-background">
                <article className="markdown-body w-full max-w-4xl px-6 py-10 !bg-white dark:!bg-background">
                    <style jsx global>{`
                        .markdown-body {
                            background-color: transparent !important;
                        }

                        .markdown-body a > img {
                            display: inline-block;
                            vertical-align: middle;
                            margin-right: 4px;
                        }

                        .markdown-body a {
                            white-space: nowrap;
                        }

                        /* Force images to maintain theme background - comprehensive override */
                        .markdown-body img,
                        .markdown-body picture img,
                        .markdown-body p img,
                        .markdown-body a img,
                        article.markdown-body img,
                        article.markdown-body picture img {
                            background-color: transparent !important;
                            background: transparent !important;
                        }
                    `}</style>

                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw, rehypeHighlight]}
                        components={components}
                    >
                        {source}
                    </ReactMarkdown>
                </article>
            </div>
        </ScrollArea>
    );
};

"use client";

import { useEffect, useId, useRef, useState } from "react";
import Markdown from "react-markdown";
import { Button } from "@/components/ui/button";

const COLLAPSED_MESSAGE_HEIGHT = 120;

interface LoginMessageProps {
    message: string | null | undefined;
}

export function LoginMessage({ message }: LoginMessageProps) {
    if (!message?.trim()) {
        return null;
    }

    return <ExpandableLoginMessage key={message} message={message} />;
}

function ExpandableLoginMessage({ message }: { message: string }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const contentId = useId();

    useEffect(() => {
        const content = contentRef.current;
        if (!content) {
            return;
        }

        const measure = () => setIsOverflowing(content.scrollHeight > COLLAPSED_MESSAGE_HEIGHT);
        measure();
        const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
        observer?.observe(content);
        window.addEventListener('resize', measure);
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, []);

    return (
        <div className="w-full min-w-0 rounded-md bg-muted p-4 text-left">
            <div
                id={contentId}
                className="overflow-hidden"
                style={{ maxHeight: isExpanded ? undefined : COLLAPSED_MESSAGE_HEIGHT }}
                onFocusCapture={() => {
                    // Reveal clipped links when keyboard navigation reaches the message.
                    if (isOverflowing) {
                        setIsExpanded(true);
                    }
                }}
            >
                <div ref={contentRef} className="prose prose-sm dark:prose-invert max-w-none break-words text-foreground prose-headings:text-base prose-headings:font-medium prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-a:text-link prose-a:underline prose-pre:overflow-x-auto [&>:first-child]:mt-0 [&>:last-child]:mb-0">
                    <Markdown
                        skipHtml
                        allowedElements={['p', 'a', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'code', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr']}
                        components={{
                            a: ({ href, children }) => href ? (
                                <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                            ) : <span>{children}</span>,
                        }}
                    >
                        {message}
                    </Markdown>
                </div>
            </div>
            {isOverflowing && !isExpanded && (
                <div aria-hidden="true" className="text-sm text-muted-foreground">…</div>
            )}
            {isOverflowing && (
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="mt-2 h-auto p-0 text-link"
                    aria-expanded={isExpanded}
                    aria-controls={contentId}
                    onClick={() => setIsExpanded(expanded => !expanded)}
                >
                    {isExpanded ? 'Show less' : 'Show more'}
                </Button>
            )}
        </div>
    );
}

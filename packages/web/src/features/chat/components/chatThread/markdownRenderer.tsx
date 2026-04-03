'use client';

import { CodeSnippet } from '@/app/components/codeSnippet';
import { SearchQueryParams } from '@/lib/types';
import { cn, createPathWithQueryParams } from '@/lib/utils';
import type { Element, Root } from "hast";
import { Schema as SanitizeSchema } from 'hast-util-sanitize';
import { CopyIcon, ExternalLinkIcon, SearchIcon } from 'lucide-react';
import type { Heading, Nodes } from "mdast";
import { findAndReplace } from 'mdast-util-find-and-replace';
import { useRouter } from 'next/navigation';
import React, { useCallback, useMemo, forwardRef, memo } from 'react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import type { PluggableList, Plugin } from "unified";
import { visit } from 'unist-util-visit';
import { CodeBlock } from './codeBlock';
import { LinearIssueCard } from './linearIssueCard';
import { FILE_REFERENCE_REGEX } from '@/features/chat/constants';
import { createFileReference } from '@/features/chat/utils';
import { SINGLE_TENANT_ORG_DOMAIN } from '@/lib/constants';
import isEqual from "fast-deep-equal/react";

const LINEAR_ISSUE_URL_REGEX = /^https:\/\/linear\.app\/[^/]+\/issue\/([A-Z]+-\d+)\/([^/\s"]+)$/;

export const REFERENCE_PAYLOAD_ATTRIBUTE = 'data-reference-payload';

const annotateCodeBlocks: Plugin<[], Root> = () => {
    return (tree: Root) => {
        visit(tree, 'element', (node, _index, parent) => {
            if (node.tagName !== 'code' || !parent || !('tagName' in parent)) {
                return;
            }

            if (parent.tagName === 'pre') {
                node.properties.isBlock = true;
                parent.properties.isBlock = true;
            } else {
                node.properties.isBlock = false;
            }
        })
    }
}

// @see: https://unifiedjs.com/learn/guide/create-a-remark-plugin/
function remarkReferencesPlugin() {
    return function (tree: Nodes) {
        findAndReplace(tree, [
            FILE_REFERENCE_REGEX,
            (_, repo: string, fileName: string, startLine?: string, endLine?: string) => {
                // Create display text
                let displayText = fileName.split('/').pop() ?? fileName;

                const fileReference = createFileReference({
                    repo: repo,
                    path: fileName,
                    startLine,
                    endLine,
                });

                if (fileReference.range) {
                    displayText += `:${fileReference.range.startLine}-${fileReference.range.endLine}`;
                }

                return {
                    type: 'html',
                    // @note: if you add additional attributes to this span, make sure to update the rehypeSanitize plugin to allow them.
                    //
                    // @note: we attach the reference id to the DOM element as a class name since there may be multiple reference elements
                    // with the same id (i.e., referencing the same file & range).
                    value: `<span
                        role="button"
                        class="${fileReference.id}"
                        className="font-mono cursor-pointer text-xs px-1 py-[1.5px] rounded-md transition-all duration-150 bg-chat-citation"
                        title="Click to navigate to code"
                        ${REFERENCE_PAYLOAD_ATTRIBUTE}="${encodeURIComponent(JSON.stringify(fileReference))}"
                    >${displayText}</span>`
                }
            }
        ])
    }
}

/**
 * A remark plugin that converts `html` MDAST nodes into `text` nodes,
 * preserving angle-bracketed content like `<id>` as visible text. Without this,
 * `<id>` is parsed as an HTML tag and then stripped by sanitization.
 *
 * This plugin must run BEFORE remarkReferencesPlugin so that the file-reference
 * HTML nodes created by that plugin are left intact for rehypeRaw to process.
 */
function remarkPreserveHtml() {
    return function (tree: Nodes) {
        visit(tree, 'html', (node, index, parent) => {
            if (index !== undefined && parent && 'children' in parent) {
                (parent.children as Nodes[])[index] = {
                    type: 'text',
                    value: (node as { value: string }).value,
                };
            }
        });
    };
}

const remarkTocExtractor = () => {
    return function (tree: Nodes) {
        visit(tree, 'heading', (node: Heading) => {
            const textContent = node.children
                .filter((child) => child.type === 'text')
                .map((child) => child.value)
                .join('');

            const id = textContent.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');

            // Add id to the heading node for linking
            node.data = node.data || {};
            node.data.hProperties = node.data.hProperties || {};
            node.data.hProperties.id = id;
        });
    };
}

interface MarkdownRendererProps {
    content: string;
    className?: string;
    /**
     * When true, angle-bracketed text like `<id>` is preserved as visible text
     * instead of being parsed as HTML. File references (@file:{...}) are unaffected.
     */
    escapeHtml?: boolean;
}

const MarkdownRendererComponent = forwardRef<HTMLDivElement, MarkdownRendererProps>(({ content, className, escapeHtml = false }, ref) => {
    const router = useRouter();

    const remarkPlugins = useMemo((): PluggableList => {
        return [
            remarkGfm,
            ...(escapeHtml ? [remarkPreserveHtml] : []),
            remarkReferencesPlugin,
            remarkTocExtractor,
        ];
    }, [escapeHtml]);

    const rehypePlugins = useMemo((): PluggableList => {
        return [
            rehypeRaw,
            [
                rehypeSanitize,
                {
                    ...defaultSchema,
                    attributes: {
                        ...defaultSchema.attributes,
                        span: [...(defaultSchema.attributes?.span ?? []), 'role', 'className', 'data*'],
                    },
                    strip: [],
                } satisfies SanitizeSchema,
            ],
            annotateCodeBlocks,
        ];
    }, []);

    const renderPre = useCallback(({ children, node, ...rest }: React.JSX.IntrinsicElements['pre'] & { node?: Element }) => {
        if (node?.properties && node.properties.isBlock === true) {
            return children;
        }

        return (
            <pre {...rest}>
                {children}
            </pre>
        )
    }, []);

    const renderAnchor = useCallback(({ href, children, className: incomingClassName, ...rest }: React.JSX.IntrinsicElements['a']) => {
        if (href) {
            const match = LINEAR_ISSUE_URL_REGEX.exec(href);
            if (match) {
                const identifier = match[1];
                const titleSlug = match[2];
                const title = titleSlug.replace(/-/g, ' ');
                return <LinearIssueCard identifier={identifier} title={title} href={href} />;
            }
        }
        return (
            <a
                {...rest}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(incomingClassName, "inline-flex items-center gap-0.5")}
            >
                {children}
                <ExternalLinkIcon className="inline w-3 h-3 mb-0.5 opacity-60" />
            </a>
        );
    }, []);

    const renderCode = useCallback(({ className, children, node, ...rest }: React.JSX.IntrinsicElements['code'] & { node?: Element }) => {
        const text = children?.toString().trimEnd() ?? '';

        if (node?.properties && node.properties.isBlock === true) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : undefined;

            return (
                <CodeBlock
                    code={text}
                    language={language}
                />
            )
        }

        return (
            <span className="group/code relative inline-block [text-decoration:inherit]">
                <CodeSnippet
                    className={className}
                    {...rest}
                >
                    {children}
                </CodeSnippet>
                <span className="absolute z-20 bottom-0 left-0 transform translate-y-full opacity-0 group-hover/code:opacity-100 hover:opacity-100 transition-all delay-300 duration-100 pointer-events-none group-hover/code:pointer-events-auto hover:pointer-events-auto block">
                    {/* Invisible bridge to prevent hover gap */}
                    <span className="absolute -top-2 left-0 right-0 h-2 block"></span>
                    <span className="bg-background border rounded-md p-0.5 flex gap-0.5">
                        <button
                            className="flex items-center justify-center w-5 h-5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors duration-150"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const url = createPathWithQueryParams(`/${SINGLE_TENANT_ORG_DOMAIN}/search`, [SearchQueryParams.query, `"${text}"`])
                                router.push(url);
                            }}
                            title="Search for snippet"
                        >
                            <SearchIcon className="w-3 h-3" />
                        </button>
                        <button
                            className="flex items-center justify-center w-5 h-5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors duration-150"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                navigator.clipboard.writeText(text);
                            }}
                            title="Copy snippet"
                        >
                            <CopyIcon className="w-3 h-3" />
                        </button>
                    </span>
                </span>
            </span>
        )

    }, [router]);

    return (
        <div
            ref={ref}
            className={cn("prose dark:prose-invert prose-p:text-foreground prose-li:text-foreground prose-li:marker:text-foreground prose-headings:mt-6 prose-ol:mt-3 prose-ul:mt-3 prose-p:mb-3 prose-code:before:content-none prose-code:after:content-none prose-hr:my-5 max-w-none [&>*:first-child]:mt-0", className)}
        >
            <Markdown
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={{
                    pre: renderPre,
                    code: renderCode,
                    a: renderAnchor,
                }}
            >
                {content}
            </Markdown>
        </div>
    );
});

MarkdownRendererComponent.displayName = 'MarkdownRenderer';

export const MarkdownRenderer = memo(MarkdownRendererComponent, isEqual);
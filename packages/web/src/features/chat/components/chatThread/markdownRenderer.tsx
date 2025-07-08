'use client';

import { CodeSnippet } from '@/app/components/codeSnippet';
import { useDomain } from '@/hooks/useDomain';
import { SearchQueryParams } from '@/lib/types';
import { cn, createPathWithQueryParams } from '@/lib/utils';
import type { Element, Root } from "hast";
import { Schema as SanitizeSchema } from 'hast-util-sanitize';
import { CopyIcon, SearchIcon } from 'lucide-react';
import type { Heading, Nodes } from "mdast";
import { findAndReplace } from 'mdast-util-find-and-replace';
import { useRouter } from 'next/navigation';
import React, { useCallback, useMemo } from 'react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import type { PluggableList, Plugin } from "unified";
import { visit } from 'unist-util-visit';
import { CodeBlock } from './codeBlock';


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
            /@file:\{([^:}]+)(?::(\d+)-(\d+))?\}/g,
            (_, fileName: string, startLine?: string, endLine?: string) => {
                // Create display text
                let displayText = fileName.split('/').pop() ?? fileName;
                if (startLine && endLine) {
                    displayText += `:${startLine}-${endLine}`;
                }

                return {
                    type: 'html',
                    // @note: if you add additional attributes to this span, make sure to update the rehypeSanitize plugin to allow them.
                    value: `<span role="link" className="font-mono cursor-pointer text-xs border px-1 py-[1.5px] rounded-md bg-fuchsia-100 hover:bg-fuchsia-200 transition-colors duration-150" title="Click to navigate to code">${displayText}</span>`
                }
            }
        ])
    }
}

const remarkTocExtractor = () => {
    return function (tree: Nodes) {
        visit(tree, 'heading', (node: Heading) => {
            const textContent = node.children
                .filter((child: any) => child.type === 'text')
                .map((child: any) => child.value)
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
    isStreaming: boolean;
    className?: string;
}

export const MarkdownRenderer = ({ content, isStreaming, className }: MarkdownRendererProps) => {
    const domain = useDomain();
    const router = useRouter();

    const remarkPlugins = useMemo((): PluggableList => {
        return [
            remarkGfm,
            remarkReferencesPlugin,
            remarkTocExtractor,
        ];
    }, []);

    const rehypePlugins = useMemo((): PluggableList => {
        return [
            rehypeRaw,
            [
                rehypeSanitize,
                {
                    ...defaultSchema,
                    attributes: {
                        ...defaultSchema.attributes,
                        span: [...(defaultSchema.attributes?.span ?? []), 'role', 'className'],
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

    const renderCode = useCallback(({ className, children, node, ...rest }: React.JSX.IntrinsicElements['code'] & { node?: Element }) => {
        const text = children?.toString().trimEnd() ?? '';

        if (node?.properties && node.properties.isBlock === true) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : undefined;
            const metadataString = node?.data?.meta;

            return (
                <CodeBlock
                    code={text}
                    isStreaming={isStreaming}
                    language={language}
                    metadataPayload={metadataString ?? undefined}
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
                                const url = createPathWithQueryParams(`/${domain}/search`, [SearchQueryParams.query, `"${text}"`])
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

    }, [isStreaming, domain, router]);


    return (
        <div
            className={cn("prose dark:prose-invert prose-p:text-foreground prose-li:text-foreground prose-li:marker:text-foreground prose-headings:mt-6 prose-ol:mt-3 prose-ul:mt-3 prose-p:mb-3 prose-code:before:content-none prose-code:after:content-none prose-hr:my-5 max-w-none [&>*:first-child]:mt-0", className)}
        >
            <Markdown
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={{
                    pre: renderPre,
                    code: renderCode,
                }}
            >
                {content}
            </Markdown>
        </div>
    );
};
'use client';

import { CodeSnippet } from '@/app/components/codeSnippet';
import { useDomain } from '@/hooks/useDomain';
import { SearchQueryParams } from '@/lib/types';
import { createPathWithQueryParams } from '@/lib/utils';
import { TextUIPart } from '@ai-sdk/ui-utils';
import type { Element, Root } from "hast";
import { CopyIcon, SearchIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Plugin } from "unified";
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

interface MarkdownUIPartProps {
    part: TextUIPart;
    isStreaming: boolean;
}

export const MarkdownUIPart = ({ part, isStreaming }: MarkdownUIPartProps) => {
    const domain = useDomain();
    const router = useRouter();

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
            className="prose dark:prose-invert prose-p:text-foreground prose-li:text-foreground prose-li:marker:text-foreground prose-headings:mt-6 prose-ol:mt-3 prose-ul:mt-3 prose-p:mb-3 prose-code:before:content-none prose-code:after:content-none prose-hr:my-5 max-w-none [&>*:first-child]:mt-0"
        >
            <Markdown
                remarkPlugins={[
                    remarkGfm,
                ]}
                rehypePlugins={[
                    annotateCodeBlocks,
                ]}
                components={{
                    pre: renderPre,
                    code: renderCode,
                }}
            >
                {part.text}
            </Markdown>
        </div>
    );
};
'use client';

import { VscodeFileIcon } from '@/app/components/vscodeFileIcon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { SymbolHoverPopup } from '@/ee/features/codeNav/components/symbolHoverPopup';
import { symbolHoverTargetsExtension } from '@/ee/features/codeNav/components/symbolHoverPopup/symbolHoverTargetsExtension';
import { SymbolDefinition } from '@/ee/features/codeNav/components/symbolHoverPopup/useHoveredOverSymbolInfo';
import { CodeBlockMetadata, codeBlockMetadataSchema } from '@/features/chat/constants';
import { CustomSlateEditor } from '@/features/chat/customSlateEditor';
import { ReadFilesToolRequest, ReadFilesToolResponse, SearchCodeToolRequest, SearchCodeToolResponse, toolNames } from '@/features/chat/tools';
import { CustomEditor } from '@/features/chat/types';
import { getAllMentionElements, resetEditor, toString } from '@/features/chat/utils';
import { useHasEntitlement } from '@/features/entitlements/useHasEntitlement';
import { useCodeMirrorLanguageExtension } from '@/hooks/useCodeMirrorLanguageExtension';
import { useCodeMirrorTheme } from '@/hooks/useCodeMirrorTheme';
import { useDomain } from '@/hooks/useDomain';
import { useFindLanguageDescription } from '@/hooks/useFindLanguageDescription';
import { useKeymapExtension } from '@/hooks/useKeymapExtension';
import { useThemeNormalized } from '@/hooks/useThemeNormalized';
import { lineOffsetExtension } from '@/lib/extensions/lineOffsetExtension';
import { SearchQueryParams } from '@/lib/types';
import { cn, createPathWithQueryParams, isServiceError } from '@/lib/utils';
import { Message, useChat } from '@ai-sdk/react';
import { CreateMessage, TextUIPart, ToolInvocationUIPart } from '@ai-sdk/ui-utils';
import { EditorView } from '@codemirror/view';
import { DoubleArrowDownIcon, DoubleArrowUpIcon, PlayIcon } from '@radix-ui/react-icons';
import { useDebounce, useIsClient } from "@uidotdev/usehooks";
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { UIMessage } from 'ai';
import type { Element, Root } from "hast";
import { ArrowDownIcon, ChevronDown, ChevronRight, CopyIcon, EyeIcon, Loader2, SearchIcon } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import React, { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Descendant } from 'slate';
import type { Plugin } from "unified";
import { visit } from 'unist-util-visit';
import { getBrowsePath, useBrowseNavigation } from '../../browse/hooks/useBrowseNavigation';
import { LightweightCodeHighlighter } from '../../components/lightweightCodeHighlighter';
import { TopBar } from '../../components/topBar';
import { ChatBox } from './chatBox';
import { ChatBoxTools } from './chatBoxTools';
import { ErrorBanner } from './errorBanner';
import { useRouter } from 'next/navigation';

type ChatHistoryState = {
    scrollOffset?: number;
}

export const Chat = ({
    id,
    initialMessages,
    inputMessage,
}: { id?: string | undefined; initialMessages?: Message[]; inputMessage?: CreateMessage } = {}) => {
    const {
        append,
        messages,
        error,
        status,
    } = useChat({
        id,
        initialMessages,
        sendExtraMessageFields: true,
        // @todo: make this dynamic based on the repo selector.
        body: {
            repos: [
                'github.com/sourcebot-dev/sourcebot',
            ]
        },
    });

    const domain = useDomain();
    const [isErrorBannerVisible, setIsErrorBannerVisible] = useState(false);
    const hasSubmittedInputMessage = useRef(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const latestMessageRef = useRef<HTMLDivElement>(null);
    const [scrollOffset, setScrollOffset] = useState(0);

    const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(false);
    const {
        scrollOffset: restoreScrollOffset,
    } = (history.state ?? {}) as ChatHistoryState;

    // Track scroll position changes.
    useEffect(() => {
        const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (!scrollElement) return;

        const handleScroll = () => {
            const scrollOffset = scrollElement.scrollTop;
            setScrollOffset(scrollOffset);

            const threshold = 50; // pixels from bottom to consider "at bottom"
            const { scrollHeight, clientHeight } = scrollElement;
            const isAtBottom = scrollHeight - scrollOffset - clientHeight <= threshold;
            setIsAutoScrollEnabled(isAtBottom);
        };

        scrollElement.addEventListener('scroll', handleScroll, { passive: true });

        return () => scrollElement.removeEventListener('scroll', handleScroll);
    }, []);

    // Debounce scroll position and save to history
    const debouncedScrollOffset = useDebounce(scrollOffset, 100);
    useEffect(() => {
        history.replaceState(
            {
                scrollOffset: debouncedScrollOffset,
            } satisfies ChatHistoryState,
            '',
            window.location.href
        );
    }, [debouncedScrollOffset]);

    // // Restore scroll offset on mount.
    useEffect(() => {
        const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (
            !scrollElement ||
            restoreScrollOffset === undefined
        ) {
            return;
        }

        scrollElement.scrollTo({
            top: restoreScrollOffset,
            behavior: 'instant',
        });
    // @note: we only want to run this effect once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // When messages are being streamed, scroll to the latest message
    // assuming auto scrolling is enabled.
    useEffect(() => {
        if (
            !latestMessageRef.current ||
            !isAutoScrollEnabled ||
            messages.length === 0
        ) {
            return;
        }

        latestMessageRef.current.scrollIntoView({
            behavior: 'instant',
            block: 'end',
            inline: 'nearest',
        });

    }, [isAutoScrollEnabled, messages]);

    // Submit inputMessage once when component mounts
    useEffect(() => {
        if (inputMessage && !hasSubmittedInputMessage.current) {
            hasSubmittedInputMessage.current = true;
            append(inputMessage);
        }
    }, [inputMessage, append]);

    // Keep the error state & banner visibility in sync.
    useEffect(() => {
        if (error) {
            setIsErrorBannerVisible(true);
        }
    }, [error]);

    const onSubmit = useCallback((children: Descendant[], editor: CustomEditor) => {
        const text = toString(children);
        const mentions = getAllMentionElements(children);

        append({
            role: "user",
            content: text,
            annotations: mentions.map((mention) => mention.data),
        });

        setIsAutoScrollEnabled(true);

        resetEditor(editor);
    }, [append]);

    // simplified rendering code, extend as needed:
    return (
        <div className="flex flex-col h-screen">
            <div className='sticky top-0 left-0 right-0 z-10'>
                <TopBar
                    domain={domain}
                />
                <Separator />
            </div>
            {error && (
                <ErrorBanner
                    error={error}
                    isVisible={isErrorBannerVisible}
                    onClose={() => setIsErrorBannerVisible(false)}
                />
            )}

            <ScrollArea
                ref={scrollAreaRef}
                className="flex flex-col h-full w-full p-4 overflow-hidden"
            >
                <div
                    className="max-w-3xl mx-auto space-y-6"
                >
                    {
                        messages.length === 0 ? (
                            <div className="flex items-center justify-center text-center h-full">
                                <p className="text-muted-foreground">no messages</p>
                            </div>
                        ) : (
                            <>
                                {messages.map((m, index) => {
                                    return (
                                        <MessageComponent
                                            key={m.id}
                                            message={m}
                                            isStreaming={index === messages.length - 1 && status === "streaming"}
                                            ref={index === messages.length - 1 ? latestMessageRef : null}
                                        />
                                    )
                                })
                                }
                            </>
                        )
                    }
                    {
                        (!isAutoScrollEnabled && status === "streaming") && (
                            <div className="absolute bottom-5 left-0 right-0 h-10 flex flex-row items-center justify-center">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="rounded-full animate-bounce-slow h-8 w-8"
                                    onClick={() => {
                                        latestMessageRef.current?.scrollIntoView({
                                            behavior: 'instant',
                                            block: 'end',
                                            inline: 'nearest',
                                        });
                                    }}
                                >
                                    <ArrowDownIcon className="w-4 h-4" />
                                </Button>
                            </div>
                        )
                    }
                </div>
            </ScrollArea>
            <div className="border rounded-md w-full max-w-3xl mx-auto mb-8">
                <CustomSlateEditor>
                    <ChatBox
                        onSubmit={onSubmit}
                        className="min-h-[80px]"
                        preferredSuggestionsBoxPlacement="top-start"
                    />
                    <div className="w-full flex flex-row items-center bg-accent rounded-b-md px-2">
                        <ChatBoxTools />
                    </div>
                </CustomSlateEditor>
            </div>
        </div>
    );
}


interface MessageComponentProps {
    message: UIMessage;
    isStreaming: boolean;
}

const MessageComponent = memo(forwardRef<HTMLDivElement, MessageComponentProps>(({ message, isStreaming }, ref) => {
    return (
        <div ref={ref} key={message.id} className="group animate-in fade-in duration-200">
            <div className="flex items-start gap-3 group">
                <MessageAvatar role={message.role} />

                <div className="flex-1 space-y-2 overflow-hidden">
                    {message.role === "assistant" && isStreaming && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Thinking...</span>
                        </div>
                    )}

                    {/* Tool calls indicators */}
                    {message.parts.length > 0 && (
                        <div>
                            {message.parts.map((part, index) => {
                                switch (part.type) {
                                    case 'text':
                                        return (
                                            <TextUIPartComponent
                                                key={index}
                                                part={part}
                                                isStreaming={isStreaming}
                                            />
                                        )
                                    case 'step-start':
                                        break;
                                    case 'tool-invocation':
                                        return (
                                            <ToolInvocationUIPartComponent
                                                key={index}
                                                part={part}
                                            />
                                        )
                                    case 'reasoning':
                                    case 'source':
                                    case 'file':
                                    default:
                                        return (
                                            <p key={index}>Unknown part type: {part.type}</p>
                                        )
                                }
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}));

interface MessageAvatarProps {
    role: Message['role'];
}

const MessageAvatar = ({ role }: MessageAvatarProps) => {
    const { data: session } = useSession();
    const { theme } = useThemeNormalized();

    return (
        <Avatar className="h-7 w-7 rounded-full">
            <AvatarFallback className="text-xs">{role === "user" ? "U" : "AI"}</AvatarFallback>
            {role === "user" ? (
                <AvatarImage src={session?.user.image ?? "/placeholder_avatar.png?height=32&width=32"} />
            ) : (
                <AvatarImage
                    src={`/${theme === 'dark' ? 'sb_logo_dark_small' : 'sb_logo_light_small'}.png?height=32&width=32`}
                />
            )}
        </Avatar>
    )
}

MessageComponent.displayName = 'MessageComponent';

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


const TextUIPartComponent = ({ part, isStreaming }: { part: TextUIPart, isStreaming: boolean }) => {
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
                <CodeBlockComponent
                    code={text}
                    isStreaming={isStreaming}
                    language={language}
                    metadataPayload={metadataString ?? undefined}
                />
            )
        }

        return (
            <span className="group/code relative inline-block [text-decoration:inherit]">
                <Code
                    className={className}
                    {...rest}
                >
                    {children}
                </Code>
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

interface CodeBlockComponentProps {
    code: string;
    isStreaming: boolean;
    language?: string;
    metadataPayload?: string;
}

const MAX_LINES_TO_DISPLAY = 14;

const CodeBlockComponent = ({
    code,
    isStreaming,
    language = "text",
    metadataPayload,
}: CodeBlockComponentProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const domain = useDomain();
    const isClient = useIsClient();

    const metadata = useMemo(() => {
        if (!metadataPayload) {
            return undefined;
        }

        try {
            const metadata = JSON.parse(metadataPayload);
            return codeBlockMetadataSchema.parse(metadata);
        }
        catch {
            return undefined;
        }
    }, [metadataPayload]);

    const lineCount = useMemo(() => {
        return code.split('\n').length;
    }, [code]);

    const isExpandButtonVisible = useMemo(() => {
        return lineCount > MAX_LINES_TO_DISPLAY;
    }, [lineCount]);

    return (
        <div className="flex flex-col rounded-md border overflow-hidden not-prose my-4">
            {metadata && (
                <div className="flex flex-row items-center bg-accent py-1 px-3 gap-1.5">
                    <VscodeFileIcon fileName={metadata.filePath} className="h-4 w-4" />
                    <Link
                        className="flex-1 block truncate-start text-foreground text-sm font-mono cursor-pointer hover:underline"
                        href={getBrowsePath({
                            repoName: metadata.repository,
                            revisionName: metadata.revision,
                            path: metadata.filePath,
                            pathType: 'blob',
                            domain,
                            highlightRange: {
                                start: {
                                    lineNumber: metadata.startLine,
                                },
                                end: {
                                    lineNumber: metadata.endLine,
                                }
                            }
                        })}
                    >
                        {metadata.filePath}
                    </Link>
                </div>
            )}
            <div
                className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    {
                        "max-h-[350px]": !isExpanded && isExpandButtonVisible, // Roughly 14 lines
                        "max-h-none": isExpanded || !isExpandButtonVisible
                    }
                )}
            >
                {(isStreaming || !isClient) ? (
                    <LightweightCodeHighlighter
                        language={language}
                        lineNumbers={true}
                        renderWhitespace={true}
                        lineNumbersOffset={metadata?.startLine ?? 1}
                    >
                        {code}
                    </LightweightCodeHighlighter>
                ) : (
                    <FullCodeBlockComponent
                        code={code}
                        language={language}
                        metadata={metadata}
                    />
                )}
            </div>
            {isExpandButtonVisible && (
                <div
                    tabIndex={0}
                    className="flex flex-row items-center justify-center w-full bg-accent py-1 cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={() => setIsExpanded(!isExpanded)}
                    onKeyDown={(e) => {
                        if (e.key !== "Enter") {
                            return;
                        }
                        setIsExpanded(!isExpanded);
                    }}
                >
                    {isExpanded ? <DoubleArrowUpIcon className="w-3 h-3" /> : <DoubleArrowDownIcon className="w-3 h-3" />}
                    <span className="text-sm ml-1">{isExpanded ? 'Show less' : 'Show more'}</span>
                </div>
            )}
        </div>
    );
};

interface FullCodeBlockComponentProps {
    code: string;
    language: string;
    metadata?: CodeBlockMetadata;
}

const FullCodeBlockComponent = ({ code, language: _language, metadata }: FullCodeBlockComponentProps) => {
    const theme = useCodeMirrorTheme();
    const [editorRef, setEditorRef] = useState<ReactCodeMirrorRef | null>(null);
    const keymapExtension = useKeymapExtension(editorRef?.view);
    const hasCodeNavEntitlement = useHasEntitlement("code-nav");

    // @note: we use `languageDescription.name` since `_language` is not a linguist language name.
    const languageDescription = useFindLanguageDescription({ languageName: _language });
    const language = useMemo(() => {
        return languageDescription?.name ?? 'Text';
    }, [languageDescription]);

    const languageExtension = useCodeMirrorLanguageExtension(language, editorRef?.view);
    const { navigateToPath } = useBrowseNavigation();


    const extensions = useMemo(() => {
        return [
            languageExtension,
            EditorView.lineWrapping,
            keymapExtension,
            ...(metadata ? [
                lineOffsetExtension(metadata.startLine - 1),

                ...(hasCodeNavEntitlement ? [
                    symbolHoverTargetsExtension,
                ] : []),
            ] : []),
        ];
    }, [languageExtension, keymapExtension, metadata, hasCodeNavEntitlement]);

    const onGotoDefinition = useCallback((symbolName: string, symbolDefinitions: SymbolDefinition[]) => {
        if (!metadata || symbolDefinitions.length === 0) {
            return;
        }

        if (symbolDefinitions.length === 0) {
            return;
        }

        if (symbolDefinitions.length === 1) {
            const symbolDefinition = symbolDefinitions[0];
            const { fileName, repoName } = symbolDefinition;
            const { revision } = metadata;

            navigateToPath({
                repoName,
                revisionName: revision,
                path: fileName,
                pathType: 'blob',
                highlightRange: symbolDefinition.range,
            })
        } else {
            const { repository, revision, filePath } = metadata;

            navigateToPath({
                repoName: repository,
                revisionName: revision,
                path: filePath,
                pathType: 'blob',
                setBrowseState: {
                    selectedSymbolInfo: {
                        symbolName,
                        repoName: repository,
                        revisionName: revision,
                        language: language,
                    },
                    activeExploreMenuTab: "definitions",
                    isBottomPanelCollapsed: false,
                }
            });

        }
    }, [metadata, navigateToPath, language]);

    const onFindReferences = useCallback((symbolName: string) => {
        if (!metadata) {
            return;
        }

        const { repository, revision, filePath } = metadata;
        navigateToPath({
            repoName: repository,
            revisionName: revision,
            path: filePath,
            pathType: 'blob',
            setBrowseState: {
                selectedSymbolInfo: {
                    symbolName,
                    repoName: repository,
                    revisionName: revision,
                    language: language,
                },
                activeExploreMenuTab: "references",
                isBottomPanelCollapsed: false,
            }
        })

    }, [language, metadata, navigateToPath]);


    return (
        <CodeMirror
            ref={setEditorRef}
            value={code}
            extensions={extensions}
            readOnly={true}
            theme={theme}
            basicSetup={{
                highlightActiveLine: false,
                highlightActiveLineGutter: false,
            }}
        >
            {editorRef && hasCodeNavEntitlement && metadata && (
                <SymbolHoverPopup
                    editorRef={editorRef}
                    revisionName={metadata.revision}
                    language={language}
                    onFindReferences={onFindReferences}
                    onGotoDefinition={onGotoDefinition}
                />
            )}
        </CodeMirror>
    )
}

const ToolInvocationUIPartComponent = ({ part }: { part: ToolInvocationUIPart }) => {
    const {
        toolName,
        state,
        args,
    } = part.toolInvocation;

    return (
        <div className='mb-2 w-full'>
            {
                toolName === toolNames.readFiles ? (
                    <ReadFilesToolComponent
                        request={args as ReadFilesToolRequest}
                        response={state === 'result' ? part.toolInvocation.result as ReadFilesToolResponse : undefined}
                    />
                ) : toolName === toolNames.searchCode ? (
                    <SearchCodeToolComponent
                        request={args as SearchCodeToolRequest}
                        response={state === 'result' ? part.toolInvocation.result as SearchCodeToolResponse : undefined}
                    />
                ) : (
                    <span className='text-sm text-muted-foreground'>Unknown tool: {toolName}</span>
                )
            }
        </div>
    )
}

interface SearchCodeToolComponentProps {
    request: SearchCodeToolRequest;
    response?: SearchCodeToolResponse;
}

const SearchCodeToolComponent = ({ request: request, response }: SearchCodeToolComponentProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const domain = useDomain();

    const label = useMemo(() => {
        if (!response) {
            return `Searching...`;
        }

        if (isServiceError(response)) {
            return `Failed to search code`;
        }

        return `Searched for "${request.query}"`;
    }, [request, response]);

    return (
        <div className="my-4">
            <ToolHeader
                isLoading={response === undefined}
                isError={isServiceError(response)}
                isExpanded={isExpanded}
                label={label}
                Icon={SearchIcon}
                onExpand={setIsExpanded}
            />
            {response !== undefined && isExpanded && (
                <>
                    {isServiceError(response) ? (
                        <TreeList>
                            <span>Failed with the following error: <Code className="text-sm text-destructive">{response.message}</Code></span>
                        </TreeList>
                    ) : (
                        <>
                            <TreeList>
                                {response.map((file) => {
                                    return (
                                        <FileListItem
                                            key={file.fileName}
                                            path={file.fileName}
                                            repoName={file.repository}
                                        />
                                    )
                                })}
                            </TreeList>
                            <Link
                                href={createPathWithQueryParams(`/${domain}/search`,
                                    [SearchQueryParams.query, request.query],
                                )}
                                className='flex flex-row items-center gap-2 text-sm text-muted-foreground mt-2 ml-auto w-fit hover:text-foreground'
                            >
                                <PlayIcon className='h-4 w-4' />
                                Manually run query
                            </Link>
                        </>
                    )}
                    <Separator className='ml-[7px] my-2' />
                </>
            )}
        </div>
    )
}

type ReadFilesToolComponentProps = {
    request: ReadFilesToolRequest;
    response?: ReadFilesToolResponse;
}


const ReadFilesToolComponent = ({ request, response }: ReadFilesToolComponentProps) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const label = useMemo(() => {
        if (!response) {
            return `Reading ${request.paths.length} files...`;
        }

        if (isServiceError(response)) {
            return `Failed to read files`;
        }

        return `Read ${response.length} files`;
    }, [request, response]);

    return (
        <div className="my-4">
            <ToolHeader
                isLoading={response === undefined}
                isError={isServiceError(response)}
                isExpanded={isExpanded}
                label={label}
                Icon={EyeIcon}
                onExpand={setIsExpanded}
            />
            {response !== undefined && isExpanded && (
                <>
                    <TreeList>
                        {isServiceError(response) ? (
                            <span>Failed with the following error: <Code className="text-sm text-destructive">{response.message}</Code></span>
                        ) : response.map((file) => {
                            return (
                                <FileListItem
                                    key={file.path}
                                    path={file.path}
                                    repoName={file.repository}
                                />
                            )
                        })}
                    </TreeList>
                    <Separator className='ml-[7px] my-2' />
                </>
            )}
        </div>
    )
}

const FileListItem = ({
    path,
    repoName,
}: {
    path: string,
    repoName: string,
}) => {
    const domain = useDomain();

    return (
        <div key={path} className="flex flex-row items-center overflow-hidden hover:bg-accent hover:text-accent-foreground rounded-sm cursor-pointer p-0.5">
            <VscodeFileIcon fileName={path} className="mr-1 flex-shrink-0" />
            <Link
                className="text-sm truncate-start"
                href={getBrowsePath({
                    repoName,
                    revisionName: 'HEAD',
                    path,
                    domain,
                    pathType: 'blob',
                })}
            >
                {path}
            </Link>
        </div>
    )
}

const TreeList = ({ children }: { children: React.ReactNode }) => {
    const childrenArray = React.Children.toArray(children);

    return (
        <ScrollArea className="flex flex-col relative mt-0.5 ml-[7px] max-h-60">
            {/* vertical line */}
            <div
                className="absolute left-0 top-0 w-px bg-border"
                style={{
                    bottom: childrenArray.length > 0 ? `${100 / childrenArray.length * 0.6}%` : '0'
                }}
            />

            {childrenArray.map((child, index) => {
                const isLast = index === childrenArray.length - 1;

                return (
                    <div
                        key={index}
                        className="relative py-0.5"
                    >
                        {!isLast && (
                            <div className="absolute left-0 w-3 h-px bg-border top-1/2"></div>
                        )}
                        {isLast && (
                            <div
                                className="absolute left-0 w-3 h-3 border-l border-b border-border rounded-bl"
                                style={{ top: 'calc(50% - 11px)' }}
                            />
                        )}

                        <div className="ml-4">{child}</div>
                    </div>
                )
            })}
        </ScrollArea>
    );
};

interface ToolHeaderProps {
    isLoading: boolean;
    isError: boolean;
    isExpanded: boolean;
    label: string;
    Icon: React.ElementType;
    onExpand: (isExpanded: boolean) => void;
}

const ToolHeader = ({ isLoading, isError, isExpanded, label, Icon, onExpand }: ToolHeaderProps) => {
    return (
        <div
            tabIndex={0}
            className={cn(
                "flex flex-row items-center gap-2 text-muted-foreground group w-fit select-none",
                {
                    'hover:text-foreground cursor-pointer': !isLoading,
                }
            )}
            onClick={() => {
                onExpand(!isExpanded)
            }}
            onKeyDown={(e) => {
                if (e.key !== "Enter") {
                    return;
                }
                onExpand(!isExpanded);
            }}
        >
            <Icon className="h-4 w-4" />
            <span className={cn("text-sm font-medium",
                {
                    'animate-pulse': isLoading,
                    'text-destructive': isError,
                }
            )}>{label}</span>
            {isLoading && (
                <Loader2 className="w-3 h-3 animate-spin" />
            )}
            {!isLoading && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                    ) : (
                        <ChevronRight className="h-3 w-3" />
                    )}
                </div>
            )}
        </div>
    )
}

const Code = ({ children, className, title }: { children: React.ReactNode, className?: string, title?: string }) => {
    return (
        <code
            className={cn("bg-gray-100 dark:bg-gray-700 w-fit rounded-md px-2 py-0.5 font-medium font-mono", className)}
            title={title}
        >
            {children}
        </code>
    )
}
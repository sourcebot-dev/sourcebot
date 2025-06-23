'use client';

import { VscodeFileIcon } from '@/app/components/vscodeFileIcon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CustomSlateEditor } from '@/features/chat/customSlateEditor';
import { ReadFilesToolRequest, ReadFilesToolResponse, SearchCodeToolRequest, SearchCodeToolResponse, toolNames } from '@/features/chat/tools';
import { getAllMentionElements, resetEditor, toString } from '@/features/chat/utils';
import { useDomain } from '@/hooks/useDomain';
import { useThemeNormalized } from '@/hooks/useThemeNormalized';
import { SearchQueryParams } from '@/lib/types';
import { cn, createPathWithQueryParams, isServiceError } from '@/lib/utils';
import { Message, useChat } from '@ai-sdk/react';
import { CreateMessage, TextUIPart, ToolInvocationUIPart } from '@ai-sdk/ui-utils';
import { PlayIcon } from '@radix-ui/react-icons';
import { UIMessage } from 'ai';
import { ChevronDown, ChevronRight, EyeIcon, Loader2, SearchIcon } from 'lucide-react';
import { marked } from "marked";
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getBrowsePath } from '../../browse/hooks/useBrowseNavigation';
import { TopBar } from '../../components/topBar';
import { ChatBox } from './chatBox';
import { ChatBoxTools } from './chatBoxTools';
import { ErrorBanner } from './errorBanner';

export default function Chat({
    id,
    initialMessages,
    inputMessage,
}: { id?: string | undefined; initialMessages?: Message[]; inputMessage?: CreateMessage } = {}) {
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

            <ScrollArea className="flex flex-col h-full w-full p-4 overflow-hidden">
                <div className="max-w-3xl mx-auto space-y-6">
                    {
                        messages.length === 0 ? (
                            <div className="flex items-center justify-center text-center h-full">
                                <p className="text-muted-foreground">no messages</p>
                            </div>
                        ) : (
                            <>
                                {messages.map((m, index) => (
                                    <MessageComponent
                                        key={m.id}
                                        message={m}
                                        isLatestMessage={index === messages.length - 1}
                                        status={status}
                                    />
                                ))}
                            </>
                        )
                    }
                </div>
            </ScrollArea>
            <div className="border rounded-md w-full max-w-3xl mx-auto mb-8">
                <CustomSlateEditor>
                    <ChatBox
                        onSubmit={(children, editor) => {
                            const text = toString(children);
                            const mentions = getAllMentionElements(children);

                            append({
                                role: "user",
                                content: text,
                                annotations: mentions.map((mention) => mention.data),
                            });

                            resetEditor(editor);
                        }}
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
    isLatestMessage: boolean;
    status: 'submitted' | 'streaming' | 'ready' | 'error';
}

const MessageComponent = ({ message, isLatestMessage, status }: MessageComponentProps) => {

    const { data: session } = useSession();
    const { theme } = useThemeNormalized();
    console.log(theme);

    return (
        <div key={message.id} className="group animate-in fade-in duration-200">
            <div className="flex items-start gap-3 group">
                <Avatar className="h-7 w-7 rounded-full">
                    <AvatarFallback className="text-xs">{message.role === "user" ? "U" : "AI"}</AvatarFallback>
                    {message.role === "user" ? (
                        <AvatarImage src={session?.user.image ?? "/placeholder_avatar.png?height=32&width=32"} />
                    ) : (
                        <AvatarImage
                            src={`/${theme === 'dark' ? 'sb_logo_dark_small' : 'sb_logo_light_small'}.png?height=32&width=32`}
                        />
                    )}
                </Avatar>

                <div className="flex-1 space-y-2 overflow-hidden">
                    {isLatestMessage && message.role === "assistant" && status === "streaming" && (
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
                                        console.log("Unknown part type:", part);
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
}

marked.use({
    renderer: {
        code: (code) => {
            return `<pre><code>${code.text}</code></pre>`;
        },
        codespan: (code) => {
            return `
                <code class="bg-gray-100 dark:bg-gray-700 w-fit rounded-md font-mono px-2 py-0.5 font-normal prose">${code.text}</code>
            `;
        }
    }
})

const TextUIPartComponent = ({ part }: { part: TextUIPart }) => {
    const markdown = useMemo(() => {
        return marked.parse(part.text, {
            gfm: true,
            breaks: true,
        });
    }, [part.text]);

    return (
        <span
            className="prose prose-p:text-foreground prose-li:text-foreground dark:prose-invert [&>*:first-child]:mt-0 prose-headings:mt-6 prose-ol:mt-3 prose-ul:mt-3 prose-p:mb-3 prose-code:before:content-none prose-code:after:content-none prose-hr:my-5 max-w-none"
            dangerouslySetInnerHTML={{ __html: markdown }}
        />
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
        <>
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
        </>
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
        <>
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
        </>
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
            className={cn(
                "flex flex-row items-center gap-2 text-muted-foreground group w-fit select-none",
                {
                    'hover:text-foreground cursor-pointer': !isLoading,
                }
            )}
            onClick={() => {
                onExpand(!isExpanded)
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
            className={cn("bg-gray-100 dark:bg-gray-700 w-fit rounded-md font-mono px-2 py-0.5", className)}
            title={title}
        >
            {children}
        </code>
    )
}
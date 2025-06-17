"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useChat } from "@ai-sdk/react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Send, Loader2, AlertCircle, X, Search, Code, HammerIcon } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TextUIPart, ToolInvocationUIPart } from "@ai-sdk/ui-utils"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormField } from "@/components/ui/form"
import { ChatContext, Citation, CITATION_PREFIX, citationSchema, FileContext } from "@/features/chat/constants"
import { TopBar } from "../components/topBar"
import { useDomain } from "@/hooks/useDomain"
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { AnimatedResizableHandle } from "@/components/ui/animatedResizableHandle"
import { FileSearchCommandDialog } from "../components/fileSearchCommandDialog"
import { useBrowsePath } from "../browse/hooks/useBrowsePath"
import Link from "next/link"

const formSchema = z.object({
    message: z.string().min(1),
});

export default function ChatPage() {

    const [isFileSearchOpen, setIsFileSearchOpen] = useState(false);
    const [files, setFiles] = useState<FileContext[]>([]);

    const {
        messages,
        input,
        status,
        error,
        append,
    } = useChat({
        body: {
            context: {
                files: files,
            } satisfies ChatContext,
        }
    });

    const [inputRows, setInputRows] = useState(1);
    const [showError, setShowError] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const domain = useDomain();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            message: "",
        },
    });
    const { isSubmitting } = form.formState;

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Auto-resize textarea based on content
    useEffect(() => {
        const rows = input.split("\n").length;
        setInputRows(Math.min(5, Math.max(1, rows)));
    }, [input]);

    // Show error when it occurs
    useEffect(() => {
        if (error) {
            setShowError(true);
        }
    }, [error]);

    const onSubmit = useCallback(({ message }: z.infer<typeof formSchema>) => {
        append({
            role: "user",
            content: message,
        });
        form.reset();
    }, [append, form]);

    return (
        <>
            <div className="flex flex-col h-screen">
                <div className='sticky top-0 left-0 right-0 z-10'>
                    <TopBar
                        domain={domain}
                    />
                    <Separator />
                </div>
                {/* Error banner */}
                {showError && error && (
                    <div className="bg-red-50 border-b border-red-200 dark:bg-red-950/20 dark:border-red-800">
                        <div className="max-w-5xl mx-auto px-4 py-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                    <span className="text-sm font-medium text-red-800 dark:text-red-200">
                                        Error occurred
                                    </span>
                                    <span className="text-sm text-red-600 dark:text-red-400">
                                        {error.message || "An unexpected error occurred. Please try again."}
                                    </span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowError(false)}
                                    className="h-6 w-6 p-0 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                <ResizablePanelGroup
                    direction="horizontal"
                >
                    <ResizablePanel
                        order={1}
                        minSize={10}
                        maxSize={20}
                        defaultSize={20}
                        className="p-2"
                    >
                        <h1 className="text-sm font-medium mb-2">Context window</h1>
                        <div className="flex flex-col gap-2">
                            {files.map((file) => (
                                <div key={file.path} className="flex items-center justify-between gap-2 p-1 border rounded-md relative">
                                    <div className="flex items-center gap-2">
                                        <Code className="h-4 w-4" />
                                        <p className="text-sm font-mono">{file.name}</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => {
                                            setFiles(files.filter((f) => f.path !== file.path));
                                        }}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </ResizablePanel>
                    <AnimatedResizableHandle />
                    <ResizablePanel
                        order={2}
                        minSize={10}
                        defaultSize={80}
                    >
                        <div className="flex flex-col h-full">
                            {messages.length === 0 ? (
                                <div className="flex items-center justify-center text-center h-full">
                                    <div className="space-y-3 max-w-md">
                                        <h3 className="text-xl font-medium">Welcome to AI Chat</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Ask me anything about your codebase
                                        </p>
                                        <div className="flex items-center justify-center gap-4 text-xs text-gray-400 dark:text-gray-500 mt-4">
                                            <div className="flex items-center gap-1">
                                                <Search className="h-3 w-3" />
                                                <span>Can search your code</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Code className="h-3 w-3" />
                                                <span>Understands your codebase</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <ScrollArea className="h-full w-full overflow-auto p-4 space-y-8">
                                    {messages.map((message, index) => (
                                        <div key={message.id} className="group animate-in fade-in duration-200">
                                            <div className="flex items-start gap-3 group">
                                                <Avatar className="h-7 w-7 mt-1 rounded-full border">
                                                    <AvatarFallback className="text-xs">{message.role === "user" ? "U" : "AI"}</AvatarFallback>
                                                    {message.role === "user" ? (
                                                        <AvatarImage src="/placeholder.svg?height=32&width=32" />
                                                    ) : (
                                                        <AvatarImage src="/placeholder.svg?height=32&width=32" />
                                                    )}
                                                </Avatar>

                                                <div className="flex-1 space-y-2 overflow-hidden">
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-semibold text-sm">
                                                            {message.role === "user" ? "You" : "AI Assistant"}
                                                        </div>
                                                        {index === messages.length - 1 && message.role === "assistant" && status === "streaming" && (
                                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                                <span>Thinking...</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Tool calls indicators */}
                                                    {message.parts.length > 0 && (
                                                        <div className="space-y-2">
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
                                                                        return <Separator key={index} />
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

                                            {index < messages.length - 1 && <Separator className="my-6" />}
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </ScrollArea>
                            )}

                            <Separator className="my-3" />

                            <div className="flex flex-col p-4">
                                <Form
                                    {...form}
                                >
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-end gap-2">
                                        <FormField
                                            control={form.control}
                                            name="message"
                                            render={({ field }) => (
                                                <Textarea
                                                    {...field}
                                                    placeholder="Message AI..."
                                                    className="flex-1 min-h-10 resize-none border rounded-md p-3"
                                                    rows={inputRows}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" && !e.shiftKey) {
                                                            e.preventDefault();
                                                            form.handleSubmit(onSubmit)(e as unknown as React.FormEvent<HTMLFormElement>);
                                                        }
                                                    }}
                                                />
                                            )}
                                        />
                                        <Button
                                            type="submit"
                                            size="icon"
                                            className="rounded-md"
                                            disabled={status === 'submitted' || status === 'streaming' || isSubmitting}
                                        >
                                            {(status === 'submitted' || status === 'streaming') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                        </Button>
                                    </form>
                                </Form>
                                <p className="text-xs text-gray-500 mt-2">Press Enter to send, Shift+Enter for a new line</p>
                            </div>
                        </div>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
            <FileSearchCommandDialog
                // @todo: generalize this
                repoName={"github.com/sourcebot-dev/sourcebot"}
                revisionName={"HEAD"}
                isOpen={isFileSearchOpen}
                onOpenChange={(isOpen) => {
                    setIsFileSearchOpen(isOpen);
                }}
                onSelect={(file) => {
                    setFiles(files => {
                        const fileExists = files.some(f => f.path === file.path);
                        return fileExists ? files : [...files, {
                            path: file.path,
                            name: file.name,
                            // @todo: generalize this
                            repository: "github.com/sourcebot-dev/sourcebot",
                            revision: "HEAD",
                        }];
                    });
                }}
            />
        </>
    )
}

const ToolInvocationUIPartComponent = ({ part }: { part: ToolInvocationUIPart }) => {
    const { toolName, state } = part.toolInvocation;

    return (
        <div className="flex items-center gap-2">
            <HammerIcon className="h-4 w-4" />
            <p>{toolName}</p>
            <span className="text-xs text-gray-500">{state}</span>
            {state === 'result' && (
                <Accordion type="single" collapsible>
                    <AccordionItem value="result">
                        <AccordionTrigger>View Invocation</AccordionTrigger>
                        <AccordionContent>
                            <p>Arguments:</p>
                            <pre className="text-xs text-gray-500 whitespace-pre-wrap break-all">
                                {JSON.stringify(part.toolInvocation.args, null, 2)}
                            </pre>
                            <p>Result:</p>
                            <pre className="text-xs text-gray-500 whitespace-pre-wrap break-all">
                                {JSON.stringify(part.toolInvocation.result, null, 2)}
                            </pre>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            )}
        </div>
    )
}

// Citation component for rendering citation links
const CitationComponent = ({ citation }: { citation: Citation }) => {
    const { name, repository, revision, path } = citation;
    const { path: browsePath } = useBrowsePath({
        repoName: repository,
        revisionName: revision,
        path: path,
        pathType: 'blob',
        highlightRange: citation.range,
    });

    return (
        <Link
            className="inline-flex items-center gap-1 px-2 py-1 text-xs transition-colors cursor-pointer rounded-md bg-accent select-none hover:bg-accent/50 border"
            href={browsePath}
        >
            <Code className="h-3 w-3" />
            <span className="font-mono">{name}</span>
        </Link>
    )
}

type ParsedSegment = {
    type: 'text';
    content: string;
} | {
    type: 'citation';
    citation: Citation;
} | {
    type: 'code-block';
    content: string;
} | {
    type: 'code-inline';
    content: string;
}

const TextUIPartComponent = ({ part }: { part: TextUIPart }) => {
    const segments = useMemo(() => {
        return parseTextIntoSegments(part.text);
    }, [part.text]);

    return (
        <div className="whitespace-pre-wrap break-words">
            {segments.map((segment, index) => {
                if (segment.type === 'citation') {
                    return (
                        <CitationComponent
                            key={index}
                            citation={segment.citation}
                        />
                    );
                } else if (segment.type === 'code-block') {
                    return (
                        <pre key={index} className="text-xs text-gray-500 whitespace-pre-wrap break-all bg-gray-50 dark:bg-gray-900 p-3 rounded-md border my-2">
                            {segment.content}
                        </pre>
                    );
                } else if (segment.type === 'code-inline') {
                    return (
                        <code key={index} className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-800 dark:text-gray-200 font-mono">
                            {segment.content}
                        </code>
                    );
                } else {
                    return (
                        <span key={index}>
                            {segment.content}
                        </span>
                    );
                }
            })}
        </div>
    )
}

// Function to parse text and extract citations and code blocks
const parseTextIntoSegments = (text: string): ParsedSegment[] => {
    const parts: ParsedSegment[] = [];

    // Create combined regex to match both citations and code blocks
    // Priority: citations first, then code blocks, then inline code
    const combinedRegex = new RegExp([
        `(${CITATION_PREFIX}.*)`, // Group 1: Citations
        '(```[\\s\\S]*?```)', // Group 2: Code blocks (triple backticks)
        '(`[^`\n]*?`)', // Group 3: Inline code (single backticks, no newlines)
    ].join('|'), 'g');

    let currentIndex = 0;
    let match: RegExpExecArray | null = null;

    while ((match = combinedRegex.exec(text)) !== null) {
        const [fullMatch, citationMatch, codeBlockMatch, inlineCodeMatch] = match;

        // Add text before the match
        if (match.index > currentIndex) {
            const textBefore = text.slice(currentIndex, match.index);
            if (textBefore.trim()) {
                parts.push({ type: 'text', content: textBefore });
            }
        }

        // Handle citations
        if (citationMatch) {
            const citationJson = citationMatch.replace(CITATION_PREFIX, '');
            try {
                const citationJsonObject = JSON.parse(citationJson);
                const citation = citationSchema.parse(citationJsonObject);
                parts.push({
                    type: 'citation',
                    citation: citation
                });
            } catch {
                // Fallback to text if parsing fails
                parts.push({ type: 'text', content: fullMatch });
            }
        }
        // Handle code blocks (```code```)
        else if (codeBlockMatch) {
            // Remove the triple backticks and extract the code content
            const codeContent = codeBlockMatch.slice(3, -3);
            parts.push({
                type: 'code-block',
                content: codeContent
            });
        }
        // Handle inline code (`code`)
        else if (inlineCodeMatch) {
            // Remove the single backticks and extract the code content
            const codeContent = inlineCodeMatch.slice(1, -1);
            parts.push({
                type: 'code-inline',
                content: codeContent
            });
        }

        currentIndex = match.index + fullMatch.length;
    }

    // Add remaining text
    if (currentIndex < text.length) {
        const remainingText = text.slice(currentIndex);
        if (remainingText.trim()) {
            parts.push({ type: 'text', content: remainingText });
        }
    }

    return parts;
}

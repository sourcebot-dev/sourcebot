"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Send, Loader2, AlertCircle, X, Search, Code, HammerIcon } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ToolInvocationUIPart } from "@ai-sdk/ui-utils"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export default function ChatPage() {
    const { messages, input, handleInputChange, handleSubmit, status, error } = useChat()
    const [inputRows, setInputRows] = useState(1)
    const [showError, setShowError] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // Auto-resize textarea based on content
    useEffect(() => {
        const rows = input.split("\n").length;
        setInputRows(Math.min(5, Math.max(1, rows)));
    }, [input])

    // Show error when it occurs
    useEffect(() => {
        if (error) {
            setShowError(true)
        }
    }, [error])

    // Handle form submission
    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (input.trim() === "") {
            return;
        }

        setShowError(false)
        handleSubmit(e)
    }

    useEffect(() => {
        console.log("messages", messages)
    }, [messages]);

    return (
        <div className="flex flex-col h-screen max-h-screen bg-white dark:bg-gray-950">
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

            {/* Main chat area */}
            <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                    <div className="max-w-5xl mx-auto px-4 py-6">
                        {messages.length === 0 ? (
                            <div className="flex h-[70vh] items-center justify-center text-center">
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
                            <div className="space-y-8">
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
                                                                        <div key={index} className="whitespace-pre-wrap break-words">
                                                                            {part.text}
                                                                        </div>
                                                                    )
                                                                case 'step-start':
                                                                    return <Separator key={index} />
                                                                case 'tool-invocation':
                                                                    return (
                                                                        <ToolCallIndicator
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
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Input area */}
            <div className="border-t bg-white dark:bg-gray-950">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <form onSubmit={onSubmit} className="flex items-end gap-2">
                        <Textarea
                            value={input}
                            onChange={handleInputChange}
                            placeholder="Message AI..."
                            className="flex-1 min-h-10 resize-none border rounded-md p-3"
                            rows={inputRows}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault()
                                    onSubmit(e as unknown as React.FormEvent<HTMLFormElement>)
                                }
                            }}
                        />
                        <Button
                            type="submit"
                            size="icon"
                            className="rounded-md h-10 w-10"
                            disabled={status === 'submitted' || status === 'streaming' || input.trim() === ""}
                        >
                            {(status === 'submitted' || status === 'streaming') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </form>
                    <p className="text-xs text-gray-500 mt-2">Press Enter to send, Shift+Enter for a new line</p>
                </div>
            </div>
        </div>
    )
}

const ToolCallIndicator = ({ part }: { part: ToolInvocationUIPart }) => {
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

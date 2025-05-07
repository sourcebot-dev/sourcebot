"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Send, Loader2, ChevronDown } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function ChatPage() {
    const { messages, input, handleInputChange, handleSubmit, status } = useChat()
    const [inputRows, setInputRows] = useState(1)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // Auto-resize textarea based on content
    useEffect(() => {
        const rows = input.split("\n").length
        setInputRows(Math.min(5, Math.max(1, rows)))
    }, [input])

    // Handle form submission
    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (input.trim() === "") return
        handleSubmit(e)
    }

    return (
        <div className="flex flex-col h-screen max-h-screen bg-white dark:bg-gray-950">
            {/* Main chat area */}
            <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                    <div className="max-w-5xl mx-auto px-4 py-6">
                        {messages.length === 0 ? (
                            <div className="flex h-[70vh] items-center justify-center text-center">
                                <div className="space-y-3 max-w-md">
                                    <h3 className="text-xl font-medium">Welcome to AI Chat</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Ask me anything
                                    </p>
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
                                                    {index === messages.length - 1 && message.role === "assistant" && (
                                                        <div className="flex items-center gap-1 text-xs text-gray-500">
                                                            <ChevronDown className="h-3 w-3" />
                                                            <span>Thought for {Math.floor(Math.random() * 10) + 1} seconds</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="prose prose-sm dark:prose-invert max-w-none">{message.content}</div>
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

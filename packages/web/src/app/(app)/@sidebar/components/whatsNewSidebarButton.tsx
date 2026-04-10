"use client"

import {
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { newsData } from "@/lib/newsData"
import { NewsItem } from "@/lib/types"
import { env, SOURCEBOT_VERSION } from "@sourcebot/shared/client"
import { Compass, Mail, MailOpen } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint"

const COOKIE_NAME = "whats-new-read-items"

const getReadItems = (): string[] => {
    if (typeof document === "undefined") {
        return []
    }

    const cookies = document.cookie.split(';').map(cookie => cookie.trim())
    const targetCookie = cookies.find(cookie => cookie.startsWith(`${COOKIE_NAME}=`))

    if (!targetCookie) {
        return []
    }

    try {
        const cookieValue = targetCookie.substring(`${COOKIE_NAME}=`.length)
        return JSON.parse(decodeURIComponent(cookieValue))
    } catch {
        return []
    }
}

const setReadItems = (readItems: string[]) => {
    if (typeof document === "undefined") {
        return
    }

    try {
        const expires = new Date()
        expires.setFullYear(expires.getFullYear() + 1)
        const cookieValue = encodeURIComponent(JSON.stringify(readItems))
        document.cookie = `${COOKIE_NAME}=${cookieValue}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
    } catch {
        // ignore
    }
}

export function WhatsNewSidebarButton() {
    const { state } = useSidebar()
    const [isOpen, setIsOpen] = useState(false)
    const [readItems, setReadItemsState] = useState<string[]>([])
    const [isInitialized, setIsInitialized] = useState(false)

    const toggleOpen = useCallback(() => {
        setIsOpen(prev => !prev)
    }, [])

    useHotkeys("shift+?", (e) => {
        e.preventDefault();
        toggleOpen();
    });

    useEffect(() => {
        const items = getReadItems()
        setReadItemsState(items)
        setIsInitialized(true)
    }, [])

    useEffect(() => {
        if (isInitialized) {
            setReadItems(readItems)
        }
    }, [readItems, isInitialized])

    const newsItemsWithReadState = newsData.map((item) => ({
        ...item,
        read: readItems.includes(item.unique_id),
    }))

    const unreadCount = newsItemsWithReadState.filter((item) => !item.read).length

    const markAsRead = (itemId: string) => {
        setReadItemsState((prev) => {
            if (!prev.includes(itemId)) {
                return [...prev, itemId]
            }
            return prev
        })
    }

    const markAllAsRead = () => {
        const allIds = newsData.map((item) => item.unique_id)
        setReadItemsState(allIds)
    }

    const handleNewsItemClick = (item: NewsItem) => {
        window.open(item.url, "_blank", "noopener,noreferrer")
        markAsRead(item.unique_id)
    }

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <Popover open={isOpen} onOpenChange={setIsOpen}>
                    <Tooltip open={state === "expanded" ? false : undefined}>
                        <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                                <SidebarMenuButton>
                                    <Compass className="h-4 w-4" />
                                    <span>{"What's new"}</span>
                                </SidebarMenuButton>
                            </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="flex items-center gap-2">
                            <KeyboardShortcutHint shortcut="?" />
                            <Separator orientation="vertical" className="h-4" />
                            <span>{"What's new"}</span>
                        </TooltipContent>
                    </Tooltip>
                    {isInitialized && unreadCount > 0 && (
                        <SidebarMenuBadge className="rounded-full bg-blue-500 text-white peer-hover/menu-button:text-white px-1.5">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </SidebarMenuBadge>
                    )}
                    <PopoverContent className="w-80 p-0" side="right" align="end" sideOffset={8}>
                        <div className="border-b p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-sm">{"What's New"}</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "All caught up"}
                                    </p>
                                </div>
                                {unreadCount > 0 && (
                                    <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-7">
                                        Mark all read
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="max-h-[32rem] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                            {newsItemsWithReadState.length === 0 ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">No recent updates</div>
                            ) : (
                                <div className="space-y-1 p-2">
                                    {newsItemsWithReadState.map((item, index) => (
                                        <div
                                            key={item.unique_id}
                                            className={`relative rounded-md transition-colors ${item.read ? "opacity-60" : ""} ${index !== newsItemsWithReadState.length - 1 ? "border-b border-border/50" : ""}`}
                                        >
                                            {!item.read && <div className="absolute left-2 top-3 h-2 w-2 bg-blue-500 rounded-full" />}
                                            <button
                                                onClick={() => handleNewsItemClick(item)}
                                                className="w-full text-left p-3 pl-6 rounded-md hover:bg-muted transition-colors group"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className={`font-medium text-sm leading-tight group-hover:text-primary ${item.read ? "text-muted-foreground" : ""}`}>
                                                            {item.header}
                                                        </h4>
                                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.sub_header}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        {item.read ? (
                                                            <MailOpen className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                                                        ) : (
                                                            <Mail className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Separator />
                        <div className="px-2 py-2 text-xs text-muted-foreground">
                            Current version: {SOURCEBOT_VERSION}
                            {env.NEXT_PUBLIC_BUILD_COMMIT_SHA && (
                                <Link
                                    className="ml-1 font-mono"
                                    href={`https://github.com/sourcebot-dev/sourcebot/commit/${env.NEXT_PUBLIC_BUILD_COMMIT_SHA}`}
                                >
                                    (<span className="hover:underline">{env.NEXT_PUBLIC_BUILD_COMMIT_SHA.substring(0, 7)}</span>)
                                </Link>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}

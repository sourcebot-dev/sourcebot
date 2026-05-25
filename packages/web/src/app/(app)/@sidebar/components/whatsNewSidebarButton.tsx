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
import { listChangelogEntries } from "@/app/api/(client)/client"
import { unwrapServiceError } from "@/lib/utils"
import { env, SOURCEBOT_VERSION } from "@sourcebot/shared/client"
import { useQuery } from "@tanstack/react-query"
import { Compass, Loader2, Mail, MailOpen } from "lucide-react"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { useLocalStorage } from "usehooks-ts"
import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint"
import { ChangelogEntryDialog } from "./changelogEntryDialog"

const STORAGE_KEY = "whats-new-read-items"

export function WhatsNewSidebarButton() {
    const { state } = useSidebar()
    const [isOpen, setIsOpen] = useState(false)
    const [tooltipOpen, setTooltipOpen] = useState(false)
    const [readItems, setReadItems] = useLocalStorage<string[]>(STORAGE_KEY, [], { initializeWithValue: false })
    const [selectedSlug, setSelectedSlug] = useState<string | null>(null)

    const toggleOpen = useCallback(() => {
        setIsOpen(prev => !prev)
    }, [])

    useHotkeys("shift+?", (e) => {
        e.preventDefault();
        toggleOpen();
    });

    const {
        data: { entries, entriesBaseUrl } = {
            entries: [],
            entriesBaseUrl: ""
        },
        isPending
    } = useQuery({
        queryKey: ["changelog-entries"],
        queryFn: () => unwrapServiceError(listChangelogEntries()),
        select: (response) => {
            return {
                entries: response.entries.map((entry) => ({
                    ...entry,
                    read: readItems.includes(entry.slug)
                })),
                entriesBaseUrl: response.entriesBaseUrl,
            }
        }
    })

    const selectedEntry = useMemo(
        () => entries.find((entry) => entry.slug === selectedSlug) ?? null,
        [entries, selectedSlug]
    )

    const unreadCount = entries.filter((item) => !item.read).length

    const markAsRead = (slug: string) => {
        setReadItems((prev) => {
            if (!prev.includes(slug)) {
                return [...prev, slug]
            }
            return prev
        })
    }

    const markAllAsRead = () => {
        setReadItems(entries.map((entry) => entry.slug))
    }

    const handleEntryClick = (slug: string) => {
        setIsOpen(false)
        setSelectedSlug(slug)
        markAsRead(slug)
    }

    const handleDialogOpenChange = (open: boolean) => {
        if (!open) {
            setSelectedSlug(null)
        }
    }

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <Popover open={isOpen} onOpenChange={setIsOpen}>
                    <Tooltip
                        open={state === "expanded" ? false : tooltipOpen}
                        onOpenChange={setTooltipOpen}
                    >
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
                    {unreadCount > 0 && (
                        <SidebarMenuBadge className="rounded-full bg-blue-500 text-white peer-hover/menu-button:text-white px-1.5">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </SidebarMenuBadge>
                    )}
                    <PopoverContent className="w-80 p-0" side="right" align="end" sideOffset={8}>
                        {isPending ? (
                            <div className="flex items-center justify-center p-8">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <>
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
                                    {entries.length === 0 ? (
                                        <div className="p-4 text-center text-sm text-muted-foreground">No recent updates</div>
                                    ) : (
                                        <div className="space-y-1 p-2">
                                            {entries.map((entry, index) => (
                                        <div
                                            key={entry.slug}
                                            className={`relative rounded-md transition-colors ${entry.read ? "opacity-60" : ""} ${index !== entries.length - 1 ? "border-b border-border/50" : ""}`}
                                        >
                                            {!entry.read && <div className="absolute left-2 top-3 h-2 w-2 bg-blue-500 rounded-full" />}
                                            <button
                                                onClick={() => handleEntryClick(entry.slug)}
                                                className="w-full text-left p-3 pl-6 rounded-md hover:bg-muted transition-colors group"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className={`font-medium text-sm leading-tight group-hover:text-primary ${entry.read ? "text-muted-foreground" : ""}`}>
                                                            {entry.title}
                                                        </h4>
                                                        {entry.summary && (
                                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.summary}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 flex-shrink-0 mt-1">
                                                        {entry.read ? (
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
                            </>
                        )}
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
            <ChangelogEntryDialog
                entry={selectedEntry}
                entriesBaseUrl={entriesBaseUrl}
                open={selectedSlug !== null}
                onOpenChange={handleDialogOpenChange}
            />
        </SidebarMenu>
    )
}

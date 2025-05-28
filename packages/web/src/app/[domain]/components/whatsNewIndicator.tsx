"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { HelpCircle, Mail, MailOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { NewsItem } from "@/lib/types"
import { newsData } from "@/lib/newsData"

interface WhatsNewProps {
  newsItems?: NewsItem[]
  autoMarkAsRead?: boolean
}

const COOKIE_NAME = "whats-new-read-items"

const getReadItems = (): string[] => {
  if (typeof document === "undefined") return []
  
  const cookies = document.cookie.split(';').map(cookie => cookie.trim())
  const targetCookie = cookies.find(cookie => cookie.startsWith(`${COOKIE_NAME}=`))
  
  if (!targetCookie) return []

  try {
    const cookieValue = targetCookie.substring(`${COOKIE_NAME}=`.length)
    return JSON.parse(decodeURIComponent(cookieValue))
  } catch (error) {
    console.warn('Failed to parse whats-new cookie:', error)
    return []
  }
}

const setReadItems = (readItems: string[]) => {
  if (typeof document === "undefined") return
  
  try {
    const expires = new Date()
    expires.setFullYear(expires.getFullYear() + 1)
    const cookieValue = encodeURIComponent(JSON.stringify(readItems))
    
    document.cookie = `${COOKIE_NAME}=${cookieValue}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
  } catch (error) {
    console.warn('Failed to set whats-new cookie:', error)
  }
}

export default function WhatsNewIndicator({ newsItems = newsData, autoMarkAsRead = true }: WhatsNewProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [readItems, setReadItemsState] = useState<string[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

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

  const newsItemsWithReadState = newsItems.map((item) => ({
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
    const allIds = newsItems.map((item) => item.unique_id)
    setReadItemsState(allIds)
  }

  const handleNewsItemClick = (item: NewsItem) => {
    window.open(item.url, "_blank", "noopener,noreferrer")

    if (autoMarkAsRead && !item.read) {
      markAsRead(item.unique_id)
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full hover:bg-muted"
          aria-label={`What's new${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <HelpCircle className="h-4 w-4" />
          {isInitialized && unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 text-[10px] flex items-center justify-center"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
              <span className="sr-only">{unreadCount} unread updates</span>
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">{"What's New"}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "All caught up!"}
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
                  className={`relative rounded-md transition-colors ${item.read ? "opacity-60" : ""} ${
                    index !== newsItemsWithReadState.length - 1 ? "border-b border-border/50" : ""
                  }`}
                >
                  {!item.read && <div className="absolute left-2 top-3 h-2 w-2 bg-blue-500 rounded-full"></div>}
                  <button
                    onClick={() => handleNewsItemClick(item)}
                    className="w-full text-left p-3 pl-6 rounded-md hover:bg-muted transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4
                          className={`font-medium text-sm leading-tight group-hover:text-primary ${
                            item.read ? "text-muted-foreground" : ""
                          }`}
                        >
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
      </PopoverContent>
    </Popover>
  )
}

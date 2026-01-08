"use client"

import { buttonVariants } from "@/components/ui/button"
import { NotificationDot } from "@/app/[domain]/components/notificationDot"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import React from "react"

export type SidebarNavItem = {
    href: string
    hrefRegex?: string
    title: React.ReactNode
    isNotificationDotVisible?: boolean
}

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
    items: SidebarNavItem[]
}

export function SidebarNav({ className, items, ...props }: SidebarNavProps) {
    const pathname = usePathname()

    return (
        <nav
            className={cn(
                "flex flex-col space-x-2 lg:space-x-0 lg:space-y-1",
                className
            )}
            {...props}
        >
            {items.map((item) => {
                const isActive = item.hrefRegex ? new RegExp(item.hrefRegex).test(pathname) : pathname === item.href;

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            buttonVariants({ variant: "ghost" }),
                            isActive
                                ? "bg-muted hover:bg-muted"
                                : "hover:bg-transparent hover:underline",
                            "justify-start"
                        )}
                    >
                        {item.title}
                        {item.isNotificationDotVisible && <NotificationDot className="ml-1.5" />}
                    </Link>
                )
            })}
        </nav>
    )
}
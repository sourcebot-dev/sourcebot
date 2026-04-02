'use client';

import {
    LogOut,
    Settings,
} from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { signOut } from "next-auth/react"
import posthog from "posthog-js";
import { useDomain } from "@/hooks/useDomain";
import { Session } from "next-auth";
import { AppearanceDropdownMenuGroup } from "./appearanceDropdownMenuGroup";
import { UserAvatar } from "@/components/userAvatar";

interface MeControlDropdownMenuProps {
    menuButtonClassName?: string;
    session: Session;
}

export const MeControlDropdownMenu = ({
    menuButtonClassName,
    session,
}: MeControlDropdownMenuProps) => {
    const domain = useDomain();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <UserAvatar
                    email={session.user.email}
                    imageUrl={session.user.image}
                    className={cn("h-8 w-8 cursor-pointer", menuButtonClassName)}
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end" sideOffset={5}>
                <DropdownMenuGroup>
                    <div className="flex flex-row items-center gap-3 px-3 py-3">
                        <UserAvatar
                            email={session.user.email}
                            imageUrl={session.user.image}
                            className="h-10 w-10 flex-shrink-0"
                        />
                        <div className="flex flex-col flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{session.user.name ?? "User"}</p>
                            {session.user.email && (
                                <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                            )}
                        </div>
                    </div>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <AppearanceDropdownMenuGroup />
                <DropdownMenuItem asChild>
                    <a href={`/${domain}/settings`}>
                        <Settings className="h-4 w-4 mr-2" />
                        <span>Settings</span>
                    </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem
                        onClick={() => {
                            signOut({
                                redirectTo: "/login",
                            }).then(() => {
                                posthog.reset();
                            })
                        }}
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

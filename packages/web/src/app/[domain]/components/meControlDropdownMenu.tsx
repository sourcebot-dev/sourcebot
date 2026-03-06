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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOut } from "next-auth/react"
import posthog from "posthog-js";
import { useDomain } from "@/hooks/useDomain";
import { Session } from "next-auth";
import { AppearanceDropdownMenuGroup } from "./appearanceDropdownMenuGroup";
import placeholderAvatar from "@/public/placeholder_avatar.png";

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
                <Avatar className={cn("h-8 w-8 cursor-pointer", menuButtonClassName)}>
                    <AvatarImage src={session.user.image ?? placeholderAvatar.src} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                        {session.user.name && session.user.name.length > 0 ? session.user.name[0].toUpperCase() : 'U'}
                    </AvatarFallback>
                </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end" sideOffset={5}>
                <DropdownMenuGroup>
                    <div className="flex flex-row items-center gap-3 px-3 py-3">
                        <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarImage
                                src={session.user.image ?? placeholderAvatar.src}
                            />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {session.user.name && session.user.name.length > 0 ? session.user.name[0].toUpperCase() : 'U'}
                            </AvatarFallback>
                        </Avatar>
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

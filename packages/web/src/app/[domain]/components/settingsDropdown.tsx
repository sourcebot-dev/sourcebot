'use client';

import {
    CodeIcon,
    Laptop,
    LogOut,
    Moon,
    Settings,
    Sun
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "next-themes"
import { useMemo, useState } from "react"
import { KeymapType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useKeymapType } from "@/hooks/useKeymapType"
import { NEXT_PUBLIC_SOURCEBOT_VERSION } from "@/lib/environment.client";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOut } from "next-auth/react"


interface SettingsDropdownProps {
    menuButtonClassName?: string;
}

export const SettingsDropdown = ({
    menuButtonClassName,
}: SettingsDropdownProps) => {

    const { theme: _theme, setTheme } = useTheme();
    const [keymapType, setKeymapType] = useKeymapType();
    const { data: session, update } = useSession();

    const theme = useMemo(() => {
        return _theme ?? "light";
    }, [_theme]);

    const ThemeIcon = useMemo(() => {
        switch (theme) {
            case "light":
                return <Sun className="h-4 w-4 mr-2" />;
            case "dark":
                return <Moon className="h-4 w-4 mr-2" />;
            case "system":
                return <Laptop className="h-4 w-4 mr-2" />;
            default:
                return <Laptop className="h-4 w-4 mr-2" />;
        }
    }, [theme]);

    return (
        // Was hitting a bug with invite code login where the first time the user signs in, the settingsDropdown doesn't have a valid session. To fix this
        // we can simply update the session everytime the settingsDropdown is opened. This isn't a super frequent operation and updating the session is low cost,
        // so this is a simple solution to the problem.
        <DropdownMenu onOpenChange={(isOpen) => {
            if (isOpen) {
                update();
            }
        }}>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className={cn(menuButtonClassName)}>
                    <Settings className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
                {session?.user && (
                    <DropdownMenuGroup>
                        <div className="flex flex-row items-center gap-1 p-2">
                            <Avatar>
                                <AvatarImage
                                    src={session.user.image ?? ""}
                                />
                                <AvatarFallback>
                                    {session.user.name && session.user.name.length > 0 ? session.user.name[0] : 'U'}
                                </AvatarFallback>
                            </Avatar>
                            <p className="text-sm font-medium text-ellipsis">{session.user.email ?? "User"}</p>
                        </div>
                        <DropdownMenuItem
                            onClick={() => {
                                signOut({
                                    redirectTo: "/login",
                                });
                            }}
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Log out</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                    </DropdownMenuGroup>
                )}
                <DropdownMenuGroup>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            {ThemeIcon}
                            <span>Theme</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                                <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                                    <DropdownMenuRadioItem value="light">
                                        Light
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="dark">
                                        Dark
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="system">
                                        System
                                    </DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <CodeIcon className="h-4 w-4 mr-2" />
                            <span>Code navigation</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                                <DropdownMenuRadioGroup value={keymapType} onValueChange={(value) => setKeymapType(value as KeymapType)}>
                                    <DropdownMenuRadioItem value="default">
                                        Default
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="vim">
                                        Vim
                                    </DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                    </DropdownMenuSub>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <div className="px-2 py-1 text-sm text-muted-foreground">
                    version: {NEXT_PUBLIC_SOURCEBOT_VERSION}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

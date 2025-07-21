'use client';

import {
    CodeIcon,
    Laptop,
    LogIn,
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
import { useMemo } from "react"
import { KeymapType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useKeymapType } from "@/hooks/useKeymapType"
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOut } from "next-auth/react"
import { env } from "@/env.mjs";
import posthog from "posthog-js";
import { useDomain } from "@/hooks/useDomain";

interface SettingsDropdownProps {
    menuButtonClassName?: string;
}

export const SettingsDropdown = ({
    menuButtonClassName,
}: SettingsDropdownProps) => {

    const { theme: _theme, setTheme } = useTheme();
    const [keymapType, setKeymapType] = useKeymapType();
    const { data: session } = useSession();
    const domain = useDomain();

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
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className={cn(menuButtonClassName)}>
                    <Settings className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
                {session?.user ? (
                    <DropdownMenuGroup>
                        <div className="flex flex-row items-start gap-3 p-2">
                            <Avatar className="flex-shrink-0">
                                <AvatarImage
                                    src={session.user.image ?? ""}
                                />
                                <AvatarFallback>
                                    {session.user.name && session.user.name.length > 0 ? session.user.name[0] : 'U'}
                                </AvatarFallback>
                            </Avatar>
                            <p className="text-sm font-medium break-all flex-1 leading-relaxed">{session.user.email ?? "User"}</p>
                        </div>
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
                ) : (
                    <DropdownMenuItem
                        onClick={() => {
                            window.location.href = "/login";
                        }}
                    >
                        <LogIn className="mr-2 h-4 w-4" />
                        <span>Sign in</span>
                    </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
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
                    {session?.user && (
                        <DropdownMenuItem asChild>
                            <a href={`/${domain}/settings`}>
                                <Settings className="h-4 w-4 mr-2" />
                                <span>Settings</span>
                            </a>
                        </DropdownMenuItem>
                    )}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <div className="px-2 py-1 text-sm text-muted-foreground">
                    version: {env.NEXT_PUBLIC_SOURCEBOT_VERSION}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

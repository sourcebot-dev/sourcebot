"use client";

import { SourcebotLogo } from "@/app/components/sourcebotLogo";
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
} from "@/components/ui/dropdown-menu";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    useSidebar,
} from "@/components/ui/sidebar";
import { UserAvatar } from "@/components/userAvatar";
import { useKeymapType } from "@/hooks/useKeymapType";
import { KeymapType } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
    ArrowLeftToLineIcon, ArrowRightToLineIcon, ChevronsUpDown, CodeIcon,
    Laptop, LogIn, LogOut, Moon, SettingsIcon, Sun, UserIcon
} from "lucide-react";
import { Session } from "next-auth";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import posthog from "posthog-js";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { WhatsNewSidebarButton } from "./whatsNewSidebarButton";

interface SidebarBaseProps {
    session: Session | null;
    collapsible?: "icon" | "offcanvas" | "none";
    headerContent: ReactNode;
    children: ReactNode;
}

export function SidebarBase({ session, collapsible = "icon", headerContent, children }: SidebarBaseProps) {
    const [isScrolled, setIsScrolled] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = contentRef.current;
        if (!el) {
            return;
        }
        const handleScroll = () => setIsScrolled(el.scrollTop > 0);
        el.addEventListener("scroll", handleScroll);
        return () => el.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <Sidebar
            collapsible={collapsible}
            className="!border-r-0"
        >
            <SidebarHeader className={cn("pt-4 border-b transition-[border-color] duration-200", isScrolled ? "border-sidebar-border" : "border-transparent")}>
                <Link href="/">
                    <div className="group-data-[state=collapsed]:hidden">
                        <SourcebotLogo className="w-fit h-8" size="large" />
                    </div>
                    <div className="hidden group-data-[state=collapsed]:block">
                        <SourcebotLogo className="w-fit h-8" size="small" />
                    </div>
                </Link>
                {headerContent}
            </SidebarHeader>
            <SidebarContent ref={contentRef}>
                {children}
            </SidebarContent>
            <SidebarFooter className="border-t border-sidebar-border">
                {collapsible !== "none" && <CollapseSidebarButton />}
                <WhatsNewSidebarButton />
                {session ? (
                    <MeControlDropdownMenu session={session} />
                ) : (
                    <GuestDropdownMenu />
                )}
            </SidebarFooter>
            {collapsible !== "none" && <SidebarRail />}
        </Sidebar>
    );
}

function CollapseSidebarButton() {
    const { toggleSidebar, state } = useSidebar();
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <Tooltip open={state === "expanded" ? false : undefined}>
                    <TooltipTrigger asChild>
                        <SidebarMenuButton onClick={toggleSidebar}>
                            {state === "expanded" ? (
                                <>
                                    <ArrowLeftToLineIcon />
                                    <span>Collapse sidebar</span>
                                </>
                            ) : (
                                <ArrowRightToLineIcon />
                            )}
                        </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="flex items-center gap-2">
                        <KeyboardShortcutHint shortcut="[" />
                        <Separator orientation="vertical" className="h-4" />
                        <span>Expand sidebar</span>
                    </TooltipContent>
                </Tooltip>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

interface MeControlDropdownMenuProps {
    session: Session;
}

const MeControlDropdownMenu = ({
    session,
}: MeControlDropdownMenuProps) => {
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <UserAvatar
                                email={session.user.email}
                                imageUrl={session.user.image}
                                className="h-8 w-8"
                            />
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">{session.user.name ?? "User"}</span>
                                {session.user.email && (
                                    <span className="truncate text-xs text-muted-foreground">{session.user.email}</span>
                                )}
                            </div>
                            <ChevronsUpDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64" side="top" align="start" sideOffset={4}>
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
                            <a href={`/settings`}>
                                <SettingsIcon className="h-4 w-4 mr-2" />
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
            </SidebarMenuItem>
        </SidebarMenu>
    )
}

const GuestDropdownMenu = () => {
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted flex-shrink-0">
                                <UserIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">Guest</span>
                                <span className="truncate text-xs text-muted-foreground">Not signed in</span>
                            </div>
                            <ChevronsUpDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64" side="top" align="start" sideOffset={4}>
                        <AppearanceDropdownMenuGroup />
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <a href="/login">
                                <LogIn className="h-4 w-4 mr-2" />
                                <span>Sign in</span>
                            </a>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}


const AppearanceDropdownMenuGroup = () => {
    const { theme: _theme, setTheme } = useTheme();
    const [keymapType, setKeymapType] = useKeymapType();

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
    )
}
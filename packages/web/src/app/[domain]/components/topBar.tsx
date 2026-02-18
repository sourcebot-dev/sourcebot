'use client';

import Link from "next/link";
import Image from "next/image";
import logoLight from "@/public/sb_logo_light.png";
import logoDark from "@/public/sb_logo_dark.png";
import { MeControlDropdownMenu } from "./meControlDropdownMenu";
import { Separator } from "@/components/ui/separator";
import { Session } from "next-auth";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppearanceDropdownMenu } from "./appearanceDropdownMenu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TopBarProps {
    domain: string;
    children?: React.ReactNode;
    centerContent?: React.ReactNode;
    actions?: React.ReactNode;
    homePath?: string;
    session: Session | null;
}

export const TopBar = ({
    domain,
    children,
    centerContent,
    actions,
    homePath = `/${domain}`,
    session,
}: TopBarProps) => {
    const router = useRouter();

    return (
        <div className='sticky top-0 left-0 right-0 z-10'>
            <div className="flex flex-row justify-between items-center py-1.5 px-3 gap-4 bg-background">
                <div className="flex-1 flex flex-row gap-4 items-center">
                    <Link
                        href={homePath}
                        className="shrink-0 cursor-pointer"
                    >
                        <Image
                            src={logoDark}
                            className="h-4 w-auto hidden dark:block"
                            alt={"Sourcebot logo"}
                        />
                        <Image
                            src={logoLight}
                            className="h-4 w-auto block dark:hidden"
                            alt={"Sourcebot logo"}
                        />
                    </Link>
                    {children}
                </div>
                {centerContent && (
                    <div className="flex-1 flex justify-center items-center">
                        {centerContent}
                    </div>
                )}
                <div className="flex-1 flex flex-row justify-end items-center gap-2">
                    {actions}
                    {session ? (
                        <MeControlDropdownMenu
                            menuButtonClassName="w-8 h-8"
                            session={session}
                        />
                    ) : (
                        <div className="flex flex-row items-center gap-2">
                            <Tooltip
                                delayDuration={100}
                            >
                                <TooltipTrigger
                                    asChild
                                >
                                    <Button
                                        variant="outline" size="icon" className="w-8 h-8"
                                        onClick={() => {
                                            router.push("/login");
                                        }}
                                    >
                                        <LogIn className="h-3 w-3" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    Sign in
                                </TooltipContent>
                            </Tooltip>
                            <AppearanceDropdownMenu className="w-8 h-8" />
                        </div>
                    )}
                </div>
            </div>
            <Separator />
        </div>
    )
}

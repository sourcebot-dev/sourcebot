'use client';

import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getCodeHostIcon, getRepoImageSrc } from "@/lib/utils";
import { CodeHostType } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface RepoVisitItem {
    repoId: number;
    repoName: string;
    displayName: string | null;
    imageUrl: string | null;
    codeHostType: CodeHostType;
}

interface RepoVisitHistoryProps {
    repoVisits: RepoVisitItem[];
}

export function RepoVisitHistory({ repoVisits }: RepoVisitHistoryProps) {
    const pathname = usePathname();

    if (repoVisits.length === 0) {
        return null;
    }

    return (
        <SidebarGroup className="group-data-[state=collapsed]:hidden">
            <SidebarGroupLabel className="text-muted-foreground whitespace-nowrap">Recent Repositories</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {repoVisits.map((visit) => {
                        const href = `/browse/${visit.repoName}/-/tree/`;
                        const browsePrefix = `/browse/${visit.repoName}`;
                        const isActive = pathname === browsePrefix
                            || pathname.startsWith(`${browsePrefix}/-/`)
                            || pathname.startsWith(`${browsePrefix}@`);
                        const repoImageSrc = visit.imageUrl
                            ? getRepoImageSrc(visit.imageUrl, visit.repoId)
                            : undefined;
                        const codeHostIcon = getCodeHostIcon(visit.codeHostType);
                        const isInternalApiImage = repoImageSrc?.startsWith('/api/');

                        const name = visit.displayName ?
                            visit.displayName.split('/').pop() :
                            visit.repoName;

                        return (
                            <SidebarMenuItem key={visit.repoId}>
                                <SidebarMenuButton asChild isActive={isActive}>
                                    <Link href={href}>
                                        {repoImageSrc ? (
                                            <Image
                                                src={repoImageSrc}
                                                alt={visit.displayName ?? visit.repoName}
                                                width={16}
                                                height={16}
                                                className="shrink-0 rounded-sm object-cover"
                                                unoptimized={isInternalApiImage}
                                            />
                                        ) : (
                                            <Image
                                                src={codeHostIcon.src}
                                                alt={visit.displayName ?? visit.repoName}
                                                width={16}
                                                height={16}
                                                className={cn("shrink-0", codeHostIcon.className)}
                                            />
                                        )}
                                        <span className="truncate">
                                            {name}
                                        </span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

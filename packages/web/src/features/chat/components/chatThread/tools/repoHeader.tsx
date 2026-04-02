'use client';

import { getBrowsePath } from "@/app/[domain]/browse/hooks/utils";
import { cn, getCodeHostIcon } from "@/lib/utils";
import { CodeHostType } from "@sourcebot/db";
import Image from "next/image";
import Link from "next/link";

type RepoInfo = {
    displayName: string;
    codeHostType: CodeHostType;
};

export const RepoHeader = ({ repo, repoName, isPrimary }: { repo: RepoInfo | undefined; repoName: string; isPrimary: boolean }) => {
    const displayName = repo?.displayName ?? repoName.split('/').slice(1).join('/');
    const icon = repo ? getCodeHostIcon(repo.codeHostType) : null;

    const href = getBrowsePath({
        repoName: repoName,
        path: '',
        pathType: 'tree',
    });

    const className = cn("top-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-popover border-b border-border",
        {
            'sticky text-muted-foreground': !isPrimary,
            'text-foreground cursor-pointer hover:bg-accent transition-colors': isPrimary,
        }
    );

    const Content = (
        <>
            {icon && (
                <Image src={icon.src} alt={repo!.codeHostType} width={12} height={12} className={icon.className} />
            )}
            <span>{displayName}</span>
        </>
    );

    if (isPrimary) {
        return (
            <Link className={className} href={href}>
                {Content}
            </Link>
        );
    } else {
        return (
            <div className={className}>
                {Content}
            </div>
        );
    }
}

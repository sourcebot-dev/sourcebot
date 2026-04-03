'use client';

import { cn } from '@/lib/utils';
import { ExternalLinkIcon } from 'lucide-react';
import Image from 'next/image';
import linearLogo from '@/public/linear.svg';

interface LinearIssueCardProps {
    identifier: string;
    title: string;
    href: string;
    className?: string;
}

export const LinearIssueCard = ({ identifier, title, href, className }: LinearIssueCardProps) => {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                "not-prose inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-muted hover:bg-accent transition-colors text-sm no-underline",
                className
            )}
        >
            <Image
                src={linearLogo}
                alt="Linear"
                className="w-4 h-4 shrink-0 dark:invert"
            />
            <span className="font-mono font-semibold text-foreground">{identifier}</span>
            <span className="text-muted-foreground truncate max-w-[240px] capitalize">{title}</span>
            <ExternalLinkIcon className="w-3 h-3 shrink-0 text-muted-foreground" />
        </a>
    );
};

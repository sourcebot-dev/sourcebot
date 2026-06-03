'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface TocItem {
    id: string;
    text: string;
    level: number;
    element: HTMLElement;
}

interface TableOfContentsProps {
    tocItems: TocItem[];
    activeId: string;
    className?: string;
}

export const TableOfContents = ({ tocItems, activeId, className }: TableOfContentsProps) => {
    const scrollToHeading = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        }
    };

    return (
        <nav className={cn('space-y-0.5', className)}>
            {tocItems.map((item) => (
                <Button
                    key={item.id}
                    variant="link"
                    size="sm"
                    onClick={() => scrollToHeading(item.id)}
                    className={cn(
                        'w-full justify-start text-left h-auto py-0.5 px-0 font-normal text-wrap hover:text-foreground underline-offset-2 text-xs',
                        {
                            'text-foreground': activeId === item.id,
                            'text-muted-foreground': activeId !== item.id,
                        }
                    )}
                    style={{
                        paddingLeft: `${(item.level - 1) * 8 + 0}px`
                    }}
                >
                    {item.text}
                </Button>
            ))}
        </nav>
    );
}; 
'use client';

import { cn } from '@/lib/utils';
import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';

interface TocItem {
    id: string;
    text: string;
    level: number;
    element: HTMLElement;
}

interface TableOfContentsProps {
    targetSelector: string;
    className?: string;
}

export const TableOfContents = ({ targetSelector, className }: TableOfContentsProps) => {
    const [tocItems, setTocItems] = useState<TocItem[]>([]);
    const [activeId, setActiveId] = useState<string>('');
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        const extractHeadings = () => {
            const targetElement = document.querySelector(targetSelector);
            if (!targetElement) return;

            const headings = targetElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
            const items: TocItem[] = [];

            headings.forEach((heading) => {
                const element = heading as HTMLElement;
                const level = parseInt(element.tagName.charAt(1));
                const text = element.textContent?.trim() || '';
                
                if (text && element.id) {
                    items.push({
                        id: element.id,
                        text,
                        level,
                        element
                    });
                }
            });

            setTocItems(items);
        };

        // Initial extraction
        extractHeadings();

        // Set up MutationObserver to watch for DOM changes
        const targetElement = document.querySelector(targetSelector);
        if (targetElement) {
            const observer = new MutationObserver(() => {
                extractHeadings();
            });

            observer.observe(targetElement, {
                childList: true,
                subtree: true,
                characterData: true
            });

            return () => observer.disconnect();
        }
    }, [targetSelector]);

    // Set up intersection observer for active heading tracking
    useEffect(() => {
        if (tocItems.length === 0) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id);
                    }
                });
            },
            {
                rootMargin: '-20px 0px -80% 0px'
            }
        );

        tocItems.forEach((item) => {
            if (observerRef.current) {
                observerRef.current.observe(item.element);
            }
        });

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [tocItems]);

    const scrollToHeading = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        }
    };

    if (tocItems.length === 0) {
        return null;
    }

    return (
        <div className={cn('space-y-1', className)}>
            <div className="text-sm font-medium text-muted-foreground mb-2">
                Table of Contents
            </div>
            <nav className="space-y-0.5">
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
        </div>
    );
}; 
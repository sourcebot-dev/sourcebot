'use client';

import { useEffect, useRef, useState } from "react";

interface Props {
    target: HTMLElement | null;
}

export interface TocItem {
    id: string;
    text: string;
    level: number;
    element: HTMLElement;
}


export const useExtractTOCItems = ({ target }: Props) => {
    const [tocItems, setTocItems] = useState<TocItem[]>([]);
    const [activeId, setActiveId] = useState<string>('');
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        const extractHeadings = () => {
            if (!target) return;

            const headings = target.querySelectorAll('h1, h2, h3, h4, h5, h6');
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
        if (target) {
            const observer = new MutationObserver(() => {
                extractHeadings();
            });

            observer.observe(target, {
                childList: true,
                subtree: true,
                characterData: true
            });

            return () => observer.disconnect();
        }
    }, [target]);

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

    return {
        tocItems,
        activeId
    }
}
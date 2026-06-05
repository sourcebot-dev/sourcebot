'use client';

import { useEffect, useRef } from "react";

const BANNER_HEIGHT_VAR = '--banner-height';

/**
 * Measures the rendered height of the top banner and exposes it as the
 * `--banner-height` CSS variable on the document root (0px when no banner is
 * shown). Viewport-based layouts (e.g. the chat thread's `calc(100vh - ...)`
 * sizing) subtract this so they don't overflow when a banner is present.
 */
export function BannerHeightObserver({ children }: { children: React.ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) {
            return;
        }

        const root = document.documentElement;
        const setHeight = (height: number) => {
            root.style.setProperty(BANNER_HEIGHT_VAR, `${height}px`);
        };

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setHeight(entry.contentRect.height);
            }
        });
        resizeObserver.observe(element);

        return () => {
            resizeObserver.disconnect();
            root.style.setProperty(BANNER_HEIGHT_VAR, '0px');
        };
    }, []);

    return <div ref={ref}>{children}</div>;
}

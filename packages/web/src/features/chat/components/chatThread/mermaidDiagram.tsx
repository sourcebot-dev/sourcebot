'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Play } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CodeBlock } from './codeBlock';

// Read dark mode from the DOM directly. `useTheme()` from `next-themes` returns
// `undefined` for `resolvedTheme` until hydration finishes, which would cause the
// first render attempt to use mermaid's *light* theme (dark text) even on dark
// pages — producing an invisible diagram inside our dark card.
const readResolvedTheme = (): 'dark' | 'light' | undefined => {
    if (typeof document === 'undefined') {
        return undefined;
    }
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
};

interface MermaidDiagramProps {
    code: string;
    className?: string;
    onRenderStateChange?: (state: { isRendered: boolean; svg?: string; error?: string }) => void;
}

const RENDER_DEBOUNCE_MS = 250;

// Hard guards to keep the main thread responsive. Mermaid is synchronous and
// can block for many seconds on large or pathological diagrams. Anything above
// these limits is gated behind an explicit user click ("Render diagram") so the
// page never freezes on its own.
const AUTO_RENDER_MAX_LINES = 60;
const AUTO_RENDER_MAX_CHARS = 4000;

// Initialize mermaid once per page load, not per render. Calling initialize on
// every render was harmless functionally but wasteful and made debugging slower.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mermaid types live behind a dynamic import
let mermaidModule: any | undefined;
let mermaidInitializedTheme: 'dark' | 'default' | undefined;

const loadMermaid = async () => {
    if (mermaidModule) {
        return mermaidModule;
    }
    const mod = await import('mermaid');
    mermaidModule = mod.default;
    return mermaidModule;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const initializeMermaidIfNeeded = (mermaid: any, theme: 'dark' | 'default') => {
    if (mermaidInitializedTheme === theme) {
        return;
    }
    mermaid.initialize({
        startOnLoad: false,
        theme,
        securityLevel: 'strict',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        flowchart: { htmlLabels: true, useMaxWidth: true },
        sequence: { useMaxWidth: true },
        gantt: { useMaxWidth: true },
        er: { useMaxWidth: true },
        class: { useMaxWidth: true },
    });
    mermaidInitializedTheme = theme;
};

export const MermaidDiagram = ({ code, className, onRenderStateChange }: MermaidDiagramProps) => {
    const reactId = useId();
    const renderTokenRef = useRef(0);
    const containerRef = useRef<HTMLDivElement | null>(null);
    // Pull from next-themes for theme-change reactivity (e.g. user toggles dark mode),
    // but fall back to a DOM read so the very first render gets the correct theme
    // even before next-themes has finished hydrating.
    const { resolvedTheme: hookResolvedTheme } = useTheme();
    const resolvedTheme = hookResolvedTheme ?? readResolvedTheme();
    const isDarkMode = resolvedTheme === 'dark';
    const [svg, setSvg] = useState<string | undefined>(undefined);
    const [error, setError] = useState<string | undefined>(undefined);
    const [isRendering, setIsRendering] = useState(false);
    const [isInViewport, setIsInViewport] = useState(false);
    const [hasUserOptedIn, setHasUserOptedIn] = useState(false);

    const sanitizedCode = useMemo(() => code.trim(), [code]);

    const renderId = useMemo(() => {
        return `mermaid-${reactId.replace(/:/g, '')}`;
    }, [reactId]);

    const complexity = useMemo(() => {
        const lines = sanitizedCode.split('\n').length;
        const chars = sanitizedCode.length;
        const isLarge = lines > AUTO_RENDER_MAX_LINES || chars > AUTO_RENDER_MAX_CHARS;
        return { lines, chars, isLarge };
    }, [sanitizedCode]);

    // Whether we should attempt an auto-render. We require: (1) the diagram is
    // small enough that it won't freeze the browser, and (2) the diagram has
    // scrolled into (or near) the viewport. Large diagrams require an explicit
    // click. This is the single most important guard against page-unresponsive
    // dialogs on chats with many failed diagrams stacked up.
    const shouldRender = useMemo(() => {
        if (hasUserOptedIn) {
            return true;
        }
        if (complexity.isLarge) {
            return false;
        }
        return isInViewport;
    }, [hasUserOptedIn, complexity.isLarge, isInViewport]);

    const render = useCallback(async (input: string, theme: 'dark' | 'default') => {
        const token = ++renderTokenRef.current;
        setIsRendering(true);

        try {
            const mermaid = await loadMermaid();
            initializeMermaidIfNeeded(mermaid, theme);

            await mermaid.parse(input);
            const { svg: rendered } = await mermaid.render(renderId, input);

            if (token !== renderTokenRef.current) {
                return;
            }

            setSvg(rendered);
            setError(undefined);
            onRenderStateChange?.({ isRendered: true, svg: rendered });
        } catch (err) {
            if (token !== renderTokenRef.current) {
                return;
            }
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
            setSvg(undefined);
            onRenderStateChange?.({ isRendered: false, error: message });
        } finally {
            if (token === renderTokenRef.current) {
                setIsRendering(false);
            }
        }
    }, [renderId, onRenderStateChange]);

    // Observe when the diagram scrolls into view. We use a generous rootMargin
    // so rendering kicks off slightly before the user actually sees the slot,
    // which feels instant in practice.
    useEffect(() => {
        const node = containerRef.current;
        if (!node || typeof IntersectionObserver === 'undefined') {
            setIsInViewport(true);
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setIsInViewport(true);
                        observer.disconnect();
                        return;
                    }
                }
            },
            { rootMargin: '200px 0px' },
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!sanitizedCode || !shouldRender) {
            return;
        }

        const theme = isDarkMode ? 'dark' : 'default';
        const timeout = setTimeout(() => {
            void render(sanitizedCode, theme);
        }, RENDER_DEBOUNCE_MS);

        return () => {
            clearTimeout(timeout);
        };
    }, [sanitizedCode, isDarkMode, render, shouldRender]);

    // Large diagram gated behind a click — never auto-renders.
    if (complexity.isLarge && !hasUserOptedIn) {
        return (
            <div
                ref={containerRef}
                className={cn(
                    'flex flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 py-6 px-4 not-prose my-4',
                    className,
                )}
            >
                <p className="text-xs text-muted-foreground text-center">
                    Large diagram ({complexity.lines} lines, {complexity.chars.toLocaleString()} chars). Auto-rendering is disabled to keep the page responsive.
                </p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHasUserOptedIn(true)}
                >
                    <Play className="h-3.5 w-3.5 mr-1" />
                    Render diagram
                </Button>
                <details className="w-full text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground text-center">
                        Show source instead
                    </summary>
                    <div className="mt-2">
                        <CodeBlock code={code} language="mermaid" />
                    </div>
                </details>
            </div>
        );
    }

    if (error && !isRendering) {
        return (
            <div
                ref={containerRef}
                className={cn('flex flex-col gap-2 not-prose my-4', className)}
            >
                <div className="text-xs text-muted-foreground italic">
                    Diagram could not be rendered. Showing source.
                </div>
                <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Mermaid error details
                    </summary>
                    <pre className="mt-1 p-2 rounded bg-muted text-destructive whitespace-pre-wrap break-all">
                        {error}
                    </pre>
                </details>
                <CodeBlock code={code} language="mermaid" />
            </div>
        );
    }

    if (!svg) {
        return (
            <div
                ref={containerRef}
                className={cn(
                    'flex items-center justify-center rounded-md border border-dashed bg-muted/30 py-12 not-prose my-4',
                    className,
                )}
            >
                <span className="text-xs text-muted-foreground">
                    {shouldRender ? 'Rendering diagram...' : 'Diagram queued (scroll to render)'}
                </span>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            // Force a contrasting background that matches the theme mermaid actually rendered for.
            // Without this, the SVG (which is transparent) takes on the parent's background, and
            // dark-mode pages would show dark mermaid lines on a dark `bg-card` — invisible.
            // Min-height keeps the slot stable while mermaid is computing dimensions and prevents
            // a layout-collapse-to-zero on malformed SVGs.
            style={{ minHeight: 80 }}
            className={cn(
                'flex justify-center overflow-x-auto rounded-md border p-3 not-prose my-4 [&_svg]:max-w-full [&_svg]:h-auto',
                isDarkMode ? 'bg-[#1e1e2e]' : 'bg-white',
                className,
            )}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
};

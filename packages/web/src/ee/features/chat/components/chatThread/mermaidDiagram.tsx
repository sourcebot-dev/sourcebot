'use client';

import { useToast } from '@/components/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useThemeNormalized } from '@/hooks/useThemeNormalized';
import { cn } from '@/lib/utils';
import { CornerUpLeft, Copy, Download, Loader2, Maximize2, PanelRight, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CodeBlock } from './codeBlock';
import { getDiagramAnchorId, getDiagramId } from '@/ee/features/chat/diagramUtils';
import { useDiagramPanel } from '@/ee/features/chat/diagramPanelContext';

// Lazily-loaded mermaid module. Kept at module scope so the (heavy) library is
// imported at most once, and only when a diagram actually needs to render.
let mermaidModulePromise: Promise<typeof import('mermaid').default> | null = null;
const loadMermaid = async () => {
    if (!mermaidModulePromise) {
        mermaidModulePromise = import('mermaid').then((mod) => mod.default);
    }
    return mermaidModulePromise;
};

let renderCounter = 0;

const renderMermaidToSvg = async (code: string, theme: 'dark' | 'default'): Promise<string> => {
    const mermaid = await loadMermaid();
    mermaid.initialize({
        startOnLoad: false,
        // `strict` sanitizes mermaid's own SVG output (via DOMPurify) and
        // disables click bindings / arbitrary HTML in labels.
        securityLevel: 'strict',
        suppressErrorRendering: true,
        // Render labels as native SVG <text> rather than HTML <foreignObject>.
        // foreignObject content taints the canvas, which breaks PNG export
        // (`toBlob` throws a SecurityError on a tainted canvas).
        htmlLabels: false,
        flowchart: { htmlLabels: false },
        theme,
    });

    // Validate first so partial / invalid input throws before we attempt a
    // render (this is what drives the fallback-to-code behavior).
    await mermaid.parse(code);

    const id = `sb-mermaid-${Date.now()}-${renderCounter++}`;
    const { svg } = await mermaid.render(id, code);
    return svg;
};

const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
};

const PNG_TARGET_LONGEST_SIDE = 2400;
const PNG_MAX_CANVAS_DIM = 8000;

const getSvgBaseSize = (svgEl: Element): { width: number; height: number } => {
    const viewBox = svgEl.getAttribute('viewBox');
    if (viewBox) {
        const parts = viewBox.split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n));
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            return { width: parts[2], height: parts[3] };
        }
    }

    const width = parseFloat(svgEl.getAttribute('width') || '');
    const height = parseFloat(svgEl.getAttribute('height') || '');
    if (width > 0 && height > 0) {
        return { width, height };
    }

    return { width: 1024, height: 768 };
};

/**
 * Rasterize a mermaid SVG to a high-resolution PNG. We bake explicit pixel
 * dimensions (scaled up from the SVG's viewBox) into the SVG before drawing so
 * the browser rasterizes the vector at full resolution instead of upscaling a
 * small default bitmap.
 */
const svgToPngBlob = (svg: string, background: string): Promise<Blob | null> => {
    return new Promise((resolve) => {
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const svgEl = doc.documentElement;
        const { width: baseWidth, height: baseHeight } = getSvgBaseSize(svgEl);

        const longestSide = Math.max(baseWidth, baseHeight);
        let scale = Math.max(2, PNG_TARGET_LONGEST_SIDE / longestSide);
        if (baseWidth * scale > PNG_MAX_CANVAS_DIM || baseHeight * scale > PNG_MAX_CANVAS_DIM) {
            scale = Math.min(PNG_MAX_CANVAS_DIM / baseWidth, PNG_MAX_CANVAS_DIM / baseHeight);
        }

        const outWidth = Math.round(baseWidth * scale);
        const outHeight = Math.round(baseHeight * scale);

        svgEl.setAttribute('width', String(outWidth));
        svgEl.setAttribute('height', String(outHeight));
        const serialized = new XMLSerializer().serializeToString(svgEl);

        const url = URL.createObjectURL(new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' }));
        const image = new Image();

        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = outWidth;
            canvas.height = outHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(url);
                resolve(null);
                return;
            }

            // Mermaid SVGs are transparent; paint a theme-matched background so
            // the exported PNG is readable on any viewer.
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, outWidth, outHeight);
            ctx.drawImage(image, 0, 0, outWidth, outHeight);
            URL.revokeObjectURL(url);

            canvas.toBlob((pngBlob) => resolve(pngBlob), 'image/png');
        };

        image.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };

        image.src = url;
    });
};

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;

/**
 * Interactive diagram surface: renders the SVG with click-drag panning and
 * zoom controls that reveal on hover. Shared by the inline and fullscreen
 * views so both behave identically.
 */
const DiagramViewport = ({ svg, className, controlsClassName, actions, fill, forceControlsVisible }: { svg: string; className?: string; controlsClassName?: string; actions?: ReactNode; fill?: boolean; forceControlsVisible?: boolean }) => {
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const draggingRef = useRef(false);
    const startRef = useRef({ x: 0, y: 0 });

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        draggingRef.current = true;
        startRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
        e.currentTarget.setPointerCapture(e.pointerId);
    }, [offset]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!draggingRef.current) {
            return;
        }
        setOffset({ x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y });
    }, []);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        draggingRef.current = false;
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
            // no-op: pointer may already be released
        }
    }, []);

    const reset = useCallback(() => {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
    }, []);

    return (
        <div className={cn('group relative overflow-hidden bg-background', className)}>
            <div
                className={cn(
                    'flex cursor-grab select-none items-center justify-center touch-none active:cursor-grabbing',
                    // `fill` (fullscreen) fills a definite-height container; otherwise the
                    // surface is content-driven so the box matches the diagram's height.
                    fill ? 'absolute inset-0' : 'w-full min-h-[120px]',
                )}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
            >
                <div
                    className="pointer-events-none [&_svg]:h-auto [&_svg]:max-w-full"
                    style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
                    dangerouslySetInnerHTML={{ __html: svg }}
                />
            </div>

            <div className={cn('absolute right-2 top-2 flex items-center gap-0.5 rounded-md border bg-background/90 p-0.5 shadow-sm transition-opacity', forceControlsVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100', controlsClassName)}>
                {actions}
                {actions && <div className="mx-0.5 h-4 w-px bg-border" />}
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
                    aria-label="Zoom out"
                >
                    <ZoomOut className="h-3 w-3" />
                </Button>
                <span className="w-9 text-center text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
                    aria-label="Zoom in"
                >
                    <ZoomIn className="h-3 w-3" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={reset}
                    aria-label="Reset view"
                >
                    <RotateCcw className="h-3 w-3" />
                </Button>
            </div>
        </div>
    );
};

interface MermaidDiagramProps {
    code: string;
    /** DOM id for the container. Defaults to the canonical inline anchor. */
    domId?: string;
    /** 'inline' (in the answer) offers a "view in panel" action; 'panel' is the right-pane mirror. */
    variant?: 'inline' | 'panel';
    /** Whether to scroll/highlight when the URL hash targets this diagram. */
    listenToDeepLink?: boolean;
    /** Optional jump-to-counterpart action (used by the panel to jump to the inline diagram). */
    onJump?: () => void;
    jumpLabel?: string;
    /** Optional override classes for the root container (e.g. to drop the default margin). */
    className?: string;
}

export const MermaidDiagram = ({
    code,
    domId,
    variant = 'inline',
    listenToDeepLink = true,
    onJump,
    jumpLabel,
    className,
}: MermaidDiagramProps) => {
    const { theme } = useThemeNormalized();
    const mermaidTheme = theme === 'dark' ? 'dark' : 'default';
    const pngBackground = mermaidTheme === 'dark' ? '#1e1e1e' : '#ffffff';
    const { toast } = useToast();

    const [svg, setSvg] = useState<string | null>(null);
    const [renderError, setRenderError] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isHighlighted, setIsHighlighted] = useState(false);
    // Keep the hover controls visible while a dropdown is open (the open menu
    // lives in a portal, so moving to it would otherwise drop the hover state).
    const [isCopyMenuOpen, setIsCopyMenuOpen] = useState(false);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const isAnyMenuOpen = isCopyMenuOpen || isExportMenuOpen;

    // Stable anchor derived from the (persisted) source, used for in-thread
    // deep links: a link to `#${canonicalAnchorId}` re-renders and scrolls to
    // the inline diagram on load. `containerId` may differ (e.g. the panel
    // mirror) to avoid duplicate DOM ids.
    const canonicalAnchorId = useMemo(() => getDiagramAnchorId(code), [code]);
    const containerId = domId ?? canonicalAnchorId;
    const diagramPanel = useDiagramPanel();
    const containerRef = useRef<HTMLDivElement>(null);

    // Render (debounced) whenever the source or theme changes. A try/catch
    // drives the fallback: partial or invalid mermaid leaves `svg` null and
    // sets `renderError`, so we render the raw code instead.
    useEffect(() => {
        let cancelled = false;
        const handle = setTimeout(async () => {
            try {
                const result = await renderMermaidToSvg(code, mermaidTheme);
                if (!cancelled) {
                    setSvg(result);
                    setRenderError(false);
                }
            } catch {
                if (!cancelled) {
                    setSvg(null);
                    setRenderError(true);
                }
            }
        }, 150);

        return () => {
            cancelled = true;
            clearTimeout(handle);
        };
    }, [code, mermaidTheme]);

    const diagramReady = svg !== null && !renderError;

    // Scroll to (and briefly highlight) this diagram when the URL hash targets
    // its anchor. Re-runs once the diagram renders so we land on final layout.
    useEffect(() => {
        if (!listenToDeepLink) {
            return;
        }
        const checkHash = () => {
            if (typeof window === 'undefined' || window.location.hash !== `#${canonicalAnchorId}`) {
                return;
            }
            containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setIsHighlighted(true);
            window.setTimeout(() => setIsHighlighted(false), 2000);
        };

        checkHash();
        window.addEventListener('hashchange', checkHash);
        return () => window.removeEventListener('hashchange', checkHash);
    }, [canonicalAnchorId, diagramReady, listenToDeepLink]);

    const onCopyLink = useCallback(() => {
        const url = new URL(window.location.href);
        url.hash = canonicalAnchorId;
        navigator.clipboard.writeText(url.toString());
        toast({ description: '✅ Copied link to diagram' });
    }, [canonicalAnchorId, toast]);

    const onCopySource = useCallback(() => {
        navigator.clipboard.writeText(code);
        toast({ description: '✅ Copied diagram source' });
    }, [code, toast]);

    const onCopyImage = useCallback(async () => {
        if (!svg) {
            return;
        }
        try {
            const blob = await svgToPngBlob(svg, pngBackground);
            if (!blob) {
                throw new Error('Failed to rasterize diagram');
            }
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            toast({ description: '✅ Copied diagram image' });
        } catch {
            toast({ description: '❌ Failed to copy image', variant: 'destructive' });
        }
    }, [svg, pngBackground, toast]);

    const onExportSvg = useCallback(() => {
        if (!svg) {
            return;
        }
        triggerDownload(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), 'diagram.svg');
    }, [svg]);

    const onExportPng = useCallback(async () => {
        if (!svg) {
            return;
        }
        const blob = await svgToPngBlob(svg, pngBackground);
        if (blob) {
            triggerDownload(blob, 'diagram.png');
        }
    }, [svg, pngBackground]);

    // Inline is capped (the answer pane shouldn't be dominated by one diagram);
    // the panel sizes to the diagram's full height and lets the right pane scroll.
    const viewportSizeClass = variant === 'panel' ? '' : 'max-h-[480px]';

    // On-hover controls overlaid on the diagram.
    const actions = (
        <>
            {variant === 'inline' && diagramPanel && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={() => diagramPanel.revealInPanel(getDiagramId(code))}
                    aria-label="View in side panel"
                >
                    <PanelRight className="h-3 w-3" />
                </Button>
            )}
            {onJump && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={onJump}
                    aria-label={jumpLabel ?? 'Jump to diagram'}
                >
                    <CornerUpLeft className="h-3 w-3" />
                </Button>
            )}
            <DropdownMenu open={isCopyMenuOpen} onOpenChange={setIsCopyMenuOpen}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 text-muted-foreground"
                        aria-label="Copy or share diagram"
                    >
                        <Copy className="h-3 w-3" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onCopyLink}>Copy link to diagram</DropdownMenuItem>
                    <DropdownMenuItem onClick={onCopySource}>Copy source</DropdownMenuItem>
                    <DropdownMenuItem onClick={onCopyImage}>Copy as image</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu open={isExportMenuOpen} onOpenChange={setIsExportMenuOpen}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 text-muted-foreground"
                        aria-label="Export diagram"
                    >
                        <Download className="h-3 w-3" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onExportSvg}>Export as SVG</DropdownMenuItem>
                    <DropdownMenuItem onClick={onExportPng}>Export as PNG</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 text-muted-foreground"
                onClick={() => setIsFullscreen(true)}
                aria-label="Open fullscreen"
            >
                <Maximize2 className="h-3 w-3" />
            </Button>
        </>
    );

    return (
        <div
            ref={containerRef}
            id={containerId}
            className={cn(
                'flex flex-col rounded-md border overflow-hidden not-prose my-4 scroll-mt-16 transition-shadow',
                isHighlighted && 'ring-2 ring-primary',
                className,
            )}
        >
            {diagramReady ? (
                <DiagramViewport svg={svg} className={viewportSizeClass} actions={actions} forceControlsVisible={isAnyMenuOpen} />
            ) : renderError ? (
                // Invalid / mid-stream source: show it as code until it renders cleanly.
                <CodeBlock code={code} language="mermaid" />
            ) : (
                // Initial render in flight: show a neutral placeholder rather than the source.
                <div className={cn('flex items-center justify-center bg-background text-muted-foreground', viewportSizeClass, 'min-h-[120px]')}>
                    <Loader2 className="h-4 w-4 animate-spin" />
                </div>
            )}

            <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
                {/* pt-12 reserves a top strip for the close (X) button so the
                    viewport's hover controls sit clearly below it. */}
                <DialogContent className="max-w-[90vw] w-[90vw] h-[90vh] flex flex-col p-3 pt-12 gap-2" closeButtonClassName="h-5 w-5">
                    <DialogTitle className="sr-only">Diagram</DialogTitle>
                    {svg && (
                        <DiagramViewport svg={svg} className="flex-1 rounded-md border" controlsClassName="right-3 top-3" fill />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

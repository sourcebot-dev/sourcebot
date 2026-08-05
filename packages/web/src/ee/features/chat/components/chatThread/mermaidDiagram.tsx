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
import { Copy, Download, Loader2, Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { CSSProperties, ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { CodeBlock } from './codeBlock';
import { sanitizeMermaidCode } from './mermaidSanitize';
import { getDiagramAnchorId, getDiagramId, getDiagramType } from '@/ee/features/chat/diagramUtils';
import { usePanelContext } from '@/ee/features/chat/panelContext';
import useCaptureEvent from '@/hooks/useCaptureEvent';

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

const renderMermaidToSvg = async (rawCode: string, theme: 'dark' | 'default'): Promise<string> => {
    const code = sanitizeMermaidCode(rawCode);
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

// Breathing room so the fitted diagram doesn't touch the viewport edges.
const FIT_MARGIN = 0.95;

// Panel sizing (see `computeFit`): the viewport grows to the diagram instead of
// a fixed box, clamped to the readable area.
const PANEL_MIN_HEIGHT = 240;
// Gap below a full-height diagram (avoids scroll jitter, keeps neighbours reachable).
const PANEL_VIEWPORT_MARGIN = 24;
// Fallback when no scroll-area ancestor can be measured.
const PANEL_FALLBACK_MAX_HEIGHT = 720;

// Zoom limits and the button step are relative to the fitted ("100%") scale, so
// the usable range and ±25% readout steps are consistent across diagram sizes.
const ZOOM_OUT_FACTOR = 0.25;
const ZOOM_IN_FACTOR = 32;
const ZOOM_STEP_FACTOR = 0.25;

interface IntrinsicSize {
    width: number;
    height: number;
}

// Diagram aspect ratio, from the SVG's viewBox. The SVG is rendered responsively
// (fills the width), so we only need the ratio for the fit math.
const parseSvgSize = (svg: string): IntrinsicSize => {
    const viewBoxMatch = svg.match(/viewBox\s*=\s*["']([^"']+)["']/);
    if (viewBoxMatch) {
        const parts = viewBoxMatch[1].split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n));
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            return { width: parts[2], height: parts[3] };
        }
    }
    return { width: 1024, height: 768 };
};

interface DiagramFit {
    // Initial transform scale (the 100% baseline); 1 = "fills the available width".
    fitScale: number;
    // Panel viewport height in px; null for inline / fullscreen (fixed / filled).
    panelHeight: number | null;
}

// Pure fit, as a transform scale where 1 = "fills the available width". Both the
// panel and fullscreen contain-fit the whole diagram, respecting width and
// height, so it never overflows the container in either dimension (zoom/pan to
// inspect details). The panel additionally grows its height to the fitted
// diagram, clamped to the readable area.
const computeFit = (
    { width: iw, height: ih }: IntrinsicSize,
    availWidth: number,
    availHeight: number,
    autoHeight: boolean,
): DiagramFit => {
    // How tall the diagram is when it fills the available width (i.e. at scale 1).
    const widthFitHeight = availWidth * (ih / iw);
    const heightFitScale = availHeight / widthFitHeight;

    // Contain-fit: never wider than the box, shrink to fit the height if tall.
    const fitScale = Math.min(1, heightFitScale) * FIT_MARGIN;

    if (!autoHeight) {
        return { fitScale, panelHeight: null };
    }

    const panelHeight = Math.round(Math.min(availHeight, Math.max(PANEL_MIN_HEIGHT, widthFitHeight * fitScale)));
    return { fitScale, panelHeight };
};

/**
 * Interactive diagram surface: the SVG with drag-to-pan + zoom (via
 * react-zoom-pan-pinch) and hover controls. Shared by the right-panel and
 * fullscreen views. The SVG fills the available width and the transform handles
 * zoom/overflow; `computeFit` picks the initial scale (treated as 100%), and the
 * zoom limits and button step are relative to it.
 *
 * `fill` is the fullscreen mode (contain-fit into the dialog); otherwise this is
 * the panel diagram, whose height grows to the diagram (clamped to the readable
 * area).
 */
const DiagramViewport = ({ svg, className, controlsClassName, actions, fill, forceControlsVisible, onPan }: { svg: string; className?: string; controlsClassName?: string; actions?: ReactNode; fill?: boolean; forceControlsVisible?: boolean; onPan?: () => void }) => {
    const intrinsic = useMemo(() => parseSvgSize(svg), [svg]);
    const rootRef = useRef<HTMLDivElement>(null);
    const apiRef = useRef<ReactZoomPanPinchRef>(null);
    // Fit (initial scale + panel height), measured from the container. Null until
    // measured; we gate the transform wrapper on it so the first paint is fitted.
    const [fit, setFit] = useState<DiagramFit | null>(null);
    // Live transform scale, driven by the library, for the relative zoom readout.
    const [scale, setScale] = useState(0);

    // Measure the available area and (re)compute the fit. Runs before paint and
    // on container / scroll-viewport resize.
    useLayoutEffect(() => {
        const root = rootRef.current;
        if (!root) {
            return;
        }

        const measure = () => {
            const availWidth = root.clientWidth;
            if (!availWidth) {
                return;
            }
            let availHeight: number;
            if (fill) {
                availHeight = root.clientHeight;
            } else {
                const viewport = root.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null;
                availHeight = viewport
                    ? Math.max(PANEL_MIN_HEIGHT, viewport.clientHeight - PANEL_VIEWPORT_MARGIN)
                    : PANEL_FALLBACK_MAX_HEIGHT;
            }
            if (!availHeight) {
                return;
            }
            // Fullscreen contain-fits the whole diagram; the panel grows its
            // height to the diagram (auto-height).
            const next = computeFit(intrinsic, availWidth, availHeight, !fill);
            setFit((prev) => (prev && prev.fitScale === next.fitScale && prev.panelHeight === next.panelHeight ? prev : next));
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(root);
        const viewport = fill ? null : root.closest('[data-radix-scroll-area-viewport]');
        if (viewport) {
            observer.observe(viewport);
        }
        return () => observer.disconnect();
    }, [intrinsic, fill]);

    const fitScale = fit?.fitScale ?? 1;
    const zoomStep = fitScale * ZOOM_STEP_FACTOR;
    const zoomLabel = `${Math.round(((scale || fitScale) / fitScale) * 100)}%`;

    const rootStyle: CSSProperties | undefined = fill
        ? undefined
        : { height: fit?.panelHeight ?? PANEL_MIN_HEIGHT };

    return (
        <div ref={rootRef} className={cn('group relative overflow-hidden bg-background', className)} style={rootStyle}>
            {fit && (
                <TransformWrapper
                    // Remount on a new diagram so it re-inits at the fresh fit
                    // scale + centered; resizes update min/max/height in place.
                    key={svg}
                    ref={apiRef}
                    initialScale={fit.fitScale}
                    minScale={fit.fitScale * ZOOM_OUT_FACTOR}
                    maxScale={fit.fitScale * ZOOM_IN_FACTOR}
                    centerOnInit
                    // Additive button steps (scale + step) so the readout moves in
                    // round ±25%-of-fit increments.
                    smooth={false}
                    limitToBounds
                    // Wheel zoom only in fullscreen; inline/panel let the wheel
                    // scroll the surrounding content instead of hijacking it.
                    wheel={{ disabled: !fill }}
                    doubleClick={{ disabled: true }}
                    onInit={(ref) => setScale(ref.state.scale)}
                    onTransform={(_ref, state) => setScale(state.scale)}
                    // Fires on actual drag movement (not a bare click); parent dedupes.
                    onPanning={onPan}
                >
                    <TransformComponent
                        wrapperClass="!w-full !h-full cursor-grab active:cursor-grabbing"
                        wrapperStyle={{ width: '100%', height: '100%' }}
                        // Content fills the column width (never its intrinsic px
                        // size); the transform handles all zoom/overflow.
                        contentStyle={{ width: '100%' }}
                    >
                        <div
                            className="w-full [&_svg]:!w-full [&_svg]:!h-auto [&_svg]:!max-w-none"
                            dangerouslySetInnerHTML={{ __html: svg }}
                        />
                    </TransformComponent>
                </TransformWrapper>
            )}

            <div className={cn('absolute right-2 top-2 flex items-center gap-0.5 rounded-md border bg-background/90 p-0.5 shadow-sm transition-opacity', forceControlsVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100', controlsClassName)}>
                {actions}
                {actions && <div className="mx-0.5 h-4 w-px bg-border" />}
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={() => apiRef.current?.zoomOut(zoomStep)}
                    aria-label="Zoom out"
                >
                    <ZoomOut className="h-3 w-3" />
                </Button>
                <span className="w-11 text-center text-xs tabular-nums text-muted-foreground">{zoomLabel}</span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={() => apiRef.current?.zoomIn(zoomStep)}
                    aria-label="Zoom in"
                >
                    <ZoomIn className="h-3 w-3" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={() => apiRef.current?.resetTransform()}
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
    /** Optional override classes for the root container (e.g. to drop the default margin). */
    className?: string;
}

/**
 * Renders a mermaid source block as an interactive diagram (pan/zoom, copy,
 * export, fullscreen). Used in the right "evidence" panel; inline, the answer
 * renders a {@link DiagramReferenceChip} that reveals this panel diagram.
 */
export const MermaidDiagram = ({
    code,
    className,
}: MermaidDiagramProps) => {
    const { theme } = useThemeNormalized();
    const mermaidTheme = theme === 'dark' ? 'dark' : 'default';
    const pngBackground = mermaidTheme === 'dark' ? '#1e1e1e' : '#ffffff';
    const { toast } = useToast();
    const captureEvent = useCaptureEvent();

    const panel = usePanelContext();
    const chatId = panel?.chatId;
    const isStreaming = panel?.isStreaming ?? false;
    const diagramId = useMemo(() => getDiagramId(code), [code]);
    const diagramType = useMemo(() => getDiagramType(code), [code]);

    const [svg, setSvg] = useState<string | null>(null);
    const [renderError, setRenderError] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    // Keep the hover controls visible while a dropdown is open (the open menu
    // lives in a portal, so moving to it would otherwise drop the hover state).
    const [isCopyMenuOpen, setIsCopyMenuOpen] = useState(false);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const isAnyMenuOpen = isCopyMenuOpen || isExportMenuOpen;

    // Stable anchor used by "Copy link to diagram": the link targets the inline
    // diagram reference (`#diagram-<hash>`) in the answer, which scrolls into
    // view and reveals this panel diagram on load.
    const canonicalAnchorId = useMemo(() => getDiagramAnchorId(code), [code]);

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

    // Gates the render-outcome event below to diagrams generated live this
    // session, so it doesn't fire when a chat is revisited / viewed from history.
    const observedStreamingRef = useRef(false);
    useEffect(() => {
        if (isStreaming) {
            observedStreamingRef.current = true;
        }
    }, [isStreaming]);

    // Report the final render outcome (success vs invalid) once per diagram,
    // only after streaming settles (so transient mid-stream parse failures
    // aren't counted). Keyed on `code` so a theme re-render doesn't re-fire.
    const reportedRenderCodeRef = useRef<string | null>(null);
    useEffect(() => {
        if (!chatId || isStreaming || !observedStreamingRef.current || reportedRenderCodeRef.current === code) {
            return;
        }
        // Wait for the render to reach a terminal state.
        if (svg === null && !renderError) {
            return;
        }
        reportedRenderCodeRef.current = code;
        captureEvent('wa_chat_diagram_rendered', {
            chatId,
            diagramId,
            outcome: renderError ? 'error' : 'success',
            diagramType,
        });
    }, [chatId, isStreaming, code, svg, renderError, diagramId, diagramType, captureEvent]);

    // Click-and-drag pan on the inline diagram, reported once per diagram.
    const hasReportedPanRef = useRef(false);
    useEffect(() => {
        hasReportedPanRef.current = false;
    }, [code]);
    const onPanInteraction = useCallback(() => {
        if (hasReportedPanRef.current || !chatId) {
            return;
        }
        hasReportedPanRef.current = true;
        captureEvent('wa_chat_diagram_panned', { chatId, diagramId });
    }, [chatId, diagramId, captureEvent]);

    const onCopyLink = useCallback(async () => {
        if (chatId) {
            captureEvent('wa_chat_diagram_copied', { chatId, diagramId, format: 'link' });
        }
        try {
            const url = new URL(window.location.href);
            url.hash = canonicalAnchorId;
            await navigator.clipboard.writeText(url.toString());
            toast({ description: '✅ Copied link to diagram' });
        } catch {
            toast({ description: '❌ Failed to copy link', variant: 'destructive' });
        }
    }, [canonicalAnchorId, toast, chatId, diagramId, captureEvent]);

    const onCopySource = useCallback(async () => {
        if (chatId) {
            captureEvent('wa_chat_diagram_copied', { chatId, diagramId, format: 'source' });
        }
        try {
            await navigator.clipboard.writeText(code);
            toast({ description: '✅ Copied diagram source' });
        } catch {
            toast({ description: '❌ Failed to copy source', variant: 'destructive' });
        }
    }, [code, toast, chatId, diagramId, captureEvent]);

    const onCopyImage = useCallback(async () => {
        if (!svg) {
            return;
        }
        if (chatId) {
            captureEvent('wa_chat_diagram_copied', { chatId, diagramId, format: 'image' });
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
    }, [svg, pngBackground, toast, chatId, diagramId, captureEvent]);

    const onExportSvg = useCallback(() => {
        if (!svg) {
            return;
        }
        if (chatId) {
            captureEvent('wa_chat_diagram_exported', { chatId, diagramId, format: 'svg' });
        }
        triggerDownload(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), 'diagram.svg');
    }, [svg, chatId, diagramId, captureEvent]);

    const onExportPng = useCallback(async () => {
        if (!svg) {
            return;
        }
        if (chatId) {
            captureEvent('wa_chat_diagram_exported', { chatId, diagramId, format: 'png' });
        }
        const blob = await svgToPngBlob(svg, pngBackground);
        if (blob) {
            triggerDownload(blob, 'diagram.png');
        }
    }, [svg, pngBackground, chatId, diagramId, captureEvent]);

    // On-hover controls overlaid on the diagram.
    const actions = (
        <>
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
                onClick={() => {
                    if (chatId) {
                        captureEvent('wa_chat_diagram_fullscreen_opened', { chatId, diagramId });
                    }
                    setIsFullscreen(true);
                }}
                aria-label="Open fullscreen"
            >
                <Maximize2 className="h-3 w-3" />
            </Button>
        </>
    );

    return (
        <div
            className={cn(
                'flex flex-col rounded-md border overflow-hidden not-prose my-4',
                className,
            )}
        >
            {diagramReady ? (
                <DiagramViewport svg={svg} actions={actions} forceControlsVisible={isAnyMenuOpen} onPan={onPanInteraction} />
            ) : renderError ? (
                // Invalid / mid-stream source: show it as code until it renders cleanly.
                <CodeBlock code={code} language="mermaid" />
            ) : (
                // Initial render in flight: show a neutral placeholder rather than the source.
                <div className="flex items-center justify-center bg-background text-muted-foreground min-h-[120px]">
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

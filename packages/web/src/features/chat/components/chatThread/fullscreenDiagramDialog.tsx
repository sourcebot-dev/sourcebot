'use client';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Download, Maximize, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { CodeBlock } from './codeBlock';
import { MermaidDiagram } from './mermaidDiagram';

// Padding around the diagram when auto-fitting. Higher values give the diagram
// more breathing room from the dialog edges; lower values fill more aggressively.
const FIT_PADDING_PX = 40;

interface FullscreenDiagramDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    code: string;
    language: string;
}

export const FullscreenDiagramDialog = ({
    isOpen,
    onOpenChange,
    code,
    language,
}: FullscreenDiagramDialogProps) => {
    const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [renderedSvg, setRenderedSvg] = useState<string | undefined>(undefined);
    const { toast } = useToast();

    // Clear the cached SVG whenever the dialog opens or the input changes, so
    // a download triggered before the next render completes can't return the
    // previous diagram's SVG.
    useEffect(() => {
        setRenderedSvg(undefined);
    }, [isOpen, code, language]);

    // Auto-fit the diagram to the available space whenever the SVG (re)renders.
    // Mermaid's `useMaxWidth: true` makes the SVG cap at its natural width, which
    // looks tiny inside a 95vw dialog. zoomToElement computes the scale needed
    // to fit the element with our chosen padding, so the diagram opens at a
    // sensible size regardless of its natural dimensions.
    const fitDiagramToView = useCallback(() => {
        const wrapper = wrapperRef.current;
        const api = transformRef.current;
        if (!wrapper || !api) {
            return;
        }
        const svg = wrapper.querySelector('svg');
        if (!svg) {
            return;
        }
        try {
            // `zoomToElement(element, scale, animationTime, animationType)`.
            // Passing `undefined` for scale lets the library compute the best-fit scale.
            api.zoomToElement(svg as unknown as HTMLElement, undefined, 200);
        } catch {
            // No-op: if the library API changes or the element disappears mid-call,
            // we silently fall back to the default scale rather than crashing.
        }
    }, []);

    const onMermaidStateChange = useCallback((state: { isRendered: boolean; svg?: string }) => {
        setRenderedSvg(state.svg);
        if (state.isRendered) {
            // Wait a frame so the freshly-injected SVG has been laid out before we measure.
            requestAnimationFrame(() => {
                fitDiagramToView();
            });
        }
    }, [fitDiagramToView]);

    const onFitToView = useCallback(() => {
        fitDiagramToView();
    }, [fitDiagramToView]);

    const onCopySource = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(code);
            toast({ description: 'Diagram source copied to clipboard' });
        } catch {
            toast({ description: 'Failed to copy diagram source', variant: 'destructive' });
        }
    }, [code, toast]);

    const onDownloadSvg = useCallback(() => {
        if (!renderedSvg) {
            toast({ description: 'Diagram not ready to download yet', variant: 'destructive' });
            return;
        }

        try {
            const blob = new Blob([renderedSvg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `diagram-${Date.now()}.svg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            toast({ description: 'Failed to download SVG', variant: 'destructive' });
        }
    }, [renderedSvg, toast]);

    const onResetView = useCallback(() => {
        transformRef.current?.resetTransform();
    }, []);

    const onZoomIn = useCallback(() => {
        transformRef.current?.zoomIn();
    }, []);

    const onZoomOut = useCallback(() => {
        transformRef.current?.zoomOut();
    }, []);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 gap-0 flex flex-col">
                <DialogHeader className="px-6 pt-5 pb-3 border-b">
                    <DialogTitle className="text-base">Diagram</DialogTitle>
                    <DialogDescription className="sr-only">
                        Fullscreen diagram viewer with pan, zoom, copy, and download controls.
                    </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="diagram" className="flex flex-col flex-1 min-h-0">
                    <div className="px-6 pt-3 pb-2 border-b flex items-center justify-between gap-3 flex-wrap">
                        <TabsList>
                            <TabsTrigger value="diagram">Diagram</TabsTrigger>
                            <TabsTrigger value="source">Source</TabsTrigger>
                        </TabsList>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onZoomOut}
                                title="Zoom out"
                                aria-label="Zoom out"
                            >
                                <Minimize2 className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onZoomIn}
                                title="Zoom in"
                                aria-label="Zoom in"
                            >
                                <Maximize2 className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onFitToView}
                                title="Fit to view"
                                aria-label="Fit to view"
                            >
                                <Maximize className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onResetView}
                                title="Reset to 100%"
                                aria-label="Reset to 100%"
                            >
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onCopySource}
                                title="Copy source"
                                aria-label="Copy source"
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onDownloadSvg}
                                title="Download SVG"
                                aria-label="Download SVG"
                                disabled={!renderedSvg}
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <TabsContent value="diagram" className="flex-1 min-h-0 m-0">
                        <div ref={wrapperRef} className="w-full h-full bg-muted/20">
                            <TransformWrapper
                                ref={transformRef}
                                minScale={0.2}
                                maxScale={8}
                                initialScale={1}
                                centerOnInit={true}
                                wheel={{ step: 0.1 }}
                                doubleClick={{ disabled: false, mode: 'reset' }}
                                limitToBounds={false}
                            >
                                <TransformComponent
                                    wrapperStyle={{ width: '100%', height: '100%' }}
                                    contentStyle={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: FIT_PADDING_PX,
                                    }}
                                >
                                    {/*
                                        Reuse MermaidDiagram so the same renderer handles both inline and fullscreen views.
                                        When react-flow is added, this can be replaced with a routing component that
                                        switches on `language`.
                                    */}
                                    {language === 'mermaid' ? (
                                        <MermaidDiagram
                                            code={code}
                                            className="border-0 bg-transparent p-0 max-w-none"
                                            onRenderStateChange={onMermaidStateChange}
                                        />
                                    ) : (
                                        <CodeBlock code={code} language={language} />
                                    )}
                                </TransformComponent>
                            </TransformWrapper>
                        </div>
                    </TabsContent>
                    <TabsContent value="source" className="flex-1 min-h-0 overflow-auto m-0 px-6 py-4">
                        <CodeBlock code={code} language={language} />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

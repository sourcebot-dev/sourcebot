'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import useCaptureEvent from '@/hooks/useCaptureEvent';
import { Code2, Expand, RefreshCw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { CodeBlock } from './codeBlock';
import { FullscreenDiagramDialog } from './fullscreenDiagramDialog';
import { MermaidDiagram } from './mermaidDiagram';

export type DiagramLanguage = 'mermaid';

// Languages this renderer supports. Adding a new engine (e.g. react-flow) means:
//   1) Add it to `DiagramLanguage`,
//   2) Add a renderer to `DIAGRAM_RENDERERS`,
//   3) Add the language tag to `SUPPORTED_DIAGRAM_LANGUAGES`.
const DIAGRAM_RENDERERS: Record<DiagramLanguage, React.ComponentType<{
    code: string;
    onRenderStateChange?: (state: { isRendered: boolean; svg?: string; error?: string }) => void;
}>> = {
    mermaid: MermaidDiagram,
};

export const SUPPORTED_DIAGRAM_LANGUAGES: DiagramLanguage[] = ['mermaid'];

export const isDiagramLanguage = (language: string | undefined): language is DiagramLanguage => {
    return language !== undefined && (SUPPORTED_DIAGRAM_LANGUAGES as string[]).includes(language);
};

interface DiagramRendererProps {
    language: DiagramLanguage;
    code: string;
    chatId?: string;
}

// Markdown sanitization (rehype-raw + rehype-sanitize) encodes angle brackets and
// other characters as HTML entities by the time a code block reaches us. Diagram
// engines like mermaid expect raw text, so we decode the common entities here
// before handing off. We deliberately do this inline rather than via DOMParser so
// the same path works during SSR.
const ENTITY_DECODE_MAP: Record<string, string> = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
};

const decodeHtmlEntities = (text: string): string => {
    return text.replace(/&(?:lt|gt|amp|quot|#39|apos|nbsp);/g, (m) => ENTITY_DECODE_MAP[m] ?? m);
};

export const DiagramRenderer = ({ language, code: rawCode, chatId }: DiagramRendererProps) => {
    const code = useMemo(() => decodeHtmlEntities(rawCode), [rawCode]);
    const Renderer = DIAGRAM_RENDERERS[language];
    const captureEvent = useCaptureEvent();
    const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
    const [isSourceMode, setIsSourceMode] = useState(false);
    const [renderError, setRenderError] = useState<string | undefined>(undefined);
    const [hasRenderedOnce, setHasRenderedOnce] = useState(false);

    const onRenderStateChange = useCallback((state: { isRendered: boolean; svg?: string; error?: string }) => {
        setRenderError(state.error);
        if (state.isRendered && !hasRenderedOnce) {
            setHasRenderedOnce(true);
            captureEvent('wa_chat_diagram_rendered', {
                chatId: chatId ?? 'unknown',
                language,
            });
        }
    }, [hasRenderedOnce, captureEvent, chatId, language]);

    const onOpenFullscreen = useCallback(() => {
        setIsFullscreenOpen(true);
        captureEvent('wa_chat_diagram_fullscreen_opened', {
            chatId: chatId ?? 'unknown',
            language,
        });
    }, [captureEvent, chatId, language]);

    const toolbar = useMemo(() => (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover/diagram:opacity-100 focus-within:opacity-100 transition-opacity">
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0 bg-background/80 backdrop-blur"
                        onClick={() => setIsSourceMode((v) => !v)}
                    >
                        <Code2 className="h-3.5 w-3.5" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{isSourceMode ? 'Show diagram' : 'Show source'}</TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0 bg-background/80 backdrop-blur"
                        onClick={onOpenFullscreen}
                        disabled={!!renderError}
                    >
                        <Expand className="h-3.5 w-3.5" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Open fullscreen</TooltipContent>
            </Tooltip>
        </div>
    ), [isSourceMode, onOpenFullscreen, renderError]);

    return (
        <>
            <div className="relative group/diagram not-prose my-4">
                {toolbar}
                {isSourceMode ? (
                    <CodeBlock code={code} language={language} />
                ) : (
                    <Renderer code={code} onRenderStateChange={onRenderStateChange} />
                )}
                {renderError && !isSourceMode && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <RefreshCw className="h-3 w-3" />
                        <span>Streaming or invalid syntax. The diagram will appear once it&apos;s complete.</span>
                    </div>
                )}
            </div>
            <FullscreenDiagramDialog
                isOpen={isFullscreenOpen}
                onOpenChange={setIsFullscreenOpen}
                code={code}
                language={language}
            />
        </>
    );
};

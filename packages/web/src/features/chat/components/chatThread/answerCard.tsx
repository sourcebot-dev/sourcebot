'use client';

import { useExtractTOCItems } from "../../useTOCItems";
import { TableOfContents } from "./tableOfContents";
import { Button } from "@/components/ui/button";
import { Sparkles, TableOfContentsIcon, ThumbsDown, ThumbsUp } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { MarkdownRenderer } from "./markdownRenderer";
import { forwardRef, memo, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CopyIconButton } from "@/app/(app)/components/copyIconButton";
import { useToast } from "@/components/hooks/use-toast";
import { convertLLMOutputToPortableMarkdown } from "../../utils";
import { submitFeedback } from "../../actions";
import { isServiceError } from "@/lib/utils";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { LangfuseWeb } from "langfuse";
import { env } from "@sourcebot/shared/client";
import isEqual from "fast-deep-equal/react";
import { FileSource } from "../../types";
import { SUPPORTED_DIAGRAM_LANGUAGES } from "./diagramRenderer";

interface AnswerCardProps {
    answerText: string;
    messageId: string;
    chatId: string;
    traceId?: string;
    sources: FileSource[];
    /**
     * When provided, an "Visualize" button is shown in the answer header. Clicking
     * it sends a follow-up message asking the agent to render the answer as a
     * diagram. The button is hidden when the answer already contains a diagram
     * block, and disabled while a stream is in flight.
     */
    onVisualize?: () => void;
    isVisualizeDisabled?: boolean;
}

const diagramFenceRegexes = SUPPORTED_DIAGRAM_LANGUAGES.map(
    (lang) => new RegExp(`\`\`\`\\s*${lang}\\b`, 'i'),
);

const answerContainsDiagram = (text: string): boolean => {
    return diagramFenceRegexes.some((re) => re.test(text));
};

const langfuseWeb = env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY ? new LangfuseWeb({
    publicKey: env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY,
    baseUrl: env.NEXT_PUBLIC_LANGFUSE_BASE_URL,
}) : null;

const AnswerCardComponent = forwardRef<HTMLDivElement, AnswerCardProps>(({
    answerText,
    messageId,
    chatId,
    traceId,
    sources,
    onVisualize,
    isVisualizeDisabled = false,
}, forwardedRef) => {
    const markdownRendererRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line react-hooks/refs -- ref.current is passed to a custom hook, not used directly in render output
    const { tocItems, activeId } = useExtractTOCItems({ target: markdownRendererRef.current });
    const [isTOCButtonToggled, setIsTOCButtonToggled] = useState(false);
    const { toast } = useToast();
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [feedback, setFeedback] = useState<'like' | 'dislike' | undefined>(undefined);
    const captureEvent = useCaptureEvent();

    useImperativeHandle(
        forwardedRef,
        () => markdownRendererRef.current as HTMLDivElement
    );

    const onCopyAnswer = useCallback(() => {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const markdownText = convertLLMOutputToPortableMarkdown(answerText, baseUrl, sources);
        navigator.clipboard.writeText(markdownText);
        toast({
            description: "✅ Copied to clipboard",
        });
        captureEvent('wa_chat_copy_answer_pressed', { chatId });
        return true;
    }, [answerText, sources, chatId, captureEvent, toast]);

    // Always show the Visualize button when the callback is wired up. The earlier
    // "hide when a diagram is already present" heuristic was too aggressive — users
    // often want a different angle on the same answer (e.g. a higher-level overview,
    // or a sequence diagram instead of an architecture graph), and discoverability
    // suffered when the button silently disappeared mid-answer.
    const hasDiagram = useMemo(() => answerContainsDiagram(answerText), [answerText]);
    const isVisualizeButtonVisible = !!onVisualize;
    const visualizeButtonLabel = hasDiagram ? 'New diagram' : 'Visualize';
    const visualizeTooltip = hasDiagram
        ? 'Generate another diagram (different angle or detail level)'
        : 'Generate a diagram from this answer';

    const onVisualizeClick = useCallback(() => {
        if (!onVisualize) {
            return;
        }
        captureEvent('wa_chat_visualize_answer_pressed', { chatId, messageId });
        onVisualize();
    }, [onVisualize, captureEvent, chatId, messageId]);

    const onFeedback = useCallback(async (feedbackType: 'like' | 'dislike') => {
        setIsSubmittingFeedback(true);

        const response = await submitFeedback({
            chatId,
            messageId,
            feedbackType
        });

        if (isServiceError(response)) {
            toast({
                description: `❌ Failed to submit feedback: ${response.message}`,
                variant: "destructive"
            });
        } else {
            toast({
                description: `✅ Feedback submitted`,
            });
            setFeedback(feedbackType);
            captureEvent('wa_chat_feedback_submitted', {
                feedback: feedbackType,
                chatId,
                messageId,
            });

            langfuseWeb?.score({
                traceId: traceId,
                name: 'user_feedback',
                value: feedbackType === 'like' ? 1 : 0,
            })
        }

        setIsSubmittingFeedback(false);
    }, [chatId, messageId, toast, captureEvent, traceId]);

    return (
        <div className="flex flex-row w-full relative scroll-mt-16">
            {(isTOCButtonToggled && tocItems.length > 0) && (
                <TableOfContents
                    tocItems={tocItems}
                    activeId={activeId}
                    className="sticky top-0 h-fit max-w-44 py-2 mr-1.5"
                />
            )}
            <div className="flex flex-col w-full bg-[#fcfcfc] dark:bg-[#0e1320] px-4 py-2 rounded-lg shadow-sm">
                <div className="flex flex-col z-10 bg-inherit py-2 sticky top-0">
                    <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-muted-foreground">Answer</p>
                        <div className="flex items-center gap-2">
                            {isVisualizeButtonVisible && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-xs text-muted-foreground gap-1"
                                            onClick={onVisualizeClick}
                                            disabled={isVisualizeDisabled}
                                        >
                                            <Sparkles className="h-3.5 w-3.5" />
                                            {visualizeButtonLabel}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        {visualizeTooltip}
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <CopyIconButton
                                        onCopy={onCopyAnswer}
                                        className="h-6 w-6 text-muted-foreground"
                                    />
                                </TooltipTrigger>
                                <TooltipContent
                                    side="bottom"
                                >
                                    Copy answer
                                </TooltipContent>
                            </Tooltip>
                            {tocItems.length > 0 && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Toggle
                                            className="h-6 w-6 px-3 min-w-6 text-muted-foreground"
                                            pressed={isTOCButtonToggled}
                                            onPressedChange={(next) => {
                                                setIsTOCButtonToggled(next);
                                                captureEvent('wa_chat_toc_toggled', { chatId, isExpanded: next });
                                            }}
                                        >
                                            <TableOfContentsIcon className="h-3 w-3" />
                                        </Toggle>
                                    </TooltipTrigger>
                                    <TooltipContent
                                        side="bottom"
                                    >
                                        Toggle table of contents
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                    <Separator />
                </div>
                <MarkdownRenderer
                    ref={markdownRendererRef}
                    content={answerText}
                    chatId={chatId}
                    // scroll-mt offsets the scroll position for headings to take account
                    // of the sticky "answer" header.
                    className="prose prose-sm max-w-none prose-headings:scroll-mt-14"
                />
                <Separator className="my-2" />
                <div className="flex gap-2">
                    <Button
                        variant={feedback === 'like' ? "default" : "ghost"}
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => onFeedback('like')}
                        disabled={isSubmittingFeedback || feedback !== undefined}
                    >
                        <ThumbsUp className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={feedback === 'dislike' ? "default" : "ghost"}
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => onFeedback('dislike')}
                        disabled={isSubmittingFeedback || feedback !== undefined}
                    >
                        <ThumbsDown className="h-4 w-4" />
                    </Button>
                </div>
            </div>

        </div>
    )
})

AnswerCardComponent.displayName = 'AnswerCard';

export const AnswerCard = memo(AnswerCardComponent, isEqual);
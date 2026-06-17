'use client';

import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getArgumentHintTokenStates } from "@/features/chat/commands/argumentSubstitution";
import { createCommandInvocationData } from "@/features/chat/commands/utils";
import { AttachmentData, CustomEditor, MentionElement, RenderElementPropsFor, SearchScope } from "@/features/chat/types";
import { insertMention, slateContentToString } from "@/features/chat/utils";
import { createPastedTextAttachment, getSubmittedTextBytes, PendingAttachment, PendingImageAttachment, readFilesAsAttachments, shouldAutoConvertPaste, toAttachmentData, uploadImageAttachment } from "@/features/chat/attachmentUtils";
import { AttachmentButton } from "./attachmentButton";
import { AttachmentTray } from "./attachmentTray";
import { cn } from "@/lib/utils";
import { useIsMac } from "@/hooks/useIsMac";
import { computePosition, flip, offset, shift, VirtualElement } from "@floating-ui/react";
import { ArrowUp, Loader2, StopCircleIcon } from "lucide-react";
import { forwardRef, Fragment, KeyboardEvent, memo, Ref, type ReactNode, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Descendant, insertText } from "slate";
import { Editable, ReactEditor, RenderElementProps, RenderLeafProps, useFocused, useSelected, useSlate } from "slate-react";
import { useSelectedLanguageModel } from "../../useSelectedLanguageModel";
import { SuggestionBox } from "./suggestionsBox";
import { Suggestion } from "./types";
import { useSuggestionModeAndQuery } from "./useSuggestionModeAndQuery";
import { useSuggestionsData } from "./useSuggestionsData";
import { useToast } from "@/components/hooks/use-toast";
import { SearchContextQuery } from "@/lib/types";
import isEqual from "fast-deep-equal/react";
import { LoginDialog } from "./loginDialog";
import { usePathname } from "next/navigation";
import { ATTACHMENT_MAX_IMAGE_BYTES, ATTACHMENT_MAX_TURN_TEXT_BYTES, PENDING_CHAT_SUBMISSION_SESSION_STORAGE_KEY } from "@/features/chat/constants";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useHasEntitlement } from "@/features/entitlements/useHasEntitlement";
import { UpsellDialog } from "@/features/billing/upsellDialog";
import type { AskCommandDefinition, CommandMentionData } from "@/features/chat/commands/types";
import { shouldUsePlainComposerEnterBehavior } from "./keyboard";
import { SourceLabelBadge } from "./sourceLabelBadge";

export interface ChatBoxHandle {
    addFiles: (files: File[]) => void;
}

// Only inline-text attachments survive the login/upgrade redirect: image blobs
// require an authenticated, entitled upload, so a redirected sender can't have
// one, and a stashed blob ref would only fail to commit on re-submit.
const getRedirectSafeAttachments = (attachments: PendingAttachment[]): AttachmentData[] => {
    return attachments
        .map(toAttachmentData)
        .filter((attachment): attachment is AttachmentData => attachment?.kind === 'text');
}

interface ChatBoxProps {
    onSubmit: (children: Descendant[], editor: CustomEditor, attachments: AttachmentData[]) => void;
    onStop?: () => void;
    preferredSuggestionsBoxPlacement?: "top-start" | "bottom-start";
    className?: string;
    isRedirecting?: boolean;
    isTurnInProgress?: boolean;
    isNetworkActive?: boolean;
    isDisabled?: boolean;
    selectedSearchScopes: SearchScope[];
    searchContexts: SearchContextQuery[];
    askCommands: AskCommandDefinition[];
    isLoginWallEnabled: boolean;
    isAuthenticated: boolean;
    // Authoritative per-image byte cap from the server
    // (SOURCEBOT_CHAT_ATTACHMENT_MAX_IMAGE_BYTES), threaded down for early
    // client-side rejection. Defaults to the constant when not provided.
    maxImageBytes?: number;
}

const ChatBoxComponent = ({
    onSubmit: _onSubmit,
    onStop,
    preferredSuggestionsBoxPlacement = "bottom-start",
    className,
    isRedirecting,
    isTurnInProgress,
    isNetworkActive,
    isDisabled,
    isLoginWallEnabled,
    isAuthenticated,
    selectedSearchScopes,
    searchContexts,
    maxImageBytes = ATTACHMENT_MAX_IMAGE_BYTES,
    askCommands,
}: ChatBoxProps, ref: Ref<ChatBoxHandle>) => {
    const suggestionsBoxRef = useRef<HTMLDivElement>(null);
    const [index, setIndex] = useState(0);
    const editor = useSlate();
    const captureEvent = useCaptureEvent();
    const { suggestionQuery, suggestionMode, range } = useSuggestionModeAndQuery();
    const { suggestions, isLoading } = useSuggestionsData({
        suggestionMode,
        suggestionQuery,
        selectedRepos: selectedSearchScopes.map((item) => {
            if (item.type === 'repo') {
                return [item.value];
            }

            if (item.type === 'reposet') {
                const reposet = searchContexts.find((reposet) => reposet.name === item.value);
                if (reposet) {
                    return reposet.repoNames;
                }
            }

            return [];
        }).flat(),
        askCommands,
    });
    const { selectedLanguageModel } = useSelectedLanguageModel();
    const { toast } = useToast();
    const isMac = useIsMac();
    const isAskEnabled = useHasEntitlement('ask');
    const [isLoginDialogOpen, setIsLoginDialogOpen] = useState<boolean>(false);
    const [isUpsellDialogOpen, setIsUpsellDialogOpen] = useState<boolean>(false);
    const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
    const [submittedAttachments, setSubmittedAttachments] = useState<PendingAttachment[]>([]);
    const pathname = usePathname();

    // Whether the selected model can accept image input (from #1372). Image
    // attachments are gated on this; text attachments are always allowed.
    const supportsImages = useMemo(
        () => selectedLanguageModel?.inputModalities?.includes('image') ?? false,
        [selectedLanguageModel],
    );

    // Uploads an image attachment's bytes and reflects the outcome back into the
    // tray (status + server attachment id).
    const uploadAndTrackImage = useCallback(async (item: PendingImageAttachment) => {
        try {
            const result = await uploadImageAttachment(item.file);
            setAttachments((prev) => prev.map((attachment) =>
                attachment.id === item.id && attachment.kind === 'image'
                    ? {
                        ...attachment,
                        status: 'uploaded',
                        attachmentId: result.attachmentId,
                        mediaType: result.mediaType,
                        sizeBytes: result.sizeBytes,
                    }
                    : attachment));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'upload failed.';
            setAttachments((prev) => prev.map((attachment) =>
                attachment.id === item.id && attachment.kind === 'image'
                    ? { ...attachment, status: 'error', error: message }
                    : attachment));
            toast({
                description: `⚠️ ${item.filename}: ${message}`,
                variant: "destructive",
            });
        }
    }, [toast]);

    // Set when the user triggers a paste with the OS raw-paste chord
    // (⌘⇧V / Ctrl+Shift+V). The subsequent `paste` event reads (and clears)
    // this so the large-paste auto-conversion is skipped for that one paste.
    const rawPasteRequestedRef = useRef<boolean>(false);

    // Warning shown when prompt text + `nextAttachments` would exceed the per-turn
    // budget, so an over-budget add surfaces immediately instead of just disabling submit.
    const getOverBudgetWarning = useCallback((nextAttachments: PendingAttachment[]): string | null => {
        const totalBytes = getSubmittedTextBytes(slateContentToString(editor.children), nextAttachments);
        if (totalBytes <= ATTACHMENT_MAX_TURN_TEXT_BYTES) {
            return null;
        }
        return `Attachments exceed the ${Math.round(ATTACHMENT_MAX_TURN_TEXT_BYTES / 1024)}KB per-message limit. Remove a file or shorten your message to send.`;
    }, [editor]);

    const onAddPastedText = useCallback((text: string) => {
        const attachment = createPastedTextAttachment(text, attachments);
        setAttachments((prev) => [...prev, attachment]);

        const overBudgetWarning = getOverBudgetWarning([...attachments, attachment]);
        if (overBudgetWarning) {
            toast({
                description: `⚠️ ${overBudgetWarning}`,
                variant: "destructive",
            });
        } else {
            toast({
                title: "Large paste added as an attachment",
                duration: 5 * 1000,
                className: "w-fit ml-auto",
                description: `Use ${isMac ? "⌘+⇧+V" : "Ctrl+Shift+V"} to paste inline instead`,
            });
        }

        ReactEditor.focus(editor);
    }, [attachments, editor, toast, isMac, getOverBudgetWarning]);

    const onAddFiles = useCallback(async (files: File[]) => {
        if (files.length === 0) {
            return;
        }

        const { attachments: added, errors } = await readFilesAsAttachments(
            files,
            {
                allowImages: supportsImages,
                existingImageCount: attachments.filter((attachment) => attachment.kind === 'image').length,
                maxImageBytes,
            },
        );
        if (added.length > 0) {
            setAttachments((prev) => [...prev, ...added]);
        }

        const overBudgetWarning = added.length > 0 ? getOverBudgetWarning([...attachments, ...added]) : null;
        const messages = [...errors, ...(overBudgetWarning ? [overBudgetWarning] : [])];
        if (messages.length > 0) {
            toast({
                description: `⚠️ ${messages.join(' ')}`,
                variant: "destructive",
            });
        }

        // Upload image attachments immediately (upload-on-select); their refs
        // are included at submit once the upload completes.
        for (const item of added) {
            if (item.kind === 'image') {
                void uploadAndTrackImage(item);
            }
        }

        // Return focus to the prompt input so the user can keep typing.
        ReactEditor.focus(editor);
    }, [attachments, toast, editor, supportsImages, uploadAndTrackImage, getOverBudgetWarning, maxImageBytes]);

    const removeAttachment = useCallback((id: string) => {
        setAttachments((prev) => {
            const target = prev.find((attachment) => attachment.id === id);
            if (target?.kind === 'image') {
                URL.revokeObjectURL(target.previewUrl);
            }
            return prev.filter((attachment) => attachment.id !== id);
        });
    }, []);

    // Track the set of live image preview object URLs (pending or
    // just-submitted) so they can be revoked when the chat box unmounts,
    // preventing leaks across SPA navigations.
    const liveObjectUrlsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        const urls = new Set<string>();
        for (const attachment of [...attachments, ...submittedAttachments]) {
            if (attachment.kind === 'image') {
                urls.add(attachment.previewUrl);
            }
        }
        liveObjectUrlsRef.current = urls;
    }, [attachments, submittedAttachments]);
    useEffect(() => {
        return () => {
            for (const url of liveObjectUrlsRef.current) {
                URL.revokeObjectURL(url);
            }
        };
    }, []);

    // Allow an ancestor pane-level drop zone to forward dropped files into this
    // chat box (which owns attachment state). See `ChatPaneDropzone`.
    useImperativeHandle(ref, () => ({
        addFiles: (files: File[]) => {
            void onAddFiles(files);
        },
    }), [onAddFiles]);

    // Reset the index when the active suggestion set changes.
    useEffect(() => {
        setIndex(0);
    }, [suggestionMode, suggestionQuery]);

    // Hotkey to focus the chat box.
    useHotkeys("/", (e) => {
        if (ReactEditor.isFocused(editor)) {
            return;
        }

        e.preventDefault();
        ReactEditor.focus(editor);
    });

    // Auto-focus chat box when the component mounts.
    useEffect(() => {
        ReactEditor.focus(editor);
    }, [editor]);

    const renderElement = useCallback((props: RenderElementProps) => {
        switch (props.element.type) {
            case 'mention':
                return <MentionComponent {...props as RenderElementPropsFor<MentionElement>} />
            default:
                return <DefaultElement {...props} />
        }
    }, []);

    const renderLeaf = useCallback((props: RenderLeafProps) => {
        return <Leaf {...props} />
    }, []);

    const { isSubmitDisabled, isSubmitDisabledReason } = useMemo((): {
        isSubmitDisabled: true,
        isSubmitDisabledReason: "empty" | "too-large" | "redirecting" | "generating" | "no-language-model-selected" | "uploading" | "upload-error"
    } | {
        isSubmitDisabled: false,
        isSubmitDisabledReason: undefined,
    } => {
        const text = slateContentToString(editor.children);
        if (text.trim().length === 0 && attachments.length === 0) {
            return {
                isSubmitDisabled: true,
                isSubmitDisabledReason: "empty",
            }
        }

        // Single per-turn bound on the submitted inline text (prompt + text
        // attachments). Image bytes are uploaded as blobs and excluded here.
        if (getSubmittedTextBytes(text, attachments) > ATTACHMENT_MAX_TURN_TEXT_BYTES) {
            return {
                isSubmitDisabled: true,
                isSubmitDisabledReason: "too-large",
            }
        }

        // Block submission until in-flight image uploads finish so their refs
        // are available when the message is built.
        if (attachments.some((attachment) => attachment.kind === 'image' && attachment.status === 'uploading')) {
            return {
                isSubmitDisabled: true,
                isSubmitDisabledReason: "uploading",
            }
        }

        // A failed or ref-less image is dropped from `attachmentData` at submit,
        // so block (rather than silently sending without it) until it's removed.
        if (attachments.some((attachment) =>
            attachment.kind === 'image' &&
            (attachment.status === 'error' || !attachment.attachmentId)
        )) {
            return {
                isSubmitDisabled: true,
                isSubmitDisabledReason: "upload-error",
            }
        }

        if (isRedirecting) {
            return {
                isSubmitDisabled: true,
                isSubmitDisabledReason: "redirecting",
            }
        }

        if (isTurnInProgress) {
            return {
                isSubmitDisabled: true,
                isSubmitDisabledReason: "generating",
            }
        }

        if (selectedLanguageModel === undefined) {

            return {
                isSubmitDisabled: true,
                isSubmitDisabledReason: "no-language-model-selected",
            }
        }

        return {
            isSubmitDisabled: false,
            isSubmitDisabledReason: undefined,
        }

    }, [editor.children, isRedirecting, isTurnInProgress, selectedLanguageModel, attachments])

    const {
        requiresLogin,
        requiresUpgrade
    } = useMemo(() => ({
        requiresLogin: isLoginWallEnabled && !isAuthenticated,
        requiresUpgrade: !isAskEnabled,
    }), [
        isAuthenticated,
        isLoginWallEnabled,
        isAskEnabled
    ])

    const onSubmit = useCallback(() => {
        if (isSubmitDisabled) {
            if (isSubmitDisabledReason === "no-language-model-selected") {
                toast({
                    description: "⚠️ You must select a language model",
                    variant: "destructive",
                });
            } else if (isSubmitDisabledReason === "too-large") {
                toast({
                    description: `⚠️ Message and attachments exceed the ${Math.round(ATTACHMENT_MAX_TURN_TEXT_BYTES / 1024)}KB per-message limit. Remove a file or shorten the text.`,
                    variant: "destructive",
                });
            }

            if (isSubmitDisabledReason === "uploading") {
                toast({
                    description: "⚠️ Please wait for image uploads to finish",
                    variant: "destructive",
                });
            }

            if (isSubmitDisabledReason === "upload-error") {
                toast({
                    description: "⚠️ Remove failed image uploads before sending",
                    variant: "destructive",
                });
            }

            return;
        }

        if (requiresLogin) {
            sessionStorage.setItem(
                PENDING_CHAT_SUBMISSION_SESSION_STORAGE_KEY,
                JSON.stringify({ pathname, children: editor.children, attachments: getRedirectSafeAttachments(attachments) }),
            );
            captureEvent('wa_askgh_login_wall_prompted', {});
            setIsLoginDialogOpen(true);
            return;
        }

        if (requiresUpgrade) {
            sessionStorage.setItem(
                PENDING_CHAT_SUBMISSION_SESSION_STORAGE_KEY,
                JSON.stringify({ pathname, children: editor.children, attachments: getRedirectSafeAttachments(attachments) }),
            );
            setIsUpsellDialogOpen(true);
            return;
        }

        const attachmentData = attachments
            .map(toAttachmentData)
            .filter((attachment): attachment is AttachmentData => attachment !== undefined);

        // The persisted message renders images from the serving route (the
        // uploader can read their own bytes pre-commit). The preview object URLs
        // are kept alive for the `submittedAttachments` redirect tray and revoked
        // on unmount (see the cleanup effect above).
        _onSubmit(editor.children, editor, attachmentData);
        // Replace the prior submitted batch, revoking its preview URLs so they
        // don't accumulate across repeated sends in a long-lived chat box.
        setSubmittedAttachments((prev) => {
            for (const attachment of prev) {
                if (attachment.kind === 'image') {
                    URL.revokeObjectURL(attachment.previewUrl);
                }
            }
            return attachments;
        });
        setAttachments([]);
    }, [
        isSubmitDisabled,
        requiresLogin,
        requiresUpgrade,
        _onSubmit,
        editor,
        isSubmitDisabledReason,
        toast,
        pathname,
        captureEvent,
        attachments
    ]);

    useEffect(() => {
        if (
            requiresLogin ||
            requiresUpgrade
        ) {
            return;
        }

        const stored = sessionStorage.getItem(PENDING_CHAT_SUBMISSION_SESSION_STORAGE_KEY);
        if (!stored) {
            return;
        }

        try {
            const { pathname: storedPathname, children, attachments: storedAttachments = [] } = JSON.parse(stored) as {
                pathname: string;
                children: Descendant[];
                attachments?: AttachmentData[];
            };
            if (storedPathname !== pathname) {
                return;
            }

            sessionStorage.removeItem(PENDING_CHAT_SUBMISSION_SESSION_STORAGE_KEY);
            _onSubmit(children, editor, storedAttachments);
        } catch (error) {
            console.error('Failed to restore pending chat submission:', error);
            sessionStorage.removeItem(PENDING_CHAT_SUBMISSION_SESSION_STORAGE_KEY);
        }
    }, [
        pathname,
        editor,
        _onSubmit,
        requiresLogin,
        requiresUpgrade,
        isSubmitDisabled
    ]);

    const onInsertSuggestion = useCallback((suggestion: Suggestion) => {
        switch (suggestion.type) {
            case 'file':
                insertMention(editor, {
                    type: 'file',
                    path: suggestion.path,
                    repo: suggestion.repo,
                    name: suggestion.name,
                    language: suggestion.language,
                    revision: suggestion.revision,
                }, range);
                break;
            case 'command':
                insertMention(editor, {
                    type: 'command',
                    commandId: suggestion.id,
                    sourceId: suggestion.sourceId,
                    slug: suggestion.slug,
                    name: suggestion.name,
                    sourceLabel: suggestion.sourceLabel,
                    argumentHint: suggestion.argumentHint,
                }, range);
                insertText(editor, ' ');
                break;
            case 'refine':
                insertText(editor, 'file:');
                break;
        }
        ReactEditor.focus(editor);
    }, [editor, range]);

    const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
        // Detect the OS raw-paste chord so the upcoming `paste` event can skip
        // the large-paste auto-conversion and insert inline instead.
        if (
            (event.key === 'v' || event.key === 'V') &&
            event.shiftKey &&
            (isMac ? event.metaKey : event.ctrlKey)
        ) {
            rawPasteRequestedRef.current = true;
        }

        if (shouldUsePlainComposerEnterBehavior(suggestionMode, suggestions.length)) {
            switch (event.key) {
                case 'Enter': {
                    if (event.shiftKey) {
                        break;
                    }

                    if (event.altKey) {
                        event.preventDefault();
                        editor.insertBreak();
                        break;
                    }

                    event.preventDefault();
                    onSubmit();
                    break;
                }
            }
        }
        else if (suggestions.length > 0) {
            switch (event.key) {
                case 'ArrowDown': {
                    event.preventDefault();
                    const prevIndex = index >= suggestions.length - 1 ? 0 : index + 1
                    setIndex(prevIndex)
                    break;
                }
                case 'ArrowUp': {
                    event.preventDefault();
                    const nextIndex = index <= 0 ? suggestions.length - 1 : index - 1
                    setIndex(nextIndex)
                    break;
                }
                case 'Tab':
                case 'Enter': {
                    event.preventDefault();
                    const suggestion = suggestions[index];
                    if (!suggestion) {
                        break;
                    }
                    onInsertSuggestion(suggestion);
                    break;
                }
                case 'Escape': {
                    event.preventDefault();
                    break;
                }
            }
        }
    }, [suggestionMode, suggestions, onSubmit, editor, index, onInsertSuggestion, isMac]);

    useEffect(() => {
        if (!range || !suggestionsBoxRef.current) {
            return;
        }

        const virtualElement: VirtualElement = {
            getBoundingClientRect: () => {
                if (!range) {
                    return new DOMRect();
                }

                return ReactEditor.toDOMRange(editor, range).getBoundingClientRect();
            }
        }

        computePosition(virtualElement, suggestionsBoxRef.current, {
            placement: preferredSuggestionsBoxPlacement,
            middleware: [
                offset(2),
                flip({
                    mainAxis: true,
                    crossAxis: false,
                    fallbackPlacements: ['top-start', 'bottom-start'],
                    padding: 20,
                }),
                shift({
                    padding: 5,
                })
            ]
        }).then(({ x, y }) => {
            if (suggestionsBoxRef.current) {
                suggestionsBoxRef.current.style.left = `${x}px`;
                suggestionsBoxRef.current.style.top = `${y}px`;
            }
        })
    }, [editor, index, range, preferredSuggestionsBoxPlacement]);

    return (
        <>
            <div
                className={cn("flex flex-col justify-between gap-0.5 w-full px-3 py-2", className)}
            >
                {(isRedirecting ? submittedAttachments : attachments).length > 0 && (
                    <AttachmentTray
                        attachments={isRedirecting ? submittedAttachments : attachments}
                        onRemove={isRedirecting ? undefined : removeAttachment}
                        className="mb-1.5"
                    />
                )}
                {attachments.some((attachment) => attachment.kind === 'image') && !supportsImages && (
                    <p className="mb-1.5 text-xs text-amber-600 dark:text-amber-500">
                        Images won&apos;t be sent: the selected model doesn&apos;t support image input.
                    </p>
                )}
                <Editable
                    className="w-full focus-visible:outline-none focus-visible:ring-0 bg-background text-base disabled:cursor-not-allowed disabled:opacity-50 md:text-sm max-h-64 overflow-y-auto"
                    placeholder="Ask a question about your code. @mention files or select search scopes to refine your query."
                    renderElement={renderElement}
                    renderLeaf={renderLeaf}
                    onKeyDown={onKeyDown}
                    readOnly={isDisabled}
                    onPaste={(event) => {
                        const clipboardData = event.clipboardData;
                        const files = clipboardData?.files ? Array.from(clipboardData.files) : [];
                        if (files.length > 0) {
                            event.preventDefault();
                            void onAddFiles(files);
                            return;
                        }

                        // A raw-paste chord (⌘⇧V / Ctrl+Shift+V) bypasses
                        // auto-conversion for this one paste. Consume the flag
                        // regardless so it never leaks into the next paste.
                        const rawPasteRequested = rawPasteRequestedRef.current;
                        rawPasteRequestedRef.current = false;
                        if (rawPasteRequested) {
                            return;
                        }

                        const text = clipboardData?.getData('text/plain') ?? '';
                        if (!shouldAutoConvertPaste(text)) {
                            return;
                        }

                        event.preventDefault();
                        onAddPastedText(text);
                    }}
                />
                <div className="flex flex-row items-center justify-end gap-1 z-10">
                    <AttachmentButton
                        onAddFiles={onAddFiles}
                        acceptImages={supportsImages}
                        disabled={isDisabled || isRedirecting || isTurnInProgress}
                    />
                    {isRedirecting ? (
                        <Button
                            variant="default"
                            disabled={true}
                            size="icon"
                            className="w-6 h-6"
                        >
                            <Loader2 className="w-4 h-4 animate-spin" />
                        </Button>
                    ) :
                        isNetworkActive ? (
                            <Button
                                variant="default"
                                size="sm"
                                className="h-8"
                                onClick={onStop}
                            >
                                <StopCircleIcon className="w-4 h-4" />
                                Stop
                            </Button>
                        ) : (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div
                                        onClick={() => {
                                            // @hack: When submission is disabled, we still want to issue
                                            // a warning to the user as to why the submission is disabled.
                                            // onSubmit on the Button will not be called because of the
                                            // disabled prop, hence the call here.
                                            if (isSubmitDisabled) {
                                                onSubmit();
                                            }
                                        }}
                                    >
                                        <Button
                                            variant={isSubmitDisabled ? "outline" : "default"}
                                            size="sm"
                                            className="w-6 h-6"
                                            onClick={onSubmit}
                                            disabled={isSubmitDisabled}
                                        >
                                            <ArrowUp className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TooltipTrigger>
                            </Tooltip>
                        )}
                </div>
                {suggestionMode !== "none" && (
                    <SuggestionBox
                        ref={suggestionsBoxRef}
                        selectedIndex={index}
                        onInsertSuggestion={onInsertSuggestion}
                        isLoading={isLoading}
                        suggestions={suggestions}
                    />
                )}
            </div>
            <LoginDialog
                isOpen={isLoginDialogOpen}
                onOpenChange={(open) => {
                    setIsLoginDialogOpen(open);
                    if (!open) {
                        sessionStorage.removeItem(PENDING_CHAT_SUBMISSION_SESSION_STORAGE_KEY);
                    }
                }}
            />
            <UpsellDialog
                open={isUpsellDialogOpen}
                onOpenChange={(open) => {
                    setIsUpsellDialogOpen(open);
                    if (!open) {
                        sessionStorage.removeItem(PENDING_CHAT_SUBMISSION_SESSION_STORAGE_KEY);
                    }
                }}
                source="chat_box"
                returnPath={pathname}
            />
        </>
    )
}

export const ChatBox = memo(forwardRef(ChatBoxComponent), isEqual);

const DefaultElement = (props: RenderElementProps) => {
    return <p {...props.attributes}>{props.children}</p>
}

const Leaf = (props: RenderLeafProps) => {
    return (
        <span
            {...props.attributes}
        >
            {props.children}
        </span>
    )
}

const MentionComponent = ({
    attributes,
    children,
    element: { data },
}: RenderElementPropsFor<MentionElement>) => {
    const selected = useSelected();
    const focused = useFocused();
    const isMac = useIsMac();

    if (data.type === 'file') {
        return (
            <MentionChip
                attributes={attributes}
                content={
                    <Fragment>
                        <VscodeFileIcon fileName={data.name} className="w-3 h-3 mr-1" />
                        {data.name}
                    </Fragment>
                }
                focused={focused}
                isMac={isMac}
                selected={selected}
                tooltipContent={
                    <span className="text-xs font-mono">
                        <span className="font-medium">{data.repo.split('/').pop()}</span>/{data.path}
                    </span>
                }
            >
                {children}
            </MentionChip>
        )
    }

    if (data.type === 'command') {
        return (
            <MentionChip
                attributes={attributes}
                content={
                    <span className="inline-flex items-center gap-1">
                        <span>{`/${data.slug}`}</span>
                        {data.sourceLabel && (
                            <SourceLabelBadge>{data.sourceLabel}</SourceLabelBadge>
                        )}
                    </span>
                }
                focused={focused}
                isMac={isMac}
                selected={selected}
                tooltipContent={<CommandMentionTooltip data={data} />}
            >
                {children}
            </MentionChip>
        )
    }

    return null;
}

const CommandMentionTooltip = ({ data }: { data: CommandMentionData }) => {
    const editor = useSlate();
    const rawArguments = data.argumentHint
        ? createCommandInvocationData(slateContentToString(editor.children), [data])?.rawArguments ?? ""
        : "";
    const tokenStates = data.argumentHint
        ? getArgumentHintTokenStates(data.argumentHint, rawArguments)
        : [];

    return (
        <span className="flex flex-col gap-1 text-xs">
            <span className="flex items-center gap-1.5">
                <span>{data.name}</span>
                {data.sourceLabel && (
                    <SourceLabelBadge>{data.sourceLabel}</SourceLabelBadge>
                )}
            </span>
            {tokenStates.length > 0 && (
                <span className="flex flex-wrap gap-1 font-mono">
                    {tokenStates.map(({ token, isFilled }, index) => (
                        <span
                            key={`${token}-${index}`}
                            className={cn(
                                isFilled ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                            )}
                        >
                            {token}
                        </span>
                    ))}
                </span>
            )}
        </span>
    );
};

interface MentionChipProps {
    attributes: RenderElementPropsFor<MentionElement>["attributes"];
    children: ReactNode;
    content: ReactNode;
    focused: boolean;
    isMac: boolean;
    selected: boolean;
    tooltipContent: ReactNode;
}

const MentionChip = ({
    attributes,
    children,
    content,
    focused,
    isMac,
    selected,
    tooltipContent,
}: MentionChipProps) => {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    {...attributes}
                    contentEditable={false}
                    className={cn(
                        "px-1.5 py-0.5 mr-1.5 mb-1 align-baseline inline-block rounded bg-muted text-xs font-mono",
                        {
                            "ring-2 ring-blue-300": selected && focused
                        }
                    )}
                >
                    <span contentEditable={false} className="flex flex-row items-center select-none">
                        {/* @see: https://github.com/ianstormtaylor/slate/issues/3490 */}
                        {isMac ? (
                            <Fragment>
                                {children}
                                {content}
                            </Fragment>
                        ) : (
                            <Fragment>
                                {content}
                                {children}
                            </Fragment>
                        )}
                    </span>
                </span>
            </TooltipTrigger>
            <TooltipContent>
                {tooltipContent}
            </TooltipContent>
        </Tooltip>
    )
}

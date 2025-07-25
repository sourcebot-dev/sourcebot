'use client';

import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { forwardRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { VscFiles } from "react-icons/vsc";
import { FileSuggestion, RefineSuggestion, Suggestion } from "./types";

interface SuggestionBoxProps {
    selectedIndex: number;
    onInsertSuggestion: (suggestion: Suggestion) => void;
    isLoading: boolean;
    suggestions: Suggestion[];
}

export const SuggestionBox = forwardRef<HTMLDivElement, SuggestionBoxProps>(({
    selectedIndex,
    onInsertSuggestion,
    isLoading,
    suggestions,
}, ref) => {

    return createPortal(
        <div
            ref={ref}
            className="absolute z-10 top-0 left-0 bg-background border rounded-md p-1 w-[500px] overflow-hidden text-ellipsis"
            data-cy="mentions-portal"
        >
            {isLoading ? (
                <div className="animate-pulse flex flex-col gap-2 px-1 py-0.5 w-full">
                    {
                        Array.from({ length: 10 }).map((_, index) => (
                            <Skeleton key={index} className="h-4 w-full" />
                        ))
                    }
                </div>
            ) :
                (suggestions.length === 0) ? (
                    <div className="flex flex-col gap-2 px-1 py-0.5 w-full">
                        <p className="text-sm text-muted-foreground">
                            No results found
                        </p>
                    </div>
                ) :
                    (
                        <div className="flex flex-col w-full">
                            {suggestions.map((suggestion, i) => (
                                <div
                                    key={i}
                                    className={cn("flex flex-row gap-2 w-full cursor-pointer rounded-md px-1 py-0.5 hover:bg-accent", {
                                        "bg-accent": i === selectedIndex,
                                    })}
                                    onClick={() => {
                                        onInsertSuggestion(suggestion);
                                    }}
                                >
                                    {
                                        suggestion.type === 'file' && (
                                            <FileSuggestionListItem file={suggestion} />
                                        )
                                    }
                                    {
                                        suggestion.type === 'refine' && (
                                            <RefineSuggestionListItem refine={suggestion} />
                                        )
                                    }
                                </div>
                            ))}
                        </div>
                    )}
        </div>,
        document.body
    )
});

SuggestionBox.displayName = 'SuggestionBox';


const FileSuggestionListItem = ({ file }: { file: FileSuggestion }) => {
    return (
        <>
            <VscodeFileIcon fileName={file.name} className="mt-1" />
            <div className="flex flex-col w-full">
                <span className="text-sm font-medium">
                    {file.name}
                </span>
                <span className="text-xs text-muted-foreground">
                    <span className="font-medium">{file.repo.split('/').pop()}</span>/{file.path}
                </span>
            </div>
        </>
    )
}

const RefineSuggestionListItem = ({ refine }: { refine: RefineSuggestion }) => {

    const Icon = useMemo(() => {
        switch (refine.targetSuggestionMode) {
            case 'file':
                return VscFiles;
        }
    }, [refine.targetSuggestionMode]);

    return (
        <>
            <Icon className="w-4 h-4 flex-shrink-0 mt-1" />
            <div className="flex flex-col w-full">
                <span className="text-sm font-medium">
                    {refine.name}
                </span>
                <span className="text-xs text-muted-foreground">
                    {refine.description}
                </span>
            </div>
        </>
    )
}

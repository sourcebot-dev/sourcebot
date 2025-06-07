'use client';

import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { BottomPanel } from "./components/bottomPanel";
import { AnimatedResizableHandle } from "@/components/ui/animatedResizableHandle";
import { BrowseStateProvider } from "./browseStateProvider";
import { FileTreePanel } from "@/features/fileTree/components/fileTreePanel";
import { TopBar } from "@/app/[domain]/components/topBar";
import { Separator } from '@/components/ui/separator';
import { useBrowseParams } from "./hooks/useBrowseParams";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useQuery } from "@tanstack/react-query";
import { unwrapServiceError } from "@/lib/utils";
import { getFiles } from "@/features/fileTree/actions";
import { useDomain } from "@/hooks/useDomain";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import Fuse from "fuse.js";

interface LayoutProps {
    children: React.ReactNode;
    params: {
        domain: string;
    }
}

export default function Layout({
    children: codePreviewPanel,
    params,
}: LayoutProps) {
    const { repoName, revisionName } = useBrowseParams();

    return (
        <BrowseStateProvider>
            <div className="flex flex-col h-screen">
                <div className='sticky top-0 left-0 right-0 z-10'>
                    <TopBar
                        defaultSearchQuery={`repo:${repoName}${revisionName ? ` rev:${revisionName}` : ''} `}
                        domain={params.domain}
                    />
                    <Separator />
                </div>
                <ResizablePanelGroup
                    direction="horizontal"
                >
                    <FileTreePanel order={1} />

                    <AnimatedResizableHandle />

                    <ResizablePanel
                        order={2}
                        minSize={10}
                        defaultSize={80}
                        id="code-preview-panel-container"
                    >
                        <ResizablePanelGroup
                            direction="vertical"
                        >
                            <ResizablePanel
                                order={1}
                                id="code-preview-panel"
                            >
                                {codePreviewPanel}
                            </ResizablePanel>
                            <AnimatedResizableHandle />
                            <BottomPanel
                                order={2}
                            />
                        </ResizablePanelGroup>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
            <FileSearchCommandDialog />
        </BrowseStateProvider>
    );
}


const FileSearchCommandDialog = () => {
    const { repoName, revisionName } = useBrowseParams();
    const domain = useDomain();

    const [isOpen, setIsOpen] = useState(false);
    const commandListRef = useRef<HTMLDivElement>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useHotkeys("mod+p", (event) => {
        event.preventDefault();
        setIsOpen((prev) => !prev);
    }, {
        enableOnFormTags: true,
        enableOnContentEditable: true,
        description: "Open File Search",
    });

    const { data: files, isLoading, isError } = useQuery({
        queryKey: ['files', repoName, revisionName, domain],
        queryFn: () => unwrapServiceError(getFiles({ repoName, revisionName: revisionName ?? 'HEAD' }, domain)),
        enabled: isOpen,
    });

    const fuse = useMemo(() => {
        return new Fuse(files ?? [], {
            keys: [
                {
                    name: 'path',
                    weight: 0.3,
                },
                {
                    name: 'name',
                    weight: 0.7,
                },
            ],
            threshold: 0.3,
            minMatchCharLength: 2,
            isCaseSensitive: false,
            includeMatches: true,
        });
    }, [files]);

    const filteredFiles = useMemo(() => {
        if (searchQuery.length === 0) {
            return files?.map((file) => ({
                file,
                matches: [],
            })) ?? [];
        }

        return fuse
            .search(searchQuery)
            .map((result) => {
                const { item, matches } = result;
                return {
                    file: item,
                    matches: matches!,
                }
            });
    }, [files, searchQuery, fuse]);

    // Scroll to the top of the list when the user types
    useEffect(() => {
        commandListRef.current?.scrollTo({
            top: 0,
        })
    }, [searchQuery]);

    const onOpenChange = useCallback(() => {
        setIsOpen(false);
        setSearchQuery('');
    }, []);

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onOpenChange}
        >
            <DialogContent
                className="overflow-hidden p-0 shadow-lg max-w-[90vw] sm:max-w-2xl"
            >
                <Command
                    shouldFilter={false}
                >
                    <CommandInput
                        placeholder="Search files..."
                        onValueChange={setSearchQuery}
                    />
                    {
                        isLoading ? (
                            <div>Loading...</div>
                        ) :
                            isError ? (
                                <CommandEmpty>Error loading files.</CommandEmpty>
                            ) : (
                                <CommandList ref={commandListRef}>
                                    {filteredFiles.map(({ file, matches }) => {
                                        const nameMatch = matches.find(m => m.key === 'name');
                                        const pathMatch = matches.find(m => m.key === 'path');
                                        
                                        return (
                                            <CommandItem
                                                key={file.path}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">
                                                        {nameMatch ? 
                                                            <HighlightedText text={file.name} indices={nameMatch.indices} /> :
                                                            file.name
                                                        }
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {pathMatch ? 
                                                            <HighlightedText text={file.path} indices={pathMatch.indices} /> :
                                                            file.path
                                                        }
                                                    </span>
                                                </div>
                                            </CommandItem>
                                        );
                                    })}
                                </CommandList>
                            )
                    }
                </Command>
            </DialogContent>
        </Dialog>
    )
}

interface HighlightedTextProps {
    text: string;
    indices: readonly [number, number][];
}

const HighlightedText = ({ text, indices }: HighlightedTextProps) => {
    if (!indices || indices.length === 0) {
        return <>{text}</>;
    }

    // Create an array of segments with their highlight status
    const segments: { text: string; highlighted: boolean }[] = [];
    let lastIndex = 0;

    // Sort indices by start position
    const sortedIndices = [...indices].sort((a, b) => a[0] - b[0]);

    sortedIndices.forEach(([start, end]) => {
        // Add non-highlighted text before this match
        if (start > lastIndex) {
            segments.push({
                text: text.slice(lastIndex, start),
                highlighted: false
            });
        }

        // Add highlighted text
        segments.push({
            text: text.slice(start, end + 1),
            highlighted: true
        });

        lastIndex = end + 1;
    });

    // Add remaining non-highlighted text
    if (lastIndex < text.length) {
        segments.push({
            text: text.slice(lastIndex),
            highlighted: false
        });
    }

    return (
        <>
            {segments.map((segment, index) => (
                segment.highlighted ? (
                    <span
                        key={index}
                        className="searchMatch-selected"
                    >
                        {segment.text}
                    </span>
                ) : (
                    <span key={index}>{segment.text}</span>
                )
            ))}
        </>
    );
};

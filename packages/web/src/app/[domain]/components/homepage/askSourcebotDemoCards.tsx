'use client';

import Image from "next/image";
import { Search, LibraryBigIcon, Code, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CardContent } from "@/components/ui/card";
import { ContextItem, RepoContextItem, SearchContextItem } from "@/features/chat/components/chatBox/contextSelector";
import { DemoExamples, DemoSearchExample, DemoSearchContextExample, DemoSearchContext } from "@/types";
import { cn, getCodeHostIcon } from "@/lib/utils";
import { RepositoryQuery, SearchContextQuery } from "@/lib/types";

interface AskSourcebotDemoCardsProps {
    demoExamples: DemoExamples;
    selectedItems: ContextItem[];
    setSelectedItems: (items: ContextItem[]) => void;
    searchContexts: SearchContextQuery[];
    repos: RepositoryQuery[];
}

export const AskSourcebotDemoCards = ({
    demoExamples,
    selectedItems,
    setSelectedItems,
    searchContexts,
    repos,
}: AskSourcebotDemoCardsProps) => {
    const handleExampleClick = (example: DemoSearchExample) => {
        if (example.url) {
            window.open(example.url, '_blank');
        }
    }

    const getContextIcon = (context: DemoSearchContext, size: number = 20) => {
        const sizeClass = size === 12 ? "h-3 w-3" : "h-5 w-5";
        
        if (context.type === "set") {
            return <LibraryBigIcon className={cn(sizeClass, "text-muted-foreground")} />;
        }
        
        if (context.codeHostType) {
            const codeHostIcon = getCodeHostIcon(context.codeHostType);
            if (codeHostIcon) {
                return (
                    <Image
                        src={codeHostIcon.src}
                        alt={`${context.codeHostType} icon`}
                        width={size}
                        height={size}
                        className={cn(sizeClass, codeHostIcon.className)}
                    />
                );
            }
        }
        
        return <Code className={cn(sizeClass, "text-muted-foreground")} />;
    }

    const handleContextClick = (demoSearchContexts: DemoSearchContext[], contextExample: DemoSearchContextExample) => {
        const context = demoSearchContexts.find((context) => context.id === contextExample.searchContext)
        if (!context) {
            console.error(`Search context ${contextExample.searchContext} not found on handleContextClick`);
            return;
        }

        if (context.type === "set") {
            const searchContext = searchContexts.find((item) => item.name === context.value);
            if (!searchContext) {
                console.error(`Search context ${context.value} not found on handleContextClick`);
                return;
            }
            
            const isSelected = selectedItems.some(
                (selected) => selected.type === 'context' && selected.value === context.value
            );
            const newSelectedItems = isSelected
                ? selectedItems.filter(
                    (selected) => !(selected.type === 'context' && selected.value === context.value)
                )
                : [...selectedItems, { type: 'context', value: context.value, name: context.displayName, repoCount: searchContext.repoNames.length } as SearchContextItem];

            setSelectedItems(newSelectedItems);
        } else {
            const repo = repos.find((repo) => repo.repoName === context.value);
            if (!repo) {
                console.error(`Repo ${context.value} not found on handleContextClick`);
                return;
            }

            const isSelected = selectedItems.some(
                (selected) => selected.type === 'repo' && selected.value === context.value
            );
            const newSelectedItems = isSelected
                ? selectedItems.filter(
                    (selected) => !(selected.type === 'repo' && selected.value === context.value)
                )
                : [...selectedItems, { type: 'repo', value: context.value, name: context.displayName, codeHostType: repo.codeHostType } as RepoContextItem];

            setSelectedItems(newSelectedItems);
        }
    }

    return (
        <div className="w-full mt-8 space-y-12 px-4 max-w-[1000px]">
            {/* Search Context Row */}
            <div className="space-y-4">
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Layers className="h-5 w-5 text-muted-foreground" />
                        <h3 className="text-lg font-semibold">Search Context</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Select the context you want to ask questions about</p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                    {demoExamples.searchContextExamples.map((contextExample) => {
                        const context = demoExamples.searchContexts.find((context) => context.id === contextExample.searchContext)
                        if (!context) {
                            console.error(`Search context ${contextExample.searchContext} not found on handleContextClick`);
                            return;
                        }

                        const isSelected = selectedItems.some(
                            (selected) => (selected.type === 'context' && selected.value === context.value) ||
                                (selected.type === 'repo' && selected.value === context.value)
                        );

                        const searchContext = searchContexts.find((item) => item.name === context.value);
                        const numRepos = searchContext ? searchContext.repoNames.length : undefined;
                        return (
                            <Card
                                key={context.value}
                                className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105 group w-full max-w-[280px] ${isSelected ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/50"
                                    }`}
                                onClick={() => handleContextClick(demoExamples.searchContexts, contextExample)}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={`flex-shrink-0 p-2 rounded-lg transition-transform group-hover:scale-105`}
                                        >
                                            {getContextIcon(context)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4
                                                    className={`font-medium text-sm transition-colors ${isSelected ? "text-primary" : "group-hover:text-primary"
                                                        }`}
                                                >
                                                    {context.displayName}
                                                </h4>
                                                {numRepos && (
                                                    <Badge className="text-[10px] px-1.5 py-0.5 h-4">
                                                        {numRepos} repos
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">{contextExample.description}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>

            {/* Example Searches Row */}
            <div className="space-y-4">
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Search className="h-5 w-5 text-muted-foreground" />
                        <h3 className="text-lg font-semibold">Community Ask Results</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Check out these featured ask results from the community</p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                    {demoExamples.searchExamples.map((example) => {
                        const searchContexts = demoExamples.searchContexts.filter((context) => example.searchContext.includes(context.id))
                        return (
                        <Card
                            key={example.url}
                            className="cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105 hover:border-primary/50 group w-full max-w-[350px]"
                            onClick={() => handleExampleClick(example)}
                        >
                            <CardContent className="p-4">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        {searchContexts.map((context) => (
                                            <Badge key={context.value} variant="secondary" className="text-[10px] px-1.5 py-0.5 h-4 flex items-center gap-1">
                                                {getContextIcon(context, 12)}
                                                {context.displayName}
                                            </Badge>
                                        ))}
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-2">
                                            {example.title}
                                        </h4>
                                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                                            {example.description}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )})}
                </div>
            </div>
        </div>
    );
}; 
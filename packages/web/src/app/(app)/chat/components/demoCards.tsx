'use client';

import { useState } from "react";
import Image from "next/image";
import { Search, LibraryBigIcon, Code, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CardContent } from "@/components/ui/card";
import { DemoExamples, DemoSearchExample, DemoSearchScope } from "@/types";
import { cn, getCodeHostIcon } from "@/lib/utils";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { SearchScopeInfoCard } from "@/features/chat/components/chatBox/searchScopeInfoCard";
import { CodeHostType } from "@sourcebot/db";

interface DemoCards {
    demoExamples: DemoExamples;
}

export const DemoCards = ({
    demoExamples,
}: DemoCards) => {
    const captureEvent = useCaptureEvent();
    const [selectedFilterSearchScope, setSelectedFilterSearchScope] = useState<number | null>(null);

    const handleExampleClick = (example: DemoSearchExample) => {
        captureEvent('wa_demo_search_example_card_pressed', {
            exampleTitle: example.title,
            exampleUrl: example.url || '',
        });

        if (example.url) {
            window.open(example.url, '_blank');
        }
    }

    const getSearchScopeIcon = (searchScope: DemoSearchScope, size: number = 20, isSelected: boolean = false) => {
        const sizeClass = size === 12 ? "h-3 w-3" : "h-5 w-5";
        const colorClass = isSelected ? "text-primary-foreground" : "text-muted-foreground";

        if (searchScope.type === "reposet") {
            return <LibraryBigIcon className={cn(sizeClass, colorClass)} />;
        }

        if (searchScope.codeHostType) {
            const codeHostIcon = getCodeHostIcon(searchScope.codeHostType as CodeHostType);
            // When selected, icons need to match the inverted badge colors
            // In light mode selected: light icon on dark bg (invert)
            // In dark mode selected: dark icon on light bg (no invert, override dark:invert)
            const selectedIconClass = isSelected
                ? "invert dark:invert-0"
                : codeHostIcon.className;

            return (
                <Image
                    src={codeHostIcon.src}
                    alt={`${searchScope.codeHostType} icon`}
                    width={size}
                    height={size}
                    className={cn(sizeClass, selectedIconClass)}
                />
            );
        }

        return <Code className={cn(sizeClass, colorClass)} />;
    }

    return (
        <div className="w-full mt-8 space-y-12 px-4 max-w-[1200px]">
            {/* Example Searches Row */}
            <div className="space-y-4">
                <div className="text-center mb-6">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <Search className="h-7 w-7 text-muted-foreground" />
                        <h3 className="text-2xl font-bold">Community Ask Results</h3>
                    </div>
                </div>

                {/* Search Scope Filter */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                    <div className="flex items-center gap-2 mr-2">
                        <div className="relative group">
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-none">
                                <SearchScopeInfoCard />
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-border"></div>
                            </div>
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Search Scope:</span>
                    </div>
                    <Badge
                        variant={selectedFilterSearchScope === null ? "default" : "secondary"}
                        className={`cursor-pointer transition-all duration-200 hover:shadow-sm ${selectedFilterSearchScope === null ? "bg-primary text-primary-foreground" : "hover:bg-secondary/80"
                            }`}
                        onClick={() => {
                            setSelectedFilterSearchScope(null);
                        }}
                    >
                        All
                    </Badge>
                    {demoExamples.searchScopes.map((searchScope) => (
                        <Badge
                            key={searchScope.id}
                            variant={selectedFilterSearchScope === searchScope.id ? "default" : "secondary"}
                            className={`cursor-pointer transition-all duration-200 hover:shadow-sm flex items-center gap-1 ${selectedFilterSearchScope === searchScope.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary/80"
                                }`}
                            onClick={() => {
                                setSelectedFilterSearchScope(searchScope.id);
                            }}
                        >
                            {getSearchScopeIcon(searchScope, 12, selectedFilterSearchScope === searchScope.id)}
                            {searchScope.displayName}
                        </Badge>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-fr">
                    {demoExamples.searchExamples
                        .filter((example) => {
                            if (selectedFilterSearchScope === null) return true;
                            return example.searchScopes.includes(selectedFilterSearchScope);
                        })
                        .map((example) => {
                            const searchScopes = demoExamples.searchScopes.filter((searchScope) => example.searchScopes.includes(searchScope.id))
                            return (
                                <Card
                                    key={example.url}
                                    className="cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105 hover:border-primary/50 group w-full h-full flex flex-col"
                                    onClick={() => handleExampleClick(example)}
                                >
                                    <CardContent className="p-4 flex-1 flex flex-col">
                                        <div className="space-y-3 flex flex-col h-full">
                                            <div className="flex items-center justify-between">
                                                {searchScopes.map((searchScope) => (
                                                    <Badge key={searchScope.value} variant="secondary" className="text-[10px] px-1.5 py-0.5 h-4 flex items-center gap-1">
                                                        {getSearchScopeIcon(searchScope, 12)}
                                                        {searchScope.displayName}
                                                    </Badge>
                                                ))}
                                            </div>
                                            <div className="space-y-1 flex-1">
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
                            )
                        })}
                </div>
            </div>
        </div>
    );
}; 
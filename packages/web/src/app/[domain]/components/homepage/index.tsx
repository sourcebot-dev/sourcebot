'use client';

import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { LanguageModelInfo } from "@/features/chat/types";
import { RepositoryQuery, SearchContextQuery } from "@/lib/types";
import { useHotkeys } from "react-hotkeys-hook";
import { AgenticSearch } from "./agenticSearch";
import { PreciseSearch } from "./preciseSearch";
import { SearchMode } from "./toolbar";
import { CustomSlateEditor } from "@/features/chat/customSlateEditor";
import { setSearchModeCookie } from "@/actions";
import { useCallback, useState } from "react";

interface HomepageProps {
    initialRepos: RepositoryQuery[];
    searchContexts: SearchContextQuery[];
    languageModels: LanguageModelInfo[];
    chatHistory: {
        id: string;
        createdAt: Date;
        name: string | null;
    }[];
    initialSearchMode: SearchMode;
}


export const Homepage = ({
    initialRepos,
    searchContexts,
    languageModels,
    chatHistory,
    initialSearchMode,
}: HomepageProps) => {
    const [searchMode, setSearchMode] = useState<SearchMode>(initialSearchMode);
    const isAgenticSearchEnabled = languageModels.length > 0;

    const onSearchModeChanged = useCallback(async (newMode: SearchMode) => {
        setSearchMode(newMode);
        await setSearchModeCookie(newMode);
    }, [setSearchMode]);

    useHotkeys("mod+i", (e) => {
        e.preventDefault();
        onSearchModeChanged("agentic");
    }, {
        enableOnFormTags: true,
        enableOnContentEditable: true,
        description: "Switch to agentic search",
    });

    useHotkeys("mod+p", (e) => {
        e.preventDefault();
        onSearchModeChanged("precise");
    }, {
        enableOnFormTags: true,
        enableOnContentEditable: true,
        description: "Switch to precise search",
    });

    return (
        <div className="flex flex-col justify-center items-center mt-8 mb-8 md:mt-18 w-full px-5">
            <div className="max-h-44 w-auto">
                <SourcebotLogo
                    className="h-18 md:h-40 w-auto"
                />
            </div>

            {searchMode === "precise" ? (
                <PreciseSearch
                    initialRepos={initialRepos}
                    searchModeSelectorProps={{
                        searchMode: "precise",
                        isAgenticSearchEnabled,
                        onSearchModeChange: onSearchModeChanged,
                    }}
                />
            ) : (
                <CustomSlateEditor>
                    <AgenticSearch
                        searchModeSelectorProps={{
                            searchMode: "agentic",
                            isAgenticSearchEnabled,
                            onSearchModeChange: onSearchModeChanged,
                        }}
                        languageModels={languageModels}
                        repos={initialRepos}
                        searchContexts={searchContexts}
                        chatHistory={chatHistory}
                    />
                </CustomSlateEditor>
            )}
        </div>
    )
}


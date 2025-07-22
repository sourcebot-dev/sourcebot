'use client';

import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { LanguageModelInfo } from "@/features/chat/types";
import { RepositoryQuery } from "@/lib/types";
import { useHotkeys } from "react-hotkeys-hook";
import { useLocalStorage } from "usehooks-ts";
import { AgenticSearch } from "./agenticSearch";
import { PreciseSearch } from "./preciseSearch";
import { SearchMode } from "./toolbar";
import { CustomSlateEditor } from "@/features/chat/customSlateEditor";

interface HomepageProps {
    initialRepos: RepositoryQuery[];
    languageModels: LanguageModelInfo[];
}


export const Homepage = ({
    initialRepos,
    languageModels,
}: HomepageProps) => {
    const [searchMode, setSearchMode] = useLocalStorage<SearchMode>("search-mode", "precise", { initializeWithValue: false });
    const isAgenticSearchEnabled = languageModels.length > 0;

    useHotkeys("mod+i", (e) => {
        e.preventDefault();
        setSearchMode("agentic");
    }, {
        enableOnFormTags: true,
        enableOnContentEditable: true,
        description: "Switch to agentic search",
    });

    useHotkeys("mod+p", (e) => {
        e.preventDefault();
        setSearchMode("precise");
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
                        onSearchModeChange: setSearchMode,
                    }}
                />
            ) : (
                <CustomSlateEditor>
                    <AgenticSearch
                        searchModeSelectorProps={{
                            searchMode: "agentic",
                            isAgenticSearchEnabled,
                            onSearchModeChange: setSearchMode,
                        }}
                        chatBoxToolbarProps={{
                            repos: initialRepos,
                            languageModels,
                        }}
                    />
                </CustomSlateEditor>
            )}
        </div>
    )
}


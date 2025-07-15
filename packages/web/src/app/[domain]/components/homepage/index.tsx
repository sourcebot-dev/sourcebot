'use client';

import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { ModelProviderInfo } from "@/features/chat/types";
import { RepositoryQuery } from "@/lib/types";
import { useHotkeys } from "react-hotkeys-hook";
import { useLocalStorage } from "usehooks-ts";
import { AgenticSearch } from "./agenticSearch";
import { PreciseSearch } from "./preciseSearch";
import { SearchMode } from "./toolbar";
import { CustomSlateEditor } from "@/features/chat/customSlateEditor";

interface HomepageProps {
    initialRepos: RepositoryQuery[];
    modelProviderInfo?: ModelProviderInfo;
}


export const Homepage = ({
    initialRepos,
    modelProviderInfo,
}: HomepageProps) => {
    const [searchMode, setSearchMode] = useLocalStorage<SearchMode>("search-mode", "precise", { initializeWithValue: false });

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
                    toolBarProps={{
                        searchMode: "precise",
                        isAgenticSearchEnabled: !!modelProviderInfo?.provider,
                        onSearchModeChange: setSearchMode,
                    }}
                />
            ) : (
                <CustomSlateEditor>
                    <AgenticSearch
                        toolBarProps={{
                            searchMode: "agentic",
                            isAgenticSearchEnabled: !!modelProviderInfo?.provider,
                            onSearchModeChange: setSearchMode,
                        }}
                        modelProviderInfo={modelProviderInfo}
                    />
                </CustomSlateEditor>
            )}
        </div>
    )
}


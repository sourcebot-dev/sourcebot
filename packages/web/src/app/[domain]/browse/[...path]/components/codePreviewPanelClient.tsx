'use client';

import { useState } from "react";
import { PureCodePreviewPanel } from "./pureCodePreviewPanel";
import { PureMarkDownPreviewPanel } from "./pureMarkDownPreviewPanel";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface CodePreviewPanelClientProps {
    path: string;
    repoName: string;
    revisionName: string;
    source: string;
    language: string;
}

export const CodePreviewPanelClient = ({
    source,
    language,
    path,
    repoName,
    revisionName,
}: CodePreviewPanelClientProps) => {
    const [viewMode, setViewMode] = useState<string>("preview");
    const isMarkdown = language.toLowerCase() === "gcc machine description" || language.toLowerCase() === "md" || path.toLocaleLowerCase().endsWith(".md") || path.toLocaleLowerCase().endsWith(".markdown");

    console.log({language,path,repoName,revisionName});
    return (
        <>
            {isMarkdown && (
                <>
                    <div className="p-2 border-b flex">
                        <ToggleGroup
                            type="single"
                            defaultValue="preview"
                            value={viewMode}
                            onValueChange={(value) => value && setViewMode(value)}
                        >
                            <ToggleGroupItem
                                value="preview"
                                aria-label="Preview"
                                className="w-fit px-4"
                            >
                                Preview
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="code"
                                aria-label="Code"
                                className="w-fit px-4"
                            >
                                Code
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                </>
            )}
            {isMarkdown && viewMode === "preview" ? (
                <PureMarkDownPreviewPanel source={source} repoName={repoName} revisionName={revisionName} />
            ) : (
                <PureCodePreviewPanel
                    source={source}
                    language={language}
                    repoName={repoName}
                    path={path}
                    revisionName={revisionName}
                />
            )}
        </>
    );
}

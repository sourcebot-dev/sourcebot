'use client';

import { useState } from "react";
import { PureCodePreviewPanel } from "./pureCodePreviewPanel";
import { PureMarkDownPreviewPanel } from "./pureMarkDownPreviewPanel";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface SourcePreviewPanelClientProps {
    path: string;
    repoName: string;
    revisionName: string;
    source: string;
    language: string;
    codeHostType: string;
    externalWebUrl?: string;
    domain: string;
}

export const SourcePreviewPanelClient = ({
    source,
    language,
    path,
    repoName,
    revisionName,
    codeHostType,
    externalWebUrl,
    domain,
}: SourcePreviewPanelClientProps) => {
    const [viewMode, setViewMode] = useState<string>("preview");
    const isMarkdown = language === 'Markdown';

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
                <PureMarkDownPreviewPanel
                    source={source}
                    repoName={repoName}
                    revisionName={revisionName}
                    codeHostType={codeHostType}
                    externalWebUrl={externalWebUrl}
                    domain={domain}
                    path={path}
                />
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

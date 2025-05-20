'use client';

import { ResizablePanel } from "@/components/ui/resizable";
import { useQuery } from "@tanstack/react-query";
import { useDomain } from "@/hooks/useDomain";
import escapeStringRegexp from "escape-string-regexp";
import { search } from "@/app/api/(client)/client";
import { base64Decode, isServiceError, unwrapServiceError } from "@/lib/utils";
import { rangeSchema, searchResponseSchema } from "@/features/search/schemas";
import { z } from "zod";
import { ScrollArea } from "@/components/ui/scroll-area";


interface BottomPanelProps {
    selectedSymbol: string | null;
    repoName: string;
}

export const BottomPanel = ({
    selectedSymbol,
    repoName,
}: BottomPanelProps) => {
    const domain = useDomain();

    const { data: references, isLoading } = useQuery({
        queryKey: ["references", selectedSymbol],
        queryFn: () => unwrapServiceError(getReferences(selectedSymbol!, repoName, domain)),
        enabled: !!selectedSymbol,
    });

    console.log(references);

    return (
        <ResizablePanel
            minSize={20}
            maxSize={30}
            collapsedSize={5}
            collapsible={true}
        >
            {!selectedSymbol ? (
                <p>No symbol selected</p>
            ) :
                isLoading ? (
                    <p>Loading...</p>
                ) :
                    (!references || isServiceError(references)) ? (
                        <p>Error loading references</p>
                    ) : (
                        <ScrollArea className="h-full">
                            {references.references.map((reference, index) => (
                                <div key={index}>
                                    <p>{reference.fileName}</p>
                                    <p>{base64Decode(reference.lineContent)}</p>
                                </div>
                            ))}
                        </ScrollArea>
                    )}
        </ResizablePanel>
    )
}

const referenceSchema = z.object({
    fileName: z.string(),
    lineContent: z.string(),
    repository: z.string(),
    repositoryId: z.number(),
    webUrl: z.string().optional(),
    language: z.string(),
    matchRange: rangeSchema,
});

type Reference = z.infer<typeof referenceSchema>;

const findReferencesResponseSchema = z.object({
    references: z.array(referenceSchema),
});

type FindReferencesResponse = z.infer<typeof findReferencesResponseSchema>;

// @todo: refactor this to a API route.
const getReferences = async (symbol: string, repoName: string, domain: string) => {
    const DEFAULT_MATCH_COUNT = 1000;

    const result = await search({
        query: `${symbol} repo:^${escapeStringRegexp(repoName)}$`,
        matches: DEFAULT_MATCH_COUNT,
        contextLines: 0,
    }, domain);

    if (isServiceError(result)) {
        return result;
    }

    const parser = searchResponseSchema.transform(async ({ files }) => ({
        references: files.flatMap((file) => {
            const chunks = file.chunks;

            return chunks.flatMap((chunk) => {
                return chunk.matchRanges.map((range): Reference => ({
                    fileName: file.fileName.text,
                    lineContent: chunk.content,
                    repository: file.repository,
                    repositoryId: file.repositoryId,
                    webUrl: file.webUrl,
                    language: file.language,
                    matchRange: range,
                }))
            });
        })
    } satisfies FindReferencesResponse));

    return parser.parseAsync(result);
}

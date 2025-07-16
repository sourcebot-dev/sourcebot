'use client';

import { useMemo } from "react";
import { getAllMentionElements } from "./utils";
import { useSlate } from "slate-react";
import { RepoMentionData } from "./types";

export const useRepoMentions = (): RepoMentionData[] => {
    const editor = useSlate();

    return useMemo(() => {
        return getAllMentionElements(editor.children)
            .map((mention) => {
                if (mention.data.type !== 'repo') {
                    return undefined;
                }
                return mention.data;
            })
            .filter((mention) => mention !== undefined)
            .filter((mention, index, self) => {
                return index === self.findIndex((m) => m.name === mention.name);
            });
    }, [editor.children]);
}
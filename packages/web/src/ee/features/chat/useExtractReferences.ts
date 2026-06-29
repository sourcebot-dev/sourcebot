'use client';

import { useMemo } from "react";
import { Reference } from "@/features/chat/types";
import { ATTACHMENT_REFERENCE_REGEX, FILE_REFERENCE_REGEX } from "@/features/chat/constants";
import { createAttachmentReference, createFileReference } from "@/features/chat/utils";
import { TextUIPart } from "ai";

export const useExtractReferences = (part?: TextUIPart): Reference[] => {
    return useMemo(() => {
        if (!part) {
            return [];
        }

        const references: Reference[] = [];
        const content = part.text ?? '';

        FILE_REFERENCE_REGEX.lastIndex = 0;
        let fileMatch;
        while ((fileMatch = FILE_REFERENCE_REGEX.exec(content)) !== null) {
            const [_, repo, fileName, startLine, endLine] = fileMatch;
            references.push(createFileReference({ repo, path: fileName, startLine, endLine }));
        }

        ATTACHMENT_REFERENCE_REGEX.lastIndex = 0;
        let attachmentMatch;
        while ((attachmentMatch = ATTACHMENT_REFERENCE_REGEX.exec(content)) !== null) {
            const [_, attachmentId, startLine, endLine] = attachmentMatch;
            references.push(createAttachmentReference({ attachmentId, startLine, endLine }));
        }

        return references;
    }, [part]);
};

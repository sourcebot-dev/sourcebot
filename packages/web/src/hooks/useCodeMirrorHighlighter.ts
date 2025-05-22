'use client';

import { useMemo } from "react";
import { tags as t, tagHighlighter } from '@lezer/highlight';

export const useCodeMirrorHighlighter = () => {
    return useMemo(() => {
        return tagHighlighter([
            { tag: t.comment, class: 'text-editor-tag-comment' },
            { tag: t.keyword, class: 'text-editor-tag-keyword' },
            { tag: [ t.definition(t.variableName) ], class: 'text-editor-tag-variable-definition' },
            { tag: [ t.definition(t.propertyName) ], class: 'text-editor-tag-property-definition' },
            { tag: t.link, class: 'underline' },
            { tag: t.strikethrough, class: 'line-through' },
            { tag: t.emphasis, class: 'italic' },
            { tag: [ t.heading, t.strong ], class: 'font-bold' },
            { tag: t.invalid, class: 'text-white' }
        ]);
    }, []);
}

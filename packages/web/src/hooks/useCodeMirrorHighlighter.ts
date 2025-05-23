'use client';

import { useMemo } from "react";
import { tags as t, tagHighlighter } from '@lezer/highlight';

export const useCodeMirrorHighlighter = () => {
    return useMemo(() => {
        return tagHighlighter([
            // Keywords (if, for, class, etc.)
            { tag: t.keyword, class: 'text-editor-tag-keyword' },

            // Names, identifiers, properties
            { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName, t.variableName], class: 'text-editor-tag-name' },

            // Functions and variable definitions
            { tag: [t.function(t.variableName), t.definition(t.variableName)], class: 'text-editor-tag-function' },
            { tag: t.local(t.variableName), class: 'text-editor-tag-variable-local' },

            // Property definitions
            { tag: [t.definition(t.name), t.separator, t.definition(t.propertyName)], class: 'text-editor-tag-definition' },

            // Labels
            { tag: [t.labelName], class: 'text-editor-tag-label' },

            // Constants and standards
            { tag: [t.color, t.constant(t.name), t.standard(t.name)], class: 'text-editor-tag-constant' },

            // Braces and brackets
            { tag: [t.brace], class: 'text-editor-tag-brace' },
            { tag: [t.squareBracket], class: 'text-editor-tag-bracket-square' },
            { tag: [t.angleBracket], class: 'text-editor-tag-bracket-angle' },

            // Types and classes
            { tag: [t.typeName, t.namespace], class: 'text-editor-tag-type' },
            { tag: [t.className], class: 'text-editor-tag-tag' },

            // Numbers and annotations
            { tag: [t.number, t.changed, t.modifier, t.self], class: 'text-editor-tag-number' },
            { tag: [t.annotation], class: 'text-editor-tag-annotation-special' },

            // Operators
            { tag: [t.operator, t.operatorKeyword], class: 'text-editor-tag-operator' },

            // HTML/XML tags and attributes
            { tag: [t.tagName], class: 'text-editor-tag-tag' },
            { tag: [t.attributeName], class: 'text-editor-tag-attribute' },

            // Strings and quotes
            { tag: [t.string], class: 'text-editor-tag-string' },
            { tag: [t.quote], class: 'text-editor-tag-quote' },
            { tag: [t.processingInstruction, t.inserted], class: 'text-editor-tag-processing' },

            // Special string content
            { tag: [t.url, t.escape, t.special(t.string)], class: 'text-editor-tag-string' },
            { tag: [t.regexp], class: 'text-editor-tag-constant' },

            // Links
            {
                tag: t.link,
                class: 'text-editor-tag-link underline',
            },

            // Meta and comments
            { tag: [t.meta], class: 'text-editor-tag-meta' },
            { tag: [t.comment], class: 'text-editor-tag-comment italic' },

            // Text formatting
            { tag: t.strong, class: 'text-editor-tag-emphasis font-bold' },
            { tag: t.emphasis, class: 'text-editor-tag-emphasis italic' },
            { tag: t.strikethrough, class: 'text-editor-tag-emphasis line-through' },

            // Headings
            { tag: t.heading, class: 'text-editor-tag-heading font-bold' },
            { tag: t.special(t.heading1), class: 'text-editor-tag-heading font-bold' },
            { tag: t.heading1, class: 'text-editor-tag-heading font-bold' },
            { tag: [t.heading2, t.heading3, t.heading4], class: 'text-editor-tag-heading font-bold' },
            { tag: [t.heading5, t.heading6], class: 'text-editor-tag-heading' },

            // Atoms and booleans
            { tag: [t.atom, t.bool, t.special(t.variableName)], class: 'text-editor-tag-atom' },

            // Content separator
            { tag: [t.contentSeparator], class: 'text-editor-tag-separator' },

            // Invalid syntax
            { tag: t.invalid, class: 'text-editor-tag-invalid' }
        ]);
    }, []);
}

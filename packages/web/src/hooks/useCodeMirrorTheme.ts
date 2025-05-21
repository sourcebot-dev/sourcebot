'use client';

import { useTailwind } from "./useTailwind";
import { useMemo } from "react";
import { useThemeNormalized } from "./useThemeNormalized";
import createTheme from "@uiw/codemirror-themes";
import { defaultLightThemeOption } from "@uiw/react-codemirror";
import { tags as t } from '@lezer/highlight';
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { defaultHighlightStyle } from "@codemirror/language";

// From: https://github.com/codemirror/theme-one-dark/blob/main/src/one-dark.ts
const chalky = "#e5c07b",
    coral = "#e06c75",
    cyan = "#56b6c2",
    invalid = "#ffffff",
    ivory = "#abb2bf",
    stone = "#7d8799",
    malibu = "#61afef",
    sage = "#98c379",
    whiskey = "#d19a66",
    violet = "#c678dd",
    highlightBackground = "#2c313aaa",
    background = "#282c34",
    selection = "#3E4451",
    cursor = "#528bff";


const darkHighlightStyles = [
    { tag: t.comment, color: stone },
    { tag: t.keyword, color: violet },
    { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: coral },
    { tag: [t.function(t.variableName), t.labelName], color: malibu },
    { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: whiskey },
    { tag: [t.definition(t.name), t.separator], color: ivory },
    { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: chalky },
    { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: cyan },
    { tag: [t.meta], color: stone },
    { tag: t.strong, fontWeight: 'bold' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: t.link, color: stone, textDecoration: 'underline' },
    { tag: t.heading, fontWeight: 'bold', color: coral },
    { tag: [t.atom, t.bool, t.special(t.variableName)], color: whiskey },
    { tag: [t.processingInstruction, t.string, t.inserted], color: sage },
    { tag: t.invalid, color: invalid }
]

export const darkHighlightStyle = HighlightStyle.define(darkHighlightStyles, {
    themeType: 'dark',
});

export const lightHighlightStyle = defaultHighlightStyle;


export const useCodeMirrorTheme = () => {
    const tailwind = useTailwind();
    const { theme } = useThemeNormalized();

    const darkTheme = useMemo(() => {
        return createTheme({
            theme: 'dark',
            settings: {
                background: tailwind.theme.colors.background,
                foreground: ivory,
                caret: cursor,
                selection: selection,
                selectionMatch: "#aafe661a", // for matching selections
                gutterBackground: background,
                gutterForeground: stone,
                gutterBorder: 'none',
                gutterActiveForeground: ivory,
                lineHighlight: highlightBackground,
            },
            styles: darkHighlightStyles,
        });
    }, [tailwind.theme.colors.background]);

    const cmTheme = useMemo(() => {
        return theme === 'dark' ? darkTheme : [
            defaultLightThemeOption,
            syntaxHighlighting(lightHighlightStyle),
        ]
    }, [theme, darkTheme]);

    return cmTheme;
}
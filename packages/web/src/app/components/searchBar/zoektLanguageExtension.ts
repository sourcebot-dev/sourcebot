import { LanguageSupport, StreamLanguage } from "@codemirror/language";
import { tags as t } from '@lezer/highlight';

const zoektLanguage = StreamLanguage.define({
    token: (stream) => {
        if (stream.match(/-?(file|branch|revision|rev|case|repo|lang|content|sym|archived|fork|public):/)) {
            return t.keyword.toString();
        }

        if (stream.match(/\bor\b/)) {
            return t.keyword.toString();
        }

        if (stream.match(/(\(|\))/)) {
            return t.paren.toString();
        }

        stream.next();
        return null;
    },
});

export const zoekt = () => {
    return new LanguageSupport(zoektLanguage);
}
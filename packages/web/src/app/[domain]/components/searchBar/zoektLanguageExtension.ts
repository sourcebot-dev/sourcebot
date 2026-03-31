import { LRLanguage, LanguageSupport } from "@codemirror/language";
import { parser } from "@sourcebot/query-language";

const zoektLanguage = LRLanguage.define({
    name: "zoekt",
    parser,
});

export const zoekt = () => {
    return new LanguageSupport(zoektLanguage);
}

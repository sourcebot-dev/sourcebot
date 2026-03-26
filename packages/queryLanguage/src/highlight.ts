import { styleTags, tags as t } from "@lezer/highlight";

export const highlight = styleTags({
    FilterKeyword: t.keyword,
    QuotedTerm: t.quote,
    Term: t.invalid,
    NegateExpr: t.operator,
    OrExpr: t.keyword,
});
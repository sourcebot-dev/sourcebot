/**
 * Wraps a value in quotes if it contains parentheses and isn't already quoted.
 * 
 * This is needed because the query language does not allow values to include parenthesis unless they're quoted. This is 
 * due to the ParenExpr symbol which parses on these parenthesis. We instruct the agent to wrap the regexp in quotes
 * but it's flaky, so we due it here as well as a backup plan to ensure the parser doesn't fail.
 */
export const preprocessRegexp = (value: string): string => {
    const hasParentheses = value.includes('(') || value.includes(')');
    const isAlreadyQuoted = value.startsWith('"') && value.endsWith('"');
    if (hasParentheses && !isAlreadyQuoted) {
        return `"${value}"`;
    }
    return value;
};

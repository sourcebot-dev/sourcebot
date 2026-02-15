import { ExternalTokenizer, InputStream, Stack } from "@lezer/lr";
import { negate, openParen, closeParen, word, or, ParenExpr } from "./parser.terms";

// Character codes
const SPACE = 32;
const TAB = 9;
const NEWLINE = 10;
const QUOTE = 34;
const OPEN_PAREN = 40;
const CLOSE_PAREN = 41;
const DASH = 45;
const COLON = 58;
const EOF = -1;

// Prefix keywords that should not be consumed as words
const PREFIXES = [
    "archived:",
    "rev:",
    "content:", "c:",
    "context:",
    "file:", "f:",
    "fork:",
    "visibility:",
    "repo:", "r:",
    "author:", "a:",
    "lang:",
    "sym:",
    "reposet:",
];

function isWhitespace(ch: number): boolean {
    return ch === SPACE || ch === TAB || ch === NEWLINE;
}

function isAlphaNumUnderscore(ch: number): boolean {
    return (ch >= 65 && ch <= 90) ||  // A-Z
           (ch >= 97 && ch <= 122) || // a-z
           (ch >= 48 && ch <= 57) ||  // 0-9
           ch === 95;                  // _
}

/**
 * Checks if the input at current position matches the given string.
 */
function matchesString(input: InputStream, str: string): boolean {
    for (let i = 0; i < str.length; i++) {
        if (input.peek(i) !== str.charCodeAt(i)) {
            return false;
        }
    }
    return true;
}

/**
 * Checks if current position starts with "or" that will be recognized as the OR operator.
 * This matches the logic in orToken - only returns true if "or" is NOT at start,
 * is followed by non-alphanumeric, AND there's actual content after it (not EOF).
 */
function isOrKeyword(input: InputStream): boolean {
    if (input.peek(0) !== 111 /* 'o' */ || input.peek(1) !== 114 /* 'r' */) {
        return false;
    }

    // Don't match "or" at the start of input
    if (input.pos === 0) {
        return false;
    }

    const afterOr = input.peek(2);

    // Must not be alphanumeric (to avoid matching "orange")
    if (isAlphaNumUnderscore(afterOr)) {
        return false;
    }

    // Must not be EOF (at EOF, "or" should be a word, not a keyword)
    if (afterOr === EOF) {
        return false;
    }

    // Check that what follows (after whitespace) is not EOF
    let offset = 2;
    while (isWhitespace(input.peek(offset))) {
        offset++;
    }
    if (input.peek(offset) === EOF) {
        return false;
    }

    // It's a valid OR keyword
    return true;
}

/**
 * Checks if current position starts with a prefix keyword.
 */
function startsWithPrefix(input: InputStream): boolean {
    for (const prefix of PREFIXES) {
        if (matchesString(input, prefix)) {
            return true;
        }
    }
    return false;
}

/**
 * Checks if a '(' at the given offset starts a balanced ParenExpr.
 * Uses peek() to avoid modifying stream position.
 * Returns true if we find a matching ')' that closes the initial '('.
 * Handles escaped characters (backslash followed by any character).
 */
function hasBalancedParensAt(input: InputStream, startOffset: number): boolean {
    if (input.peek(startOffset) !== OPEN_PAREN) {
        return false;
    }

    let offset = startOffset + 1;
    let depth = 1;

    while (true) {
        const ch = input.peek(offset);
        if (ch === EOF) break;

        // Handle escaped characters - skip the next character after a backslash
        if (ch === 92 /* backslash */) {
            offset += 2; // Skip backslash and the escaped character
            continue;
        }

        if (ch === OPEN_PAREN) {
            depth++;
        } else if (ch === CLOSE_PAREN) {
            depth--;
            if (depth === 0) {
                return true;
            }
        }
        offset++;
    }

    return false;
}

/**
 * Checks if we're currently inside a ParenExpr by looking backwards in the input
 * to count unmatched opening parens that likely started a ParenExpr.
 *
 * We only consider a '(' as a ParenExpr start if it's preceded by whitespace or
 * start-of-input, since "test()" has a '(' that's part of a word, not a ParenExpr.
 * Handles escaped characters (backslash followed by any character).
 */
function hasUnmatchedOpenParen(input: InputStream): boolean {
    // Count parens backwards from current position
    let depth = 0;
    let offset = -1;

    // Look backwards up to 1000 characters (reasonable limit)
    while (offset >= -1000) {
        const ch = input.peek(offset);
        if (ch === EOF) {
            // Reached start of input - if we have negative depth, there's an unmatched '('
            return depth < 0;
        }

        // Check if this character is escaped (preceded by backslash)
        // Note: we need to be careful about escaped backslashes (\\)
        // For simplicity, if we see a backslash immediately before, skip this char
        const prevCh = input.peek(offset - 1);
        if (prevCh === 92 /* backslash */) {
            // Check if the backslash itself is escaped
            const prevPrevCh = input.peek(offset - 2);
            if (prevPrevCh !== 92) {
                // Single backslash - this char is escaped, skip it
                offset--;
                continue;
            }
            // Double backslash - the backslash is escaped, so current char is not
        }

        if (ch === CLOSE_PAREN) {
            depth++;
        } else if (ch === OPEN_PAREN) {
            // Check what's before this '('
            const beforeParen = input.peek(offset - 1);

            // A '(' starts a ParenExpr if it's preceded by:
            // - EOF or whitespace (e.g., "(hello)" or "test (hello)")
            // - '-' for negation (e.g., "-(hello)")
            // - ':' for prefix values (e.g., "repo:(foo or bar)")
            const isDefinitelyParenExprStart =
                beforeParen === EOF ||
                isWhitespace(beforeParen) ||
                beforeParen === DASH ||
                beforeParen === COLON;

            // Special case: '(' preceded by '(' could be nested ParenExprs like "((hello))"
            // BUT it could also be part of a word like "test((nested))"
            // To distinguish: if prev is '(', check what's before THAT '('
            let isParenExprStart = isDefinitelyParenExprStart;
            if (!isParenExprStart && beforeParen === OPEN_PAREN) {
                // Check what's before the previous '('
                const prevPrevCh = input.peek(offset - 2);
                // Only count as ParenExpr if the preceding '(' is also at a token boundary
                isParenExprStart =
                    prevPrevCh === EOF ||
                    isWhitespace(prevPrevCh) ||
                    prevPrevCh === DASH ||
                    prevPrevCh === COLON;
            }

            if (isParenExprStart) {
                // This '(' likely started a ParenExpr
                depth--;
                if (depth < 0) {
                    // Found an unmatched opening paren that started a ParenExpr
                    return true;
                }
            }
            // If beforeParen is something else, this '(' is part of a word like "test()"
            // Don't count it in our depth tracking
        }
        offset--;
    }

    return false;
}

/**
 * Checks if the parser stack indicates we're currently inside a ParenExpr.
 */
function isInsideParenExpr(input: InputStream, stack: Stack): boolean {
    // First try the standard parser state check
    if (stack.canShift(closeParen)) {
        return true;
    }

    // If that fails, use a heuristic: look backwards for unmatched '('
    // This handles cases where the parser needs to reduce before shifting closeParen
    return hasUnmatchedOpenParen(input);
}

/**
 * External tokenizer for '(' - emits openParen only if there's a balanced ')'.
 * This allows words like "(pr" or "func(arg)" to be parsed as single terms
 * while "(foo bar)" is parsed as a ParenExpr.
 */
export const parenToken = new ExternalTokenizer((input) => {
    if (input.next !== OPEN_PAREN) return;
    
    if (hasBalancedParensAt(input, 0)) {
        // Found balanced parens - emit openParen (just the '(')
        input.advance();
        input.acceptToken(openParen);
    }
    // If unbalanced, don't emit anything - let wordToken handle it
});

/**
 * External tokenizer for ')' - emits closeParen when appropriate.
 * We emit closeParen if:
 * 1. The parser can immediately shift it (canShift returns true), OR
 * 2. We're likely inside a ParenExpr based on other heuristics
 */
export const closeParenToken = new ExternalTokenizer((input, stack) => {
    if (input.next !== CLOSE_PAREN) return;

    // Check if we should emit closeParen (when inside a ParenExpr)
    if (isInsideParenExpr(input, stack)) {
        input.advance();
        input.acceptToken(closeParen);
    }
    // Otherwise, don't emit - let wordToken handle ')' as part of a word
});

/**
 * External tokenizer for words - allows '(' and ')' when not part of a ParenExpr.
 * 
 * Rules:
 * - Don't match if starts with balanced '(' (let parenToken handle it)
 * - Don't match if starts with ')' and we're inside a ParenExpr (let closeParenToken handle it)
 * - Don't match if starts with valid quotedString
 * - Don't match if starts with "or" keyword
 * - Don't match if starts with a prefix keyword
 * - Otherwise, consume everything including '(' and ')' as part of the word
 *   (except stop at ')' when inside a ParenExpr)
 */
export const wordToken = new ExternalTokenizer((input, stack) => {
    // Can't start with whitespace or EOF
    if (isWhitespace(input.next) || input.next === EOF) {
        return;
    }
    
    // Check for valid quoted string (starts with " and has closing ")
    if (input.next === QUOTE) {
        // Look for closing quote
        let offset = 1;
        while (true) {
            const ch = input.peek(offset);
            if (ch === EOF || ch === NEWLINE) break; // Unclosed quote - treat as word
            if (ch === QUOTE) return; // Valid quoted string - let grammar handle it
            if (ch === 92 /* backslash */) offset++; // Skip escaped char
            offset++;
        }
        // Unclosed quote - fall through to treat as word
    }
    
    // Don't match 'or' keyword (followed by non-alphanumeric)
    if (isOrKeyword(input)) {
        return;
    }
    
    // Don't match prefix keywords
    if (startsWithPrefix(input)) {
        return;
    }
    
    // If starts with '(' and has balanced parens, don't consume as word
    // (let parenToken handle it)
    if (input.next === OPEN_PAREN && hasBalancedParensAt(input, 0)) {
        return;
    }
    
    const startPos = input.pos;

    // Consume characters
    while (input.next !== EOF) {
        const ch = input.next;

        // Stop at whitespace
        if (isWhitespace(ch)) break;

        // Stop at ')' if closeParenToken would handle it (when inside a ParenExpr)
        // This allows "(hello)" to work while "test)" becomes a single word
        if (ch === CLOSE_PAREN && isInsideParenExpr(input, stack)) {
            break;
        }

        // Don't stop at '(' in the middle - just consume it
        // (balanced paren check at START is handled above)

        input.advance();
    }
    
    if (input.pos > startPos) {
        input.acceptToken(word);
    }
});

/**
 * External tokenizer for 'or' keyword.
 * Only tokenizes "or" as the OR operator when:
 * 1. It's NOT at the start of input (to treat "or test" as a term)
 * 2. It's followed by a non-alphanumeric character (to avoid "orange")
 * 3. It's NOT at EOF (to treat "test or" as two terms, not an OR expression)
 */
export const orToken = new ExternalTokenizer((input) => {
    // Check if we're at "or"
    if (input.next !== 111 /* 'o' */) return;
    if (input.peek(1) !== 114 /* 'r' */) return;

    // Don't match "or" at the start of input (position 0)
    // "or test" should parse as a single term, not an OR expression
    if (input.pos === 0) return;

    // Check what follows "or"
    const afterOr = input.peek(2);

    // Must not be alphanumeric or underscore (to avoid matching "orange", "order", etc.)
    if (isAlphaNumUnderscore(afterOr)) return;

    // Must not be EOF (to treat "test or" as two terms)
    if (afterOr === EOF) return;

    // Also check that what follows (after skipping whitespace) is not EOF
    // This handles "test or   " (or followed by only whitespace)
    let offset = 2;
    while (isWhitespace(input.peek(offset))) {
        offset++;
    }
    if (input.peek(offset) === EOF) return;

    // Valid OR operator - emit it
    input.advance(); // 'o'
    input.advance(); // 'r'
    input.acceptToken(or);
});

/**
 * External tokenizer for negation.
 * Only tokenizes `-` as negate when followed by a prefix keyword or balanced `(`.
 */
export const negateToken = new ExternalTokenizer((input) => {
    if (input.next !== DASH) return;
    
    // Look ahead using peek to see what follows the dash (skipping whitespace)
    let offset = 1;
    while (isWhitespace(input.peek(offset))) {
        offset++;
    }
    
    const chAfterDash = input.peek(offset);
    
    // Check if followed by opening paren that starts a balanced ParenExpr
    if (chAfterDash === OPEN_PAREN && hasBalancedParensAt(input, offset)) {
        input.advance();
        input.acceptToken(negate);
        return;
    }
    
    // Check if followed by a prefix keyword (by checking for keyword followed by colon)
    let foundColon = false;
    let peekOffset = offset;
    
    while (true) {
        const ch = input.peek(peekOffset);
        if (ch === EOF) break;
        
        if (ch === COLON) {
            foundColon = true;
            break;
        }
        // Hit a delimiter (whitespace, paren, or quote) - not a prefix keyword
        if (isWhitespace(ch) || ch === OPEN_PAREN || ch === CLOSE_PAREN || ch === QUOTE) {
            break;
        }
        peekOffset++;
    }
    
    if (foundColon) {
        // It's a prefix keyword, accept as negate
        input.advance();
        input.acceptToken(negate);
        return;
    }
    
    // Otherwise, don't tokenize as negate (let word handle it)
});


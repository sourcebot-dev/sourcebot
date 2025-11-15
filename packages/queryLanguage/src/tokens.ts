import { ExternalTokenizer } from "@lezer/lr";
import { negate } from "./parser.terms";

// External tokenizer for negation
// Only tokenizes `-` as negate when followed by a prefix keyword or `(`
export const negateToken = new ExternalTokenizer((input, stack) => {
    if (input.next !== 45 /* '-' */) return; // Not a dash
    
    const startPos = input.pos;
    
    // Look ahead to see what follows the dash
    input.advance();
    
    // Skip whitespace
    let ch = input.next;
    while (ch === 32 || ch === 9 || ch === 10) {
        input.advance();
        ch = input.next;
    }
    
    // Check if followed by opening paren
    if (ch === 40 /* '(' */) {
        input.acceptToken(negate, -input.pos + startPos + 1); // Accept just the dash
        return;
    }
    
    // Check if followed by a prefix keyword (by checking for keyword followed by colon)
    // We need to look ahead to find the colon
    const checkPos = input.pos;
    let foundColon = false;
    let charCount = 0;
    
    // Look ahead up to 10 characters to find a colon
    while (charCount < 10 && ch >= 0) {
        if (ch === 58 /* ':' */) {
            foundColon = true;
            break;
        }
        if (ch === 32 || ch === 9 || ch === 10 || ch === 40 || ch === 41 || ch === 34) {
            // Hit whitespace, paren, or quote - not a prefix
            break;
        }
        input.advance();
        ch = input.next;
        charCount++;
    }
    
    // Reset position
    while (input.pos > checkPos) {
        input.advance(-1);
    }
    
    if (foundColon) {
        // It's a prefix keyword, accept as negate
        input.acceptToken(negate, -input.pos + startPos + 1);
        return;
    }
    
    // Otherwise, don't tokenize as negate (let word handle it)
});

